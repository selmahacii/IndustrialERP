// POST: Approve a pending transaction


import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditService } from '@/lib/audit-service';
import { AuditAction, Prisma, TransactionStatus } from '@prisma/client';


// UTILITY FUNCTIONS


function getUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-user-id') || null;
}

function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}


// POST /api/finance/transactions/[id]/approve
// Approve a pending transaction


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return errorResponse('Utilisateur non authentifié', 401);
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const approvalNotes = body.approvalNotes as string | undefined;

    // Use transaction for concurrent update protection
    const result = await db.$transaction(async (tx) => {
      // Get existing transaction with lock
      const existingTransaction = await tx.transaction.findUnique({
        where: { id },
        include: {
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!existingTransaction) {
        throw new Error('TRANSACTION_NOT_FOUND');
      }

      // Check if transaction is pending
      if (existingTransaction.status !== TransactionStatus.PENDING) {
        throw new Error('TRANSACTION_NOT_PENDING');
      }

      // Store old values for audit
      const oldValue = {
        status: existingTransaction.status,
      };

      // Update transaction status to APPROVED
      const updatedTransaction = await tx.transaction.update({
        where: { id },
        data: {
          status: TransactionStatus.APPROVED,
        },
        include: {
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Create audit log for approval
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.APPROVE,
          entityType: 'Transaction',
          entityId: id,
          oldValue: JSON.stringify(oldValue),
          newValue: JSON.stringify({ status: TransactionStatus.APPROVED }),
          description: approvalNotes 
            ? `Transaction approuvée: ${existingTransaction.transactionNumber}. Notes: ${approvalNotes}`
            : `Transaction approuvée: ${existingTransaction.transactionNumber}`,
        },
      });

      return updatedTransaction;
    });

    return NextResponse.json({
      ...result,
      message: 'Transaction approuvée avec succès',
    });
  } catch (error) {
    console.error('Error approving transaction:', error);

    if (error instanceof Error) {
      if (error.message === 'TRANSACTION_NOT_FOUND') {
        return errorResponse('Transaction non trouvée', 404);
      }
      if (error.message === 'TRANSACTION_NOT_PENDING') {
        return errorResponse(
          'Seules les transactions en attente peuvent être approuvées',
          403
        );
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return errorResponse('Transaction non trouvée', 404);
      }
    }

    return errorResponse(
      'Une erreur est survenue lors de l\'approbation de la transaction',
      500
    );
  }
}


