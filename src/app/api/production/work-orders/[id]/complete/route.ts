// Production module - Complete work order with inventory update


import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditService } from '@/lib/audit-service'
import { WorkOrderStatus, MovementType, ItemType, ProductType } from '@prisma/client'
import { z } from 'zod'


// HELPER FUNCTIONS


function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'system'
}


// POST /api/production/work-orders/[id]/complete
// Complete work order (update stock, create finished goods)


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const userId = getUserId(request)
    
    // Validation schema
    const completeSchema = z.object({
      completedQty: z.number().positive().optional(), // Defaults to planned quantity
      notes: z.string().max(500).optional().nullable(),
      wasteItems: z.array(z.object({
        productId: z.string(),
        quantity: z.number().positive(),
        notes: z.string().optional().nullable(),
      })).optional(),
    })
    
    const validatedData = completeSchema.parse(body)
    
    // Get the work order with all related data
    const workOrder = await db.workOrder.findUnique({
      where: { id },
      include: {
        product: {
          include: { inventory: true },
        },
        items: {
          include: {
            product: {
              include: { inventory: true },
            },
          },
        },
        steps: true,
      },
    })
    
    if (!workOrder) {
      return NextResponse.json(
        { error: 'Ordre de travail non trouvé' },
        { status: 404 }
      )
    }
    
    // Business rule: Only IN_PROGRESS orders can be completed
    if (workOrder.status !== WorkOrderStatus.IN_PROGRESS) {
      return NextResponse.json(
        { error: 'Seuls les ordres en cours peuvent être complétés' },
        { status: 400 }
      )
    }
    
    // Determine completed quantity
    const completedQty = validatedData.completedQty ?? workOrder.quantity
    
    // Validate completed quantity doesn't exceed planned
    if (completedQty > workOrder.quantity) {
      return NextResponse.json(
        { error: 'La quantité complétée ne peut pas dépasser la quantité planifiée' },
        { status: 400 }
      )
    }
    
    // Check if all steps are completed or skipped (if steps exist)
    if (workOrder.steps.length > 0) {
      const incompleteSteps = workOrder.steps.filter(
        s => s.status !== 'COMPLETED' && s.status !== 'SKIPPED'
      )
      
      if (incompleteSteps.length > 0) {
        return NextResponse.json(
          {
            error: 'Toutes les étapes doivent être terminées ou ignorées avant de compléter l\'ordre',
            incompleteSteps: incompleteSteps.map(s => ({
              stepNumber: s.stepNumber,
              name: s.name,
              status: s.status,
            })),
          },
          { status: 400 }
        )
      }
    }
    
    // Complete work order and update inventory in transaction
    const result = await db.$transaction(async (tx) => {
      const now = new Date()
      
      // Update work order
      const updatedWorkOrder = await tx.workOrder.update({
        where: { id },
        data: {
          status: WorkOrderStatus.COMPLETED,
          completedQty,
          actualEnd: now,
          notes: validatedData.notes 
            ? `${workOrder.notes || ''}\n${validatedData.notes}`.trim()
            : workOrder.notes,
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
        },
      })
      
      // Process input items - consume from inventory and release reservations
      const inputItems = workOrder.items.filter(i => i.type === ItemType.INPUT)
      const processedInputs: Array<{
        productId: string
        productName: string
        quantityConsumed: number
        quantityReleased: number
      }> = []
      
      for (const item of inputItems) {
        const inventory = item.product.inventory
        if (!inventory) continue
        
        const previousQty = inventory.quantity
        const previousReserved = inventory.reservedQty
        
        // Calculate quantities
        const quantityToConsume = item.quantity
        const quantityToRelease = item.quantity // Release the reservation
        
        // Update inventory: reduce quantity and release reservation
        const newQty = previousQty - quantityToConsume
        const newReserved = Math.max(0, previousReserved - quantityToRelease)
        
        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            quantity: newQty,
            reservedQty: newReserved,
            lastRestockedAt: now,
          },
        })
        
        // Create OUT movement for consumption
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: MovementType.OUT,
            quantity: quantityToConsume,
            previousQty,
            newQty,
            referenceType: 'WORK_ORDER',
            referenceId: id,
            notes: `Consommation pour l'ordre de travail ${workOrder.orderNumber}`,
            userId,
          },
        })
        
        // Create RELEASE movement for reservation release
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: MovementType.RELEASE,
            quantity: quantityToRelease,
            previousQty: previousReserved,
            newQty: newReserved,
            referenceType: 'WORK_ORDER',
            referenceId: id,
            notes: `Libération de réservation pour l'ordre de travail ${workOrder.orderNumber}`,
            userId,
          },
        })
        
        processedInputs.push({
          productId: item.productId,
          productName: item.product.name,
          quantityConsumed: quantityToConsume,
          quantityReleased: quantityToRelease,
        })
      }
      
      // Process output item - add finished goods to inventory
      const outputItems = workOrder.items.filter(i => i.type === ItemType.OUTPUT)
      const processedOutputs: Array<{
        productId: string
        productName: string
        quantityProduced: number
      }> = []
      
      for (const item of outputItems) {
        let inventory = item.product.inventory
        
        // If no inventory record exists, create one
        if (!inventory) {
          inventory = await tx.inventory.create({
            data: {
              productId: item.productId,
              quantity: 0,
              reservedQty: 0,
              minStockLevel: 0,
            },
          })
        }
        
        const previousQty = inventory.quantity
        const quantityProduced = completedQty // Use completed quantity
        const newQty = previousQty + quantityProduced
        
        // Update inventory
        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            quantity: newQty,
            lastRestockedAt: now,
          },
        })
        
        // Create IN movement for finished goods
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: MovementType.IN,
            quantity: quantityProduced,
            previousQty,
            newQty,
            referenceType: 'WORK_ORDER',
            referenceId: id,
            notes: `Production complète - Ordre ${workOrder.orderNumber}`,
            userId,
          },
        })
        
        processedOutputs.push({
          productId: item.productId,
          productName: item.product.name,
          quantityProduced,
        })
      }
      
      // Process waste items if provided
      const processedWaste: Array<{
        productId: string
        productName: string
        quantityWasted: number
      }> = []
      
      if (validatedData.wasteItems && validatedData.wasteItems.length > 0) {
        for (const waste of validatedData.wasteItems) {
          const product = await tx.product.findUnique({
            where: { id: waste.productId },
            include: { inventory: true },
          })
          
          if (!product || !product.inventory) continue
          
          const previousQty = product.inventory.quantity
          const newQty = previousQty - waste.quantity
          
          // Update inventory
          await tx.inventory.update({
            where: { productId: waste.productId },
            data: { quantity: newQty },
          })
          
          // Create waste movement
          await tx.inventoryMovement.create({
            data: {
              productId: waste.productId,
              type: MovementType.OUT,
              quantity: waste.quantity,
              previousQty,
              newQty,
              referenceType: 'WORK_ORDER',
              referenceId: id,
              notes: `Déchet - Ordre ${workOrder.orderNumber}: ${waste.notes || ''}`,
              userId,
            },
          })
          
          // Create work order item for waste
          await tx.workOrderItem.create({
            data: {
              workOrderId: id,
              productId: waste.productId,
              quantity: waste.quantity,
              type: ItemType.WASTE,
              notes: waste.notes,
            },
          })
          
          processedWaste.push({
            productId: waste.productId,
            productName: product.name,
            quantityWasted: waste.quantity,
          })
        }
      }
      
      // Log the completion
      await auditService.logAction(
        userId,
        'UPDATE',
        'WorkOrder',
        id,
        {
          newValue: {
            status: 'COMPLETED',
            completedQty,
            actualEnd: now,
          },
          description: `Completion de l'ordre de travail ${workOrder.orderNumber} - ${completedQty} ${workOrder.product.unit} produites`,
        }
      )
      
      return {
        workOrder: updatedWorkOrder,
        summary: {
          plannedQty: workOrder.quantity,
          completedQty,
          inputs: processedInputs,
          outputs: processedOutputs,
          waste: processedWaste,
        },
      }
    })
    
    return NextResponse.json({
      message: 'Ordre de travail complété avec succès',
      workOrder: result.workOrder,
      summary: result.summary,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error completing work order:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la completion de l\'ordre de travail' },
      { status: 500 }
    )
  }
}


