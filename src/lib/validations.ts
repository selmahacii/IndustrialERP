import { z } from "zod";


// COMMON VALIDATIONS & HELPERS


// Positive number validation with French error message
const positiveNumber = (fieldName: string) =>
  z.number({
    required_error: `${fieldName} est obligatoire`,
    invalid_type_error: `${fieldName} doit être un nombre`,
  }).positive(`${fieldName} doit être un nombre positif`);

// Non-negative number (allows zero)
const nonNegativeNumber = (fieldName: string) =>
  z.number({
    required_error: `${fieldName} est obligatoire`,
    invalid_type_error: `${fieldName} doit être un nombre`,
  }).min(0, `${fieldName} ne peut pas être négatif`);

// Optional positive number
const optionalPositiveNumber = (fieldName: string) =>
  z.number({
    invalid_type_error: `${fieldName} doit être un nombre`,
  }).positive(`${fieldName} doit être un nombre positif`).optional();

// Date validation
const dateField = (fieldName: string) =>
  z.coerce.date({
    required_error: `${fieldName} est obligatoire`,
    invalid_type_error: `${fieldName} doit être une date valide`,
  });

// Optional date
const optionalDate = (fieldName: string) =>
  z.coerce.date({
    invalid_type_error: `${fieldName} doit être une date valide`,
  }).optional().nullable();

// Non-empty string with French error
const nonEmptyString = (fieldName: string, minLength = 1) =>
  z.string({
    required_error: `${fieldName} est obligatoire`,
    invalid_type_error: `${fieldName} doit être une chaîne de caractères`,
  }).min(minLength, `${fieldName} ne peut pas être vide`);

// Email validation with French error
const emailField = () =>
  z.string({
    required_error: "L'adresse email est obligatoire",
  }).email("L'adresse email n'est pas valide");

// Phone validation (optional)
const phoneField = () =>
  z.string()
    .regex(/^[+]?[\d\s-]{8,20}$/, "Le numéro de téléphone n'est pas valide")
    .optional()
    .or(z.literal(""));


// ENUMS (matching Prisma schema)


export const UserRoleEnum = z.enum([
  "ADMIN",
  "MANAGER",
  "ACCOUNTANT",
  "WAREHOUSE_MANAGER",
  "PRODUCTION_MANAGER",
  "HR_MANAGER",
  "EMPLOYEE",
]);

export const DepartmentEnum = z.enum([
  "PRODUCTION",
  "WAREHOUSE",
  "FINANCE",
  "HR",
  "SALES",
  "PROCUREMENT",
  "QUALITY",
  "MAINTENANCE",
  "LOGISTICS",
  "ADMINISTRATION",
]);

export const EmployeeStatusEnum = z.enum([
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "TERMINATED",
]);

export const TimeEntryStatusEnum = z.enum([
  "PRESENT",
  "ABSENT",
  "LATE",
  "EARLY_DEPARTURE",
  "VACATION",
  "SICK_LEAVE",
]);

export const PayrollStatusEnum = z.enum([
  "DRAFT",
  "PENDING",
  "APPROVED",
  "PAID",
  "CANCELLED",
]);

export const ProductTypeEnum = z.enum([
  "RAW_MATERIAL",
  "WORK_IN_PROGRESS",
  "FINISHED_GOOD",
  "CONSUMABLE",
]);

export const MovementTypeEnum = z.enum([
  "IN",
  "OUT",
  "TRANSFER",
  "ADJUSTMENT",
  "RESERVATION",
  "RELEASE",
]);

export const WorkOrderStatusEnum = z.enum([
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]);

export const PriorityEnum = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

export const StepStatusEnum = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "SKIPPED",
  "FAILED",
]);

export const ItemTypeEnum = z.enum([
  "INPUT",
  "OUTPUT",
  "WASTE",
]);

export const AccountTypeEnum = z.enum([
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
]);

export const TransactionTypeEnum = z.enum([
  "DEBIT",
  "CREDIT",
]);

export const TransactionStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "RECONCILED",
  "CANCELLED",
]);

export const JournalStatusEnum = z.enum([
  "DRAFT",
  "POSTED",
  "REVERSED",
]);

export const PurchaseStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "RECEIVED",
  "PARTIAL",
  "CANCELLED",
]);

export const AuditActionEnum = z.enum([
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "LOGIN",
  "LOGOUT",
  "VIEW",
  "EXPORT",
  "PRINT",
]);

export const NotificationTypeEnum = z.enum([
  "INFO",
  "WARNING",
  "ERROR",
  "SUCCESS",
  "STOCK_ALERT",
  "PRODUCTION_ALERT",
  "FINANCE_ALERT",
]);


// USER VALIDATIONS


export const userCreateSchema = z.object({
  email: emailField(),
  name: nonEmptyString("Le nom", 2).max(100, "Le nom ne peut pas dépasser 100 caractères"),
  password: z.string({
    required_error: "Le mot de passe est obligatoire",
  })
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
    .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
  role: UserRoleEnum.default("EMPLOYEE"),
  employeeId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const userUpdateSchema = z.object({
  email: emailField().optional(),
  name: nonEmptyString("Le nom", 2).max(100, "Le nom ne peut pas dépasser 100 caractères").optional(),
  role: UserRoleEnum.optional(),
  employeeId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const userLoginSchema = z.object({
  email: emailField(),
  password: z.string({
    required_error: "Le mot de passe est obligatoire",
  }).min(1, "Le mot de passe est obligatoire"),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string({
    required_error: "Le mot de passe actuel est obligatoire",
  }).min(1, "Le mot de passe actuel est obligatoire"),
  newPassword: z.string({
    required_error: "Le nouveau mot de passe est obligatoire",
  })
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
    .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
  confirmPassword: z.string({
    required_error: "La confirmation du mot de passe est obligatoire",
  }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

// Type exports
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserLoginInput = z.infer<typeof userLoginSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;


// EMPLOYEE VALIDATIONS


export const employeeCreateSchema = z.object({
  employeeNumber: nonEmptyString("Le matricule", 2).max(20, "Le matricule ne peut pas dépasser 20 caractères"),
  firstName: nonEmptyString("Le prénom", 2).max(50, "Le prénom ne peut pas dépasser 50 caractères"),
  lastName: nonEmptyString("Le nom de famille", 2).max(50, "Le nom de famille ne peut pas dépasser 50 caractères"),
  email: emailField(),
  phone: phoneField(),
  address: z.string().max(200, "L'adresse ne peut pas dépasser 200 caractères").optional().nullable(),
  department: DepartmentEnum,
  position: nonEmptyString("Le poste", 2).max(100, "Le poste ne peut pas dépasser 100 caractères"),
  hireDate: dateField("La date d'embauche"),
  salary: positiveNumber("Le salaire"),
  bankAccount: z.string().max(50, "Le compte bancaire ne peut pas dépasser 50 caractères").optional().nullable(),
  status: EmployeeStatusEnum.default("ACTIVE"),
}).transform((data) => ({
  ...data,
  fullName: `${data.firstName} ${data.lastName}`,
}));

export const employeeUpdateSchema = z.object({
  employeeNumber: nonEmptyString("Le matricule", 2).max(20, "Le matricule ne peut pas dépasser 20 caractères").optional(),
  firstName: nonEmptyString("Le prénom", 2).max(50, "Le prénom ne peut pas dépasser 50 caractères").optional(),
  lastName: nonEmptyString("Le nom de famille", 2).max(50, "Le nom de famille ne peut pas dépasser 50 caractères").optional(),
  email: emailField().optional(),
  phone: phoneField(),
  address: z.string().max(200, "L'adresse ne peut pas dépasser 200 caractères").optional().nullable(),
  department: DepartmentEnum.optional(),
  position: nonEmptyString("Le poste", 2).max(100, "Le poste ne peut pas dépasser 100 caractères").optional(),
  hireDate: dateField("La date d'embauche").optional(),
  terminationDate: optionalDate("La date de départ"),
  salary: positiveNumber("Le salaire").optional(),
  bankAccount: z.string().max(50, "Le compte bancaire ne peut pas dépasser 50 caractères").optional().nullable(),
  status: EmployeeStatusEnum.optional(),
});

// Type exports
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;


// PRODUCT VALIDATIONS


export const productCreateSchema = z.object({
  sku: nonEmptyString("Le code SKU", 2).max(50, "Le code SKU ne peut pas dépasser 50 caractères"),
  name: nonEmptyString("Le nom du produit", 2).max(200, "Le nom ne peut pas dépasser 200 caractères"),
  description: z.string().max(1000, "La description ne peut pas dépasser 1000 caractères").optional().nullable(),
  categoryId: z.string().optional().nullable(),
  type: ProductTypeEnum,
  unit: nonEmptyString("L'unité", 1).max(20, "L'unité ne peut pas dépasser 20 caractères"),
  unitPrice: nonNegativeNumber("Le prix unitaire"),
  costPrice: nonNegativeNumber("Le prix de revient"),
  isActive: z.boolean().default(true),
});

export const productUpdateSchema = z.object({
  sku: nonEmptyString("Le code SKU", 2).max(50, "Le code SKU ne peut pas dépasser 50 caractères").optional(),
  name: nonEmptyString("Le nom du produit", 2).max(200, "Le nom ne peut pas dépasser 200 caractères").optional(),
  description: z.string().max(1000, "La description ne peut pas dépasser 1000 caractères").optional().nullable(),
  categoryId: z.string().optional().nullable(),
  type: ProductTypeEnum.optional(),
  unit: nonEmptyString("L'unité", 1).max(20, "L'unité ne peut pas dépasser 20 caractères").optional(),
  unitPrice: nonNegativeNumber("Le prix unitaire").optional(),
  costPrice: nonNegativeNumber("Le prix de revient").optional(),
  isActive: z.boolean().optional(),
});

// Type exports
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;


// INVENTORY VALIDATIONS


export const inventoryCreateSchema = z.object({
  productId: nonEmptyString("L'ID du produit"),
  quantity: nonNegativeNumber("La quantité").default(0),
  reservedQty: nonNegativeNumber("La quantité réservée").default(0),
  minStockLevel: nonNegativeNumber("Le seuil minimum").default(0),
  maxStockLevel: optionalPositiveNumber("Le seuil maximum"),
  reorderPoint: optionalPositiveNumber("Le point de commande"),
  location: z.string().max(100, "L'emplacement ne peut pas dépasser 100 caractères").optional().nullable(),
});

export const inventoryUpdateSchema = z.object({
  quantity: nonNegativeNumber("La quantité").optional(),
  reservedQty: nonNegativeNumber("La quantité réservée").optional(),
  minStockLevel: nonNegativeNumber("Le seuil minimum").optional(),
  maxStockLevel: optionalPositiveNumber("Le seuil maximum"),
  reorderPoint: optionalPositiveNumber("Le point de commande"),
  location: z.string().max(100, "L'emplacement ne peut pas dépasser 100 caractères").optional().nullable(),
});

export const inventoryMovementSchema = z.object({
  productId: nonEmptyString("L'ID du produit"),
  type: MovementTypeEnum,
  quantity: positiveNumber("La quantité"),
  referenceType: z.string().max(50).optional().nullable(),
  referenceId: z.string().optional().nullable(),
  notes: z.string().max(500, "Les notes ne peuvent pas dépasser 500 caractères").optional().nullable(),
});

export const inventoryAdjustmentSchema = z.object({
  productId: nonEmptyString("L'ID du produit"),
  previousQty: nonNegativeNumber("La quantité précédente"),
  newQty: nonNegativeNumber("La nouvelle quantité"),
  reason: nonEmptyString("La raison de l'ajustement", 5).max(200, "La raison ne peut pas dépasser 200 caractères"),
  notes: z.string().max(500, "Les notes ne peuvent pas dépasser 500 caractères").optional().nullable(),
});

// Type exports
export type InventoryCreateInput = z.infer<typeof inventoryCreateSchema>;
export type InventoryUpdateInput = z.infer<typeof inventoryUpdateSchema>;
export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;


// TRANSACTION VALIDATIONS (CRITICAL - FINANCIAL DATA)


// Strict monetary validation - must be positive
const monetaryAmount = (fieldName: string) =>
  z.number({
    required_error: `${fieldName} est obligatoire`,
    invalid_type_error: `${fieldName} doit être un nombre`,
  })
    .positive(`${fieldName} doit être un montant positif`)
    .finite(`${fieldName} doit être un nombre fini`)
    .multipleOf(0.01, `${fieldName} doit avoir au maximum 2 décimales`);

export const transactionCreateSchema = z.object({
  accountId: nonEmptyString("L'ID du compte"),
  type: TransactionTypeEnum,
  amount: monetaryAmount("Le montant"),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional().nullable(),
  category: z.string().max(100, "La catégorie ne peut pas dépasser 100 caractères").optional().nullable(),
  reference: z.string().max(100, "La référence ne peut pas dépasser 100 caractères").optional().nullable(),
  transactionDate: dateField("La date de transaction"),
}).superRefine((data, ctx) => {
  // Additional business logic validation
  if (data.amount > 100000000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Le montant dépasse la limite maximale autorisée (100,000,000 DZD)",
      path: ["amount"],
    });
  }
});

export const transactionApproveSchema = z.object({
  transactionId: nonEmptyString("L'ID de la transaction"),
  approvalNotes: z.string().max(500, "Les notes ne peuvent pas dépasser 500 caractères").optional().nullable(),
});

export const transactionRejectSchema = z.object({
  transactionId: nonEmptyString("L'ID de la transaction"),
  rejectionReason: nonEmptyString("La raison du rejet", 5)
    .max(500, "La raison ne peut pas dépasser 500 caractères"),
});

export const transactionUpdateSchema = z.object({
  amount: monetaryAmount("Le montant").optional(),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional().nullable(),
  category: z.string().max(100, "La catégorie ne peut pas dépasser 100 caractères").optional().nullable(),
  reference: z.string().max(100, "La référence ne peut pas dépasser 100 caractères").optional().nullable(),
  transactionDate: dateField("La date de transaction").optional(),
});

// Bulk transaction validation for batch operations
export const bulkTransactionCreateSchema = z.object({
  transactions: z.array(transactionCreateSchema).min(1, "Au moins une transaction est requise").max(100, "Maximum 100 transactions par lot"),
}).superRefine((data, ctx) => {
  // Calculate total amount
  const totalAmount = data.transactions.reduce((sum, t) => sum + t.amount, 0);
  if (totalAmount > 1000000000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Le montant total du lot dépasse la limite maximale autorisée (1,000,000,000 DZD)",
      path: ["transactions"],
    });
  }
});

// Type exports
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionApproveInput = z.infer<typeof transactionApproveSchema>;
export type TransactionRejectInput = z.infer<typeof transactionRejectSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type BulkTransactionCreateInput = z.infer<typeof bulkTransactionCreateSchema>;


// WORK ORDER VALIDATIONS


export const workOrderCreateSchema = z.object({
  orderNumber: nonEmptyString("Le numéro d'ordre", 2).max(50, "Le numéro ne peut pas dépasser 50 caractères"),
  productId: nonEmptyString("L'ID du produit"),
  quantity: positiveNumber("La quantité"),
  priority: PriorityEnum.default("MEDIUM"),
  scheduledStart: optionalDate("La date de début prévue"),
  scheduledEnd: optionalDate("La date de fin prévue"),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().max(1000, "Les notes ne peuvent pas dépasser 1000 caractères").optional().nullable(),
}).superRefine((data, ctx) => {
  // Validate scheduled dates
  if (data.scheduledStart && data.scheduledEnd) {
    if (data.scheduledStart > data.scheduledEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La date de début doit être antérieure à la date de fin",
        path: ["scheduledStart"],
      });
    }
  }
});

export const workOrderUpdateSchema = z.object({
  quantity: positiveNumber("La quantité").optional(),
  completedQty: nonNegativeNumber("La quantité complétée").optional(),
  status: WorkOrderStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  scheduledStart: optionalDate("La date de début prévue"),
  scheduledEnd: optionalDate("La date de fin prévue"),
  actualStart: optionalDate("La date de début réelle"),
  actualEnd: optionalDate("La date de fin réelle"),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().max(1000, "Les notes ne peuvent pas dépasser 1000 caractères").optional().nullable(),
}).superRefine((data, ctx) => {
  // Validate scheduled dates
  if (data.scheduledStart && data.scheduledEnd && data.scheduledStart > data.scheduledEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La date de début doit être antérieure à la date de fin",
      path: ["scheduledStart"],
    });
  }
  // Validate actual dates
  if (data.actualStart && data.actualEnd && data.actualStart > data.actualEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La date de début réelle doit être antérieure à la date de fin réelle",
      path: ["actualStart"],
    });
  }
  // Validate completed quantity doesn't exceed total
  if (data.completedQty !== undefined && data.quantity !== undefined && data.completedQty > data.quantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La quantité complétée ne peut pas dépasser la quantité totale",
      path: ["completedQty"],
    });
  }
});

export const workOrderStepCreateSchema = z.object({
  workOrderId: nonEmptyString("L'ID de l'ordre de travail"),
  stepNumber: z.number({
    required_error: "Le numéro d'étape est obligatoire",
    invalid_type_error: "Le numéro d'étape doit être un nombre",
  }).int("Le numéro d'étape doit être un entier").positive("Le numéro d'étape doit être positif"),
  name: nonEmptyString("Le nom de l'étape", 2).max(100, "Le nom ne peut pas dépasser 100 caractères"),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional().nullable(),
  estimatedTime: optionalPositiveNumber("Le temps estimé"),
});

export const workOrderStepUpdateSchema = z.object({
  name: nonEmptyString("Le nom de l'étape", 2).max(100, "Le nom ne peut pas dépasser 100 caractères").optional(),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional().nullable(),
  status: StepStatusEnum.optional(),
  estimatedTime: optionalPositiveNumber("Le temps estimé"),
  actualTime: optionalPositiveNumber("Le temps réel"),
  notes: z.string().max(500, "Les notes ne peuvent pas dépasser 500 caractères").optional().nullable(),
});

export const workOrderItemSchema = z.object({
  productId: nonEmptyString("L'ID du produit"),
  quantity: positiveNumber("La quantité"),
  type: ItemTypeEnum,
  notes: z.string().max(200, "Les notes ne peuvent pas dépasser 200 caractères").optional().nullable(),
});

// Type exports
export type WorkOrderCreateInput = z.infer<typeof workOrderCreateSchema>;
export type WorkOrderUpdateInput = z.infer<typeof workOrderUpdateSchema>;
export type WorkOrderStepCreateInput = z.infer<typeof workOrderStepCreateSchema>;
export type WorkOrderStepUpdateInput = z.infer<typeof workOrderStepUpdateSchema>;
export type WorkOrderItemInput = z.infer<typeof workOrderItemSchema>;


// TIME ENTRY VALIDATIONS


export const timeEntryClockInSchema = z.object({
  employeeId: nonEmptyString("L'ID de l'employé"),
  date: dateField("La date"),
  clockIn: dateField("L'heure d'arrivée"),
  notes: z.string().max(500, "Les notes ne peuvent pas dépasser 500 caractères").optional().nullable(),
});

export const timeEntryClockOutSchema = z.object({
  timeEntryId: nonEmptyString("L'ID du pointage"),
  clockOut: dateField("L'heure de départ"),
  notes: z.string().max(500, "Les notes ne peuvent pas dépasser 500 caractères").optional().nullable(),
}).superRefine((data, ctx) => {
  // Clock out time validation happens at runtime when we fetch the time entry
});

export const timeEntryCreateSchema = z.object({
  employeeId: nonEmptyString("L'ID de l'employé"),
  date: dateField("La date"),
  clockIn: dateField("L'heure d'arrivée"),
  clockOut: optionalDate("L'heure de départ"),
  overtimeHours: nonNegativeNumber("Les heures supplémentaires").default(0),
  status: TimeEntryStatusEnum.default("PRESENT"),
  notes: z.string().max(500, "Les notes ne peuvent pas dépasser 500 caractères").optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.clockOut && data.clockIn > data.clockOut) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "L'heure d'arrivée doit être antérieure à l'heure de départ",
      path: ["clockIn"],
    });
  }
});

export const timeEntryUpdateSchema = z.object({
  clockIn: dateField("L'heure d'arrivée").optional(),
  clockOut: optionalDate("L'heure de départ"),
  overtimeHours: nonNegativeNumber("Les heures supplémentaires").optional(),
  status: TimeEntryStatusEnum.optional(),
  notes: z.string().max(500, "Les notes ne peuvent pas dépasser 500 caractères").optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.clockIn && data.clockOut && data.clockIn > data.clockOut) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "L'heure d'arrivée doit être antérieure à l'heure de départ",
      path: ["clockIn"],
    });
  }
});

// Type exports
export type TimeEntryClockInInput = z.infer<typeof timeEntryClockInSchema>;
export type TimeEntryClockOutInput = z.infer<typeof timeEntryClockOutSchema>;
export type TimeEntryCreateInput = z.infer<typeof timeEntryCreateSchema>;
export type TimeEntryUpdateInput = z.infer<typeof timeEntryUpdateSchema>;


// PAYROLL VALIDATIONS


export const payrollCreateSchema = z.object({
  employeeId: nonEmptyString("L'ID de l'employé"),
  periodStart: dateField("La date de début de période"),
  periodEnd: dateField("La date de fin de période"),
  baseSalary: monetaryAmount("Le salaire de base"),
  overtimePay: nonNegativeNumber("La rémunération des heures supplémentaires").default(0),
  bonuses: nonNegativeNumber("Les primes").default(0),
  deductions: nonNegativeNumber("Les déductions").default(0),
  paymentMethod: z.string().max(50, "Le mode de paiement ne peut pas dépasser 50 caractères").optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.periodStart >= data.periodEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La date de début doit être antérieure à la date de fin",
      path: ["periodStart"],
    });
  }
}).transform((data) => ({
  ...data,
  netSalary: data.baseSalary + data.overtimePay + data.bonuses - data.deductions,
}));

export const payrollUpdateSchema = z.object({
  baseSalary: monetaryAmount("Le salaire de base").optional(),
  overtimePay: nonNegativeNumber("La rémunération des heures supplémentaires").optional(),
  bonuses: nonNegativeNumber("Les primes").optional(),
  deductions: nonNegativeNumber("Les déductions").optional(),
  status: PayrollStatusEnum.optional(),
  paymentMethod: z.string().max(50, "Le mode de paiement ne peut pas dépasser 50 caractères").optional().nullable(),
  paidAt: optionalDate("La date de paiement"),
});

export const payrollApproveSchema = z.object({
  payrollId: nonEmptyString("L'ID de la paie"),
  approvalNotes: z.string().max(500, "Les notes ne peuvent pas dépasser 500 caractères").optional().nullable(),
});

export const payrollPaySchema = z.object({
  payrollId: nonEmptyString("L'ID de la paie"),
  paymentMethod: nonEmptyString("Le mode de paiement", 2).max(50, "Le mode de paiement ne peut pas dépasser 50 caractères"),
  paymentReference: z.string().max(100, "La référence de paiement ne peut pas dépasser 100 caractères").optional().nullable(),
});

// Type exports
export type PayrollCreateInput = z.infer<typeof payrollCreateSchema>;
export type PayrollUpdateInput = z.infer<typeof payrollUpdateSchema>;
export type PayrollApproveInput = z.infer<typeof payrollApproveSchema>;
export type PayrollPayInput = z.infer<typeof payrollPaySchema>;


// ACCOUNT VALIDATIONS (Finance Module)


export const accountCreateSchema = z.object({
  code: nonEmptyString("Le code du compte", 2).max(20, "Le code ne peut pas dépasser 20 caractères"),
  name: nonEmptyString("Le nom du compte", 2).max(100, "Le nom ne peut pas dépasser 100 caractères"),
  type: AccountTypeEnum,
  parentCode: z.string().max(20, "Le code parent ne peut pas dépasser 20 caractères").optional().nullable(),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional().nullable(),
  isActive: z.boolean().default(true),
});

export const accountUpdateSchema = z.object({
  name: nonEmptyString("Le nom du compte", 2).max(100, "Le nom ne peut pas dépasser 100 caractères").optional(),
  type: AccountTypeEnum.optional(),
  parentCode: z.string().max(20, "Le code parent ne peut pas dépasser 20 caractères").optional().nullable(),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional().nullable(),
  isActive: z.boolean().optional(),
});

// Type exports
export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;


// JOURNAL ENTRY VALIDATIONS


export const journalLineSchema = z.object({
  accountId: nonEmptyString("L'ID du compte"),
  debit: nonNegativeNumber("Le débit").default(0),
  credit: nonNegativeNumber("Le crédit").default(0),
  description: z.string().max(200, "La description ne peut pas dépasser 200 caractères").optional().nullable(),
});

export const journalEntryCreateSchema = z.object({
  entryNumber: nonEmptyString("Le numéro d'écriture", 2).max(50, "Le numéro ne peut pas dépasser 50 caractères"),
  date: dateField("La date"),
  description: nonEmptyString("La description", 2).max(500, "La description ne peut pas dépasser 500 caractères"),
  reference: z.string().max(100, "La référence ne peut pas dépasser 100 caractères").optional().nullable(),
  lines: z.array(journalLineSchema).min(2, "Au moins 2 lignes sont requises pour une écriture comptable"),
}).superRefine((data, ctx) => {
  // Validate double-entry: total debits must equal total credits
  const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);
  
  // Round to 2 decimal places for comparison
  const roundedDebit = Math.round(totalDebit * 100) / 100;
  const roundedCredit = Math.round(totalCredit * 100) / 100;
  
  if (roundedDebit !== roundedCredit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Les totaux ne sont pas équilibrés: Débit=${roundedDebit.toFixed(2)}, Crédit=${roundedCredit.toFixed(2)}`,
      path: ["lines"],
    });
  }
  
  // Validate each line has either debit or credit, not both
  data.lines.forEach((line, index) => {
    if (line.debit > 0 && line.credit > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Une ligne ne peut pas avoir à la fois un débit et un crédit",
        path: ["lines", index],
      });
    }
    if (line.debit === 0 && line.credit === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Une ligne doit avoir soit un débit soit un crédit",
        path: ["lines", index],
      });
    }
  });
});

// Type exports
export type JournalLineInput = z.infer<typeof journalLineSchema>;
export type JournalEntryCreateInput = z.infer<typeof journalEntryCreateSchema>;


// SUPPLIER VALIDATIONS


export const supplierCreateSchema = z.object({
  code: nonEmptyString("Le code fournisseur", 2).max(20, "Le code ne peut pas dépasser 20 caractères"),
  name: nonEmptyString("Le nom du fournisseur", 2).max(200, "Le nom ne peut pas dépasser 200 caractères"),
  contactName: z.string().max(100, "Le nom du contact ne peut pas dépasser 100 caractères").optional().nullable(),
  email: emailField().optional().nullable(),
  phone: phoneField(),
  address: z.string().max(500, "L'adresse ne peut pas dépasser 500 caractères").optional().nullable(),
  taxId: z.string().max(50, "Le numéro fiscal ne peut pas dépasser 50 caractères").optional().nullable(),
  paymentTerms: z.number().int("Les conditions de paiement doivent être un nombre entier de jours").min(0).max(365).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const supplierUpdateSchema = z.object({
  name: nonEmptyString("Le nom du fournisseur", 2).max(200, "Le nom ne peut pas dépasser 200 caractères").optional(),
  contactName: z.string().max(100, "Le nom du contact ne peut pas dépasser 100 caractères").optional().nullable(),
  email: emailField().optional().nullable(),
  phone: phoneField(),
  address: z.string().max(500, "L'adresse ne peut pas dépasser 500 caractères").optional().nullable(),
  taxId: z.string().max(50, "Le numéro fiscal ne peut pas dépasser 50 caractères").optional().nullable(),
  paymentTerms: z.number().int("Les conditions de paiement doivent être un nombre entier de jours").min(0).max(365).optional().nullable(),
  isActive: z.boolean().optional(),
});

// Type exports
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;


// PURCHASE ORDER VALIDATIONS


export const purchaseOrderLineSchema = z.object({
  productId: nonEmptyString("L'ID du produit"),
  quantity: positiveNumber("La quantité"),
  unitPrice: nonNegativeNumber("Le prix unitaire"),
});

export const purchaseOrderCreateSchema = z.object({
  orderNumber: nonEmptyString("Le numéro de commande", 2).max(50, "Le numéro ne peut pas dépasser 50 caractères"),
  supplierId: nonEmptyString("L'ID du fournisseur"),
  orderDate: dateField("La date de commande"),
  expectedDate: optionalDate("La date prévue"),
  notes: z.string().max(1000, "Les notes ne peuvent pas dépasser 1000 caractères").optional().nullable(),
  lines: z.array(purchaseOrderLineSchema).min(1, "Au moins une ligne est requise"),
}).superRefine((data, ctx) => {
  // Validate expected date is after order date
  if (data.expectedDate && data.orderDate > data.expectedDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La date prévue doit être postérieure à la date de commande",
      path: ["expectedDate"],
    });
  }
});

export const purchaseOrderUpdateSchema = z.object({
  expectedDate: optionalDate("La date prévue"),
  status: PurchaseStatusEnum.optional(),
  notes: z.string().max(1000, "Les notes ne peuvent pas dépasser 1000 caractères").optional().nullable(),
});

// Type exports
export type PurchaseOrderLineInput = z.infer<typeof purchaseOrderLineSchema>;
export type PurchaseOrderCreateInput = z.infer<typeof purchaseOrderCreateSchema>;
export type PurchaseOrderUpdateInput = z.infer<typeof purchaseOrderUpdateSchema>;


// CATEGORY VALIDATIONS


export const categoryCreateSchema = z.object({
  name: nonEmptyString("Le nom de la catégorie", 2).max(100, "Le nom ne peut pas dépasser 100 caractères"),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional().nullable(),
});

export const categoryUpdateSchema = z.object({
  name: nonEmptyString("Le nom de la catégorie", 2).max(100, "Le nom ne peut pas dépasser 100 caractères").optional(),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional().nullable(),
});

// Type exports
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;


// NOTIFICATION VALIDATIONS


export const notificationCreateSchema = z.object({
  userId: nonEmptyString("L'ID de l'utilisateur"),
  title: nonEmptyString("Le titre", 2).max(100, "Le titre ne peut pas dépasser 100 caractères"),
  message: nonEmptyString("Le message", 2).max(500, "Le message ne peut pas dépasser 500 caractères"),
  type: NotificationTypeEnum,
  link: z.string().max(200, "Le lien ne peut pas dépasser 200 caractères").optional().nullable(),
});

// Type export
export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;


// SETTING VALIDATIONS


export const settingCreateSchema = z.object({
  key: nonEmptyString("La clé", 2).max(100, "La clé ne peut pas dépasser 100 caractères"),
  value: nonEmptyString("La valeur"),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional().nullable(),
  category: z.string().max(50, "La catégorie ne peut pas dépasser 50 caractères").optional().nullable(),
});

export const settingUpdateSchema = z.object({
  value: nonEmptyString("La valeur").optional(),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional().nullable(),
  category: z.string().max(50, "La catégorie ne peut pas dépasser 50 caractères").optional().nullable(),
});

// Type exports
export type SettingCreateInput = z.infer<typeof settingCreateSchema>;
export type SettingUpdateInput = z.infer<typeof settingUpdateSchema>;


// UTILITY FUNCTIONS


/**
 * Validates that a date range is valid (start before end)
 */
export function validateDateRange(startDate: Date, endDate: Date, startField: string, endField: string): boolean {
  return startDate < endDate;
}

/**
 * Validates that a monetary amount is within acceptable bounds
 */
export function validateMonetaryBounds(amount: number, min = 0, max = 100000000): boolean {
  return amount > min && amount <= max;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.errors.map((error) => {
    const path = error.path.join(".");
    return path ? `${path}: ${error.message}` : error.message;
  });
}


// EXPORT ALL ENUMS


export type UserRole = z.infer<typeof UserRoleEnum>;
export type Department = z.infer<typeof DepartmentEnum>;
export type EmployeeStatus = z.infer<typeof EmployeeStatusEnum>;
export type TimeEntryStatus = z.infer<typeof TimeEntryStatusEnum>;
export type PayrollStatus = z.infer<typeof PayrollStatusEnum>;
export type ProductType = z.infer<typeof ProductTypeEnum>;
export type MovementType = z.infer<typeof MovementTypeEnum>;
export type WorkOrderStatus = z.infer<typeof WorkOrderStatusEnum>;
export type Priority = z.infer<typeof PriorityEnum>;
export type StepStatus = z.infer<typeof StepStatusEnum>;
export type ItemType = z.infer<typeof ItemTypeEnum>;
export type AccountType = z.infer<typeof AccountTypeEnum>;
export type TransactionType = z.infer<typeof TransactionTypeEnum>;
export type TransactionStatus = z.infer<typeof TransactionStatusEnum>;
export type JournalStatus = z.infer<typeof JournalStatusEnum>;
export type PurchaseStatus = z.infer<typeof PurchaseStatusEnum>;
export type AuditAction = z.infer<typeof AuditActionEnum>;
export type NotificationType = z.infer<typeof NotificationTypeEnum>;


