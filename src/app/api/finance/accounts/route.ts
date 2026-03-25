// GET: List all accounts
// POST: Create new account


import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditService } from '@/lib/audit-service';
import {
  accountCreateSchema,
  formatValidationErrors,
} from '@/lib/validations';
import { AccountType, Prisma } from '@prisma/client';


// UTILITY FUNCTIONS


function getUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-user-id') || null;
}

function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}


// GET /api/finance/accounts
// List all accounts with optional filtering


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Filters
    const type = searchParams.get('type') as AccountType | null;
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');
    const includeStats = searchParams.get('includeStats') === 'true';

    // Build where clause
    const where: Prisma.AccountWhereInput = {};

    if (type && Object.values(AccountType).includes(type)) {
      where.type = type;
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Fetch accounts
    const accounts = await db.account.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { code: 'asc' },
      ],
      include: includeStats
        ? {
            _count: {
              select: {
                transactions: true,
                journalLines: true,
              },
            },
          }
        : undefined,
    });

    // Group accounts by type for hierarchical view
    const accountsByType = accounts.reduce((acc, account) => {
      if (!acc[account.type]) {
        acc[account.type] = [];
      }
      acc[account.type].push(account);
      return acc;
    }, {} as Record<AccountType, typeof accounts>);

    // Calculate totals if requested
    let stats = undefined;
    if (includeStats) {
      const transactionStats = await db.transaction.groupBy({
        by: ['accountId'],
        _sum: {
          amount: true,
        },
        where: {
          status: 'APPROVED',
        },
      });

      stats = {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter((a) => a.isActive).length,
        transactionTotals: transactionStats.reduce((acc, stat) => {
          if (stat.accountId) {
            acc[stat.accountId] = stat._sum.amount || 0;
          }
          return acc;
        }, {} as Record<string, number>),
      };
    }

    return NextResponse.json({
      accounts,
      accountsByType,
      stats,
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return errorResponse(
      'Une erreur est survenue lors de la récupération des comptes',
      500
    );
  }
}


// POST /api/finance/accounts
// Create a new account


export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return errorResponse('Utilisateur non authentifié', 401);
    }

    const body = await request.json();

    // Validate input
    const validationResult = accountCreateSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return NextResponse.json(
        { error: 'Données invalides', details: errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if account code already exists
    const existingAccount = await db.account.findUnique({
      where: { code: data.code },
    });

    if (existingAccount) {
      return errorResponse('Un compte avec ce code existe déjà', 409);
    }

    // Validate parent code if provided
    if (data.parentCode) {
      const parentAccount = await db.account.findUnique({
        where: { code: data.parentCode },
      });

      if (!parentAccount) {
        return errorResponse('Le code parent spécifié n\'existe pas');
      }

      // Ensure parent type is compatible (simplified check)
      // In a real system, you might have more complex hierarchy rules
    }

    // Create account with audit logging
    const result = await db.$transaction(async (tx) => {
      // Create the account
      const account = await tx.account.create({
        data: {
          code: data.code,
          name: data.name,
          type: data.type,
          parentCode: data.parentCode,
          description: data.description,
          isActive: data.isActive ?? true,
        },
      });

      // Log the creation
      await auditService.logCreate(
        userId,
        'Account',
        account.id,
        {
          code: account.code,
          name: account.name,
          type: account.type,
          parentCode: account.parentCode,
        },
        `Compte créé: ${account.code} - ${account.name}`
      );

      return account;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return errorResponse('Un compte avec ce code existe déjà', 409);
      }
    }

    return errorResponse(
      'Une erreur est survenue lors de la création du compte',
      500
    );
  }
}


