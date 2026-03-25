import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import { timeEntryCreateSchema, formatValidationErrors } from "@/lib/validations";
import { TimeEntryStatus, Prisma } from "@prisma/client";


// GET /api/hr/time-entries - List time entries with filtering


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Filter parameters
    const employeeId = searchParams.get("employeeId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status") as TimeEntryStatus | null;
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.TimeEntryWhereInput = {};
    
    if (employeeId) {
      where.employeeId = employeeId;
    }
    
    if (status) {
      where.status = status;
    }
    
    // Date range filter
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    // Execute query with pagination
    const [timeEntries, total] = await Promise.all([
      db.timeEntry.findMany({
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
            },
          },
        },
        orderBy: [
          { date: "desc" },
          { clockIn: "desc" },
        ],
        skip,
        take: limit,
      }),
      db.timeEntry.count({ where }),
    ]);

    // Calculate summary statistics
    const summary = await calculateTimeSummary(where);

    return NextResponse.json({
      data: timeEntries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    });
  } catch (error) {
    console.error("Error fetching time entries:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des pointages" },
      { status: 500 }
    );
  }
}


// POST /api/hr/time-entries - Create time entry


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = timeEntryCreateSchema.safeParse(body);
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

    if (employee.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "L'employé n'est pas actif" },
        { status: 400 }
      );
    }

    // Normalize date to start of day for comparison
    const entryDate = new Date(data.date);
    entryDate.setHours(0, 0, 0, 0);

    // Check for duplicate entry for same employee and date
    const existingEntry = await db.timeEntry.findFirst({
      where: {
        employeeId: data.employeeId,
        date: {
          gte: entryDate,
          lt: new Date(entryDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingEntry) {
      return NextResponse.json(
        { error: "Un pointage existe déjà pour cet employé à cette date" },
        { status: 400 }
      );
    }

    // Calculate overtime if clockOut is provided
    let overtimeHours = data.overtimeHours || 0;
    if (data.clockOut) {
      overtimeHours = calculateOvertime(data.clockIn, data.clockOut);
    }

    // Determine status based on clock-in time
    let status = data.status || "PRESENT";
    if (!data.status) {
      // Standard work day starts at 8:00 AM
      const clockInHour = new Date(data.clockIn).getHours();
      const clockInMinute = new Date(data.clockIn).getMinutes();
      const standardStart = 8 * 60; // 8:00 AM in minutes
      const actualStart = clockInHour * 60 + clockInMinute;
      
      if (actualStart > standardStart + 15) {
        status = "LATE";
      }
    }

    // Create time entry in transaction
    const timeEntry = await db.$transaction(async (tx) => {
      const newTimeEntry = await tx.timeEntry.create({
        data: {
          employeeId: data.employeeId,
          date: entryDate,
          clockIn: new Date(data.clockIn),
          clockOut: data.clockOut ? new Date(data.clockOut) : null,
          overtimeHours,
          status: status as TimeEntryStatus,
          notes: data.notes ?? null,
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
            },
          },
        },
      });

      // Audit log
      await auditService.logCreate(
        "system", // userId - in real app, get from session
        "TimeEntry",
        newTimeEntry.id,
        newTimeEntry,
        `Création de pointage pour ${newTimeEntry.employee.fullName} le ${entryDate.toLocaleDateString()}`
      );

      return newTimeEntry;
    });

    return NextResponse.json(timeEntry, { status: 201 });
  } catch (error) {
    console.error("Error creating time entry:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du pointage" },
      { status: 500 }
    );
  }
}


// HELPER: Calculate overtime hours
// Standard work day is 8 hours, overtime = hours above 8


function calculateOvertime(clockIn: Date, clockOut: Date): number {
  const diffMs = clockOut.getTime() - clockIn.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  // Standard work day is 8 hours
  const standardHours = 8;
  
  if (diffHours > standardHours) {
    return Math.round((diffHours - standardHours) * 100) / 100;
  }
  
  return 0;
}


// HELPER: Calculate time summary statistics


async function calculateTimeSummary(where: Prisma.TimeEntryWhereInput) {
  const entries = await db.timeEntry.findMany({
    where,
    select: {
      clockIn: true,
      clockOut: true,
      overtimeHours: true,
      status: true,
    },
  });

  let totalHours = 0;
  let totalOvertimeHours = 0;
  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;

  for (const entry of entries) {
    if (entry.clockOut) {
      const diffMs = entry.clockOut.getTime() - entry.clockIn.getTime();
      totalHours += diffMs / (1000 * 60 * 60);
    }
    
    totalOvertimeHours += entry.overtimeHours || 0;
    
    switch (entry.status) {
      case "PRESENT":
        presentDays++;
        break;
      case "LATE":
        lateDays++;
        presentDays++; // Late is still present
        break;
      case "ABSENT":
        absentDays++;
        break;
    }
  }

  return {
    totalEntries: entries.length,
    totalHours: Math.round(totalHours * 100) / 100,
    totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
    presentDays,
    lateDays,
    absentDays,
  };
}


