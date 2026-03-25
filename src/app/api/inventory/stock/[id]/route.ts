import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import {
  inventoryUpdateSchema,
  formatValidationErrors,
} from "@/lib/validations";


// GET /api/inventory/stock/[id]
// Get stock details for a specific inventory item


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const inventory = await db.inventory.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "Article de stock non trouvé" },
        { status: 404 }
      );
    }

    // Get recent movements for this inventory item
    const recentMovements = await db.inventoryMovement.findMany({
      where: { productId: inventory.productId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Calculate stock metrics
    const stockMetrics = {
      availableQty: inventory.quantity - inventory.reservedQty,
      isLowStock: inventory.quantity <= inventory.minStockLevel,
      isOverStock: inventory.maxStockLevel
        ? inventory.quantity > inventory.maxStockLevel
        : false,
      stockPercentage: inventory.maxStockLevel
        ? (inventory.quantity / inventory.maxStockLevel) * 100
        : null,
      minStockPercent:
        inventory.minStockLevel > 0
          ? (inventory.quantity / inventory.minStockLevel) * 100
          : null,
      shortage:
        inventory.quantity < inventory.minStockLevel
          ? inventory.minStockLevel - inventory.quantity
          : 0,
      reorderNeeded:
        inventory.reorderPoint && inventory.quantity <= inventory.reorderPoint,
    };

    // Calculate stock value
    const stockValue = {
      atCost: inventory.quantity * inventory.product.costPrice,
      atPrice: inventory.quantity * inventory.product.unitPrice,
      potentialProfit:
        inventory.quantity *
        (inventory.product.unitPrice - inventory.product.costPrice),
    };

    return NextResponse.json({
      data: {
        ...inventory,
        stockMetrics,
        stockValue,
        recentMovements,
      },
    });
  } catch (error) {
    console.error("Error fetching stock item:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'article de stock" },
      { status: 500 }
    );
  }
}


// PUT /api/inventory/stock/[id]
// Update stock thresholds (minStockLevel, maxStockLevel)


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = inventoryUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: formatValidationErrors(validationResult.error),
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if inventory item exists
    const existingInventory = await db.inventory.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, name: true, sku: true },
        },
      },
    });

    if (!existingInventory) {
      return NextResponse.json(
        { error: "Article de stock non trouvé" },
        { status: 404 }
      );
    }

    // Validate thresholds
    if (data.minStockLevel !== undefined && data.maxStockLevel !== undefined) {
      if (data.minStockLevel > data.maxStockLevel) {
        return NextResponse.json(
          { error: "Le seuil minimum ne peut pas être supérieur au seuil maximum" },
          { status: 400 }
        );
      }
    }

    if (
      data.reorderPoint !== undefined &&
      data.minStockLevel !== undefined &&
      data.reorderPoint < data.minStockLevel
    ) {
      return NextResponse.json(
        { error: "Le point de commande ne peut pas être inférieur au seuil minimum" },
        { status: 400 }
      );
    }

    // Only allow updating thresholds, not quantity directly
    // Quantity changes should go through the movements API
    const allowedFields = [
      "minStockLevel",
      "maxStockLevel",
      "reorderPoint",
      "location",
    ];

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    for (const field of allowedFields) {
      if (data[field as keyof typeof data] !== undefined) {
        updateData[field] = data[field as keyof typeof data];
      }
    }

    // Update inventory
    const updatedInventory = await db.inventory.update({
      where: { id },
      data: updateData,
      include: {
        product: {
          include: {
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Log audit
    const userId = request.headers.get("x-user-id") || "system";
    await auditService.logUpdate(
      userId,
      "Inventory",
      id,
      existingInventory,
      updatedInventory,
      `Seuils de stock mis à jour pour ${existingInventory.product.name} (${existingInventory.product.sku})`
    );

    // Check if this update resolves a stock alert
    const wasLowStock =
      existingInventory.quantity <= existingInventory.minStockLevel;
    const isNowLowStock =
      updatedInventory.quantity <= updatedInventory.minStockLevel;

    if (wasLowStock && !isNowLowStock) {
      // Alert resolved by raising minStockLevel above current quantity
      await auditService.logAction(
        userId,
        "UPDATE",
        "Inventory",
        id,
        {
          description: `Alerte de stock bas résolue pour ${existingInventory.product.name}`,
          newValue: { previousMinStockLevel: existingInventory.minStockLevel },
        }
      );
    }

    return NextResponse.json({
      data: {
        ...updatedInventory,
        stockMetrics: {
          availableQty:
            updatedInventory.quantity - updatedInventory.reservedQty,
          isLowStock:
            updatedInventory.quantity <= updatedInventory.minStockLevel,
          isOverStock: updatedInventory.maxStockLevel
            ? updatedInventory.quantity > updatedInventory.maxStockLevel
            : false,
        },
      },
    });
  } catch (error) {
    console.error("Error updating stock item:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'article de stock" },
      { status: 500 }
    );
  }
}


