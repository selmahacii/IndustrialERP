import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import { payrollPaySchema, formatValidationErrors } from "@/lib/validations";
import { PayrollStatus } from "@prisma/client";


// POST /api/hr/payroll/[id]/pay - Mark payroll as paid


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = payrollPaySchema.safeParse({
      payrollId: id,
      ...body,
    });
    
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
            department: true,
            bankAccount: true,
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

    // Validate status - must be APPROVED to pay
    if (existingPayroll.status !== "APPROVED") {
      return NextResponse.json(
        { 
          error: "La fiche de paie doit être approuvée avant le paiement",
          currentStatus: existingPayroll.status,
        },
        { status: 400 }
      );
    }

    // Validate bank account for bank transfer
    if (data.paymentMethod === "BANK_TRANSFER" && !existingPayroll.employee.bankAccount) {
      return NextResponse.json(
        { 
          error: "L'employé n'a pas de compte bancaire enregistré pour le virement",
          suggestion: "Veuillez utiliser un autre mode de paiement ou mettre à jour les informations de l'employé",
        },
        { status: 400 }
      );
    }

    // Mark payroll as paid in transaction
    const payroll = await db.$transaction(async (tx) => {
      const updatedPayroll = await tx.payroll.update({
        where: { id },
        data: {
          status: "PAID" as PayrollStatus,
          paidAt: new Date(),
          paymentMethod: data.paymentMethod,
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
      await auditService.logAction(
        "system", // userId - in real app, get from session
        "APPROVE", // Using APPROVE action for payment completion
        "Payroll",
        id,
        {
          newValue: {
            status: "PAID",
            paidAt: new Date(),
            paymentMethod: data.paymentMethod,
            paymentReference: data.paymentReference,
          },
          description: `Paiement de la fiche de paie de ${updatedPayroll.employee.fullName} - Montant: ${existingPayroll.netSalary} DZD via ${data.paymentMethod}`,
        }
      );

      return updatedPayroll;
    });

    // Generate payment receipt info
    const paymentInfo = {
      payrollId: payroll.id,
      employeeName: payroll.employee.fullName,
      netSalary: existingPayroll.netSalary,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      paidAt: payroll.paidAt,
      period: {
        start: existingPayroll.periodStart,
        end: existingPayroll.periodEnd,
      },
    };

    return NextResponse.json({
      ...payroll,
      paymentInfo,
      message: `Paiement effectué avec succès - ${existingPayroll.netSalary} DZD versés à ${payroll.employee.fullName}`,
    });
  } catch (error) {
    console.error("Error paying payroll:", error);
    return NextResponse.json(
      { error: "Erreur lors du paiement de la fiche de paie" },
      { status: 500 }
    );
  }
}


