// Production module - Work Orders CRUD


import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditService } from '@/lib/audit-service'
import { Prisma, WorkOrderStatus, Priority } from '@prisma/client'
import { z } from 'zod'
import { workOrderCreateSchema } from '@/lib/validations'


// HELPER FUNCTIONS


/**
 * Generate unique work order number in format WO-YYYYMMDD-XXXX
 */
async function generateOrderNumber(): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  
  // Find the highest sequence for today
  const prefix = `WO-${dateStr}-`
  
  const lastOrder = await db.workOrder.findFirst({
    where: {
      orderNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      orderNumber: 'desc',
    },
    select: {
      orderNumber: true,
    },
  })
  
  let sequence = 1
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.slice(-4), 10)
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1
    }
  }
  
  return `${prefix}${sequence.toString().padStart(4, '0')}`
}

/**
 * Get user ID from request headers (placeholder for actual auth)
 */
function getUserId(request: NextRequest): string {
  // In production, this would get the user ID from the session/JWT
  // For now, we use a header or default
  return request.headers.get('x-user-id') || 'system'
}

/**
 * Parse query parameters for filtering
 */
function parseQueryParams(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  return {
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: parseInt(searchParams.get('limit') || '20', 10),
    status: searchParams.get('status') as WorkOrderStatus | null,
    priority: searchParams.get('priority') as Priority | null,
    productId: searchParams.get('productId'),
    assignedToId: searchParams.get('assignedToId'),
    scheduledStartFrom: searchParams.get('scheduledStartFrom'),
    scheduledStartTo: searchParams.get('scheduledStartTo'),
    scheduledEndFrom: searchParams.get('scheduledEndFrom'),
    scheduledEndTo: searchParams.get('scheduledEndTo'),
    search: searchParams.get('search'),
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
  }
}


// GET /api/production/work-orders
// List work orders with pagination and filtering


export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const skip = (params.page - 1) * params.limit
    
    // Build where clause
    const where: Prisma.WorkOrderWhereInput = {}
    
    if (params.status) {
      where.status = params.status
    }
    
    if (params.priority) {
      where.priority = params.priority
    }
    
    if (params.productId) {
      where.productId = params.productId
    }
    
    if (params.assignedToId) {
      where.assignedToId = params.assignedToId
    }
    
    // Date range filters
    if (params.scheduledStartFrom || params.scheduledStartTo) {
      where.scheduledStart = {}
      if (params.scheduledStartFrom) {
        where.scheduledStart.gte = new Date(params.scheduledStartFrom)
      }
      if (params.scheduledStartTo) {
        where.scheduledStart.lte = new Date(params.scheduledStartTo)
      }
    }
    
    if (params.scheduledEndFrom || params.scheduledEndTo) {
      where.scheduledEnd = {}
      if (params.scheduledEndFrom) {
        where.scheduledEnd.gte = new Date(params.scheduledEndFrom)
      }
      if (params.scheduledEndTo) {
        where.scheduledEnd.lte = new Date(params.scheduledEndTo)
      }
    }
    
    // Search by order number or product name
    if (params.search) {
      where.OR = [
        { orderNumber: { contains: params.search } },
        { product: { name: { contains: params.search } } },
        { product: { sku: { contains: params.search } } },
      ]
    }
    
    // Build orderBy
    const orderBy: Prisma.WorkOrderOrderByWithRelationInput = {}
    orderBy[params.sortBy as keyof Prisma.WorkOrderOrderByWithRelationInput] = params.sortOrder
    
    // Execute queries in parallel
    const [workOrders, total] = await Promise.all([
      db.workOrder.findMany({
        where,
        skip,
        take: params.limit,
        orderBy,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              employeeNumber: true,
              fullName: true,
              department: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              steps: true,
              items: true,
            },
          },
        },
      }),
      db.workOrder.count({ where }),
    ])
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / params.limit)
    
    return NextResponse.json({
      data: workOrders,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasMore: params.page < totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching work orders:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des ordres de travail' },
      { status: 500 }
    )
  }
}


// POST /api/production/work-orders
// Create new work order


export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = getUserId(request)
    
    // Validate input - we need to modify the schema to not require orderNumber
    const createSchema = z.object({
      productId: z.string().min(1, "L'ID du produit est obligatoire"),
      quantity: z.number().positive('La quantité doit être positive'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
      scheduledStart: z.coerce.date().optional().nullable(),
      scheduledEnd: z.coerce.date().optional().nullable(),
      assignedToId: z.string().optional().nullable(),
      notes: z.string().max(1000).optional().nullable(),
    }).superRefine((data, ctx) => {
      if (data.scheduledStart && data.scheduledEnd && data.scheduledStart > data.scheduledEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La date de début doit être antérieure à la date de fin",
          path: ["scheduledStart"],
        })
      }
    })
    
    const validatedData = createSchema.parse(body)
    
    // Verify product exists
    const product = await db.product.findUnique({
      where: { id: validatedData.productId },
    })
    
    if (!product) {
      return NextResponse.json(
        { error: 'Produit non trouvé' },
        { status: 404 }
      )
    }
    
    // Verify assigned employee exists (if provided)
    if (validatedData.assignedToId) {
      const employee = await db.employee.findUnique({
        where: { id: validatedData.assignedToId },
      })
      
      if (!employee) {
        return NextResponse.json(
          { error: 'Employé assigné non trouvé' },
          { status: 404 }
        )
      }
    }
    
    // Generate unique order number
    const orderNumber = await generateOrderNumber()
    
    // Create work order in transaction
    const workOrder = await db.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          orderNumber,
          productId: validatedData.productId,
          quantity: validatedData.quantity,
          priority: validatedData.priority as Priority,
          scheduledStart: validatedData.scheduledStart,
          scheduledEnd: validatedData.scheduledEnd,
          assignedToId: validatedData.assignedToId,
          notes: validatedData.notes,
          status: WorkOrderStatus.DRAFT,
          createdById: userId,
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              employeeNumber: true,
              fullName: true,
            },
          },
        },
      })
      
      // Log creation
      await auditService.logCreate(
        userId,
        'WorkOrder',
        wo.id,
        {
          orderNumber: wo.orderNumber,
          productId: wo.productId,
          quantity: wo.quantity,
          priority: wo.priority,
        },
        `Création de l'ordre de travail ${wo.orderNumber}`
      )
      
      return wo
    })
    
    return NextResponse.json(workOrder, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error creating work order:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'ordre de travail' },
      { status: 500 }
    )
  }
}


