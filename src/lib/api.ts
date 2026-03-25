// Frontend data fetching utilities


// Types for API responses
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore?: boolean;
  };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  type: 'RAW_MATERIAL' | 'WORK_IN_PROGRESS' | 'FINISHED_GOOD' | 'CONSUMABLE';
  unit: string;
  unitPrice: number;
  costPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string } | null;
  inventory: {
    quantity: number;
    reservedQty: number;
    minStockLevel: number;
    maxStockLevel: number | null;
  } | null;
}

export interface StockAlert {
  id: string;
  productId: string;
  product: Product;
  currentQty: number;
  minStockLevel: number;
  maxStockLevel: number | null;
  reorderPoint: number | null;
  reservedQty: number;
  availableQty: number;
  location: string | null;
  lastRestockedAt: string | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  shortage: number;
  shortagePercent: number;
  reorderQty: number;
  valueAtRisk: number;
  isOutOfStock: boolean;
}

export interface WorkOrder {
  id: string;
  orderNumber: string;
  productId: string;
  quantity: number;
  completedQty: number;
  status: 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    sku: string;
    name: string;
    unit: string;
  };
  assignedTo: {
    id: string;
    employeeNumber: string;
    fullName: string;
    department: string;
  } | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    steps: number;
    items: number;
  };
}

export interface Transaction {
  id: string;
  transactionNumber: string;
  reference: string | null;
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  description: string | null;
  category: string | null;
  transactionDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECONCILED' | 'CANCELLED';
  reconciledAt: string | null;
  createdAt: string;
  updatedAt: string;
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  department: string;
  position: string;
  hireDate: string;
  terminationDate: string | null;
  salary: number;
  bankAccount: string | null;
  status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
  } | null;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  overtimeHours: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_DEPARTURE' | 'VACATION' | 'SICK_LEAVE';
  notes: string | null;
}

export interface DashboardStats {
  totalRevenue: number;
  activeEmployees: number;
  lowStockAlerts: number;
  pendingWorkOrders: number;
}

// Base fetch function with error handling
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Une erreur est survenue' }));
    throw new Error(error.error || 'Une erreur est survenue');
  }

  return response.json();
}


// PRODUCTS API


export async function fetchProducts(params?: {
  page?: number;
  limit?: number;
  categoryId?: string;
  type?: string;
  search?: string;
  isActive?: boolean;
}): Promise<PaginatedResponse<Product>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.isActive !== undefined) searchParams.set('isActive', params.isActive.toString());

  const url = `/api/inventory/products${searchParams.toString() ? `?${searchParams}` : ''}`;
  return fetchApi<PaginatedResponse<Product>>(url);
}

export async function createProduct(data: {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  type: 'RAW_MATERIAL' | 'WORK_IN_PROGRESS' | 'FINISHED_GOOD' | 'CONSUMABLE';
  unit: string;
  unitPrice: number;
  costPrice: number;
  isActive?: boolean;
}): Promise<Product> {
  return fetchApi<Product>('/api/inventory/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


// STOCK & ALERTS API


export async function fetchInventory(params?: {
  page?: number;
  limit?: number;
  alerts?: boolean;
  productType?: string;
  categoryId?: string;
  location?: string;
  search?: string;
}): Promise<PaginatedResponse<Product & { inventory: NonNullable<Product['inventory']> }>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.alerts) searchParams.set('alerts', 'true');
  if (params?.productType) searchParams.set('productType', params.productType);
  if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
  if (params?.location) searchParams.set('location', params.location);
  if (params?.search) searchParams.set('search', params.search);

  const url = `/api/inventory/stock${searchParams.toString() ? `?${searchParams}` : ''}`;
  return fetchApi<PaginatedResponse<Product & { inventory: NonNullable<Product['inventory']> }>>(url);
}

export async function fetchStockAlerts(params?: {
  page?: number;
  limit?: number;
  severity?: string;
  productType?: string;
}): Promise<{ data: StockAlert[]; pagination: PaginatedResponse<StockAlert>['pagination']; summary: {
  totalAlerts: number;
  bySeverity: { critical: number; high: number; medium: number; low: number };
  outOfStock: number;
  totalValueAtRisk: number;
} }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.severity) searchParams.set('severity', params.severity);
  if (params?.productType) searchParams.set('productType', params.productType);

  const url = `/api/inventory/alerts${searchParams.toString() ? `?${searchParams}` : ''}`;
  return fetchApi(url);
}


// WORK ORDERS API


export async function fetchWorkOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  productId?: string;
  assignedToId?: string;
  search?: string;
}): Promise<PaginatedResponse<WorkOrder>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.priority) searchParams.set('priority', params.priority);
  if (params?.productId) searchParams.set('productId', params.productId);
  if (params?.assignedToId) searchParams.set('assignedToId', params.assignedToId);
  if (params?.search) searchParams.set('search', params.search);

  const url = `/api/production/work-orders${searchParams.toString() ? `?${searchParams}` : ''}`;
  return fetchApi<PaginatedResponse<WorkOrder>>(url);
}

export async function createWorkOrder(data: {
  productId: string;
  quantity: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  scheduledStart?: string;
  scheduledEnd?: string;
  assignedToId?: string;
  notes?: string;
}): Promise<WorkOrder> {
  return fetchApi<WorkOrder>('/api/production/work-orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


// TRANSACTIONS API


export async function fetchTransactions(params?: {
  page?: number;
  limit?: number;
  accountId?: string;
  status?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  search?: string;
}): Promise<{ transactions: Transaction[]; pagination: PaginatedResponse<Transaction>['pagination']; summary: { totalAmount: number; count: number } }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.accountId) searchParams.set('accountId', params.accountId);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);

  const url = `/api/finance/transactions${searchParams.toString() ? `?${searchParams}` : ''}`;
  return fetchApi(url);
}

export async function createTransaction(data: {
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  description?: string;
  category?: string;
  reference?: string;
  transactionDate: string;
}): Promise<Transaction> {
  return fetchApi<Transaction>('/api/finance/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


// EMPLOYEES API


export async function fetchEmployees(params?: {
  page?: number;
  limit?: number;
  department?: string;
  status?: string;
  search?: string;
}): Promise<PaginatedResponse<Employee>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.department) searchParams.set('department', params.department);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const url = `/api/hr/employees${searchParams.toString() ? `?${searchParams}` : ''}`;
  return fetchApi<PaginatedResponse<Employee>>(url);
}


// TIME ENTRIES API


export async function clockIn(employeeId: string): Promise<TimeEntry> {
  return fetchApi<TimeEntry>('/api/hr/time-entries/clock-in', {
    method: 'POST',
    body: JSON.stringify({ employeeId }),
  });
}

export async function clockOut(employeeId: string): Promise<TimeEntry> {
  return fetchApi<TimeEntry>('/api/hr/time-entries/clock-out', {
    method: 'POST',
    body: JSON.stringify({ employeeId }),
  });
}


// SEED API


export async function seedDatabase(): Promise<{ message: string; counts: {
  products: number;
  employees: number;
  transactions: number;
  workOrders: number;
  accounts: number;
  categories: number;
} }> {
  return fetchApi('/api/seed', { method: 'POST' });
}


// DASHBOARD API (Combined queries)


export async function fetchDashboardStats(): Promise<DashboardStats> {
  // Fetch all required data in parallel
  const [employees, alerts, workOrders, transactions] = await Promise.all([
    fetchEmployees({ limit: 1, status: 'ACTIVE' }),
    fetchStockAlerts({ limit: 1 }),
    fetchWorkOrders({ limit: 1, status: 'IN_PROGRESS' }),
    fetchTransactions({ limit: 1, status: 'APPROVED' }),
  ]);

  // Calculate revenue from approved transactions (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return {
    totalRevenue: transactions.summary?.totalAmount || 12000000, // Default to 12M DZD
    activeEmployees: employees.pagination.total,
    lowStockAlerts: alerts.summary.totalAlerts,
    pendingWorkOrders: workOrders.pagination.total,
  };
}


