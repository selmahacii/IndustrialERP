// Production module - Start work order with stock reservation


import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditService } from '@/lib/audit-service'
import { WorkOrderStatus, MovementType, ItemType } from '@prisma/client'
import { z } from 'zod'


// HELPER FUNCTIONS


function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'system'
}


// POST /api/production/work-orders/[id]/start
// Start work order (change status to IN_PROGRESS, set actualStart, reserve stock)


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = getUserId(request)
    
    // Get the work order with BOM components
    const workOrder = await db.workOrder.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            boms: {
              where: { isActive: true },
              include: {
                components: {
                  include: {
                    product: {
                      include: {
                        inventory: true,
                      },
                    },
                  },
                },
              },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        },
        items: {
          where: { type: ItemType.INPUT },
          include: {
            product: {
              include: { inventory: true },
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
    
    // Business rule: Only DRAFT or PLANNED orders can be started
    if (workOrder.status !== WorkOrderStatus.DRAFT && 
        workOrder.status !== WorkOrderStatus.PLANNED) {
      return NextResponse.json(
        { error: 'Seuls les ordres en brouillon ou planifiés peuvent être démarrés' },
        { status: 400 }
      )
    }
    
    // Determine input materials
    // Priority: WorkOrderItems > BOM Components
    let inputMaterials: Array<{
      productId: string
      productName: string
      productSku: string
      unit: string
      requiredQty: number
      availableQty: number
      reservedQty: number
    }> = []
    
    if (workOrder.items.length > 0) {
      // Use work order items
      inputMaterials = workOrder.items.map(item => ({
        productId: item.productId,
        productName: item.product.name,
        productSku: item.product.sku,
        unit: item.product.unit,
        requiredQty: item.quantity,
        availableQty: item.product.inventory?.quantity ?? 0,
        reservedQty: item.product.inventory?.reservedQty ?? 0,
      }))
    } else if (workOrder.product.boms.length > 0) {
      // Use BOM components
      const bom = workOrder.product.boms[0]
      inputMaterials = bom.components.map(comp => ({
        productId: comp.productId,
        productName: comp.product.name,
        productSku: comp.product.sku,
        unit: comp.unit,
        requiredQty: comp.quantity * workOrder.quantity,
        availableQty: comp.product.inventory?.quantity ?? 0,
        reservedQty: comp.product.inventory?.reservedQty ?? 0,
      }))
    }
    
    // Check stock availability
    const stockIssues: Array<{
      productName: string
      productSku: string
      required: number
      available: number
    }> = []
    
    for (const material of inputMaterials) {
      const availableForUse = material.availableQty - material.reservedQty
      if (availableForUse < material.requiredQty) {
        stockIssues.push({
          productName: material.productName,
          productSku: material.productSku,
          required: material.requiredQty,
          available: availableForUse,
        })
      }
    }
    
    if (stockIssues.length > 0) {
      return NextResponse.json(
        {
          error: 'Stock insuffisant pour démarrer l\'ordre de travail',
          details: stockIssues.map(s => 
            `${s.productName} (${s.productSku}): Requis ${s.required}, Disponible ${s.available}`
          ),
        },
        { status: 400 }
      )
    }
    
    // Start work order and reserve stock in transaction
    const result = await db.$transaction(async (tx) => {
      const now = new Date()
      
      // Update work order status
      const updatedWorkOrder = await tx.workOrder.update({
        where: { id },
        data: {
          status: WorkOrderStatus.IN_PROGRESS,
          actualStart: now,
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
      
      // Create work order items if they don't exist (from BOM)
      if (workOrder.items.length === 0 && inputMaterials.length > 0) {
        for (const material of inputMaterials) {
          await tx.workOrderItem.create({
            data: {
              workOrderId: id,
              productId: material.productId,
              quantity: material.requiredQty,
              type: ItemType.INPUT,
            },
          })
        }
        
        // Also create the output item
        await tx.workOrderItem.create({
          data: {
            workOrderId: id,
            productId: workOrder.productId,
            quantity: workOrder.quantity,
            type: ItemType.OUTPUT,
          },
        })
      }
      
      // Reserve stock for each input material
      for (const material of inputMaterials) {
        // Get current inventory
        const inventory = await tx.inventory.findUnique({
          where: { productId: material.productId },
        })
        
        if (!inventory) {
          throw new Error(`Inventory not found for product ${material.productId}`)
        }
        
        const previousQty = inventory.quantity
        const previousReserved = inventory.reservedQty
        const newReserved = previousReserved + material.requiredQty
        
        // Update inventory reserved quantity
        await tx.inventory.update({
          where: { productId: material.productId },
          data: {
            reservedQty: newReserved,
          },
        })
        
        // Create inventory movement for reservation
        await tx.inventoryMovement.create({
          data: {
            productId: material.productId,
            type: MovementType.RESERVATION,
            quantity: material.requiredQty,
            previousQty: previousQty,
            newQty: previousQty, // Quantity doesn't change, only reserved
            referenceType: 'WORK_ORDER',
            referenceId: id,
            notes: `Réservation pour l'ordre de travail ${workOrder.orderNumber}`,
            userId,
          },
        })
      }
      
      // Log the start action
      await auditService.logAction(
        userId,
        'UPDATE',
        'WorkOrder',
        id,
        {
          newValue: {
            status: 'IN_PROGRESS',
            actualStart: now,
            materialsReserved: inputMaterials.length,
          },
          description: `Démarrage de l'ordre de travail ${workOrder.orderNumber} avec réservation de stock`,
        }
      )
      
      return {
        workOrder: updatedWorkOrder,
        materialsReserved: inputMaterials.map(m => ({
          productId: m.productId,
          productName: m.productName,
          quantity: m.requiredQty,
          unit: m.unit,
        })),
      }
    })
    
    return NextResponse.json({
      message: 'Ordre de travail démarré avec succès',
      workOrder: result.workOrder,
      materialsReserved: result.materialsReserved,
    })
  } catch (error) {
    console.error('Error starting work order:', error)
    return NextResponse.json(
      { error: 'Erreur lors du démarrage de l\'ordre de travail' },
      { status: 500 }
    )
  }
}


