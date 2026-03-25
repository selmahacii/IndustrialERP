// GET, PUT, DELETE for individual transactions


import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditService } from '@/lib/audit-service';
import {
  transactionUpdateSchema,
  formatValidationErrors,
} from '@/lib/validations';
import { Prisma, TransactionStatus } from '@prisma/client';


// UTILITY FUNCTIONS


function getUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-user-id') || null;
}

function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}


// GET /api/finance/transactions/[id]
// Get transaction details


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const transaction = await db.transaction.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            description: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      return errorResponse('Transaction non trouvée', 404);
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return errorResponse(
      'Une erreur est survenue lors de la récupération de la transaction',
      500
    );
  }
}


// PUT /api/finance/transactions/[id]
// Update transaction (only if PENDING)


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return errorResponse('Utilisateur non authentifié', 401);
    }

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = transactionUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return NextResponse.json(
        { error: 'Données invalides', details: errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

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
            },
          },
        },
      });

      if (!existingTransaction) {
        throw new Error('TRANSACTION_NOT_FOUND');
      }

      // Check if transaction can be modified
      if (existingTransaction.status !== TransactionStatus.PENDING) {
        throw new Error('TRANSACTION_NOT_MODIFIABLE');
      }

      // Store old values for audit
      const oldValue = {
        amount: existingTransaction.amount,
        description: existingTransaction.description,
        category: existingTransaction.category,
        reference: existingTransaction.reference,
        transactionDate: existingTransaction.transactionDate,
      };

      // Update the transaction
      const updatedTransaction = await tx.transaction.update({
        where: { id },
        data: {
          amount: data.amount,
          description: data.description,
          category: data.category,
          reference: data.reference,
          transactionDate: data.transactionDate,
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
        },
      });

      // Log the update
      await auditService.logUpdate(
        userId,
        'Transaction',
        id,
        oldValue,
        {
          amount: updatedTransaction.amount,
          description: updatedTransaction.description,
          category: updatedTransaction.category,
          reference: updatedTransaction.reference,
          transactionDate: updatedTransaction.transactionDate,
        },
        `Transaction modifiée: ${existingTransaction.transactionNumber}`
      );

      return updatedTransaction;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating transaction:', error);

    if (error instanceof Error) {
      if (error.message === 'TRANSACTION_NOT_FOUND') {
        return errorResponse('Transaction non trouvée', 404);
      }
      if (error.message === 'TRANSACTION_NOT_MODIFIABLE') {
        return errorResponse(
          'Seules les transactions en attente peuvent être modifiées',
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
      'Une erreur est survenue lors de la mise à jour de la transaction',
      500
    );
  }
}


// DELETE /api/finance/transactions/[id]
// Delete transaction (only if PENDING)


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return errorResponse('Utilisateur non authentifié', 401);
    }

    const { id } = await params;

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
            },
          },
        },
      });

      if (!existingTransaction) {
        throw new Error('TRANSACTION_NOT_FOUND');
      }

      // Check if transaction can be deleted
      if (existingTransaction.status !== TransactionStatus.PENDING) {
        throw new Error('TRANSACTION_NOT_DELETABLE');
      }

      // Store values for audit before deletion
      const deletedData = {
        transactionNumber: existingTransaction.transactionNumber,
        type: existingTransaction.type,
        amount: existingTransaction.amount,
        accountCode: existingTransaction.account.code,
        accountName: existingTransaction.account.name,
      };

      // Delete the transaction
      await tx.transaction.delete({
        where: { id },
      });

      // Log the deletion
      await auditService.logDelete(
        userId,
        'Transaction',
        id,
        deletedData,
        `Transaction supprimée: ${existingTransaction.transactionNumber}`
      );

      return { success: true, transactionNumber: existingTransaction.transactionNumber };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting transaction:', error);

    if (error instanceof Error) {
      if (error.message === 'TRANSACTION_NOT_FOUND') {
        return errorResponse('Transaction non trouvée', 404);
      }
      if (error.message === 'TRANSACTION_NOT_DELETABLE') {
        return errorResponse(
          'Seules les transactions en attente peuvent être supprimées',
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
      'Une erreur est survenue lors de la suppression de la transaction',
      500
    );
  }
}


