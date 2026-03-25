import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  ProductType,
  Department,
  EmployeeStatus,
  WorkOrderStatus,
  Priority,
  TransactionStatus,
  TransactionType,
  AccountType,
} from '@prisma/client';


// POST /api/seed
// Seed the database with demo data


export async function POST() {
  try {
    // Check if data already exists
    const existingProducts = await db.product.count();
    if (existingProducts > 0) {
      return NextResponse.json({
        message: 'Database already seeded',
        counts: {
          products: existingProducts,
          employees: await db.employee.count(),
          transactions: await db.transaction.count(),
          workOrders: await db.workOrder.count(),
          accounts: await db.account.count(),
          categories: await db.category.count(),
        },
      });
    }

    // Create in transaction for data integrity
    const result = await db.$transaction(async (tx) => {

      // 1. CREATE CATEGORIES

      const categories = await Promise.all([
        tx.category.create({
          data: { name: 'Matières Premières', description: 'Raw materials for production' },
        }),
        tx.category.create({
          data: { name: 'Produits Finis', description: 'Finished goods ready for sale' },
        }),
        tx.category.create({
          data: { name: 'Consommables', description: 'Consumables and supplies' },
        }),
        tx.category.create({
          data: { name: 'Outillage', description: 'Tools and equipment' },
        }),
      ]);


      // 2. CREATE ACCOUNTS (Chart of Accounts)

      const accounts = await Promise.all([
        tx.account.create({
          data: { code: '1000', name: 'Caisse', type: AccountType.ASSET, description: 'Cash on hand' },
        }),
        tx.account.create({
          data: { code: '1010', name: 'Banque BNA', type: AccountType.ASSET, description: 'Bank account - BNA' },
        }),
        tx.account.create({
          data: { code: '3000', name: 'Ventes', type: AccountType.REVENUE, description: 'Sales revenue' },
        }),
        tx.account.create({
          data: { code: '4000', name: 'Achats', type: AccountType.EXPENSE, description: 'Purchases' },
        }),
        tx.account.create({
          data: { code: '5000', name: 'Salaires', type: AccountType.EXPENSE, description: 'Salaries and wages' },
        }),
        tx.account.create({
          data: { code: '6000', name: 'Charges Sociales', type: AccountType.EXPENSE, description: 'Social charges' },
        }),
      ]);


      // 3. CREATE USER (for audit trail)

      const user = await tx.user.create({
        data: {
          email: 'admin@industriel.dz',
          name: 'Admin System',
          passwordHash: '$2a$10$placeholder', // Placeholder - not used for login
          role: 'ADMIN',
          isActive: true,
        },
      });


      // 4. CREATE PRODUCTS (10 Products)

      const products = await Promise.all([
        // Raw Materials
        tx.product.create({
          data: {
            sku: 'MAT-001',
            name: 'Acier Inox 316',
            description: 'Acier inoxydable 316 - Tôles 2mm',
            categoryId: categories[0].id,
            type: ProductType.RAW_MATERIAL,
            unit: 'kg',
            unitPrice: 850,
            costPrice: 720,
            isActive: true,
          },
        }),
        tx.product.create({
          data: {
            sku: 'MAT-002',
            name: 'Aluminium 6061',
            description: 'Aluminium 6061 - Barres rondes',
            categoryId: categories[0].id,
            type: ProductType.RAW_MATERIAL,
            unit: 'kg',
            unitPrice: 650,
            costPrice: 580,
            isActive: true,
          },
        }),
        tx.product.create({
          data: {
            sku: 'MAT-003',
            name: 'Plastique ABS',
            description: 'Granulés plastique ABS',
            categoryId: categories[0].id,
            type: ProductType.RAW_MATERIAL,
            unit: 'kg',
            unitPrice: 180,
            costPrice: 150,
            isActive: true,
          },
        }),
        // Finished Goods
        tx.product.create({
          data: {
            sku: 'PRD-001',
            name: 'Pompe Industrielle P200',
            description: 'Pompe industrielle haute pression 200m³/h',
            categoryId: categories[1].id,
            type: ProductType.FINISHED_GOOD,
            unit: 'unité',
            unitPrice: 450000,
            costPrice: 320000,
            isActive: true,
          },
        }),
        tx.product.create({
          data: {
            sku: 'PRD-002',
            name: 'Turbine T500',
            description: 'Turbine à vapeur 500kW',
            categoryId: categories[1].id,
            type: ProductType.FINISHED_GOOD,
            unit: 'unité',
            unitPrice: 2500000,
            costPrice: 1850000,
            isActive: true,
          },
        }),
        tx.product.create({
          data: {
            sku: 'PRD-003',
            name: 'Échangeur Thermique E100',
            description: 'Échangeur thermique à plaques',
            categoryId: categories[1].id,
            type: ProductType.FINISHED_GOOD,
            unit: 'unité',
            unitPrice: 850000,
            costPrice: 620000,
            isActive: true,
          },
        }),
        // Consumables
        tx.product.create({
          data: {
            sku: 'CON-001',
            name: 'Huile Hydraulique ISO 46',
            description: 'Huile hydraulique 200L',
            categoryId: categories[2].id,
            type: ProductType.CONSUMABLE,
            unit: 'litre',
            unitPrice: 450,
            costPrice: 380,
            isActive: true,
          },
        }),
        tx.product.create({
          data: {
            sku: 'CON-002',
            name: 'Électrodes Soudure E7018',
            description: 'Électrodes de soudure diamètre 3.2mm',
            categoryId: categories[2].id,
            type: ProductType.CONSUMABLE,
            unit: 'kg',
            unitPrice: 1200,
            costPrice: 950,
            isActive: true,
          },
        }),
        // More Raw Materials
        tx.product.create({
          data: {
            sku: 'MAT-004',
            name: 'Cuivre Électrolytique',
            description: 'Cuivre pur 99.9% - Fils',
            categoryId: categories[0].id,
            type: ProductType.RAW_MATERIAL,
            unit: 'kg',
            unitPrice: 1450,
            costPrice: 1280,
            isActive: true,
          },
        }),
        tx.product.create({
          data: {
            sku: 'MAT-005',
            name: 'Laiton Naval',
            description: 'Laiton naval - Tôles',
            categoryId: categories[0].id,
            type: ProductType.RAW_MATERIAL,
            unit: 'kg',
            unitPrice: 950,
            costPrice: 820,
            isActive: true,
          },
        }),
      ]);


      // 5. CREATE INVENTORY RECORDS

      const inventoryData = [
        { productId: products[0].id, quantity: 2500, minStockLevel: 5000, maxStockLevel: 15000 }, // Low stock
        { productId: products[1].id, quantity: 3200, minStockLevel: 3000, maxStockLevel: 10000 },
        { productId: products[2].id, quantity: 8500, minStockLevel: 2000, maxStockLevel: 8000 },
        { productId: products[3].id, quantity: 15, minStockLevel: 10, maxStockLevel: 50 },
        { productId: products[4].id, quantity: 3, minStockLevel: 5, maxStockLevel: 20 }, // Low stock
        { productId: products[5].id, quantity: 8, minStockLevel: 5, maxStockLevel: 25 },
        { productId: products[6].id, quantity: 450, minStockLevel: 1000, maxStockLevel: 3000 }, // Low stock
        { productId: products[7].id, quantity: 180, minStockLevel: 100, maxStockLevel: 500 },
        { productId: products[8].id, quantity: 0, minStockLevel: 500, maxStockLevel: 2000 }, // Out of stock
        { productId: products[9].id, quantity: 1200, minStockLevel: 800, maxStockLevel: 3000 },
      ];

      await Promise.all(
        inventoryData.map((inv) =>
          tx.inventory.create({
            data: {
              productId: inv.productId,
              quantity: inv.quantity,
              reservedQty: 0,
              minStockLevel: inv.minStockLevel,
              maxStockLevel: inv.maxStockLevel,
              location: 'Entrepôt A',
            },
          })
        )
      );


      // 6. CREATE EMPLOYEES (5 Employees)

      const employees = await Promise.all([
        tx.employee.create({
          data: {
            employeeNumber: 'PRD240001',
            firstName: 'Mohamed',
            lastName: 'Benali',
            fullName: 'Mohamed Benali',
            email: 'mohamed.benali@industriel.dz',
            phone: '0555123456',
            department: Department.PRODUCTION,
            position: 'Chef de Production',
            hireDate: new Date('2020-03-15'),
            salary: 120000,
            bankAccount: '00100123456789012345',
            status: EmployeeStatus.ACTIVE,
          },
        }),
        tx.employee.create({
          data: {
            employeeNumber: 'WRH240001',
            firstName: 'Fatima',
            lastName: 'Zerhouni',
            fullName: 'Fatima Zerhouni',
            email: 'fatima.zerhouni@industriel.dz',
            phone: '0555234567',
            department: Department.WAREHOUSE,
            position: 'Responsable Stock',
            hireDate: new Date('2019-06-01'),
            salary: 85000,
            status: EmployeeStatus.ACTIVE,
          },
        }),
        tx.employee.create({
          data: {
            employeeNumber: 'FIN240001',
            firstName: 'Ahmed',
            lastName: 'Mansouri',
            fullName: 'Ahmed Mansouri',
            email: 'ahmed.mansouri@industriel.dz',
            phone: '0555345678',
            department: Department.FINANCE,
            position: 'Comptable Principal',
            hireDate: new Date('2021-01-10'),
            salary: 95000,
            status: EmployeeStatus.ACTIVE,
          },
        }),
        tx.employee.create({
          data: {
            employeeNumber: 'HRM240001',
            firstName: 'Samira',
            lastName: 'Bouazza',
            fullName: 'Samira Bouazza',
            email: 'samira.bouazza@industriel.dz',
            phone: '0555456789',
            department: Department.HR,
            position: 'Responsable RH',
            hireDate: new Date('2018-09-20'),
            salary: 110000,
            status: EmployeeStatus.ACTIVE,
          },
        }),
        tx.employee.create({
          data: {
            employeeNumber: 'MNT240001',
            firstName: 'Karim',
            lastName: 'Hadji',
            fullName: 'Karim Hadji',
            email: 'karim.hadji@industriel.dz',
            phone: '0555567890',
            department: Department.MAINTENANCE,
            position: 'Technicien Maintenance',
            hireDate: new Date('2022-02-28'),
            salary: 65000,
            status: EmployeeStatus.ACTIVE,
          },
        }),
      ]);


      // 7. CREATE WORK ORDERS (3 Work Orders)

      const workOrders = await Promise.all([
        tx.workOrder.create({
          data: {
            orderNumber: 'WO-20240115-0001',
            productId: products[3].id, // Pompe Industrielle P200
            quantity: 5,
            completedQty: 2,
            status: WorkOrderStatus.IN_PROGRESS,
            priority: Priority.HIGH,
            scheduledStart: new Date('2024-01-15'),
            scheduledEnd: new Date('2024-01-25'),
            actualStart: new Date('2024-01-15'),
            assignedToId: employees[0].id,
            createdById: user.id,
            notes: 'Commande urgente pour client SONATRACH',
          },
        }),
        tx.workOrder.create({
          data: {
            orderNumber: 'WO-20240116-0001',
            productId: products[4].id, // Turbine T500
            quantity: 1,
            completedQty: 0,
            status: WorkOrderStatus.PLANNED,
            priority: Priority.URGENT,
            scheduledStart: new Date('2024-01-20'),
            scheduledEnd: new Date('2024-02-15'),
            assignedToId: employees[0].id,
            createdById: user.id,
            notes: 'Projet spécial - Turbine pour centrale électrique',
          },
        }),
        tx.workOrder.create({
          data: {
            orderNumber: 'WO-20240117-0001',
            productId: products[5].id, // Échangeur Thermique E100
            quantity: 3,
            completedQty: 3,
            status: WorkOrderStatus.COMPLETED,
            priority: Priority.MEDIUM,
            scheduledStart: new Date('2024-01-10'),
            scheduledEnd: new Date('2024-01-17'),
            actualStart: new Date('2024-01-10'),
            actualEnd: new Date('2024-01-16'),
            assignedToId: employees[0].id,
            createdById: user.id,
            notes: 'Commande complétée en avance',
          },
        }),
      ]);

      // Add work order steps
      await Promise.all([
        // Steps for first work order (IN_PROGRESS)
        tx.workOrderStep.create({
          data: {
            workOrderId: workOrders[0].id,
            stepNumber: 1,
            name: 'Découpe des matériaux',
            status: 'COMPLETED',
            estimatedTime: 8,
            actualTime: 7.5,
          },
        }),
        tx.workOrderStep.create({
          data: {
            workOrderId: workOrders[0].id,
            stepNumber: 2,
            name: 'Usinage composants',
            status: 'COMPLETED',
            estimatedTime: 16,
            actualTime: 18,
          },
        }),
        tx.workOrderStep.create({
          data: {
            workOrderId: workOrders[0].id,
            stepNumber: 3,
            name: 'Assemblage',
            status: 'IN_PROGRESS',
            estimatedTime: 12,
          },
        }),
        tx.workOrderStep.create({
          data: {
            workOrderId: workOrders[0].id,
            stepNumber: 4,
            name: 'Tests et Contrôle Qualité',
            status: 'PENDING',
            estimatedTime: 6,
          },
        }),
      ]);


      // 8. CREATE TRANSACTIONS (5 Transactions)

      const transactions = await Promise.all([
        tx.transaction.create({
          data: {
            transactionNumber: 'TXN-202401-00001',
            accountId: accounts[0].id, // Caisse
            type: TransactionType.CREDIT,
            amount: 2500000,
            description: 'Vente - 5 Pompes Industrielles P200',
            category: 'Ventes',
            transactionDate: new Date('2024-01-10'),
            status: TransactionStatus.APPROVED,
            userId: user.id,
          },
        }),
        tx.transaction.create({
          data: {
            transactionNumber: 'TXN-202401-00002',
            accountId: accounts[3].id, // Achats
            type: TransactionType.DEBIT,
            amount: 1800000,
            description: 'Achat Acier Inox 316 - 2500kg',
            category: 'Achats Matières',
            transactionDate: new Date('2024-01-12'),
            status: TransactionStatus.APPROVED,
            userId: user.id,
          },
        }),
        tx.transaction.create({
          data: {
            transactionNumber: 'TXN-202401-00003',
            accountId: accounts[4].id, // Salaires
            type: TransactionType.DEBIT,
            amount: 3500000,
            description: 'Salaires Janvier 2024',
            category: 'Salaires',
            transactionDate: new Date('2024-01-05'),
            status: TransactionStatus.APPROVED,
            userId: user.id,
          },
        }),
        tx.transaction.create({
          data: {
            transactionNumber: 'TXN-202401-00004',
            accountId: accounts[1].id, // Banque
            type: TransactionType.CREDIT,
            amount: 5000000,
            description: 'Avance client - Projet Turbine T500',
            category: 'Avances Clients',
            transactionDate: new Date('2024-01-08'),
            status: TransactionStatus.APPROVED,
            userId: user.id,
          },
        }),
        tx.transaction.create({
          data: {
            transactionNumber: 'TXN-202401-00005',
            accountId: accounts[3].id, // Achats
            type: TransactionType.DEBIT,
            amount: 450000,
            description: 'Achat Huile Hydraulique - 1000L',
            category: 'Achats Consommables',
            transactionDate: new Date('2024-01-14'),
            status: TransactionStatus.PENDING,
            userId: user.id,
          },
        }),
      ]);

      return {
        categories: categories.length,
        accounts: accounts.length,
        products: products.length,
        employees: employees.length,
        workOrders: workOrders.length,
        transactions: transactions.length,
      };
    });

    return NextResponse.json({
      message: 'Database seeded successfully',
      counts: result,
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'initialisation de la base de données' },
      { status: 500 }
    );
  }
}


// GET /api/seed
// Check seed status


export async function GET() {
  try {
    const counts = {
      products: await db.product.count(),
      employees: await db.employee.count(),
      transactions: await db.transaction.count(),
      workOrders: await db.workOrder.count(),
      accounts: await db.account.count(),
      categories: await db.category.count(),
    };

    return NextResponse.json({
      seeded: counts.products > 0,
      counts,
    });
  } catch (error) {
    console.error('Error checking seed status:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vérification du statut' },
      { status: 500 }
    );
  }
}


