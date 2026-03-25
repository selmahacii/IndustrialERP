import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditService } from "@/lib/audit-service";
import { employeeCreateSchema, formatValidationErrors } from "@/lib/validations";
import { Department, EmployeeStatus, Prisma } from "@prisma/client";


// GET /api/hr/employees - List employees with filtering


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Filter parameters
    const department = searchParams.get("department") as Department | null;
    const status = searchParams.get("status") as EmployeeStatus | null;
    const search = searchParams.get("search");
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.EmployeeWhereInput = {};
    
    if (department) {
      where.department = department;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { fullName: { contains: search } },
        { employeeNumber: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // Execute query with pagination
    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
            },
          },
        },
        orderBy: [
          { department: "asc" },
          { lastName: "asc" },
        ],
        skip,
        take: limit,
      }),
      db.employee.count({ where }),
    ]);

    return NextResponse.json({
      data: employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des employés" },
      { status: 500 }
    );
  }
}


// POST /api/hr/employees - Create new employee


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = employeeCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Données invalides", 
          details: formatValidationErrors(validationResult.error) 
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if employee number already exists
    const existingByNumber = await db.employee.findUnique({
      where: { employeeNumber: data.employeeNumber },
    });
    if (existingByNumber) {
      return NextResponse.json(
        { error: "Un employé avec ce matricule existe déjà" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingByEmail = await db.employee.findUnique({
      where: { email: data.email },
    });
    if (existingByEmail) {
      return NextResponse.json(
        { error: "Un employé avec cet email existe déjà" },
        { status: 400 }
      );
    }

    // Create employee with auto-generated employeeNumber if not provided
    // If employeeNumber is provided, use it; otherwise generate one
    const employeeNumber = data.employeeNumber || await generateEmployeeNumber(data.department);

    // Create employee in transaction
    const employee = await db.$transaction(async (tx) => {
      const newEmployee = await tx.employee.create({
        data: {
          employeeNumber,
          firstName: data.firstName,
          lastName: data.lastName,
          fullName: `${data.firstName} ${data.lastName}`,
          email: data.email,
          phone: data.phone ?? null,
          address: data.address ?? null,
          department: data.department,
          position: data.position,
          hireDate: data.hireDate,
          salary: data.salary,
          bankAccount: data.bankAccount ?? null,
          status: data.status || "ACTIVE",
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
            },
          },
        },
      });

      // Audit log
      await auditService.logCreate(
        "system", // userId - in real app, get from session
        "Employee",
        newEmployee.id,
        newEmployee,
        `Création de l'employé ${newEmployee.fullName} (${newEmployee.employeeNumber})`
      );

      return newEmployee;
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("Error creating employee:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'employé" },
      { status: 500 }
    );
  }
}


// HELPER: Generate unique employee number


async function generateEmployeeNumber(department: Department): Promise<string> {
  // Department prefix mapping
  const deptPrefixes: Record<Department, string> = {
    PRODUCTION: "PRD",
    WAREHOUSE: "WRH",
    FINANCE: "FIN",
    HR: "HRM",
    SALES: "SAL",
    PROCUREMENT: "PRC",
    QUALITY: "QTY",
    MAINTENANCE: "MNT",
    LOGISTICS: "LOG",
    ADMINISTRATION: "ADM",
  };

  const prefix = deptPrefixes[department] || "EMP";
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Find the highest number for this prefix and year
  const lastEmployee = await db.employee.findFirst({
    where: {
      employeeNumber: {
        startsWith: `${prefix}${year}`,
      },
    },
    orderBy: {
      employeeNumber: "desc",
    },
  });

  let sequence = 1;
  if (lastEmployee) {
    const lastSequence = parseInt(lastEmployee.employeeNumber.slice(-4), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  // Format: PREFIX-YY-NNNN (e.g., PRD240001)
  return `${prefix}${year}${sequence.toString().padStart(4, "0")}`;
}


