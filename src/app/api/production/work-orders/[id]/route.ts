// Production module - Single Work Order CRUD


import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditService } from '@/lib/audit-service'
import { Prisma, WorkOrderStatus, Priority } from '@prisma/client'
import { z } from 'zod'


// HELPER FUNCTIONS


function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'system'
}


// GET /api/production/work-orders/[id]
// Get work order with steps and items


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const workOrder = await db.workOrder.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            description: true,
            unit: true,
            unitPrice: true,
            costPrice: true,
            type: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            employeeNumber: true,
            fullName: true,
            department: true,
            position: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        steps: {
          orderBy: {
            stepNumber: 'asc',
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
                costPrice: true,
              },
            },
          },
        },
      },
    })
    
    if (!workOrder) {
      return NextResponse.json(
        { error: 'Ordre de travail non trouvé' },
        { status: 404 }
      )
    }
    
    // Calculate progress
    const totalSteps = workOrder.steps.length
    const completedSteps = workOrder.steps.filter(
      s => s.status === 'COMPLETED' || s.status === 'SKIPPED'
    ).length
    const progressPercentage = totalSteps > 0 
      ? Math.round((completedSteps / totalSteps) * 100) 
      : 0
    
    // Group items by type
    const inputs = workOrder.items.filter(i => i.type === 'INPUT')
    const outputs = workOrder.items.filter(i => i.type === 'OUTPUT')
    const waste = workOrder.items.filter(i => i.type === 'WASTE')
    
    return NextResponse.json({
      ...workOrder,
      progress: {
        totalSteps,
        completedSteps,
        percentage: progressPercentage,
      },
      itemsGrouped: {
        inputs,
        outputs,
        waste,
      },
    })
  } catch (error) {
    console.error('Error fetching work order:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'ordre de travail' },
      { status: 500 }
    )
  }
}


// PUT /api/production/work-orders/[id]
// Update work order


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const userId = getUserId(request)
    
    // Validation schema
    const updateSchema = z.object({
      quantity: z.number().positive().optional(),
      completedQty: z.number().min(0).optional(),
      status: z.enum(['DRAFT', 'PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      scheduledStart: z.coerce.date().optional().nullable(),
      scheduledEnd: z.coerce.date().optional().nullable(),
      actualStart: z.coerce.date().optional().nullable(),
      actualEnd: z.coerce.date().optional().nullable(),
      assignedToId: z.string().optional().nullable(),
      notes: z.string().max(1000).optional().nullable(),
    }).superRefine((data, ctx) => {
      // Validate scheduled dates
      if (data.scheduledStart && data.scheduledEnd && data.scheduledStart > data.scheduledEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La date de début doit être antérieure à la date de fin",
          path: ["scheduledStart"],
        })
      }
      // Validate actual dates
      if (data.actualStart && data.actualEnd && data.actualStart > data.actualEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La date de début réelle doit être antérieure à la date de fin réelle",
          path: ["actualStart"],
        })
      }
    })
    
    const validatedData = updateSchema.parse(body)
    
    // Get existing work order
    const existingWorkOrder = await db.workOrder.findUnique({
      where: { id },
    })
    
    if (!existingWorkOrder) {
      return NextResponse.json(
        { error: 'Ordre de travail non trouvé' },
        { status: 404 }
      )
    }
    
    // Business rule: Only DRAFT or PLANNED orders can be modified significantly
    if (existingWorkOrder.status !== WorkOrderStatus.DRAFT && 
        existingWorkOrder.status !== WorkOrderStatus.PLANNED) {
      // Allow only status updates and notes for IN_PROGRESS orders
      const allowedFields = ['status', 'notes', 'completedQty']
      const attemptedFields = Object.keys(validatedData)
      const invalidFields = attemptedFields.filter(f => !allowedFields.includes(f))
      
      if (invalidFields.length > 0) {
        return NextResponse.json(
          { error: `Seuls les champs ${allowedFields.join(', ')} peuvent être modifiés pour un ordre en cours` },
          { status: 400 }
        )
      }
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
    
    // Update in transaction
    const updatedWorkOrder = await db.$transaction(async (tx) => {
      const wo = await tx.workOrder.update({
        where: { id },
        data: validatedData,
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
      
      // Log update
      await auditService.logUpdate(
        userId,
        'WorkOrder',
        wo.id,
        existingWorkOrder,
        validatedData,
        `Mise à jour de l'ordre de travail ${wo.orderNumber}`
      )
      
      return wo
    })
    
    return NextResponse.json(updatedWorkOrder)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error updating work order:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'ordre de travail' },
      { status: 500 }
    )
  }
}


// DELETE /api/production/work-orders/[id]
// Delete work order (only if DRAFT)


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = getUserId(request)
    
    // Get existing work order
    const existingWorkOrder = await db.workOrder.findUnique({
      where: { id },
      include: {
        steps: true,
        items: true,
      },
    })
    
    if (!existingWorkOrder) {
      return NextResponse.json(
        { error: 'Ordre de travail non trouvé' },
        { status: 404 }
      )
    }
    
    // Business rule: Only DRAFT orders can be deleted
    if (existingWorkOrder.status !== WorkOrderStatus.DRAFT) {
      return NextResponse.json(
        { error: 'Seuls les ordres de travail en brouillon peuvent être supprimés' },
        { status: 400 }
      )
    }
    
    // Delete in transaction (cascade will handle steps and items)
    await db.$transaction(async (tx) => {
      await tx.workOrder.delete({
        where: { id },
      })
      
      // Log deletion
      await auditService.logDelete(
        userId,
        'WorkOrder',
        id,
        existingWorkOrder,
        `Suppression de l'ordre de travail ${existingWorkOrder.orderNumber}`
      )
    })
    
    return NextResponse.json(
      { message: 'Ordre de travail supprimé avec succès' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting work order:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'ordre de travail' },
      { status: 500 }
    )
  }
}


