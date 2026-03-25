// GET: List journal entries
// POST: Create journal entry with double-entry validation


import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditService } from '@/lib/audit-service';
import {
  journalEntryCreateSchema,
  formatValidationErrors,
} from '@/lib/validations';
import { JournalStatus, Prisma } from '@prisma/client';


// UTILITY FUNCTIONS


function getUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-user-id') || null;
}

function errorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Generate a unique journal entry number
 */
async function generateEntryNumber(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  // Get count of journal entries for this month
  const count = await db.journalEntry.count({
    where: {
      createdAt: {
        gte: new Date(year, date.getMonth(), 1),
        lt: new Date(year, date.getMonth() + 1, 1),
      },
    },
  });

  const sequence = String(count + 1).padStart(5, '0');
  return `JE-${year}${month}-${sequence}`;
}

/**
 * Validate that all account IDs in lines exist
 */
async function validateAccounts(
  accountIds: string[]
): Promise<{ valid: boolean; invalidIds: string[] }> {
  const accounts = await db.account.findMany({
    where: {
      id: { in: accountIds },
      isActive: true,
    },
    select: { id: true },
  });

  const foundIds = new Set(accounts.map((a) => a.id));
  const invalidIds = accountIds.filter((id) => !foundIds.has(id));

  return {
    valid: invalidIds.length === 0,
    invalidIds,
  };
}


// GET /api/finance/journal
// List journal entries with pagination


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Filters
    const status = searchParams.get('status') as JournalStatus | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    // Build where clause
    const where: Prisma.JournalEntryWhereInput = {};

    if (status && Object.values(JournalStatus).includes(status)) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { entryNumber: { contains: search } },
        { description: { contains: search } },
        { reference: { contains: search } },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    // Execute queries in parallel
    const [entries, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        include: {
          lines: {
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
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      db.journalEntry.count({ where }),
    ]);

    // Calculate totals for each entry
    const entriesWithTotals = entries.map((entry) => {
      const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
      return {
        ...entry,
        totalDebit,
        totalCredit,
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      };
    });

    return NextResponse.json({
      entries: entriesWithTotals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return errorResponse(
      'Une erreur est survenue lors de la récupération des écritures comptables',
      500
    );
  }
}


// POST /api/finance/journal
// Create a journal entry with double-entry validation


export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return errorResponse('Utilisateur non authentifié', 401);
    }

    const body = await request.json();

    // Validate input with double-entry validation
    const validationResult = journalEntryCreateSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = formatValidationErrors(validationResult.error);
      return NextResponse.json(
        { error: 'Données invalides', details: errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Double-entry validation already done in schema, but let's verify again
    const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);

    // Round to 2 decimal places for comparison
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;

    if (roundedDebit !== roundedCredit) {
      return errorResponse(
        `Les totaux ne sont pas équilibrés: Débit=${roundedDebit.toFixed(2)}, Crédit=${roundedCredit.toFixed(2)}`
      );
    }

    // Validate all accounts exist and are active
    const accountIds = data.lines.map((line) => line.accountId);
    const accountValidation = await validateAccounts(accountIds);

    if (!accountValidation.valid) {
      return errorResponse(
        `Les comptes suivants n'existent pas ou sont inactifs: ${accountValidation.invalidIds.join(', ')}`
      );
    }

    // Generate entry number
    const entryNumber = await generateEntryNumber();

    // Create journal entry with lines in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create the journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber: data.entryNumber || entryNumber,
          date: data.date,
          description: data.description,
          reference: data.reference,
          status: JournalStatus.DRAFT,
          lines: {
            create: data.lines.map((line) => ({
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description,
            })),
          },
        },
        include: {
          lines: {
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
          },
        },
      });

      // Log the creation
      await auditService.logCreate(
        userId,
        'JournalEntry',
        journalEntry.id,
        {
          entryNumber: journalEntry.entryNumber,
          description: journalEntry.description,
          totalDebit: roundedDebit,
          totalCredit: roundedCredit,
          linesCount: data.lines.length,
        },
        `Écriture comptable créée: ${journalEntry.entryNumber}`
      );

      return journalEntry;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating journal entry:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return errorResponse('Une écriture avec ce numéro existe déjà', 409);
      }
      if (error.code === 'P2003') {
        return errorResponse('Un des comptes spécifiés n\'existe pas');
      }
    }

    return errorResponse(
      'Une erreur est survenue lors de la création de l\'écriture comptable',
      500
    );
  }
}


