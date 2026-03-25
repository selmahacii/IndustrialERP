import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";


// GET /api/inventory/stock
// List all inventory with stock levels
// Query param: ?alerts=true for low stock alerts


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Check if this is an alerts request
    const alertsOnly = searchParams.get("alerts") === "true";

    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    // Filter parameters
    const productId = searchParams.get("productId");
    const location = searchParams.get("location");
    const productType = searchParams.get("productType");
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search");

    // Build where clause
    const where: Prisma.InventoryWhereInput = {};

    if (productId) {
      where.productId = productId;
    }

    if (location) {
      where.location = { contains: location };
    }

    // Product-related filters
    if (productType || categoryId || search) {
      where.product = {};
      
      if (productType) {
        where.product.type = productType as Prisma.EnumProductTypeFilter["equals"];
      }
      
      if (categoryId) {
        where.product.categoryId = categoryId;
      }
      
      if (search) {
        where.product.OR = [
          { name: { contains: search } },
          { sku: { contains: search } },
        ];
      }
    }

    // For alerts, filter by low stock
    if (alertsOnly) {
      // Get all inventory items and filter in-memory for SQLite compatibility
      const allInventory = await db.inventory.findMany({
        where: {
          product: {
            isActive: true,
          },
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
      const lowStockItems = allInventory.filter(
        (item) => item.quantity <= item.minStockLevel
      );

      // Calculate severity
      const alertsWithSeverity = lowStockItems.map((item) => ({
        ...item,
        severity: calculateAlertSeverity(item),
        shortage: item.minStockLevel - item.quantity,
        shortagePercent:
          item.minStockLevel > 0
            ? ((item.minStockLevel - item.quantity) / item.minStockLevel) * 100
            : 100,
      }));

      // Sort by severity (critical first) then by shortage
      alertsWithSeverity.sort((a, b) => {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const severityDiff =
          severityOrder[a.severity as keyof typeof severityOrder] -
          severityOrder[b.severity as keyof typeof severityOrder];
        if (severityDiff !== 0) return severityDiff;
        return b.shortage - a.shortage;
      });

      // Paginate results
      const paginatedAlerts = alertsWithSeverity.slice(skip, skip + limit);

      return NextResponse.json({
        data: paginatedAlerts,
        pagination: {
          page,
          limit,
          total: alertsWithSeverity.length,
          totalPages: Math.ceil(alertsWithSeverity.length / limit),
          hasMore: skip + limit < alertsWithSeverity.length,
        },
        summary: {
          totalAlerts: alertsWithSeverity.length,
          critical: alertsWithSeverity.filter((a) => a.severity === "CRITICAL")
            .length,
          high: alertsWithSeverity.filter((a) => a.severity === "HIGH").length,
          medium: alertsWithSeverity.filter((a) => a.severity === "MEDIUM")
            .length,
          low: alertsWithSeverity.filter((a) => a.severity === "LOW").length,
        },
      });
    }

    // Regular inventory listing
    const [inventory, total] = await Promise.all([
      db.inventory.findMany({
        where,
        include: {
          product: {
            include: {
              category: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      db.inventory.count({ where }),
    ]);

    // Add stock status to each item
    const inventoryWithStatus = inventory.map((item) => ({
      ...item,
      availableQty: item.quantity - item.reservedQty,
      isLowStock: item.quantity <= item.minStockLevel,
      isOverStock: item.maxStockLevel
        ? item.quantity > item.maxStockLevel
        : false,
      stockPercentage:
        item.maxStockLevel && item.maxStockLevel > 0
          ? (item.quantity / item.maxStockLevel) * 100
          : null,
    }));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: inventoryWithStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      summary: {
        totalItems: total,
        lowStockCount: inventoryWithStatus.filter((i) => i.isLowStock).length,
        overStockCount: inventoryWithStatus.filter((i) => i.isOverStock)
          .length,
        totalValue: inventoryWithStatus.reduce(
          (sum, item) => sum + item.quantity * item.product.costPrice,
          0
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du stock" },
      { status: 500 }
    );
  }
}


// Helper: Calculate Alert Severity


function calculateAlertSeverity(item: {
  quantity: number;
  minStockLevel: number;
}): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (item.quantity === 0) return "CRITICAL";

  const ratio = item.quantity / item.minStockLevel;

  if (ratio <= 0.25) return "CRITICAL";
  if (ratio <= 0.5) return "HIGH";
  if (ratio <= 0.75) return "MEDIUM";
  return "LOW";
}


