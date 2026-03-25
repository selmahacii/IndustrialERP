// Production module - Work Order Steps CRUD


import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditService } from '@/lib/audit-service'
import { StepStatus } from '@prisma/client'
import { z } from 'zod'


// HELPER FUNCTIONS


function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'system'
}


// GET /api/production/work-orders/[id]/steps
// List steps for a work order


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Verify work order exists
    const workOrder = await db.workOrder.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, status: true },
    })
    
    if (!workOrder) {
      return NextResponse.json(
        { error: 'Ordre de travail non trouvé' },
        { status: 404 }
      )
    }
    
    const steps = await db.workOrderStep.findMany({
      where: { workOrderId: id },
      orderBy: { stepNumber: 'asc' },
    })
    
    // Calculate progress summary
    const totalSteps = steps.length
    const completedSteps = steps.filter(s => s.status === 'COMPLETED').length
    const skippedSteps = steps.filter(s => s.status === 'SKIPPED').length
    const inProgressSteps = steps.filter(s => s.status === 'IN_PROGRESS').length
    const pendingSteps = steps.filter(s => s.status === 'PENDING').length
    const failedSteps = steps.filter(s => s.status === 'FAILED').length
    
    return NextResponse.json({
      data: steps,
      summary: {
        total: totalSteps,
        completed: completedSteps,
        skipped: skippedSteps,
        inProgress: inProgressSteps,
        pending: pendingSteps,
        failed: failedSteps,
        progressPercentage: totalSteps > 0 
          ? Math.round(((completedSteps + skippedSteps) / totalSteps) * 100) 
          : 0,
      },
      workOrder: {
        id: workOrder.id,
        orderNumber: workOrder.orderNumber,
        status: workOrder.status,
      },
    })
  } catch (error) {
    console.error('Error fetching work order steps:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des étapes' },
      { status: 500 }
    )
  }
}


// POST /api/production/work-orders/[id]/steps
// Add new step to work order


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const userId = getUserId(request)
    
    // Validation schema
    const createSchema = z.object({
      stepNumber: z.number().int().positive().optional(), // Auto-assigned if not provided
      name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(100),
      description: z.string().max(500).optional().nullable(),
      estimatedTime: z.number().positive().optional().nullable(), // in hours
    })
    
    const validatedData = createSchema.parse(body)
    
    // Verify work order exists and is in a state that allows adding steps
    const workOrder = await db.workOrder.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepNumber: 'desc' },
          take: 1,
        },
      },
    })
    
    if (!workOrder) {
      return NextResponse.json(
        { error: 'Ordre de travail non trouvé' },
        { status: 404 }
      )
    }
    
    // Business rule: Steps can only be added to DRAFT or PLANNED orders
    if (workOrder.status !== 'DRAFT' && workOrder.status !== 'PLANNED') {
      return NextResponse.json(
        { error: 'Les étapes ne peuvent être ajoutées qu\'aux ordres en brouillon ou planifiés' },
        { status: 400 }
      )
    }
    
    // Determine step number
    const nextStepNumber = validatedData.stepNumber ?? 
      (workOrder.steps.length > 0 ? workOrder.steps[0].stepNumber + 1 : 1)
    
    // Check if step number already exists
    const existingStep = await db.workOrderStep.findUnique({
      where: {
        workOrderId_stepNumber: {
          workOrderId: id,
          stepNumber: nextStepNumber,
        },
      },
    })
    
    if (existingStep) {
      return NextResponse.json(
        { error: `L'étape numéro ${nextStepNumber} existe déjà` },
        { status: 400 }
      )
    }
    
    // Create step in transaction
    const step = await db.$transaction(async (tx) => {
      const newStep = await tx.workOrderStep.create({
        data: {
          workOrderId: id,
          stepNumber: nextStepNumber,
          name: validatedData.name,
          description: validatedData.description,
          estimatedTime: validatedData.estimatedTime,
          status: StepStatus.PENDING,
        },
      })
      
      // Log creation
      await auditService.logCreate(
        userId,
        'WorkOrderStep',
        newStep.id,
        {
          workOrderId: id,
          stepNumber: nextStepNumber,
          name: validatedData.name,
        },
        `Ajout de l'étape ${nextStepNumber} à l'ordre ${workOrder.orderNumber}`
      )
      
      return newStep
    })
    
    return NextResponse.json(step, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error creating work order step:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'étape' },
      { status: 500 }
    )
  }
}


