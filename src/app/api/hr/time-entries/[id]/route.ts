import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import { timeEntryUpdateSchema, formatValidationErrors } from "@/lib/validations";
import { TimeEntryStatus } from "@prisma/client";


// PUT /api/hr/time-entries/[id] - Update time entry (clock out)


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = timeEntryUpdateSchema.safeParse(body);
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
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            status: true,
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

    // Validate clock out time if provided
    if (data.clockOut) {
      const clockOutTime = new Date(data.clockOut);
      const clockInTime = data.clockIn ? new Date(data.clockIn) : existingEntry.clockIn;
      
      if (clockOutTime <= clockInTime) {
        return NextResponse.json(
          { error: "L'heure de départ doit être postérieure à l'heure d'arrivée" },
          { status: 400 }
        );
      }
    }

    // Calculate overtime if clocking out
    let overtimeHours = data.overtimeHours;
    if (data.clockOut && !data.overtimeHours) {
      const clockIn = data.clockIn ? new Date(data.clockIn) : existingEntry.clockIn;
      overtimeHours = calculateOvertime(clockIn, new Date(data.clockOut));
    }

    // Determine status based on early departure
    let status = data.status as TimeEntryStatus | undefined;
    if (data.clockOut && !data.status) {
      const clockOutTime = new Date(data.clockOut);
      const clockOutHour = clockOutTime.getHours();
      const clockOutMinute = clockOutTime.getMinutes();
      
      // Standard work day ends at 17:00 (5 PM)
      const standardEnd = 17 * 60; // 17:00 in minutes
      const actualEnd = clockOutHour * 60 + clockOutMinute;
      
      // If clocking out more than 15 minutes early
      if (actualEnd < standardEnd - 15) {
        status = "EARLY_DEPARTURE";
      }
    }

    // Update time entry in transaction
    const timeEntry = await db.$transaction(async (tx) => {
      const updateData: any = {};
      
      if (data.clockIn) updateData.clockIn = new Date(data.clockIn);
      if (data.clockOut) updateData.clockOut = new Date(data.clockOut);
      if (overtimeHours !== undefined) updateData.overtimeHours = overtimeHours;
      if (status) updateData.status = status;
      if (data.notes !== undefined) updateData.notes = data.notes;

      const updatedEntry = await tx.timeEntry.update({
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
            },
          },
        },
      });

      // Calculate hours worked if clocking out
      let hoursWorked = null;
      if (updatedEntry.clockOut) {
        const diffMs = updatedEntry.clockOut.getTime() - updatedEntry.clockIn.getTime();
        hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      // Audit log
      await auditService.logUpdate(
        "system", // userId - in real app, get from session
        "TimeEntry",
        id,
        existingEntry,
        { ...updatedEntry, hoursWorked },
        `Mise à jour du pointage de ${updatedEntry.employee.fullName}`
      );

      return { ...updatedEntry, hoursWorked };
    });

    return NextResponse.json(timeEntry);
  } catch (error) {
    console.error("Error updating time entry:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du pointage" },
      { status: 500 }
    );
  }
}


// GET /api/hr/time-entries/[id] - Get time entry details


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const timeEntry = await db.timeEntry.findUnique({
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
          },
        },
      },
    });

    if (!timeEntry) {
      return NextResponse.json(
        { error: "Pointage non trouvé" },
        { status: 404 }
      );
    }

    // Calculate hours worked
    let hoursWorked = null;
    if (timeEntry.clockOut) {
      const diffMs = timeEntry.clockOut.getTime() - timeEntry.clockIn.getTime();
      hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
    }

    // Audit log
    await auditService.logView(
      "system", // userId - in real app, get from session
      "TimeEntry",
      id,
      `Consultation du pointage de ${timeEntry.employee.fullName}`
    );

    return NextResponse.json({ ...timeEntry, hoursWorked });
  } catch (error) {
    console.error("Error fetching time entry:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du pointage" },
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


