import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import { PayrollStatus } from "@prisma/client";


// POST /api/hr/payroll/[id]/approve - Approve payroll


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Check if payroll exists
    const existingPayroll = await db.payroll.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            fullName: true,
            department: true,
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

    // Validate status transition
    if (existingPayroll.status !== "DRAFT" && existingPayroll.status !== "PENDING") {
      return NextResponse.json(
        { 
          error: "Cette fiche de paie ne peut pas être approuvée",
          currentStatus: existingPayroll.status,
        },
        { status: 400 }
      );
    }

    // Validate net salary is positive
    if (existingPayroll.netSalary <= 0) {
      return NextResponse.json(
        { error: "Le salaire net doit être positif pour approuver la fiche de paie" },
        { status: 400 }
      );
    }

    // Approve payroll in transaction
    const payroll = await db.$transaction(async (tx) => {
      const updatedPayroll = await tx.payroll.update({
        where: { id },
        data: {
          status: "APPROVED" as PayrollStatus,
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
      await auditService.logApprove(
        "system", // userId - in real app, get from session
        "Payroll",
        id,
        `Approbation de la fiche de paie de ${updatedPayroll.employee.fullName} - Net: ${existingPayroll.netSalary} DZD`
      );

      return updatedPayroll;
    });

    return NextResponse.json({
      ...payroll,
      message: "Fiche de paie approuvée avec succès",
    });
  } catch (error) {
    console.error("Error approving payroll:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'approbation de la fiche de paie" },
      { status: 500 }
    );
  }
}


