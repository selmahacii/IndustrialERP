import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import { timeEntryClockInSchema, formatValidationErrors } from "@/lib/validations";
import { TimeEntryStatus } from "@prisma/client";


// POST /api/hr/time-entries/clock-in - Clock in for current day


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = timeEntryClockInSchema.safeParse(body);
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

    // Normalize date to start of day
    const entryDate = new Date(data.date);
    entryDate.setHours(0, 0, 0, 0);

    // Check for duplicate clock-in for same day (CRITICAL: prevent duplicate clock-ins)
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
        { 
          error: "L'employé a déjà pointé pour aujourd'hui",
          existingEntry,
        },
        { status: 400 }
      );
    }

    // Determine status based on clock-in time
    let status: TimeEntryStatus = "PRESENT";
    const clockInTime = new Date(data.clockIn);
    const clockInHour = clockInTime.getHours();
    const clockInMinute = clockInTime.getMinutes();
    
    // Standard work day starts at 8:00 AM
    const standardStart = 8 * 60; // 8:00 AM in minutes
    const actualStart = clockInHour * 60 + clockInMinute;
    
    // More than 15 minutes late is considered LATE
    if (actualStart > standardStart + 15) {
      status = "LATE";
    }

    // Create time entry in transaction
    const timeEntry = await db.$transaction(async (tx) => {
      const newTimeEntry = await tx.timeEntry.create({
        data: {
          employeeId: data.employeeId,
          date: entryDate,
          clockIn: clockInTime,
          clockOut: null, // Will be set on clock-out
          overtimeHours: 0, // Will be calculated on clock-out
          status,
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
        {
          employeeId: data.employeeId,
          date: entryDate,
          clockIn: clockInTime,
          status,
        },
        `Pointage d'entrée pour ${newTimeEntry.employee.fullName} à ${clockInTime.toLocaleTimeString()}`
      );

      return newTimeEntry;
    });

    // Response with status message
    const statusMessage = status === "LATE" 
      ? "Pointage enregistré (retard détecté)" 
      : "Pointage enregistré avec succès";

    return NextResponse.json({
      ...timeEntry,
      message: statusMessage,
      isLate: status === "LATE",
    }, { status: 201 });
  } catch (error) {
    console.error("Error clocking in:", error);
    return NextResponse.json(
      { error: "Erreur lors du pointage d'entrée" },
      { status: 500 }
    );
  }
}


