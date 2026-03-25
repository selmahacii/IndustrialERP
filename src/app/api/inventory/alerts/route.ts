import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";


// GET /api/inventory/alerts
// Get all products below minimum stock level


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Filter parameters
    const severity = searchParams.get("severity"); // CRITICAL, HIGH, MEDIUM, LOW
    const productType = searchParams.get("productType");
    const categoryId = searchParams.get("categoryId");

    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    // Build where clause for products
    const productWhere: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (productType) {
      productWhere.type = productType as Prisma.EnumProductTypeFilter["equals"];
    }

    if (categoryId) {
      productWhere.categoryId = categoryId;
    }

    // Get all inventory items with low stock
    const allInventory = await db.inventory.findMany({
      where: {
        product: productWhere,
      },
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

    // Filter for low stock items (quantity <= minStockLevel)
    let lowStockItems = allInventory.filter(
      (item) => item.quantity <= item.minStockLevel && item.minStockLevel > 0
    );

    // Calculate alert details for each item
    let alerts = lowStockItems.map((item) => {
      const shortage = item.minStockLevel - item.quantity;
      const shortagePercent =
        item.minStockLevel > 0
          ? ((item.minStockLevel - item.quantity) / item.minStockLevel) * 100
          : 100;

      // Calculate severity
      let alertSeverity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
      if (item.quantity === 0) {
        alertSeverity = "CRITICAL";
      } else {
        const ratio = item.quantity / item.minStockLevel;
        if (ratio <= 0.25) alertSeverity = "CRITICAL";
        else if (ratio <= 0.5) alertSeverity = "HIGH";
        else if (ratio <= 0.75) alertSeverity = "MEDIUM";
        else alertSeverity = "LOW";
      }

      // Calculate reorder recommendation
      const reorderQty = item.reorderPoint
        ? Math.max(item.reorderPoint - item.quantity, item.minStockLevel - item.quantity)
        : item.minStockLevel - item.quantity;

      // Estimate value at risk
      const valueAtRisk = shortage * item.product.costPrice;

      return {
        id: item.id,
        productId: item.productId,
        product: item.product,
        currentQty: item.quantity,
        minStockLevel: item.minStockLevel,
        maxStockLevel: item.maxStockLevel,
        reorderPoint: item.reorderPoint,
        reservedQty: item.reservedQty,
        availableQty: item.quantity - item.reservedQty,
        location: item.location,
        lastRestockedAt: item.lastRestockedAt,
        updatedAt: item.updatedAt,
        // Alert-specific fields
        severity: alertSeverity,
        shortage,
        shortagePercent,
        reorderQty,
        valueAtRisk,
        isOutOfStock: item.quantity === 0,
        hasReservation: item.reservedQty > 0,
      };
    });

    // Filter by severity if specified
    if (severity && ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(severity)) {
      alerts = alerts.filter((a) => a.severity === severity);
    }

    // Sort by severity (critical first) then by shortage value
    alerts.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const severityDiff =
        severityOrder[a.severity as keyof typeof severityOrder] -
        severityOrder[b.severity as keyof typeof severityOrder];
      if (severityDiff !== 0) return severityDiff;
      return b.valueAtRisk - a.valueAtRisk;
    });

    // Paginate
    const paginatedAlerts = alerts.slice(skip, skip + limit);
    const totalPages = Math.ceil(alerts.length / limit);

    // Calculate summary statistics
    const summary = {
      totalAlerts: alerts.length,
      bySeverity: {
        critical: alerts.filter((a) => a.severity === "CRITICAL").length,
        high: alerts.filter((a) => a.severity === "HIGH").length,
        medium: alerts.filter((a) => a.severity === "MEDIUM").length,
        low: alerts.filter((a) => a.severity === "LOW").length,
      },
      byType: {
        rawMaterial: alerts.filter((a) => a.product.type === "RAW_MATERIAL").length,
        workInProgress: alerts.filter((a) => a.product.type === "WORK_IN_PROGRESS").length,
        finishedGood: alerts.filter((a) => a.product.type === "FINISHED_GOOD").length,
        consumable: alerts.filter((a) => a.product.type === "CONSUMABLE").length,
      },
      outOfStock: alerts.filter((a) => a.isOutOfStock).length,
      totalValueAtRisk: alerts.reduce((sum, a) => sum + a.valueAtRisk, 0),
      totalShortage: alerts.reduce((sum, a) => sum + a.shortage, 0),
    };

    // Get recent movements for alert items (for context)
    const recentMovements = await db.inventoryMovement.findMany({
      where: {
        productId: { in: alerts.map((a) => a.productId) },
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      data: paginatedAlerts,
      pagination: {
        page,
        limit,
        total: alerts.length,
        totalPages,
        hasMore: page < totalPages,
      },
      summary,
      recentMovements,
    });
  } catch (error) {
    console.error("Error fetching stock alerts:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des alertes de stock" },
      { status: 500 }
    );
  }
}


