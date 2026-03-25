// Production module - BOM CRUD


import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditService } from '@/lib/audit-service'
import { Prisma } from '@prisma/client'
import { z } from 'zod'


// HELPER FUNCTIONS


function getUserId(request: NextRequest): string {
  return request.headers.get('x-user-id') || 'system'
}

/**
 * Parse query parameters for filtering
 */
function parseQueryParams(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  return {
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: parseInt(searchParams.get('limit') || '20', 10),
    productId: searchParams.get('productId'),
    isActive: searchParams.get('isActive') === 'true' ? true : 
              searchParams.get('isActive') === 'false' ? false : undefined,
    search: searchParams.get('search'),
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
  }
}


// GET /api/production/bom
// List Bill of Materials


export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(request)
    const skip = (params.page - 1) * params.limit
    
    // Build where clause
    const where: Prisma.BOMWhereInput = {}
    
    if (params.productId) {
      where.productId = params.productId
    }
    
    if (params.isActive !== undefined) {
      where.isActive = params.isActive
    }
    
    // Search by product name or SKU
    if (params.search) {
      where.OR = [
        { product: { name: { contains: params.search } } },
        { product: { sku: { contains: params.search } } },
      ]
    }
    
    // Build orderBy
    const orderBy: Prisma.BOMOrderByWithRelationInput = {}
    orderBy[params.sortBy as keyof Prisma.BOMOrderByWithRelationInput] = params.sortOrder
    
    // Execute queries in parallel
    const [boms, total] = await Promise.all([
      db.bOM.findMany({
        where,
        skip,
        take: params.limit,
        orderBy,
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
          components: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  unit: true,
                  costPrice: true,
                },
              },
            },
          },
          _count: {
            select: {
              components: true,
            },
          },
        },
      }),
      db.bOM.count({ where }),
    ])
    
    // Calculate total cost for each BOM
    const bomsWithCost = boms.map(bom => {
      const totalComponentCost = bom.components.reduce((sum, comp) => {
        return sum + (comp.product.costPrice * comp.quantity)
      }, 0)
      
      return {
        ...bom,
        totalComponentCost,
        componentCount: bom.components.length,
      }
    })
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / params.limit)
    
    return NextResponse.json({
      data: bomsWithCost,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasMore: params.page < totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching BOMs:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des nomenclatures' },
      { status: 500 }
    )
  }
}


// POST /api/production/bom
// Create new Bill of Materials with components


export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = getUserId(request)
    
    // Validation schema
    const componentSchema = z.object({
      productId: z.string().min(1, "L'ID du produit composant est obligatoire"),
      quantity: z.number().positive('La quantité doit être positive'),
      unit: z.string().min(1, "L'unité est obligatoire"),
    })
    
    const createSchema = z.object({
      productId: z.string().min(1, "L'ID du produit est obligatoire"),
      version: z.string().max(20).default('1.0'),
      isActive: z.boolean().default(true),
      notes: z.string().max(500).optional().nullable(),
      components: z.array(componentSchema).min(1, 'Au moins un composant est requis'),
    })
    
    const validatedData = createSchema.parse(body)
    
    // Verify product exists and is a FINISHED_GOOD
    const product = await db.product.findUnique({
      where: { id: validatedData.productId },
    })
    
    if (!product) {
      return NextResponse.json(
        { error: 'Produit non trouvé' },
        { status: 404 }
      )
    }
    
    // Check if BOM already exists for this product version
    const existingBOM = await db.bOM.findUnique({
      where: {
        productId_version: {
          productId: validatedData.productId,
          version: validatedData.version,
        },
      },
    })
    
    if (existingBOM) {
      return NextResponse.json(
        { error: `Une nomenclature version ${validatedData.version} existe déjà pour ce produit` },
        { status: 400 }
      )
    }
    
    // Verify all component products exist
    const componentProductIds = [...new Set(validatedData.components.map(c => c.productId))]
    
    // Ensure product is not using itself as a component
    if (componentProductIds.includes(validatedData.productId)) {
      return NextResponse.json(
        { error: 'Un produit ne peut pas être son propre composant' },
        { status: 400 }
      )
    }
    
    const componentProducts = await db.product.findMany({
      where: { id: { in: componentProductIds } },
      select: { id: true, name: true, unit: true },
    })
    
    if (componentProducts.length !== componentProductIds.length) {
      const foundIds = componentProducts.map(p => p.id)
      const missingIds = componentProductIds.filter(id => !foundIds.includes(id))
      return NextResponse.json(
        { error: `Composants non trouvés: ${missingIds.join(', ')}` },
        { status: 404 }
      )
    }
    
    // Create BOM with components in transaction
    const bom = await db.$transaction(async (tx) => {
      // If this is the first active BOM for the product, or isActive is true,
      // deactivate other versions
      if (validatedData.isActive) {
        await tx.bOM.updateMany({
          where: {
            productId: validatedData.productId,
            isActive: true,
          },
          data: { isActive: false },
        })
      }
      
      // Create BOM
      const newBOM = await tx.bOM.create({
        data: {
          productId: validatedData.productId,
          version: validatedData.version,
          isActive: validatedData.isActive,
          notes: validatedData.notes,
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
      
      // Create components
      for (const component of validatedData.components) {
        await tx.bOMComponent.create({
          data: {
            bomId: newBOM.id,
            productId: component.productId,
            quantity: component.quantity,
            unit: component.unit,
          },
        })
      }
      
      // Fetch the complete BOM with components
      const completeBOM = await tx.bOM.findUnique({
        where: { id: newBOM.id },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true,
            },
          },
          components: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  unit: true,
                  costPrice: true,
                },
              },
            },
          },
        },
      })
      
      // Log creation
      await auditService.logCreate(
        userId,
        'BOM',
        newBOM.id,
        {
          productId: validatedData.productId,
          version: validatedData.version,
          componentCount: validatedData.components.length,
        },
        `Création de la nomenclature ${product.name} v${validatedData.version}`
      )
      
      return completeBOM
    })
    
    return NextResponse.json(bom, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error creating BOM:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la nomenclature' },
      { status: 500 }
    )
  }
}


