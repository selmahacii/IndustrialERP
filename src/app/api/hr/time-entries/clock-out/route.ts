import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import { timeEntryClockOutSchema, formatValidationErrors } from "@/lib/validations";
import { TimeEntryStatus } from "@prisma/client";


// POST /api/hr/time-entries/clock-out - Clock out and calculate overtime


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = timeEntryClockOutSchema.safeParse(body);
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

    // Check if time entry exists
    const existingEntry = await db.timeEntry.findUnique({
      where: { id: data.timeEntryId },
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            fullName: true,
            department: true,
            salary: true,
          },
        },
      },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: "Pointage non trouvé" },
        { status: 404 }
      );
    }

    // Check if already clocked out
    if (existingEntry.clockOut) {
      return NextResponse.json(
        { 
          error: "L'employé a déjà pointé sa sortie",
          clockOut: existingEntry.clockOut,
        },
        { status: 400 }
      );
    }

    const clockOutTime = new Date(data.clockOut);

    // Validate clock out is after clock in
    if (clockOutTime <= existingEntry.clockIn) {
      return NextResponse.json(
        { error: "L'heure de départ doit être postérieure à l'heure d'arrivée" },
        { status: 400 }
      );
    }

    // Calculate hours worked and overtime
    const { hoursWorked, overtimeHours } = calculateHoursAndOvertime(
      existingEntry.clockIn,
      clockOutTime
    );

    // Determine if early departure
    let status = existingEntry.status as TimeEntryStatus;
    const clockOutHour = clockOutTime.getHours();
    const clockOutMinute = clockOutTime.getMinutes();
    
    // Standard work day ends at 17:00 (5 PM)
    const standardEnd = 17 * 60; // 17:00 in minutes
    const actualEnd = clockOutHour * 60 + clockOutMinute;
    
    // If clocking out more than 15 minutes early and not already late
    if (actualEnd < standardEnd - 15 && status !== "LATE") {
      status = "EARLY_DEPARTURE";
    }

    // Update time entry in transaction
    const timeEntry = await db.$transaction(async (tx) => {
      const updatedEntry = await tx.timeEntry.update({
        where: { id: data.timeEntryId },
        data: {
          clockOut: clockOutTime,
          overtimeHours,
          status,
          notes: data.notes ?? existingEntry.notes,
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
      await auditService.logUpdate(
        "system", // userId - in real app, get from session
        "TimeEntry",
        data.timeEntryId,
        existingEntry,
        {
          clockOut: clockOutTime,
          hoursWorked,
          overtimeHours,
          status,
        },
        `Pointage de sortie pour ${updatedEntry.employee.fullName} à ${clockOutTime.toLocaleTimeString()}`
      );

      return updatedEntry;
    });

    // Calculate estimated overtime pay (hourly rate = monthly salary / 173.33 hours)
    const hourlyRate = existingEntry.employee.salary / 173.33;
    const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5 * 100) / 100; // 1.5x for overtime

    // Response with summary
    const summary = {
      hoursWorked,
      overtimeHours,
      overtimePay,
      isEarlyDeparture: status === "EARLY_DEPARTURE",
      status,
    };

    return NextResponse.json({
      ...timeEntry,
      summary,
      message: overtimeHours > 0 
        ? `Pointage enregistré. Heures supplémentaires: ${overtimeHours.toFixed(2)}h`
        : "Pointage enregistré avec succès",
    });
  } catch (error) {
    console.error("Error clocking out:", error);
    return NextResponse.json(
      { error: "Erreur lors du pointage de sortie" },
      { status: 500 }
    );
  }
}


// HELPER: Calculate hours worked and overtime
// CRITICAL: Overtime = hours above 8 per day


function calculateHoursAndOvertime(clockIn: Date, clockOut: Date): {
  hoursWorked: number;
  overtimeHours: number;
} {
  const diffMs = clockOut.getTime() - clockIn.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const hoursWorked = Math.round(diffHours * 100) / 100;
  
  // Standard work day is 8 hours
  const standardHours = 8;
  
  // CRITICAL: Overtime is any hours worked above 8
  const overtimeHours = diffHours > standardHours 
    ? Math.round((diffHours - standardHours) * 100) / 100 
    : 0;
  
  return { hoursWorked, overtimeHours };
}


