import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import {
  productCreateSchema,
  formatValidationErrors,
  ProductType,
} from "@/lib/validations";
import { Prisma } from "@prisma/client";


// GET /api/inventory/products
// List products with pagination, filtering, and search


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    // Filter parameters
    const categoryId = searchParams.get("categoryId");
    const type = searchParams.get("type") as ProductType | null;
    const search = searchParams.get("search");
    const isActive = searchParams.get("isActive");

    // Build where clause
    const where: Prisma.ProductWhereInput = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (type && ["RAW_MATERIAL", "WORK_IN_PROGRESS", "FINISHED_GOOD", "CONSUMABLE"].includes(type)) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    // Fetch products with count
    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
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
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des produits" },
      { status: 500 }
    );
  }
}


// POST /api/inventory/products
// Create a new product


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = productCreateSchema.safeParse(body);
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

    // Check if SKU already exists
    const existingProduct = await db.product.findUnique({
      where: { sku: data.sku },
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: "Un produit avec ce code SKU existe déjà" },
        { status: 409 }
      );
    }

    // Validate category exists if provided
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

    // Create product with inventory record in a transaction
    const product = await db.$transaction(async (tx) => {
      // Create the product
      const newProduct = await tx.product.create({
        data: {
          sku: data.sku,
          name: data.name,
          description: data.description,
          categoryId: data.categoryId,
          type: data.type,
          unit: data.unit,
          unitPrice: data.unitPrice,
          costPrice: data.costPrice,
          isActive: data.isActive ?? true,
        },
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
      });

      // Create initial inventory record
      await tx.inventory.create({
        data: {
          productId: newProduct.id,
          quantity: 0,
          reservedQty: 0,
          minStockLevel: 0,
        },
      });

      return newProduct;
    });

    // Log audit (using a default user ID for now - in production, get from auth)
    const userId = request.headers.get("x-user-id") || "system";
    await auditService.logCreate(
      userId,
      "Product",
      product.id,
      product,
      `Produit créé: ${product.name} (${product.sku})`
    );

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du produit" },
      { status: 500 }
    );
  }
}


