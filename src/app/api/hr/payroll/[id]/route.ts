// CRITICAL: Net Salary = Base + Overtime + Bonuses - Deductions


import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import { payrollUpdateSchema, formatValidationErrors } from "@/lib/validations";
import { PayrollStatus } from "@prisma/client";


// GET /api/hr/payroll/[id] - Get payroll details


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const payroll = await db.payroll.findUnique({
      where: { id },
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
            salary: true,
            bankAccount: true,
            hireDate: true,
          },
        },
      },
    });

    if (!payroll) {
      return NextResponse.json(
        { error: "Fiche de paie non trouvée" },
        { status: 404 }
      );
    }

    // Get time entries for the payroll period
    const timeEntries = await db.timeEntry.findMany({
      where: {
        employeeId: payroll.employeeId,
        date: {
          gte: payroll.periodStart,
          lte: payroll.periodEnd,
        },
      },
      orderBy: { date: "asc" },
    });

    // Calculate worked hours and overtime
    let totalWorkedHours = 0;
    let totalOvertimeHours = 0;
    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;

    for (const entry of timeEntries) {
      if (entry.clockOut) {
        const diffMs = entry.clockOut.getTime() - entry.clockIn.getTime();
        totalWorkedHours += diffMs / (1000 * 60 * 60);
      }
      totalOvertimeHours += entry.overtimeHours || 0;

      switch (entry.status) {
        case "PRESENT":
          presentDays++;
          break;
        case "LATE":
          lateDays++;
          presentDays++;
          break;
        case "ABSENT":
          absentDays++;
          break;
      }
    }

    // Audit log
    await auditService.logView(
      "system", // userId - in real app, get from session
      "Payroll",
      id,
      `Consultation de la fiche de paie de ${payroll.employee.fullName}`
    );

    return NextResponse.json({
      ...payroll,
      summary: {
        totalWorkedHours: Math.round(totalWorkedHours * 100) / 100,
        totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
        presentDays,
        absentDays,
        lateDays,
        totalDays: timeEntries.length,
      },
      timeEntries,
    });
  } catch (error) {
    console.error("Error fetching payroll:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la fiche de paie" },
      { status: 500 }
    );
  }
}


// PUT /api/hr/payroll/[id] - Update payroll


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = payrollUpdateSchema.safeParse(body);
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

    // Check if payroll exists
    const existingPayroll = await db.payroll.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            fullName: true,
          },
        },
      },
    });

    if (!existingPayroll) {
      return NextResponse.json(
        { error: "Fiche de paie non trouvée" },
        { status: 404 }
      );
    }

    // Check if payroll can be modified
    if (existingPayroll.status === "PAID" || existingPayroll.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cette fiche de paie ne peut plus être modifiée" },
        { status: 400 }
      );
    }

    // CRITICAL: Recalculate net salary
    // Net Salary = Base + Overtime + Bonuses - Deductions
    const baseSalary = data.baseSalary ?? existingPayroll.baseSalary;
    const overtimePay = data.overtimePay ?? existingPayroll.overtimePay;
    const bonuses = data.bonuses ?? existingPayroll.bonuses;
    const deductions = data.deductions ?? existingPayroll.deductions;
    const netSalary = Math.round((baseSalary + overtimePay + bonuses - deductions) * 100) / 100;

    // Update payroll in transaction
    const payroll = await db.$transaction(async (tx) => {
      const updateData: any = {
        ...data,
        netSalary,
      };
      
      // Remove status from direct update - use approve/pay endpoints
      delete updateData.status;

      const updatedPayroll = await tx.payroll.update({
        where: { id },
        data: updateData,
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
      await auditService.logUpdate(
        "system", // userId - in real app, get from session
        "Payroll",
        id,
        existingPayroll,
        {
          ...data,
          netSalary,
        },
        `Mise à jour de la fiche de paie de ${updatedPayroll.employee.fullName}`
      );

      return updatedPayroll;
    });

    return NextResponse.json(payroll);
  } catch (error) {
    console.error("Error updating payroll:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la fiche de paie" },
      { status: 500 }
    );
  }
}


