// CRITICAL: Net Salary = Base + Overtime + Bonuses - Deductions


import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import { payrollCreateSchema, formatValidationErrors } from "@/lib/validations";
import { PayrollStatus, Prisma } from "@prisma/client";


// GET /api/hr/payroll - List payrolls with filtering


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Filter parameters
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status") as PayrollStatus | null;
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.PayrollWhereInput = {};
    
    if (employeeId) {
      where.employeeId = employeeId;
    }
    
    if (status) {
      where.status = status;
    }
    
    // Date range filter
    if (periodStart || periodEnd) {
      where.periodStart = {};
      if (periodStart) {
        where.periodStart.gte = new Date(periodStart);
      }
    }
    if (periodEnd) {
      where.periodEnd = {};
      if (periodStart) {
        where.periodEnd.lte = new Date(periodEnd);
      }
    }

    // Execute query with pagination
    const [payrolls, total] = await Promise.all([
      db.payroll.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              fullName: true,
              department: true,
              position: true,
              bankAccount: true,
            },
          },
        },
        orderBy: [
          { periodStart: "desc" },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      }),
      db.payroll.count({ where }),
    ]);

    // Calculate summary statistics
    const summary = await calculatePayrollSummary(where);

    return NextResponse.json({
      data: payrolls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    });
  } catch (error) {
    console.error("Error fetching payrolls:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des fiches de paie" },
      { status: 500 }
    );
  }
}


// POST /api/hr/payroll - Generate payroll for a period


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = payrollCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Données invalides", 
          details: formatValidationErrors(validationResult.error) 
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if employee exists and is active
    const employee = await db.employee.findUnique({
      where: { id: data.employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 }
      );
    }

    // Check for duplicate payroll for same period
    const existingPayroll = await db.payroll.findFirst({
      where: {
        employeeId: data.employeeId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      },
    });

    if (existingPayroll) {
      return NextResponse.json(
        { 
          error: "Une fiche de paie existe déjà pour cette période",
          existingPayroll,
        },
        { status: 400 }
      );
    }

    // Calculate overtime pay from time entries in the period
    const overtimePay = await calculateOvertimePayForPeriod(
      data.employeeId,
      data.periodStart,
      data.periodEnd,
      employee.salary
    );

    // CRITICAL: Calculate net salary
    // Net Salary = Base + Overtime + Bonuses - Deductions
    const finalOvertimePay = data.overtimePay || overtimePay;
    const netSalary = Math.round(
      (data.baseSalary + finalOvertimePay + data.bonuses - data.deductions) * 100
    ) / 100;

    // Create payroll in transaction
    const payroll = await db.$transaction(async (tx) => {
      const newPayroll = await tx.payroll.create({
        data: {
          employeeId: data.employeeId,
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
          baseSalary: data.baseSalary,
          overtimePay: finalOvertimePay,
          bonuses: data.bonuses || 0,
          deductions: data.deductions || 0,
          netSalary,
          status: "DRAFT",
          paymentMethod: data.paymentMethod ?? null,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              fullName: true,
              department: true,
              bankAccount: true,
            },
          },
        },
      });

      // Audit log
      await auditService.logCreate(
        "system", // userId - in real app, get from session
        "Payroll",
        newPayroll.id,
        {
          employeeId: data.employeeId,
          period: `${data.periodStart} - ${data.periodEnd}`,
          baseSalary: data.baseSalary,
          overtimePay: finalOvertimePay,
          bonuses: data.bonuses,
          deductions: data.deductions,
          netSalary,
        },
        `Création de la fiche de paie pour ${newPayroll.employee.fullName} - Période: ${new Date(data.periodStart).toLocaleDateString()} au ${new Date(data.periodEnd).toLocaleDateString()}`
      );

      return newPayroll;
    });

    return NextResponse.json(payroll, { status: 201 });
  } catch (error) {
    console.error("Error creating payroll:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la fiche de paie" },
      { status: 500 }
    );
  }
}


// HELPER: Calculate overtime pay from time entries
// Overtime rate is 1.5x the normal hourly rate


async function calculateOvertimePayForPeriod(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
  monthlySalary: number
): Promise<number> {
  // Get all time entries for the period
  const timeEntries = await db.timeEntry.findMany({
    where: {
      employeeId,
      date: {
        gte: new Date(periodStart),
        lte: new Date(periodEnd),
      },
      clockOut: { not: null }, // Only completed entries
    },
    select: {
      overtimeHours: true,
    },
  });

  // Sum overtime hours
  const totalOvertimeHours = timeEntries.reduce(
    (sum, entry) => sum + (entry.overtimeHours || 0),
    0
  );

  // Calculate hourly rate (173.33 hours per month = 40 hours/week * 52 weeks / 12 months)
  const hourlyRate = monthlySalary / 173.33;
  
  // Overtime pay at 1.5x rate
  const overtimePay = totalOvertimeHours * hourlyRate * 1.5;
  
  return Math.round(overtimePay * 100) / 100;
}


// HELPER: Calculate payroll summary statistics


async function calculatePayrollSummary(where: Prisma.PayrollWhereInput) {
  const payrolls = await db.payroll.findMany({
    where,
    select: {
      baseSalary: true,
      overtimePay: true,
      bonuses: true,
      deductions: true,
      netSalary: true,
      status: true,
    },
  });

  const summary = {
    totalPayrolls: payrolls.length,
    totalBaseSalary: 0,
    totalOvertimePay: 0,
    totalBonuses: 0,
    totalDeductions: 0,
    totalNetSalary: 0,
    byStatus: {
      DRAFT: 0,
      PENDING: 0,
      APPROVED: 0,
      PAID: 0,
      CANCELLED: 0,
    },
  };

  for (const payroll of payrolls) {
    summary.totalBaseSalary += payroll.baseSalary;
    summary.totalOvertimePay += payroll.overtimePay || 0;
    summary.totalBonuses += payroll.bonuses || 0;
    summary.totalDeductions += payroll.deductions || 0;
    summary.totalNetSalary += payroll.netSalary;
    summary.byStatus[payroll.status as keyof typeof summary.byStatus]++;
  }

  // Round all totals
  summary.totalBaseSalary = Math.round(summary.totalBaseSalary * 100) / 100;
  summary.totalOvertimePay = Math.round(summary.totalOvertimePay * 100) / 100;
  summary.totalBonuses = Math.round(summary.totalBonuses * 100) / 100;
  summary.totalDeductions = Math.round(summary.totalDeductions * 100) / 100;
  summary.totalNetSalary = Math.round(summary.totalNetSalary * 100) / 100;

  return summary;
}


