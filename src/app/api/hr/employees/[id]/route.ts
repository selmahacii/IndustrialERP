import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import { employeeUpdateSchema, formatValidationErrors } from "@/lib/validations";


// GET /api/hr/employees/[id] - Get employee details


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        timeEntries: {
          take: 30,
          orderBy: { date: "desc" },
        },
        payrolls: {
          take: 12,
          orderBy: { createdAt: "desc" },
        },
        workOrders: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 }
      );
    }

    // Audit log
    await auditService.logView(
      "system", // userId - in real app, get from session
      "Employee",
      id,
      `Consultation de l'employé ${employee.fullName}`
    );

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'employé" },
      { status: 500 }
    );
  }
}


// PUT /api/hr/employees/[id] - Update employee


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = employeeUpdateSchema.safeParse(body);
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

    // Check if employee exists
    const existingEmployee = await db.employee.findUnique({
      where: { id },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 }
      );
    }

    // Check for duplicate employee number if changing
    if (data.employeeNumber && data.employeeNumber !== existingEmployee.employeeNumber) {
      const duplicateNumber = await db.employee.findUnique({
        where: { employeeNumber: data.employeeNumber },
      });
      if (duplicateNumber) {
        return NextResponse.json(
          { error: "Un employé avec ce matricule existe déjà" },
          { status: 400 }
        );
      }
    }

    // Check for duplicate email if changing
    if (data.email && data.email !== existingEmployee.email) {
      const duplicateEmail = await db.employee.findUnique({
        where: { email: data.email },
      });
      if (duplicateEmail) {
        return NextResponse.json(
          { error: "Un employé avec cet email existe déjà" },
          { status: 400 }
        );
      }
    }

    // Update employee in transaction
    const employee = await db.$transaction(async (tx) => {
      // Build update data with fullName if firstName or lastName changed
      const updateData: any = { ...data };
      if (data.firstName || data.lastName) {
        updateData.fullName = `${data.firstName ?? existingEmployee.firstName} ${data.lastName ?? existingEmployee.lastName}`;
      }

      const updatedEmployee = await tx.employee.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
            },
          },
        },
      });

      // Audit log
      await auditService.logUpdate(
        "system", // userId - in real app, get from session
        "Employee",
        id,
        existingEmployee,
        updatedEmployee,
        `Mise à jour de l'employé ${updatedEmployee.fullName}`
      );

      return updatedEmployee;
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Error updating employee:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'employé" },
      { status: 500 }
    );
  }
}


// DELETE /api/hr/employees/[id] - Terminate employee


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if employee exists
    const existingEmployee = await db.employee.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: "Employé non trouvé" },
        { status: 404 }
      );
    }

    // Check if already terminated
    if (existingEmployee.status === "TERMINATED") {
      return NextResponse.json(
        { error: "L'employé est déjà licencié" },
        { status: 400 }
      );
    }

    // Terminate employee (soft delete - set status to TERMINATED)
    const employee = await db.$transaction(async (tx) => {
      const updatedEmployee = await tx.employee.update({
        where: { id },
        data: {
          status: "TERMINATED",
          terminationDate: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
            },
          },
        },
      });

      // Deactivate associated user account
      if (existingEmployee.user) {
        await tx.user.update({
          where: { id: existingEmployee.user.id },
          data: { isActive: false },
        });
      }

      // Audit log
      await auditService.logDelete(
        "system", // userId - in real app, get from session
        "Employee",
        id,
        existingEmployee,
        `Licenciement de l'employé ${existingEmployee.fullName}`
      );

      return updatedEmployee;
    });

    return NextResponse.json({
      message: "Employé licencié avec succès",
      employee,
    });
  } catch (error) {
    console.error("Error terminating employee:", error);
    return NextResponse.json(
      { error: "Erreur lors du licenciement de l'employé" },
      { status: 500 }
    );
  }
}


