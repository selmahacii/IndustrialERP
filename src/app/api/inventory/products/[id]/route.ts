import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import {
  productUpdateSchema,
  formatValidationErrors,
} from "@/lib/validations";


// GET /api/inventory/products/[id]
// Get product details with inventory info


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await db.product.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, description: true },
        },
        inventory: {
          select: {
            id: true,
            quantity: true,
            reservedQty: true,
            minStockLevel: true,
            maxStockLevel: true,
            reorderPoint: true,
            location: true,
            lastRestockedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            inventoryMovements: true,
            workOrderItems: true,
            bomComponents: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Produit non trouvé" },
        { status: 404 }
      );
    }

    // Calculate stock status
    const stockStatus = {
      available: product.inventory
        ? product.inventory.quantity - product.inventory.reservedQty
        : 0,
      isLowStock: product.inventory
        ? product.inventory.quantity <= product.inventory.minStockLevel
        : false,
      isOverStock: product.inventory?.maxStockLevel
        ? product.inventory.quantity > product.inventory.maxStockLevel
        : false,
    };

    return NextResponse.json({
      data: {
        ...product,
        stockStatus,
      },
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du produit" },
      { status: 500 }
    );
  }
}


// PUT /api/inventory/products/[id]
// Update product details


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = productUpdateSchema.safeParse(body);
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

    // Check if product exists
    const existingProduct = await db.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Produit non trouvé" },
        { status: 404 }
      );
    }

    // Check SKU uniqueness if being updated
    if (data.sku && data.sku !== existingProduct.sku) {
      const skuExists = await db.product.findUnique({
        where: { sku: data.sku },
      });

      if (skuExists) {
        return NextResponse.json(
          { error: "Un produit avec ce code SKU existe déjà" },
          { status: 409 }
        );
      }
    }

    // Validate category exists if being updated
    if (data.categoryId) {
      const category = await db.category.findUnique({
        where: { id: data.categoryId },
      });

      if (!category) {
        return NextResponse.json(
          { error: "La catégorie spécifiée n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Update product
    const updatedProduct = await db.product.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
        inventory: {
          select: {
            quantity: true,
            reservedQty: true,
            minStockLevel: true,
            maxStockLevel: true,
          },
        },
      },
    });

    // Log audit
    const userId = request.headers.get("x-user-id") || "system";
    await auditService.logUpdate(
      userId,
      "Product",
      id,
      existingProduct,
      updatedProduct,
      `Produit mis à jour: ${updatedProduct.name} (${updatedProduct.sku})`
    );

    return NextResponse.json({ data: updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du produit" },
      { status: 500 }
    );
  }
}


// DELETE /api/inventory/products/[id]
// Soft delete product (set isActive = false)


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if product exists
    const existingProduct = await db.product.findUnique({
      where: { id },
      include: {
        inventory: true,
        _count: {
          select: {
            inventoryMovements: true,
            workOrderItems: true,
          },
        },
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Produit non trouvé" },
        { status: 404 }
      );
    }

    // Check if product can be deactivated
    if (existingProduct._count.workOrderItems > 0) {
      return NextResponse.json(
        {
          error:
            "Ce produit ne peut pas être désactivé car il est utilisé dans des ordres de travail",
        },
        { status: 400 }
      );
    }

    // Soft delete (set isActive = false)
    const updatedProduct = await db.product.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Log audit
    const userId = request.headers.get("x-user-id") || "system";
    await auditService.logDelete(
      userId,
      "Product",
      id,
      existingProduct,
      `Produit désactivé: ${existingProduct.name} (${existingProduct.sku})`
    );

    return NextResponse.json({
      data: updatedProduct,
      message: "Produit désactivé avec succès",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du produit" },
      { status: 500 }
    );
  }
}


