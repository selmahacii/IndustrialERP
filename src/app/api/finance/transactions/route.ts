// CRUD for financial transactions with pagination and filtering


import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditService } from '@/lib/audit-service';
import {
  transactionCreateSchema,
  formatValidationErrors,
} from '@/lib/validations';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';


// UTILITY FUNCTIONS


/**
 * Generate a unique transaction number
 */
async function generateTransactionNumber(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  // Get count of transactions for this month
  const count = await db.transaction.count({
    where: {
      createdAt: {
        gte: new Date(year, date.getMonth(), 1),
        lt: new Date(year, date.getMonth() + 1, 1),
      },
    },
  });

  const sequence = String(count + 1).padStart(5, '0');
  return `TXN-${year}${month}-${sequence}`;
}

/**
 * Get user ID from request headers
 */
function getUserIdFromRequest(request: NextRequest): string | null {
  // In a real app, this would extract from JWT session
  // For now, we use a header or default
  return request.headers.get('x-user-id') || null;
}

/**
 * Create error response with French message
 */
function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}


// GET /api/finance/transactions
// List transactions with pagination and filtering


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Filters
    const accountId = searchParams.get('accountId');
    const status = searchParams.get('status') as TransactionStatus | null;
    const type = searchParams.get('type') as TransactionType | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // Build where clause
    const where: Prisma.TransactionWhereInput = {};

    if (accountId) {
      where.accountId = accountId;
    }

    if (status && Object.values(TransactionStatus).includes(status)) {
      where.status = status;
    }

    if (type && Object.values(TransactionType).includes(type)) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { description: { contains: search } },
        { reference: { contains: search } },
        { transactionNumber: { contains: search } },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) {
        where.transactionDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.transactionDate.lte = new Date(endDate);
      }
    }

    // Execute queries in parallel
    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
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
        orderBy: {
          transactionDate: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      db.transaction.count({ where }),
    ]);

    // Calculate summary statistics
    const summary = await db.transaction.aggregate({
      where: {
        ...where,
        status: TransactionStatus.APPROVED,
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalAmount: summary._sum.amount || 0,
        count: summary._count,
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return errorResponse(
      'Une erreur est survenue lors de la récupération des transactions',
      500
    );
  }
}


// POST /api/finance/transactions
// Create a new transaction


export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return errorResponse('Utilisateur non authentifié', 401);
    }

    const body = await request.json();

    // Validate input
    const validationResult = transactionCreateSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return NextResponse.json(
        { error: 'Données invalides', details: errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Verify account exists and is active
    const account = await db.account.findUnique({
      where: { id: data.accountId },
    });

    if (!account) {
      return errorResponse('Le compte spécifié n\'existe pas');
    }

    if (!account.isActive) {
      return errorResponse('Le compte spécifié est inactif');
    }

    // Generate transaction number
    const transactionNumber = await generateTransactionNumber();

    // Create transaction with audit logging using transaction
    const result = await db.$transaction(async (tx) => {
      // Create the transaction
      const transaction = await tx.transaction.create({
        data: {
          transactionNumber,
          accountId: data.accountId,
          type: data.type,
          amount: data.amount,
          description: data.description,
          category: data.category,
          reference: data.reference,
          transactionDate: data.transactionDate,
          userId,
          status: TransactionStatus.PENDING,
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

      // Log the creation
      await auditService.logCreate(
        userId,
        'Transaction',
        transaction.id,
        {
          transactionNumber: transaction.transactionNumber,
          type: transaction.type,
          amount: transaction.amount,
          accountCode: account.code,
          accountName: account.name,
        },
        `Transaction créée: ${transaction.transactionNumber}`
      );

      return transaction;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return errorResponse('Une transaction avec ce numéro existe déjà', 409);
      }
    }
    
    return errorResponse(
      'Une erreur est survenue lors de la création de la transaction',
      500
    );
  }
}


