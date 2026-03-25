// CRITICAL: Uses Prisma transactions for atomic updates


import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import {
  inventoryMovementSchema,
  inventoryAdjustmentSchema,
  formatValidationErrors,
  MovementType,
} from "@/lib/validations";
import { Prisma } from "@prisma/client";


// GET /api/inventory/movements
// List movements with filtering


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    // Filter parameters
    const productId = searchParams.get("productId");
    const type = searchParams.get("type") as MovementType | null;
    const userId = searchParams.get("userId");
    const referenceType = searchParams.get("referenceType");
    const referenceId = searchParams.get("referenceId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: Prisma.InventoryMovementWhereInput = {};

    if (productId) {
      where.productId = productId;
    }

    if (type && ["IN", "OUT", "TRANSFER", "ADJUSTMENT", "RESERVATION", "RELEASE"].includes(type)) {
      where.type = type;
    }

    if (userId) {
      where.userId = userId;
    }

    if (referenceType) {
      where.referenceType = referenceType;
    }

    if (referenceId) {
      where.referenceId = referenceId;
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Fetch movements with count
    const [movements, total] = await Promise.all([
      db.inventoryMovement.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true,
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
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.inventoryMovement.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    // Summary statistics
    const summary = {
      totalMovements: total,
      totalIn: movements.filter((m) => m.type === "IN").reduce((sum, m) => sum + m.quantity, 0),
      totalOut: movements.filter((m) => m.type === "OUT").reduce((sum, m) => sum + m.quantity, 0),
      totalAdjustments: movements.filter((m) => m.type === "ADJUSTMENT").length,
    };

    return NextResponse.json({
      data: movements,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      summary,
    });
  } catch (error) {
    console.error("Error fetching movements:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des mouvements" },
      { status: 500 }
    );
  }
}


// POST /api/inventory/movements
// Create movement (IN, OUT, ADJUSTMENT) - ATOMIC UPDATE


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = request.headers.get("x-user-id") || "system";

    // Check if this is an adjustment request
    const isAdjustment = body.previousQty !== undefined && body.newQty !== undefined;

    let movementData: {
      productId: string;
      type: MovementType;
      quantity: number;
      referenceType?: string | null;
      referenceId?: string | null;
      notes?: string | null;
    };

    if (isAdjustment) {
      // Validate adjustment schema
      const validationResult = inventoryAdjustmentSchema.safeParse(body);
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
      movementData = {
        productId: data.productId,
        type: "ADJUSTMENT" as MovementType,
        quantity: Math.abs(data.newQty - data.previousQty),
        referenceType: "ADJUSTMENT",
        referenceId: null,
        notes: `${data.reason}${data.notes ? ` - ${data.notes}` : ""}`,
      };
    } else {
      // Validate movement schema
      const validationResult = inventoryMovementSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: "Données invalides",
            details: formatValidationErrors(validationResult.error),
          },
          { status: 400 }
        );
      }

      movementData = validationResult.data;
    }

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 400 }
      );
    }

    // Execute within a transaction for atomicity
    const result = await db.$transaction(async (tx) => {
      // Get current inventory with lock (using findUnique within transaction)
      const inventory = await tx.inventory.findUnique({
        where: { productId: movementData.productId },
        include: {
          product: {
            select: { id: true, name: true, sku: true, isActive: true },
          },
        },
      });

      if (!inventory) {
        throw new Error("INVENTORY_NOT_FOUND");
      }

      if (!inventory.product.isActive) {
        throw new Error("PRODUCT_INACTIVE");
      }

      const previousQty = inventory.quantity;
      let newQty: number;

      // Calculate new quantity based on movement type
      switch (movementData.type) {
        case "IN":
          newQty = previousQty + movementData.quantity;
          break;

        case "OUT":
          // Validate no negative stock
          if (previousQty < movementData.quantity) {
            throw new Error("INSUFFICIENT_STOCK");
          }
          newQty = previousQty - movementData.quantity;
          break;

        case "ADJUSTMENT":
          if (isAdjustment) {
            // For adjustments, use the provided newQty
            newQty = body.newQty;
          } else {
            // For generic adjustment, the quantity field represents the delta
            newQty = previousQty + movementData.quantity;
            if (newQty < 0) {
              throw new Error("NEGATIVE_STOCK");
            }
          }
          break;

        case "RESERVATION":
          // Reserve stock
          const availableQty = previousQty - inventory.reservedQty;
          if (availableQty < movementData.quantity) {
            throw new Error("INSUFFICIENT_AVAILABLE_STOCK");
          }
          // Update reservedQty instead of quantity
          await tx.inventory.update({
            where: { productId: movementData.productId },
            data: {
              reservedQty: inventory.reservedQty + movementData.quantity,
              updatedAt: new Date(),
            },
          });
          newQty = previousQty; // Quantity doesn't change for reservations
          break;

        case "RELEASE":
          // Release reservation
          if (inventory.reservedQty < movementData.quantity) {
            throw new Error("INSUFFICIENT_RESERVATION");
          }
          await tx.inventory.update({
            where: { productId: movementData.productId },
            data: {
              reservedQty: inventory.reservedQty - movementData.quantity,
              updatedAt: new Date(),
            },
          });
          newQty = previousQty; // Quantity doesn't change for releases
          break;

        case "TRANSFER":
          // Transfer requires additional destination
          throw new Error("TRANSFER_REQUIRES_DESTINATION");

        default:
          throw new Error("INVALID_MOVEMENT_TYPE");
      }

      // Update inventory for IN, OUT, ADJUSTMENT
      if (["IN", "OUT", "ADJUSTMENT"].includes(movementData.type)) {
        await tx.inventory.update({
          where: { productId: movementData.productId },
          data: {
            quantity: newQty,
            lastRestockedAt: movementData.type === "IN" ? new Date() : undefined,
            updatedAt: new Date(),
          },
        });
      }

      // Create movement record
      const movement = await tx.inventoryMovement.create({
        data: {
          productId: movementData.productId,
          type: movementData.type,
          quantity: movementData.quantity,
          previousQty,
          newQty,
          referenceType: movementData.referenceType,
          referenceId: movementData.referenceId,
          notes: movementData.notes,
          userId,
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
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return { movement, inventory, previousQty, newQty };
    });

    // Log audit
    await auditService.logCreate(
      userId,
      "InventoryMovement",
      result.movement.id,
      {
        productId: result.movement.productId,
        productName: result.movement.product.name,
        type: result.movement.type,
        quantity: result.movement.quantity,
        previousQty: result.previousQty,
        newQty: result.newQty,
        reference: result.movement.referenceType,
      },
      `Mouvement de stock: ${result.movement.type} - ${result.movement.quantity} ${result.movement.product.unit} de ${result.movement.product.name}`
    );

    // Check if this created a low stock alert
    const inventory = await db.inventory.findUnique({
      where: { productId: movementData.productId },
    });

    if (inventory && result.newQty <= inventory.minStockLevel && result.previousQty > inventory.minStockLevel) {
      // Log stock alert
      await auditService.logAction(
        userId,
        "CREATE",
        "StockAlert",
        movementData.productId,
        {
          description: `Alerte de stock bas déclenchée pour ${result.movement.product.name}`,
          newValue: {
            currentQty: result.newQty,
            minStockLevel: inventory.minStockLevel,
            shortage: inventory.minStockLevel - result.newQty,
          },
        }
      );
    }

    return NextResponse.json(
      {
        data: result.movement,
        inventory: {
          previousQty: result.previousQty,
          newQty: result.newQty,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating movement:", error);

    // Handle specific errors
    if (error instanceof Error) {
      switch (error.message) {
        case "INVENTORY_NOT_FOUND":
          return NextResponse.json(
            { error: "Inventaire non trouvé pour ce produit" },
            { status: 404 }
          );
        case "PRODUCT_INACTIVE":
          return NextResponse.json(
            { error: "Ce produit est inactif" },
            { status: 400 }
          );
        case "INSUFFICIENT_STOCK":
          return NextResponse.json(
            { error: "Stock insuffisant pour effectuer cette sortie" },
            { status: 400 }
          );
        case "INSUFFICIENT_AVAILABLE_STOCK":
          return NextResponse.json(
            { error: "Stock disponible insuffisant (une partie est réservée)" },
            { status: 400 }
          );
        case "INSUFFICIENT_RESERVATION":
          return NextResponse.json(
            { error: "Quantité réservée insuffisante" },
            { status: 400 }
          );
        case "NEGATIVE_STOCK":
          return NextResponse.json(
            { error: "L'ajustement entraînerait un stock négatif" },
            { status: 400 }
          );
        case "TRANSFER_REQUIRES_DESTINATION":
          return NextResponse.json(
            { error: "Les transferts nécessitent une destination" },
            { status: 400 }
          );
        case "INVALID_MOVEMENT_TYPE":
          return NextResponse.json(
            { error: "Type de mouvement invalide" },
            { status: 400 }
          );
      }
    }

    return NextResponse.json(
      { error: "Erreur lors de la création du mouvement" },
      { status: 500 }
    );
  }
}


