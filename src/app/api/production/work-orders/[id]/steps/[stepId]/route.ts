// Production module - Update step status


import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditService } from '@/lib/audit-service'
import { StepStatus, WorkOrderStatus } from '@prisma/client'
import { z } from 'zod'


// HELPER FUNCTIONS


function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'system'
}


// PUT /api/production/work-orders/[id]/steps/[stepId]
// Update step status (start, complete, skip)


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id, stepId } = await params
    const body = await request.json()
    const userId = getUserId(request)
    
    // Validation schema
    const updateSchema = z.object({
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'FAILED']).optional(),
      actualTime: z.number().positive().optional().nullable(), // in hours
      notes: z.string().max(500).optional().nullable(),
    })
    
    const validatedData = updateSchema.parse(body)
    
    // Get the step and work order
    const step = await db.workOrderStep.findUnique({
      where: { id: stepId },
      include: {
        workOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    })
    
    if (!step) {
      return NextResponse.json(
        { error: 'Étape non trouvée' },
        { status: 404 }
      )
    }
    
    // Verify step belongs to the correct work order
    if (step.workOrderId !== id) {
      return NextResponse.json(
        { error: 'L\'étape n\'appartient pas à cet ordre de travail' },
        { status: 400 }
      )
    }
    
    // Business rule: Steps can only be updated for IN_PROGRESS orders
    // (except for PLANNED orders where we allow updates to add notes)
    if (step.workOrder.status !== WorkOrderStatus.IN_PROGRESS && 
        step.workOrder.status !== WorkOrderStatus.PLANNED) {
      return NextResponse.json(
        { error: 'Les étapes ne peuvent être modifiées que pour les ordres en cours ou planifiés' },
        { status: 400 }
      )
    }
    
    // Prepare update data
    const updateData: {
      status?: StepStatus;
      actualTime?: number | null;
      notes?: string | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    } = { ...validatedData }
    
    // Handle status transitions
    if (validatedData.status) {
      const now = new Date()
      
      switch (validatedData.status) {
        case 'IN_PROGRESS':
          // Starting the step
          if (step.status !== 'PENDING') {
            return NextResponse.json(
              { error: 'Seule une étape en attente peut être démarrée' },
              { status: 400 }
            )
          }
          updateData.startedAt = now
          break
          
        case 'COMPLETED':
          // Completing the step
          if (step.status !== 'IN_PROGRESS') {
            return NextResponse.json(
              { error: 'Seule une étape en cours peut être complétée' },
              { status: 400 }
            )
          }
          updateData.completedAt = now
          break
          
        case 'SKIPPED':
          // Skipping the step
          if (step.status === 'COMPLETED' || step.status === 'SKIPPED') {
            return NextResponse.json(
              { error: 'Cette étape ne peut pas être ignorée' },
              { status: 400 }
            )
          }
          break
          
        case 'FAILED':
          // Marking step as failed
          if (step.status !== 'IN_PROGRESS') {
            return NextResponse.json(
              { error: 'Seule une étape en cours peut être marquée comme échouée' },
              { status: 400 }
            )
          }
          break
          
        case 'PENDING':
          // Resetting to pending (should be rare)
          updateData.startedAt = null
          updateData.completedAt = null
          break
      }
    }
    
    // Update step in transaction
    const updatedStep = await db.$transaction(async (tx) => {
      const s = await tx.workOrderStep.update({
        where: { id: stepId },
        data: updateData,
      })
      
      // Log update
      await auditService.logUpdate(
        userId,
        'WorkOrderStep',
        stepId,
        {
          status: step.status,
          actualTime: step.actualTime,
          notes: step.notes,
        },
        updateData,
        `Mise à jour de l'étape ${step.stepNumber} de l'ordre ${step.workOrder.orderNumber}`
      )
      
      return s
    })
    
    // Check if all steps are completed/skipped to potentially auto-update work order
    if (validatedData.status === 'COMPLETED' || validatedData.status === 'SKIPPED') {
      const allSteps = await db.workOrderStep.findMany({
        where: { workOrderId: id },
      })
      
      const allDone = allSteps.every(
        s => s.status === 'COMPLETED' || s.status === 'SKIPPED'
      )
      
      if (allDone) {
        // Include a hint in the response that all steps are done
        return NextResponse.json({
          ...updatedStep,
          _allStepsCompleted: true,
          _message: 'Toutes les étapes sont terminées. Vous pouvez maintenant compléter l\'ordre de travail.',
        })
      }
    }
    
    return NextResponse.json(updatedStep)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error updating work order step:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'étape' },
      { status: 500 }
    )
  }
}


// DELETE /api/production/work-orders/[id]/steps/[stepId]
// Delete a step (only if DRAFT or PLANNED)


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id, stepId } = await params
    const userId = getUserId(request)
    
    // Get the step and work order
    const step = await db.workOrderStep.findUnique({
      where: { id: stepId },
      include: {
        workOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    })
    
    if (!step) {
      return NextResponse.json(
        { error: 'Étape non trouvée' },
        { status: 404 }
      )
    }
    
    // Verify step belongs to the correct work order
    if (step.workOrderId !== id) {
      return NextResponse.json(
        { error: 'L\'étape n\'appartient pas à cet ordre de travail' },
        { status: 400 }
      )
    }
    
    // Business rule: Steps can only be deleted from DRAFT or PLANNED orders
    if (step.workOrder.status !== WorkOrderStatus.DRAFT && 
        step.workOrder.status !== WorkOrderStatus.PLANNED) {
      return NextResponse.json(
        { error: 'Les étapes ne peuvent être supprimées que des ordres en brouillon ou planifiés' },
        { status: 400 }
      )
    }
    
    // Delete step and renumber remaining steps
    await db.$transaction(async (tx) => {
      await tx.workOrderStep.delete({
        where: { id: stepId },
      })
      
      // Renumber remaining steps
      const remainingSteps = await tx.workOrderStep.findMany({
        where: { workOrderId: id },
        orderBy: { stepNumber: 'asc' },
      })
      
      for (let i = 0; i < remainingSteps.length; i++) {
        if (remainingSteps[i].stepNumber !== i + 1) {
          await tx.workOrderStep.update({
            where: { id: remainingSteps[i].id },
            data: { stepNumber: i + 1 },
          })
        }
      }
      
      // Log deletion
      await auditService.logDelete(
        userId,
        'WorkOrderStep',
        stepId,
        step,
        `Suppression de l'étape ${step.stepNumber} de l'ordre ${step.workOrder.orderNumber}`
      )
    })
    
    return NextResponse.json(
      { message: 'Étape supprimée avec succès' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting work order step:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'étape' },
      { status: 500 }
    )
  }
}


