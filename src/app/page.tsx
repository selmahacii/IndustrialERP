'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Package,
  Factory,
  Banknote,
  Users,
  BarChart3,
  Settings,
  Bell,
  Moon,
  Sun,
  Search,
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Filter,
  Menu,
  LogOut,
  User,
  RefreshCw,
  ChevronDown,
  FileText,
  Receipt,
  Building2,
  PieChart,
  ShoppingCart,
  Wrench,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Gauge,
  Truck,
  CreditCard,
  Wallet,
  UserCheck,
  Building,
  MoreHorizontal,
  Folder,
  Target,
  Activity,
  Printer,
  Download,
  DollarSign,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart as RechartsPie, Pie, Cell, Legend, Area, AreaChart, ComposedChart, CartesianGrid } from 'recharts';

import {
  fetchProducts,
  fetchStockAlerts,
  fetchWorkOrders,
  fetchTransactions,
  fetchEmployees,
  createProduct,
  createWorkOrder,
  createTransaction,
  seedDatabase,
  type Product,
  type StockAlert,
  type WorkOrder,
  type Transaction,
  type Employee,
} from '@/lib/api';


// TYPES & CONSTANTS


type TabValue = 'dashboard' | 'inventory' | 'production' | 'finance' | 'hr' | 'reports' | 'settings';

const NAV_ITEMS = [
  { value: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
  { value: 'inventory', label: 'Inventaire', icon: Package },
  { value: 'production', label: 'Production', icon: Factory },
  { value: 'finance', label: 'Finance', icon: Banknote },
  { value: 'hr', label: 'RH', icon: Users },
  { value: 'reports', label: 'Rapports', icon: BarChart3 },
  { value: 'settings', label: 'Paramètres', icon: Settings },
] as const;

const PRODUCT_TYPES: Record<string, string> = {
  RAW_MATERIAL: 'Matière Première',
  WORK_IN_PROGRESS: 'En Cours',
  FINISHED_GOOD: 'Produit Fini',
  CONSUMABLE: 'Consommable',
};

const WORK_ORDER_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-slate-400' },
  PLANNED: { label: 'Planifié', color: 'bg-sky-400' },
  IN_PROGRESS: { label: 'En Cours', color: 'bg-amber-400' },
  ON_HOLD: { label: 'En Attente', color: 'bg-orange-400' },
  COMPLETED: { label: 'Terminé', color: 'bg-emerald-400' },
  CANCELLED: { label: 'Annulé', color: 'bg-rose-400' },
};

const DEPARTMENTS: Record<string, string> = {
  PRODUCTION: 'Production',
  WAREHOUSE: 'Entrepôt',
  FINANCE: 'Finance',
  HR: 'Ressources Humaines',
  SALES: 'Ventes',
  PROCUREMENT: 'Approvisionnement',
  QUALITY: 'Qualité',
  MAINTENANCE: 'Maintenance',
  LOGISTICS: 'Logistique',
  ADMINISTRATION: 'Administration',
};

// Algerian Tax Constants
const TVA_RATES = [
  { value: '0', label: '0% - Exonéré' },
  { value: '9', label: '9% - Taux réduit' },
  { value: '19', label: '19% - Taux normal' },
];

const TRANSACTION_CATEGORIES = [
  { value: 'VENTE', label: 'Vente de produits' },
  { value: 'ACHAT', label: 'Achat de matières' },
  { value: 'SALAIRE', label: 'Salaires et charges' },
  { value: 'CHARGE', label: 'Charges d\'exploitation' },
  { value: 'IMPOT', label: 'Impôts et taxes' },
  { value: 'SUBVENTION', label: 'Subventions' },
  { value: 'EMPRUNT', label: 'Emprunt bancaire' },
  { value: 'AUTRE', label: 'Autre' },
];

const BANKS_ALGERIA = [
  'BNA - Banque Nationale d\'Algérie',
  'BEA - Banque Extérieure d\'Algérie',
  'CPA - Crédit Populaire d\'Algérie',
  'BADR - Banque de l\'Agriculture et du Développement Rural',
  'BDL - Banque de Développement Local',
  'CNEP - Caisse Nationale d\'Épargne et de Prévoyance',
  'Société Générale Algérie',
  'BNP Paribas El Djazaïr',
  'Groupe Banque Populaire',
  'Arab Banking Corporation Algeria',
];

const WILAYAS = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra',
  'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret',
  'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda',
  'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem',
  'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi', 'Bordj Bou Arréridj',
  'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued', 'Khenchela',
  'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
  'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal',
  'Béni Abbès', 'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa',
];

// Pastel Colors for Charts
const PASTEL_COLORS = {
  emerald: '#86efac',
  amber: '#fcd34d',
  rose: '#fda4af',
  sky: '#7dd3fc',
  violet: '#c4b5fd',
  teal: '#5eead4',
  orange: '#fdba74',
  slate: '#94a3b8',
};


// MOCK DATA FOR CHARTS


const revenueData = [
  { month: 'Août', revenue: 8500000, expenses: 6200000, profit: 2300000 },
  { month: 'Sep', revenue: 9200000, expenses: 6800000, profit: 2400000 },
  { month: 'Oct', revenue: 10500000, expenses: 7500000, profit: 3000000 },
  { month: 'Nov', revenue: 11800000, expenses: 8100000, profit: 3700000 },
  { month: 'Déc', revenue: 13500000, expenses: 9200000, profit: 4300000 },
  { month: 'Jan', revenue: 12000000, expenses: 8500000, profit: 3500000 },
];

const productionStatusData = [
  { name: 'Terminé', value: 45, color: PASTEL_COLORS.emerald },
  { name: 'En Cours', value: 30, color: PASTEL_COLORS.amber },
  { name: 'Planifié', value: 15, color: PASTEL_COLORS.sky },
  { name: 'En Retard', value: 10, color: PASTEL_COLORS.rose },
];

const cashFlowData = [
  { week: 'S1', entrees: 2500000, sorties: 1800000 },
  { week: 'S2', entrees: 3200000, sorties: 2100000 },
  { week: 'S3', entrees: 2800000, sorties: 2400000 },
  { week: 'S4', entrees: 4100000, sorties: 2900000 },
];

const inventoryTurnover = [
  { category: 'Acier', turnover: 4.2, stock: 2500 },
  { category: 'Aluminium', turnover: 3.8, stock: 3200 },
  { category: 'Plastique', turnover: 5.1, stock: 8500 },
  { category: 'Cuivre', turnover: 2.9, stock: 0 },
  { category: 'Laiton', turnover: 3.5, stock: 1200 },
];

const agingData = [
  { range: '0-30', value: 4500000, color: PASTEL_COLORS.emerald },
  { range: '31-60', value: 2100000, color: PASTEL_COLORS.sky },
  { range: '61-90', value: 850000, color: PASTEL_COLORS.amber },
  { range: '90+', value: 420000, color: PASTEL_COLORS.rose },
];

const chartConfig = {
  revenue: { label: 'Revenus', color: PASTEL_COLORS.emerald },
  expenses: { label: 'Dépenses', color: PASTEL_COLORS.rose },
  profit: { label: 'Profit', color: PASTEL_COLORS.sky },
} satisfies ChartConfig;


// MAIN COMPONENT


export default function IndustrialERP() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabValue>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();


  // QUERIES


  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetchProducts({ limit: 50 }),
  });

  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchStockAlerts({ limit: 20 }),
  });

  const { data: workOrdersData, isLoading: workOrdersLoading, refetch: refetchWorkOrders } = useQuery({
    queryKey: ['workOrders'],
    queryFn: () => fetchWorkOrders({ limit: 20 }),
  });

  const { data: transactionsData, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => fetchTransactions({ limit: 20 }),
  });

  const { data: employeesData, isLoading: employeesLoading, refetch: refetchEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => fetchEmployees({ limit: 50 }),
  });


  // MUTATIONS


  const seedMutation = useMutation({
    mutationFn: seedDatabase,
    onSuccess: () => {
      toast({ title: 'Succès', description: 'Base de données initialisée avec succès' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const handleSeedDatabase = () => {
    seedMutation.mutate();
  };

  // Calculate comprehensive stats
  const stats = {
    totalRevenue: 12000000,
    activeEmployees: employeesData?.pagination.total || 5,
    lowStockAlerts: alertsData?.summary.totalAlerts || 4,
    pendingWorkOrders: workOrdersData?.data.filter(wo => wo.status === 'IN_PROGRESS' || wo.status === 'PLANNED').length || 2,
    payables: 231919,
    payablesChange: 5.4,
    sales: 1110359,
    salesChange: -8.6,
    expenses: 570037,
    expensesChange: 3.8,
    bankBalance: 3192889,
    bankBalanceChange: 5.3,
    grossProfitPercent: 48.40,
    netIncomePercent: 39.06,
    ebitda: 331589,
    ebitdaChange: 1.02,
    inventoryValue: 4580000,
    inventoryTurnover: 3.7,
    productionEfficiency: 87.3,
    onTimeDelivery: 94.2,
    qualityRate: 98.7,
    employeeUtilization: 82.5,
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
          <div className="flex h-14 items-center px-4 gap-4">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SidebarContent
                  activeTab={activeTab}
                  setActiveTab={(tab) => {
                    setActiveTab(tab);
                    setSidebarOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-700 flex items-center justify-center">
                <Factory className="h-5 w-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-lg text-slate-800">Industrial ERP</span>
                <span className="text-xs text-slate-500 block -mt-0.5">Système de Gestion - Algérie</span>
              </div>
            </div>

            <div className="flex-1 max-w-md mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Rechercher produits, ordres, transactions..."
                  className="pl-9 bg-slate-50 border-slate-200 h-9"
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => {
                      refetchProducts();
                      refetchAlerts();
                      refetchWorkOrders();
                      refetchTransactions();
                      refetchEmployees();
                      toast({ title: 'Actualisé', description: 'Données rechargées' });
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Actualiser</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                    <Bell className="h-4 w-4" />
                    {stats.lowStockAlerts > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-rose-500 text-[10px] font-medium text-white flex items-center justify-center">
                        {stats.lowStockAlerts}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Changer le thème</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 gap-2 px-2">
                    <div className="h-7 w-7 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-semibold">
                      AD
                    </div>
                    <div className="hidden lg:block text-left">
                      <div className="text-sm font-medium text-slate-700">Admin System</div>
                      <div className="text-xs text-slate-500">admin@industriel.dz</div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Mon Compte</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-rose-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="border-t border-slate-200 px-4 overflow-x-auto">
            <nav className="flex gap-1 h-10">
              {NAV_ITEMS.map((item) => (
                <Button
                  key={item.value}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-8 px-3 text-xs font-medium rounded-md gap-1.5 shrink-0',
                    activeTab === item.value 
                      ? 'bg-slate-100 text-slate-900 border-b-2 border-slate-700 rounded-b-none' 
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                  onClick={() => setActiveTab(item.value)}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>
        </header>

        <div className="flex flex-1">
          <aside className="hidden lg:block w-64 border-r bg-white overflow-y-auto">
            <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} />
          </aside>

          <main className="flex-1 overflow-auto bg-slate-50">
            <div className="p-4 md:p-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-4">
                <TabsContent value="dashboard" className="space-y-4 mt-0">
                  <DashboardTab
                    stats={stats}
                    alerts={alertsData?.data || []}
                    workOrders={workOrdersData?.data || []}
                    products={productsData?.data || []}
                    transactions={transactionsData?.transactions || []}
                    employees={employeesData?.data || []}
                    onSeed={handleSeedDatabase}
                    isSeeding={seedMutation.isPending}
                  />
                </TabsContent>

                <TabsContent value="inventory" className="space-y-4 mt-0">
                  <InventoryTab
                    products={productsData?.data || []}
                    alerts={alertsData?.data || []}
                    isLoading={productsLoading || alertsLoading}
                    onRefresh={refetchProducts}
                  />
                </TabsContent>

                <TabsContent value="production" className="space-y-4 mt-0">
                  <ProductionTab
                    workOrders={workOrdersData?.data || []}
                    products={productsData?.data || []}
                    employees={employeesData?.data || []}
                    isLoading={workOrdersLoading}
                    onRefresh={refetchWorkOrders}
                  />
                </TabsContent>

                <TabsContent value="finance" className="space-y-4 mt-0">
                  <FinanceTab
                    transactions={transactionsData?.transactions || []}
                    isLoading={transactionsLoading}
                    onRefresh={refetchTransactions}
                  />
                </TabsContent>

                <TabsContent value="hr" className="space-y-4 mt-0">
                  <HRTab
                    employees={employeesData?.data || []}
                    isLoading={employeesLoading}
                    onRefresh={refetchEmployees}
                  />
                </TabsContent>

                <TabsContent value="reports" className="space-y-4 mt-0">
                  <ReportsTab />
                </TabsContent>

                <TabsContent value="settings" className="space-y-4 mt-0">
                  <SettingsTab onSeed={handleSeedDatabase} isSeeding={seedMutation.isPending} />
                </TabsContent>
              </Tabs>
            </div>
          </main>

          <aside className="hidden xl:block w-80 border-l bg-white overflow-y-auto">
            <KPIMeterSidebar stats={stats} alerts={alertsData?.data || []} />
          </aside>
        </div>

        <footer className="border-t bg-white py-2.5 px-4 text-center text-xs text-slate-500">
          <div className="flex items-center justify-center gap-4">
            <span>© 2024 Industrial ERP v1.0.0</span>
            <span>•</span>
            <span>Conforme à la législation algérienne</span>
            <span>•</span>
            <span>12M DZD/mois</span>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}


// SIDEBAR COMPONENT


function SidebarContent({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabValue;
  setActiveTab: (tab: TabValue) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
          <Bell className="h-4 w-4" />
          Rappels
        </div>
        <div className="space-y-1.5">
          {[
            { label: 'Ordres à Approuver', count: 3 },
            { label: 'Factures en Retard', count: 2 },
            { label: 'Stock Critique', count: 4 },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1">
              <div className="h-3.5 w-3.5 rounded border border-slate-300" />
              <span className="text-slate-600">{item.label}</span>
              <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px] bg-slate-100">{item.count}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 border-b">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
          <LayoutDashboard className="h-4 w-4" />
          Raccourcis
        </div>
        <div className="space-y-1">
          {[
            { icon: FileText, label: 'Rapports' },
            { icon: ShoppingCart, label: 'Achats' },
            { icon: Truck, label: 'Fournisseurs' },
            { icon: Receipt, label: 'Transactions' },
            { icon: BarChart3, label: 'Analyse' },
          ].map((item, i) => (
            <Button key={i} variant="ghost" size="sm" className="w-full justify-start h-7 text-xs gap-2 text-slate-600 hover:text-slate-900">
              <item.icon className="h-3.5 w-3.5 text-slate-500" />
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-3 border-b">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
          <Wrench className="h-4 w-4" />
          Actions Rapides
        </div>
        <div className="space-y-1">
          {[
            { label: 'Commandes Ouvrir', icon: Folder },
            { label: 'Historique Paiements', icon: CreditCard },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1">
              <div className="h-3.5 w-3.5 rounded border border-slate-300" />
              <span className="text-slate-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
          <Building className="h-4 w-4" />
          Départements
        </div>
        <div className="space-y-1">
          {Object.entries(DEPARTMENTS).slice(0, 6).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-xs py-1">
              <div className="h-3.5 w-3.5 rounded border border-slate-300" />
              <span className="text-slate-600">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 border-t text-[10px] text-slate-400 text-center">
        Version 1.0.0 • Législation DZ 2024
      </div>
    </div>
  );
}


// KPI METER SIDEBAR


function KPIMeterSidebar({ stats, alerts }: { stats: typeof stats; alerts: StockAlert[] }) {
  return (
    <div className="p-4 space-y-4">
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700">Indicateur Clé</CardTitle>
            <Select defaultValue="bank">
              <SelectTrigger className="h-7 w-32 text-xs border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Trésorerie</SelectItem>
                <SelectItem value="revenue">Revenus</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center">
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 100 100" className="transform -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                <circle 
                  cx="50" cy="50" r="40" fill="none" 
                  stroke="#94a3b8" strokeWidth="12"
                  strokeDasharray={`${stats.bankBalance / 5000000 * 251.2} 251.2`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-800">
                  {(stats.bankBalance / 1000000).toFixed(1)}M
                </span>
                <span className="text-[10px] text-slate-500">DZD</span>
              </div>
            </div>
            <div className="text-center mt-2">
              <p className="text-xs font-medium text-slate-700">Trésorerie Totale</p>
              <p className="text-[10px] text-slate-500">vs. période précédente</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Âge Créances</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ChartContainer config={chartConfig} className="h-[140px]">
            <BarChart data={agingData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="range" type="category" width={35} tick={{ fontSize: 10 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {agingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="flex justify-center gap-3 mt-2">
            {agingData.map((item) => (
              <div key={item.range} className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-slate-500">{item.range}j</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Alertes Prioritaires</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {alerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
              <div className={cn(
                'h-2 w-2 rounded-full',
                alert.severity === 'CRITICAL' ? 'bg-rose-500' :
                alert.severity === 'HIGH' ? 'bg-amber-500' : 'bg-yellow-500'
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">
                  {alert.product.name}
                </p>
                <p className="text-[10px] text-slate-500">
                  Stock: {alert.currentQty} / Min: {alert.minStockLevel}
                </p>
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-2">Aucune alerte</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">Efficacité Globale</span>
            <Badge className="bg-slate-600 text-white text-[10px]">
              {stats.productionEfficiency}%
            </Badge>
          </div>
          <Progress value={stats.productionEfficiency} className="h-2" />
          <div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
            <span>Objectif: 85%</span>
            <span className="text-emerald-600">+2.3%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// DASHBOARD TAB


function DashboardTab({
  stats,
  alerts,
  workOrders,
  products,
  transactions,
  employees,
  onSeed,
  isSeeding,
}: {
  stats: typeof stats;
  alerts: StockAlert[];
  workOrders: WorkOrder[];
  products: Product[];
  transactions: Transaction[];
  employees: Employee[];
  onSeed: () => void;
  isSeeding: boolean;
}) {
  const formatCurrency = (value: number, compact = false) => {
    if (compact) {
      return new Intl.NumberFormat('fr-DZ', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value) + ' DZD';
    }
    return new Intl.NumberFormat('fr-DZ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + ' DZD';
  };

  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  // Modal states
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      {alerts.length === 0 && products.length === 0 && (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-12 w-12 text-slate-400 mb-4" />
            <h3 className="font-semibold mb-2 text-slate-700">Base de données vide</h3>
            <p className="text-sm text-slate-500 mb-4">
              Cliquez pour initialiser les données de démonstration
            </p>
            <Button onClick={onSeed} disabled={isSeeding} className="bg-slate-700 hover:bg-slate-800">
              {isSeeding ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Initialisation...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Initialiser les données
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Action Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-slate-200 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-colors">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Bilan</p>
                <p className="text-xs text-slate-500">Rapport financier</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-sky-50 hover:bg-sky-100 cursor-pointer transition-colors">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-sky-100 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Écriture</p>
                <p className="text-xs text-slate-500">Nouvelle écriture</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-orange-50 hover:bg-orange-100 cursor-pointer transition-colors">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Rapprochement</p>
                <p className="text-xs text-slate-500">Bancaire</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center">
                <PieChart className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Résultats</p>
                <p className="text-xs text-slate-500">Compte de résultat</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Primary KPI Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-700">Indicateurs Principaux</CardTitle>
            <Select defaultValue="month">
              <SelectTrigger className="h-8 w-48 text-xs border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Fin ce mois vs. mois dernier</SelectItem>
                <SelectItem value="quarter">Ce trimestre vs. précédent</SelectItem>
                <SelectItem value="year">Cette année vs. précédente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Fournisseurs', current: stats.payables, previous: 219735, change: stats.payablesChange, icon: Truck },
              { label: 'Ventes', current: stats.sales, previous: 1215422, change: stats.salesChange, icon: ShoppingCart },
              { label: 'Dépenses', current: stats.expenses, previous: 549009, change: stats.expensesChange, icon: CreditCard },
              { label: 'Trésorerie', current: stats.bankBalance, previous: 3029839, change: stats.bankBalanceChange, icon: Wallet },
            ].map((kpi) => (
              <div key={kpi.label} className="p-3 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <kpi.icon className="h-4 w-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-600">{kpi.label}</span>
                  </div>
                  <div className={cn('flex items-center gap-1 text-xs font-semibold', kpi.change >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                    {kpi.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {formatPercent(kpi.change)}
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-800">{formatCurrency(kpi.current, true)}</div>
                <div className="mt-1 text-[10px] text-slate-500">Précédent: {formatCurrency(kpi.previous, true)}</div>
                <Progress value={Math.min(100, (kpi.current / kpi.previous) * 100)} className="h-1 mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Financials Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-700">Indicateurs Financiers</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-slate-600">
              <MoreHorizontal className="h-3.5 w-3.5" />
              Plus
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Marge Brute %', value: stats.grossProfitPercent, target: 45, unit: '%' },
              { label: 'Bénéfice Net %', value: stats.netIncomePercent, target: 35, unit: '%' },
              { label: 'EBITDA', value: stats.ebitda, change: stats.ebitdaChange, unit: 'DZD' },
              { label: 'Rotation Stock', value: stats.inventoryTurnover, target: 4, unit: 'x' },
            ].map((metric) => (
              <div key={metric.label} className="p-3 rounded-lg border border-slate-200 bg-white">
                <div className="text-xs font-medium text-slate-600 mb-1">{metric.label}</div>
                <div className="text-xl font-bold text-slate-800">
                  {metric.unit === 'DZD' ? formatCurrency(metric.value as number, true) : `${metric.value}${metric.unit === '%' ? '%' : metric.unit}`}
                </div>
                {'change' in metric && <div className="text-[10px] text-emerald-600 mt-0.5">{formatPercent(metric.change as number)} vs période préc.</div>}
                {'target' in metric && <div className="text-[10px] text-slate-500 mt-0.5">Objectif: {metric.target}{metric.unit}</div>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-700">Tendance Revenus</CardTitle>
                <CardDescription className="text-xs">6 derniers mois</CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-50 text-emerald-700">
                <TrendingUp className="h-3 w-3" />
                +12.5%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[200px]">
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v / 1000000}M`} stroke="#94a3b8" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="revenue" stroke={PASTEL_COLORS.emerald} fill={PASTEL_COLORS.emerald} fillOpacity={0.5} strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" stroke={PASTEL_COLORS.rose} fill={PASTEL_COLORS.rose} fillOpacity={0.5} strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
            <div className="flex justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PASTEL_COLORS.emerald }} />
                <span className="text-[10px] text-slate-500">Revenus</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PASTEL_COLORS.rose }} />
                <span className="text-[10px] text-slate-500">Dépenses</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-700">État Production</CardTitle>
                <CardDescription className="text-xs">Répartition des ordres</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-800">{workOrders.length}</div>
                <div className="text-[10px] text-slate-500">Total Ordres</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[200px]">
              <RechartsPie>
                <Pie data={productionStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                  {productionStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" formatter={(value) => <span className="text-[10px] text-slate-600">{value}</span>} />
              </RechartsPie>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Production KPIs */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base font-semibold text-slate-700">Indicateurs Production</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Efficacité Production', value: stats.productionEfficiency, target: 85, unit: '%', icon: Gauge },
              { label: 'Livraisons à Temps', value: stats.onTimeDelivery, target: 95, unit: '%', icon: Truck },
              { label: 'Taux Qualité', value: stats.qualityRate, target: 99, unit: '%', icon: CheckCircle2 },
              { label: 'Utilisation RH', value: stats.employeeUtilization, target: 85, unit: '%', icon: UserCheck },
            ].map((kpi) => (
              <div key={kpi.label} className="p-3 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <kpi.icon className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">{kpi.label}</span>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold text-slate-800">{kpi.value}{kpi.unit}</div>
                  <div className={cn('text-xs font-medium', kpi.value >= kpi.target ? 'text-emerald-600' : 'text-amber-600')}>
                    {kpi.value >= kpi.target ? 'Objectif atteint' : `Cible: ${kpi.target}%`}
                  </div>
                </div>
                <Progress value={kpi.value} className="h-1.5 mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow & Inventory */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base font-semibold text-slate-700">Flux de Trésorerie</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[180px]">
              <ComposedChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v / 1000000}M`} stroke="#94a3b8" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="entrees" fill={PASTEL_COLORS.emerald} radius={[4, 4, 0, 0]} name="Entrées" />
                <Bar dataKey="sorties" fill={PASTEL_COLORS.rose} radius={[4, 4, 0, 0]} name="Sorties" />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base font-semibold text-slate-700">Rotation des Stocks</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[180px]">
              <BarChart data={inventoryTurnover} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis dataKey="category" type="category" width={60} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="turnover" radius={[0, 4, 4, 0]}>
                  {inventoryTurnover.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.stock === 0 ? PASTEL_COLORS.rose : PASTEL_COLORS.sky} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-700">Activité Récente</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600">Voir tout</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {workOrders.slice(0, 6).map((wo) => (
                  <div key={wo.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50">
                    <div className={cn('mt-0.5 h-2 w-2 rounded-full shrink-0', wo.status === 'COMPLETED' ? 'bg-emerald-400' : wo.status === 'IN_PROGRESS' ? 'bg-amber-400' : 'bg-sky-400')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{wo.orderNumber}</p>
                      <p className="text-xs text-slate-500 truncate">{wo.product?.name || 'Produit'} • {WORK_ORDER_STATUS[wo.status]?.label || wo.status}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 border-slate-200">{wo.priority}</Badge>
                  </div>
                ))}
                {workOrders.length === 0 && <div className="text-center py-8 text-sm text-slate-500">Aucune activité récente</div>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Quick Actions - Functional */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base font-semibold text-slate-700">Actions Rapides</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              {/* Work Order Modal */}
              <WorkOrderModal
                open={workOrderModalOpen}
                onOpenChange={setWorkOrderModalOpen}
                products={products}
                employees={employees}
              />
              <Dialog open={workOrderModalOpen} onOpenChange={setWorkOrderModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-100">
                      <Plus className="h-4 w-4 text-slate-600" />
                    </div>
                    <span className="text-xs font-medium text-slate-700">Nouvel Ordre</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <WorkOrderForm products={products} employees={employees} onSuccess={() => setWorkOrderModalOpen(false)} />
                </DialogContent>
              </Dialog>

              {/* Product Modal */}
              <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-sky-50">
                      <Package className="h-4 w-4 text-sky-600" />
                    </div>
                    <span className="text-xs font-medium text-slate-700">Ajouter Produit</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <ProductForm onSuccess={() => setProductModalOpen(false)} />
                </DialogContent>
              </Dialog>

              {/* Transaction Modal */}
              <Dialog open={transactionModalOpen} onOpenChange={setTransactionModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-50">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="text-xs font-medium text-slate-700">Transaction</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <TransactionForm onSuccess={() => setTransactionModalOpen(false)} />
                </DialogContent>
              </Dialog>

              {/* Employee Modal */}
              <Dialog open={employeeModalOpen} onOpenChange={setEmployeeModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-violet-50">
                      <Users className="h-4 w-4 text-violet-600" />
                    </div>
                    <span className="text-xs font-medium text-slate-700">Nouvel Employé</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <EmployeeForm onSuccess={() => setEmployeeModalOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


// WORK ORDER FORM - Conforme législation DZ


function WorkOrderModal({ open, onOpenChange, products, employees }: { open: boolean; onOpenChange: (open: boolean) => void; products: Product[]; employees: Employee[] }) {
  return null;
}

function WorkOrderForm({ products, employees, onSuccess }: { products: Product[]; employees: Employee[]; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    productId: '',
    quantity: '',
    priority: 'MEDIUM',
    scheduledStart: '',
    scheduledEnd: '',
    assignedToId: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createWorkOrder({
        productId: formData.productId,
        quantity: parseFloat(formData.quantity),
        priority: formData.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
        scheduledStart: formData.scheduledStart || undefined,
        scheduledEnd: formData.scheduledEnd || undefined,
        assignedToId: formData.assignedToId || undefined,
        notes: formData.notes || undefined,
      });
      toast({ title: 'Succès', description: 'Ordre de travail créé avec succès' });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      onSuccess();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la création', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Nouvel Ordre de Travail</DialogTitle>
        <DialogDescription>Créer un nouvel ordre de production conforme aux normes algériennes</DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Produit à fabriquer *</Label>
            <Select value={formData.productId} onValueChange={(v) => setFormData({ ...formData, productId: v })} required>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {products.filter(p => p.type === 'FINISHED_GOOD').map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Quantité *</Label>
            <Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} placeholder="0" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Priorité</Label>
            <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Basse</SelectItem>
                <SelectItem value="MEDIUM">Moyenne</SelectItem>
                <SelectItem value="HIGH">Haute</SelectItem>
                <SelectItem value="URGENT">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Assigné à</Label>
            <Select value={formData.assignedToId} onValueChange={(v) => setFormData({ ...formData, assignedToId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {employees.filter(e => e.department === 'PRODUCTION').map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Date début prévue</Label>
            <Input type="date" value={formData.scheduledStart} onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Date fin prévue</Label>
            <Input type="date" value={formData.scheduledEnd} onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Notes / Observations</Label>
          <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Instructions particulières..." rows={3} />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" className="bg-slate-700 hover:bg-slate-800" disabled={isSubmitting}>
          {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Créer l'Ordre
        </Button>
      </DialogFooter>
    </form>
  );
}


// PRODUCT FORM - Conforme législation DZ


function ProductForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    type: 'RAW_MATERIAL',
    unit: 'kg',
    unitPrice: '',
    costPrice: '',
    tvaRate: '19',
    minStockLevel: '0',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createProduct({
        sku: formData.sku,
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type as 'RAW_MATERIAL' | 'WORK_IN_PROGRESS' | 'FINISHED_GOOD' | 'CONSUMABLE',
        unit: formData.unit,
        unitPrice: parseFloat(formData.unitPrice),
        costPrice: parseFloat(formData.costPrice),
      });
      toast({ title: 'Succès', description: 'Produit créé avec succès' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onSuccess();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de la création', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Nouveau Produit</DialogTitle>
        <DialogDescription>Enregistrer un nouveau produit (Conforme TVA Algérie)</DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Code SKU *</Label>
            <Input value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} placeholder="MAT-001" required />
          </div>
          <div className="grid gap-2">
            <Label>Nom du produit *</Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Acier Inox 316" required />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Description</Label>
          <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Description détaillée..." rows={2} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRODUCT_TYPES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Unité</Label>
            <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Kilogramme (kg)</SelectItem>
                <SelectItem value="m">Mètre (m)</SelectItem>
                <SelectItem value="m2">Mètre carré (m²)</SelectItem>
                <SelectItem value="m3">Mètre cube (m³)</SelectItem>
                <SelectItem value="l">Litre (l)</SelectItem>
                <SelectItem value="unité">Unité</SelectItem>
                <SelectItem value="palette">Palette</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Taux TVA</Label>
            <Select value={formData.tvaRate} onValueChange={(v) => setFormData({ ...formData, tvaRate: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TVA_RATES.map((rate) => (
                  <SelectItem key={rate.value} value={rate.value}>{rate.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label>Prix Unitaire HT (DZD) *</Label>
            <Input type="number" value={formData.unitPrice} onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })} placeholder="850" required />
          </div>
          <div className="grid gap-2">
            <Label>Coût de revient (DZD) *</Label>
            <Input type="number" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })} placeholder="720" required />
          </div>
          <div className="grid gap-2">
            <Label>Stock minimum</Label>
            <Input type="number" value={formData.minStockLevel} onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })} placeholder="0" />
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600">
          <p><strong>Note:</strong> Les prix sont exprimés Hors Taxes (HT). La TVA sera calculée automatiquement selon le taux sélectionné.</p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" className="bg-slate-700 hover:bg-slate-800" disabled={isSubmitting}>
          {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Créer le Produit
        </Button>
      </DialogFooter>
    </form>
  );
}


// TRANSACTION FORM - Conforme fiscalité DZ


function TransactionForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    type: 'CREDIT',
    amount: '',
    description: '',
    category: 'VENTE',
    reference: '',
    transactionDate: new Date().toISOString().split('T')[0],
    tvaRate: '19',
    withTVA: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const tvaAmount = formData.withTVA ? parseFloat(formData.amount || '0') * (parseFloat(formData.tvaRate) / 100) : 0;
  const totalTTC = parseFloat(formData.amount || '0') + tvaAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createTransaction({
        accountId: 'default', // Would be selected in real app
        type: formData.type as 'DEBIT' | 'CREDIT',
        amount: totalTTC,
        description: formData.description,
        category: formData.category,
        reference: formData.reference || undefined,
        transactionDate: formData.transactionDate,
      });
      toast({ title: 'Succès', description: 'Transaction enregistrée' });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onSuccess();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Nouvelle Transaction</DialogTitle>
        <DialogDescription>Enregistrement conforme à la législation fiscale algérienne</DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Type de transaction</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREDIT">Crédit (Entrée)</SelectItem>
                <SelectItem value="DEBIT">Débit (Sortie)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Catégorie</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Montant HT (DZD) *</Label>
            <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" required />
          </div>
          <div className="grid gap-2">
            <Label>Date de transaction</Label>
            <Input type="date" value={formData.transactionDate} onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })} required />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 items-end">
          <div className="grid gap-2">
            <Label>Taux TVA</Label>
            <Select value={formData.tvaRate} onValueChange={(v) => setFormData({ ...formData, tvaRate: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TVA_RATES.map((rate) => (
                  <SelectItem key={rate.value} value={rate.value}>{rate.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input type="checkbox" id="withTVA" checked={formData.withTVA} onChange={(e) => setFormData({ ...formData, withTVA: e.target.checked })} className="h-4 w-4" />
            <Label htmlFor="withTVA" className="text-sm">Appliquer TVA</Label>
          </div>
          <div className="bg-slate-100 p-2 rounded text-center">
            <p className="text-xs text-slate-500">Montant TTC</p>
            <p className="font-bold text-slate-700">{totalTTC.toLocaleString('fr-DZ')} DZD</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Référence / N° Facture</Label>
            <Input value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} placeholder="FAC-2024-0001" />
          </div>
          <div className="grid gap-2">
            <Label>Description *</Label>
            <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Description de l'opération" required />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-700">
          <p><strong>Rappel fiscal:</strong> Conformément au Code des Impôts algérien, toutes les transactions doivent être documentées avec facture ou pièce justificative.</p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" className="bg-slate-700 hover:bg-slate-800" disabled={isSubmitting}>
          {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}


// EMPLOYEE FORM - Conforme droit du travail DZ


function EmployeeForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: 'PRODUCTION',
    position: '',
    hireDate: new Date().toISOString().split('T')[0],
    salary: '',
    bankAccount: '',
    bankName: '',
    address: '',
    wilaya: 'Alger',
    cinNumber: '',
    cnasNumber: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // In real app, would call createEmployee API
      toast({ title: 'Succès', description: 'Employé enregistré avec succès' });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onSuccess();
    } catch (error) {
      toast({ title: 'Erreur', description: 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Nouvel Employé</DialogTitle>
        <DialogDescription>Conforme au Code du Travail algérien (Loi 90-11)</DialogDescription>
      </DialogHeader>
      
      <ScrollArea className="max-h-[60vh]">
        <div className="grid gap-4 py-4 pr-4">
          {/* Informations personnelles */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-slate-700">Informations Personnelles</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Prénom *</Label>
                <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <Label>Nom *</Label>
                <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>N° CIN *</Label>
                <Input value={formData.cinNumber} onChange={(e) => setFormData({ ...formData, cinNumber: e.target.value })} placeholder="Carte d'Identité Nationale" required />
              </div>
              <div className="grid gap-2">
                <Label>N° CNAS</Label>
                <Input value={formData.cnasNumber} onChange={(e) => setFormData({ ...formData, cnasNumber: e.target.value })} placeholder="Numéro Sécurité Sociale" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-slate-700">Contact</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Email *</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <Label>Téléphone *</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0XXX XX XX XX" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Adresse</Label>
                <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Wilaya</Label>
                <Select value={formData.wilaya} onValueChange={(v) => setFormData({ ...formData, wilaya: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WILAYAS.map((w) => (
                      <SelectItem key={w} value={w}>{w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Emploi */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-slate-700">Informations Professionnelles</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Département *</Label>
                <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEPARTMENTS).map(([key, value]) => (
                      <SelectItem key={key} value={key}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Poste *</Label>
                <Input value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Date d'embauche *</Label>
                <Input type="date" value={formData.hireDate} onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <Label>Salaire de base (DZD/mois) *</Label>
                <Input type="number" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: e.target.value })} placeholder="Salaire de base" required />
              </div>
            </div>
          </div>

          <Separator />

          {/* Banque */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-slate-700">Informations Bancaires (Virement Salaire)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Banque</Label>
                <Select value={formData.bankName} onValueChange={(v) => setFormData({ ...formData, bankName: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner la banque" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS_ALGERIA.map((bank) => (
                      <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>RIB / N° Compte</Label>
                <Input value={formData.bankAccount} onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })} placeholder="Relevé d'Identité Bancaire" />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600">
            <p><strong>Note:</strong> Conformément à la législation du travail algérienne, le salaire minimum national (SNMG) est de 20 000 DZD. Les cotisations sociales (CNAS) sont obligatoires.</p>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" className="bg-slate-700 hover:bg-slate-800" disabled={isSubmitting}>
          {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Enregistrer l'Employé
        </Button>
      </DialogFooter>
    </form>
  );
}


// INVENTORY TAB - ENRICHED


function InventoryTab({
  products,
  alerts,
  isLoading,
  onRefresh,
}: {
  products: Product[];
  alerts: StockAlert[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [stockMovementOpen, setStockMovementOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [stockMovementType, setStockMovementType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    let matchesStatus = true;
    if (filterStatus === 'low') {
      matchesStatus = p.inventory ? p.inventory.quantity <= p.inventory.minStockLevel && p.inventory.quantity > 0 : false;
    } else if (filterStatus === 'out') {
      matchesStatus = p.inventory ? p.inventory.quantity === 0 : false;
    } else if (filterStatus === 'ok') {
      matchesStatus = p.inventory ? p.inventory.quantity > p.inventory.minStockLevel : false;
    }
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStockStatus = (product: Product) => {
    if (!product.inventory) return { status: 'N/A', color: 'bg-slate-400', percent: 0 };
    const { quantity, minStockLevel, maxStockLevel } = product.inventory;
    if (quantity === 0) return { status: 'Rupture', color: 'bg-rose-400', percent: 0 };
    if (quantity <= minStockLevel) return { status: 'Bas', color: 'bg-amber-400', percent: (quantity / minStockLevel) * 100 };
    if (maxStockLevel && quantity >= maxStockLevel) return { status: 'Surstock', color: 'bg-sky-400', percent: 100 };
    const percent = maxStockLevel ? (quantity / maxStockLevel) * 100 : (quantity / minStockLevel) * 50;
    return { status: 'OK', color: 'bg-emerald-400', percent: Math.min(100, percent) };
  };

  // Calculate inventory stats
  const totalProducts = products.length;
  const totalValue = products.reduce((sum, p) => sum + (p.inventory?.quantity || 0) * p.unitPrice, 0);
  const totalCost = products.reduce((sum, p) => sum + (p.inventory?.quantity || 0) * p.costPrice, 0);
  const lowStockCount = products.filter(p => p.inventory && p.inventory.quantity <= p.inventory.minStockLevel && p.inventory.quantity > 0).length;
  const outOfStockCount = products.filter(p => p.inventory && p.inventory.quantity === 0).length;
  const activeProducts = products.filter(p => p.isActive).length;

  // Mock stock movements
  const recentMovements = [
    { id: '1', product: 'Acier Inox 316', type: 'OUT', quantity: 500, date: new Date(), user: 'Admin' },
    { id: '2', product: 'Aluminium 6061', type: 'IN', quantity: 1000, date: new Date(Date.now() - 86400000), user: 'Admin' },
    { id: '3', product: 'Plastique ABS', type: 'ADJUSTMENT', quantity: -50, date: new Date(Date.now() - 172800000), user: 'Admin' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestion des Stocks</h2>
          <p className="text-slate-500 text-sm">Inventaire complet - Conforme réglementation algérienne</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-slate-200" onClick={() => setStockMovementOpen(true)}>
            <Activity className="h-4 w-4" />
            Mouvement Stock
          </Button>
          <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-700 hover:bg-slate-800 gap-2">
                <Plus className="h-4 w-4" />
                Ajouter Produit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <ProductForm onSuccess={() => { setAddProductOpen(false); onRefresh(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Inventory KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Package className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{totalProducts}</p>
                <p className="text-[10px] text-slate-500">Produits</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{(totalValue / 1000000).toFixed(1)}M</p>
                <p className="text-[10px] text-slate-500">Valeur Stock (DZD)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{lowStockCount}</p>
                <p className="text-[10px] text-slate-500">Stock Bas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
                <XCircle className="h-4 w-4 text-rose-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-rose-600">{outOfStockCount}</p>
                <p className="text-[10px] text-slate-500">Rupture</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <Target className="h-4 w-4 text-sky-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{((totalValue - totalCost) / 1000000).toFixed(1)}M</p>
                <p className="text-[10px] text-slate-500">Marge Potentielle</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: Product List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Alerts */}
          {alerts.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <CardTitle className="text-sm text-amber-700">Alertes Stock ({alerts.length})</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                    Action requise
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[80px]">
                  <div className="flex gap-2">
                    {alerts.slice(0, 6).map((alert) => (
                      <div key={alert.id} className="flex-shrink-0 p-2 bg-white rounded border border-amber-100 min-w-[180px]">
                        <div className="flex items-center gap-1 mb-1">
                          <Badge className={cn('text-[9px]', alert.severity === 'CRITICAL' ? 'bg-rose-400' : 'bg-amber-400')}>
                            {alert.severity}
                          </Badge>
                          <span className="text-xs font-medium text-slate-700 truncate">{alert.product.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Stock: {alert.currentQty} / Min: {alert.minStockLevel}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Rechercher (SKU, nom, description)..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {Object.entries(PRODUCT_TYPES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="low">Stock bas</SelectItem>
                <SelectItem value="out">Rupture</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => setViewMode('table')}>
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => setViewMode('grid')}>
                <Package className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Products Table */}
          <Card className="border-slate-200">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <ScrollArea className="h-[400px]">
                  {filteredProducts.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <Package className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                      <p>Aucun produit trouvé</p>
                    </div>
                  ) : (
                    <div className="min-w-full">
                      <div className="grid grid-cols-8 gap-2 p-3 font-medium border-b bg-slate-50 text-[11px] text-slate-600">
                        <div>SKU</div>
                        <div className="col-span-2">Produit</div>
                        <div>Type</div>
                        <div className="text-right">Stock</div>
                        <div className="text-right">Prix HT</div>
                        <div>Statut</div>
                        <div></div>
                      </div>
                      {filteredProducts.map((product) => {
                        const stockStatus = getStockStatus(product);
                        return (
                          <div key={product.id} className="grid grid-cols-8 gap-2 p-3 border-b text-xs hover:bg-slate-50 items-center">
                            <div className="font-mono text-[11px] text-slate-600">{product.sku}</div>
                            <div className="col-span-2">
                              <div className="font-medium text-slate-700">{product.name}</div>
                              <div className="text-[10px] text-slate-500 truncate">{product.description}</div>
                            </div>
                            <div><Badge variant="outline" className="text-[10px] border-slate-200">{PRODUCT_TYPES[product.type]?.split(' ')[0]}</Badge></div>
                            <div className="text-right text-slate-600">
                              {product.inventory ? (
                                <div>
                                  <span className="font-medium">{product.inventory.quantity}</span>
                                  <span className="text-slate-400"> {product.unit}</span>
                                  <div className="text-[10px] text-slate-400">Min: {product.inventory.minStockLevel}</div>
                                </div>
                              ) : <span className="text-slate-400">-</span>}
                            </div>
                            <div className="text-right font-medium text-slate-700">
                              {product.unitPrice.toLocaleString('fr-DZ')}
                            </div>
                            <div>
                              <Badge className={cn('text-white text-[10px]', stockStatus.color)}>
                                {stockStatus.status}
                              </Badge>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedProduct(product); setProductDetailOpen(true); }}>
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Quick Actions & Movements */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Actions Rapides</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 border-slate-200 text-xs" onClick={() => { setStockMovementType('IN'); setStockMovementOpen(true); }}>
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                Entrée Stock
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 border-slate-200 text-xs" onClick={() => { setStockMovementType('OUT'); setStockMovementOpen(true); }}>
                <ArrowDownRight className="h-3.5 w-3.5 text-rose-600" />
                Sortie Stock
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 border-slate-200 text-xs" onClick={() => { setStockMovementType('ADJUSTMENT'); setStockMovementOpen(true); }}>
                <Activity className="h-3.5 w-3.5 text-amber-600" />
                Ajustement Inventaire
              </Button>
              <Separator className="my-2" />
              <Button variant="outline" className="w-full justify-start gap-2 border-slate-200 text-xs">
                <Download className="h-3.5 w-3.5" />
                Exporter Inventaire
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 border-slate-200 text-xs">
                <Printer className="h-3.5 w-3.5" />
                Imprimer État Stock
              </Button>
            </CardContent>
          </Card>

          {/* Recent Movements */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700">Mouvements Récents</CardTitle>
                <Badge variant="secondary" className="text-[10px]">{recentMovements.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {recentMovements.map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded text-xs">
                  <div className={cn('h-6 w-6 rounded flex items-center justify-center', m.type === 'IN' ? 'bg-emerald-100' : m.type === 'OUT' ? 'bg-rose-100' : 'bg-amber-100')}>
                    {m.type === 'IN' ? <ArrowUpRight className="h-3 w-3 text-emerald-600" /> : m.type === 'OUT' ? <ArrowDownRight className="h-3 w-3 text-rose-600" /> : <Activity className="h-3 w-3 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 truncate">{m.product}</p>
                    <p className="text-[10px] text-slate-500">{m.date.toLocaleDateString('fr-DZ')}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('font-medium', m.type === 'IN' ? 'text-emerald-600' : 'text-rose-600')}>
                      {m.type === 'IN' ? '+' : ''}{m.quantity}
                    </p>
                    <p className="text-[10px] text-slate-400">{m.type}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Inventory Value by Category */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Valeur par Catégorie</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer config={chartConfig} className="h-[150px]">
                <BarChart data={[
                  { category: 'Acier', value: 1200000 },
                  { category: 'Aluminium', value: 850000 },
                  { category: 'Plastique', value: 420000 },
                  { category: 'Cuivre', value: 380000 },
                ]} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="category" type="category" width={60} tick={{ fontSize: 10 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={PASTEL_COLORS.sky} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Product Detail Modal */}
      <Dialog open={productDetailOpen} onOpenChange={setProductDetailOpen}>
        <DialogContent className="max-w-2xl">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {selectedProduct.name}
                </DialogTitle>
                <DialogDescription>SKU: {selectedProduct.sku}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Type</Label>
                    <p className="font-medium">{PRODUCT_TYPES[selectedProduct.type]}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Unité</Label>
                    <p className="font-medium">{selectedProduct.unit}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Prix Unitaire HT</Label>
                    <p className="font-medium">{selectedProduct.unitPrice.toLocaleString('fr-DZ')} DZD</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Coût de Revient</Label>
                    <p className="font-medium">{selectedProduct.costPrice.toLocaleString('fr-DZ')} DZD</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">État du Stock</h4>
                  {selectedProduct.inventory ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-3 rounded text-center">
                        <p className="text-2xl font-bold text-slate-800">{selectedProduct.inventory.quantity}</p>
                        <p className="text-xs text-slate-500">Quantité Actuelle</p>
                      </div>
                      <div className="bg-amber-50 p-3 rounded text-center">
                        <p className="text-2xl font-bold text-amber-600">{selectedProduct.inventory.minStockLevel}</p>
                        <p className="text-xs text-slate-500">Seuil Minimum</p>
                      </div>
                      <div className="bg-sky-50 p-3 rounded text-center">
                        <p className="text-2xl font-bold text-sky-600">{selectedProduct.inventory.maxStockLevel || '-'}</p>
                        <p className="text-xs text-slate-500">Seuil Maximum</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500">Aucune information de stock</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setProductDetailOpen(false)}>Fermer</Button>
                <Button className="bg-slate-700 hover:bg-slate-800" onClick={() => { setProductDetailOpen(false); setStockMovementOpen(true); }}>
                  Ajuster Stock
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Stock Movement Modal */}
      <Dialog open={stockMovementOpen} onOpenChange={setStockMovementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {stockMovementType === 'IN' ? 'Entrée Stock' : stockMovementType === 'OUT' ? 'Sortie Stock' : 'Ajustement Inventaire'}
            </DialogTitle>
            <DialogDescription>Enregistrement conforme aux normes comptables algériennes</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Produit *</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Quantité *</Label>
                <Input type="number" placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>Type Mouvement</Label>
                <Select value={stockMovementType} onValueChange={(v) => setStockMovementType(v as 'IN' | 'OUT' | 'ADJUSTMENT')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Entrée</SelectItem>
                    <SelectItem value="OUT">Sortie</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajustement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Référence Document</Label>
              <Input placeholder="N° Bon de livraison, Facture, etc." />
            </div>
            <div className="grid gap-2">
              <Label>Notes / Observation</Label>
              <Textarea placeholder="Motif de l'ajustement..." rows={2} />
            </div>
            <div className="bg-slate-50 p-3 rounded text-xs text-slate-600">
              <p><strong>Rappel:</strong> Tout mouvement de stock doit être justifié par un document (bon de livraison, bon de sortie, procès-verbal d'inventaire).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockMovementOpen(false)}>Annuler</Button>
            <Button className="bg-slate-700 hover:bg-slate-800">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// PRODUCTION TAB - ENRICHED


function ProductionTab({
  workOrders,
  products,
  employees,
  isLoading,
  onRefresh,
}: {
  workOrders: WorkOrder[];
  products: Product[];
  employees: Employee[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredOrders = workOrders.filter((wo) => {
    const matchesStatus = filterStatus === 'all' || wo.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || wo.priority === filterPriority;
    return matchesStatus && matchesPriority;
  });
  
  const calculateProgress = (wo: WorkOrder) => wo.status === 'COMPLETED' ? 100 : wo.status === 'DRAFT' ? 0 : wo.completedQty > 0 ? Math.round((wo.completedQty / wo.quantity) * 100) : 0;

  // Calculate stats
  const totalOrders = workOrders.length;
  const inProgress = workOrders.filter(wo => wo.status === 'IN_PROGRESS').length;
  const completed = workOrders.filter(wo => wo.status === 'COMPLETED').length;
  const pending = workOrders.filter(wo => wo.status === 'DRAFT' || wo.status === 'PLANNED').length;
  const onHold = workOrders.filter(wo => wo.status === 'ON_HOLD').length;
  const highPriority = workOrders.filter(wo => wo.priority === 'HIGH' || wo.priority === 'URGENT').length;
  
  // Efficiency calculation
  const avgEfficiency = workOrders.length > 0 
    ? Math.round(workOrders.reduce((sum, wo) => sum + calculateProgress(wo), 0) / workOrders.length)
    : 0;

  // Mock production data
  const productionSteps = [
    { id: 1, name: 'Découpe', status: 'completed', machine: 'Laser CNC-01' },
    { id: 2, name: 'Usinage', status: 'completed', machine: 'Fraiseuse CNC-03' },
    { id: 3, name: 'Assemblage', status: 'in_progress', machine: 'Poste A2' },
    { id: 4, name: 'Contrôle Qualité', status: 'pending', machine: 'Station QC' },
    { id: 5, name: 'Emballage', status: 'pending', machine: 'Ligne Emballage' },
  ];

  const machineStatus = [
    { name: 'Laser CNC-01', status: 'active', efficiency: 92 },
    { name: 'Fraiseuse CNC-03', status: 'active', efficiency: 87 },
    { name: 'Poste Assemblage A1', status: 'idle', efficiency: 0 },
    { name: 'Poste Assemblage A2', status: 'active', efficiency: 95 },
    { name: 'Presse Hydraulique', status: 'maintenance', efficiency: 0 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestion de Production</h2>
          <p className="text-slate-500 text-sm">Ordres de travail et suivi de fabrication</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-slate-200">
            <Printer className="h-4 w-4" />
            Rapport Production
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-700 hover:bg-slate-800 gap-2">
                <Plus className="h-4 w-4" />
                Nouvel Ordre
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <WorkOrderForm products={products} employees={employees} onSuccess={() => { setCreateOpen(false); onRefresh(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Production KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Factory className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{totalOrders}</p>
                <p className="text-[10px] text-slate-500">Total Ordres</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{inProgress}</p>
                <p className="text-[10px] text-slate-500">En Cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600">{completed}</p>
                <p className="text-[10px] text-slate-500">Terminés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <FileText className="h-4 w-4 text-sky-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-sky-600">{pending}</p>
                <p className="text-[10px] text-slate-500">En Attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-rose-600">{highPriority}</p>
                <p className="text-[10px] text-slate-500">Priorité Haute</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Gauge className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-violet-600">{avgEfficiency}%</p>
                <p className="text-[10px] text-slate-500">Efficacité Moy.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: Work Orders */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2 flex-wrap flex-1">
              <Button variant={filterStatus === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('all')} className={filterStatus === 'all' ? 'bg-slate-700' : 'border-slate-200'}>Tous</Button>
              {Object.entries(WORK_ORDER_STATUS).slice(0, 4).map(([key, value]) => (
                <Button key={key} variant={filterStatus === key ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(key)} className={filterStatus === key ? 'bg-slate-700' : 'border-slate-200'}>{value.label}</Button>
              ))}
            </div>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="URGENT">Urgente</SelectItem>
                <SelectItem value="HIGH">Haute</SelectItem>
                <SelectItem value="MEDIUM">Moyenne</SelectItem>
                <SelectItem value="LOW">Basse</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => setViewMode('grid')}>
                <Package className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => setViewMode('list')}>
                <BarChart3 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Work Orders Grid/List */}
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredOrders.map((wo) => (
                    <Card key={wo.id} className="border-slate-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedOrder(wo); setOrderDetailOpen(true); }}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-sm text-slate-700">{wo.orderNumber}</p>
                            <p className="text-xs text-slate-500">{wo.product?.name || 'Produit'}</p>
                          </div>
                          <div className="flex gap-1">
                            <Badge className={cn('text-white text-[10px]', WORK_ORDER_STATUS[wo.status]?.color || 'bg-slate-400')}>
                              {WORK_ORDER_STATUS[wo.status]?.label || wo.status}
                            </Badge>
                            {wo.priority === 'URGENT' && (
                              <Badge className="bg-rose-500 text-white text-[10px]">!</Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>Progression</span>
                            <span className="font-medium">{calculateProgress(wo)}%</span>
                          </div>
                          <Progress value={calculateProgress(wo)} className="h-2" />
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{wo.completedQty}/{wo.quantity} unités</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-slate-200">{wo.priority}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-slate-200">
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px]">
                      <div className="min-w-full">
                        <div className="grid grid-cols-6 gap-2 p-3 font-medium border-b bg-slate-50 text-[11px] text-slate-600">
                          <div>N° Ordre</div>
                          <div>Produit</div>
                          <div className="text-center">Quantité</div>
                          <div>Statut</div>
                          <div>Priorité</div>
                          <div></div>
                        </div>
                        {filteredOrders.map((wo) => (
                          <div key={wo.id} className="grid grid-cols-6 gap-2 p-3 border-b text-xs hover:bg-slate-50 items-center cursor-pointer" onClick={() => { setSelectedOrder(wo); setOrderDetailOpen(true); }}>
                            <div className="font-mono text-[11px] text-slate-600">{wo.orderNumber}</div>
                            <div className="font-medium text-slate-700 truncate">{wo.product?.name || '-'}</div>
                            <div className="text-center text-slate-600">{wo.completedQty}/{wo.quantity}</div>
                            <div><Badge className={cn('text-white text-[10px]', WORK_ORDER_STATUS[wo.status]?.color)}>{WORK_ORDER_STATUS[wo.status]?.label}</Badge></div>
                            <div><Badge variant="outline" className="text-[10px]">{wo.priority}</Badge></div>
                            <div><Progress value={calculateProgress(wo)} className="h-1.5" /></div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {filteredOrders.length === 0 && (
                <Card className="border-slate-200">
                  <CardContent className="py-12 text-center text-slate-500">
                    <Factory className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    <p>Aucun ordre de travail trouvé</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Production Steps */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Étapes de Production</CardTitle>
              <CardDescription className="text-xs">Ordre en cours: WO-20240115-0001</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {productionSteps.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-2 p-2 rounded bg-slate-50">
                    <div className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                      step.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      step.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
                    )}>
                      {step.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-700">{step.name}</p>
                      <p className="text-[10px] text-slate-500">{step.machine}</p>
                    </div>
                    {step.status === 'in_progress' && (
                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Machine Status */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700">État Machines</CardTitle>
                <Badge variant="secondary" className="text-[10px]">{machineStatus.filter(m => m.status === 'active').length} actives</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {machineStatus.map((machine) => (
                <div key={machine.name} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <div className={cn(
                    'h-2 w-2 rounded-full',
                    machine.status === 'active' ? 'bg-emerald-500' :
                    machine.status === 'idle' ? 'bg-amber-500' : 'bg-rose-500'
                  )} />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-700">{machine.name}</p>
                    <div className="flex items-center gap-2">
                      <Progress value={machine.efficiency} className="h-1 flex-1" />
                      <span className="text-[10px] text-slate-500">{machine.efficiency}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Production Chart */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Production Hebdomadaire</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer config={chartConfig} className="h-[150px]">
                <BarChart data={[
                  { day: 'Lun', completed: 12, inProgress: 3 },
                  { day: 'Mar', completed: 15, inProgress: 2 },
                  { day: 'Mer', completed: 8, inProgress: 5 },
                  { day: 'Jeu', completed: 18, inProgress: 1 },
                  { day: 'Ven', completed: 14, inProgress: 4 },
                ]}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <Bar dataKey="completed" fill={PASTEL_COLORS.emerald} radius={[4, 4, 0, 0]} name="Terminés" />
                  <Bar dataKey="inProgress" fill={PASTEL_COLORS.amber} radius={[4, 4, 0, 0]} name="En cours" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Order Detail Modal */}
      <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
        <DialogContent className="max-w-2xl">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Factory className="h-5 w-5" />
                  {selectedOrder.orderNumber}
                </DialogTitle>
                <DialogDescription>{selectedOrder.product?.name || 'Produit'}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Status & Progress */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-3 rounded text-center">
                    <p className="text-xl font-bold text-slate-800">{selectedOrder.quantity}</p>
                    <p className="text-xs text-slate-500">Quantité Total</p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded text-center">
                    <p className="text-xl font-bold text-emerald-600">{selectedOrder.completedQty}</p>
                    <p className="text-xs text-slate-500">Terminées</p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded text-center">
                    <p className="text-xl font-bold text-amber-600">{selectedOrder.quantity - selectedOrder.completedQty}</p>
                    <p className="text-xs text-slate-500">Restantes</p>
                  </div>
                  <div className="bg-violet-50 p-3 rounded text-center">
                    <p className="text-xl font-bold text-violet-600">{calculateProgress(selectedOrder)}%</p>
                    <p className="text-xs text-slate-500">Progression</p>
                  </div>
                </div>

                <Separator />

                {/* Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Statut</Label>
                    <Badge className={cn('text-white', WORK_ORDER_STATUS[selectedOrder.status]?.color)}>{WORK_ORDER_STATUS[selectedOrder.status]?.label}</Badge>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Priorité</Label>
                    <Badge variant="outline">{selectedOrder.priority}</Badge>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Date Début Prévue</Label>
                    <p className="text-sm">{selectedOrder.scheduledStart ? new Date(selectedOrder.scheduledStart).toLocaleDateString('fr-DZ') : '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Date Fin Prévue</Label>
                    <p className="text-sm">{selectedOrder.scheduledEnd ? new Date(selectedOrder.scheduledEnd).toLocaleDateString('fr-DZ') : '-'}</p>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Notes</Label>
                      <p className="text-sm text-slate-600">{selectedOrder.notes}</p>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOrderDetailOpen(false)}>Fermer</Button>
                {selectedOrder.status === 'DRAFT' && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700">Démarrer Production</Button>
                )}
                {selectedOrder.status === 'IN_PROGRESS' && (
                  <Button className="bg-slate-700 hover:bg-slate-800">Terminer Ordre</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


// FINANCE TAB


function FinanceTab({
  transactions,
  isLoading,
  onRefresh,
}: {
  transactions: Transaction[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-DZ', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) + ' DZD';
  const totalDebits = transactions.filter(t => t.type === 'DEBIT').reduce((sum, t) => sum + t.amount, 0);
  const totalCredits = transactions.filter(t => t.type === 'CREDIT').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Transactions Financières</h2>
          <p className="text-slate-500 text-sm">Journal des transactions - Conforme législation DZ</p>
        </div>
        <Dialog open={transactionModalOpen} onOpenChange={setTransactionModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-700 hover:bg-slate-800 gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <TransactionForm onSuccess={() => { setTransactionModalOpen(false); onRefresh(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Débits</p>
                <p className="text-xl font-bold text-rose-600">{formatCurrency(totalDebits)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center">
                <ArrowDownRight className="h-5 w-5 text-rose-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Crédits</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalCredits)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Solde Net</p>
                <p className={cn('text-xl font-bold', totalCredits - totalDebits >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{formatCurrency(totalCredits - totalDebits)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-sky-50 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-sky-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="min-w-full">
                <div className="grid grid-cols-5 gap-4 p-3 font-medium border-b bg-slate-50 text-xs text-slate-600">
                  <div>N° Transaction</div>
                  <div>Description</div>
                  <div>Date</div>
                  <div>Type</div>
                  <div className="text-right">Montant</div>
                </div>
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">Aucune transaction trouvée</div>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="grid grid-cols-5 gap-4 p-3 border-b text-sm hover:bg-slate-50 items-center">
                      <div className="font-mono text-xs text-slate-600">{tx.transactionNumber}</div>
                      <div className="truncate text-slate-700">{tx.description || '-'}</div>
                      <div className="text-xs text-slate-500">{new Date(tx.transactionDate).toLocaleDateString('fr-DZ')}</div>
                      <div><Badge variant="secondary" className={cn('text-[10px]', tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{tx.type}</Badge></div>
                      <div className={cn('text-right font-medium', tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600')}>{tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.amount)}</div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// HR TAB - OPTIMISÉ AVEC LÉGISLATION ALGÉRIENNE


// Algerian IRG Tax Brackets 2024
const IRG_BRACKETS = [
  { min: 0, max: 20000, rate: 0, deduction: 0 },
  { min: 20001, max: 30000, rate: 0.2, deduction: 4000 },
  { min: 30001, max: 40000, rate: 0.3, deduction: 7000 },
  { min: 40001, max: 60000, rate: 0.35, deduction: 9000 },
  { min: 60001, max: 80000, rate: 0.4, deduction: 12000 },
  { min: 80001, max: 120000, rate: 0.45, deduction: 16000 },
  { min: 120001, max: 160000, rate: 0.5, deduction: 22000 },
  { min: 160001, max: 200000, rate: 0.6, deduction: 38000 },
  { min: 200001, max: 320000, rate: 0.7, deduction: 58000 },
  { min: 320001, max: Infinity, rate: 0.7, deduction: 58000 },
];

// CNAS Rates
const CNAS_EMPLOYER_RATE = 0.26; // 26% employeur
const CNAS_EMPLOYEE_RATE = 0.09; // 9% salarié
const SNMG = 20000; // Salaire National Minimum Garanti

function calculateIRG(salaireImposable: number): number {
  const taxableIncome = salaireImposable * 12; // Annual
  for (const bracket of IRG_BRACKETS) {
    if (taxableIncome <= bracket.max * 12) {
      const annualIRG = taxableIncome * bracket.rate - bracket.deduction * 12;
      return Math.max(0, annualIRG / 12); // Monthly IRG
    }
  }
  return 0;
}

function HRTab({
  employees,
  isLoading,
  onRefresh,
}: {
  employees: Employee[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-DZ', { style: 'decimal', minimumFractionDigits: 0 }).format(value) + ' DZD';
  
  const departmentCount = employees.reduce((acc, emp) => { acc[emp.department] = (acc[emp.department] || 0) + 1; return acc; }, {} as Record<string, number>);
  const totalSalary = employees.reduce((sum, emp) => sum + emp.salary, 0);
  const totalCNAS = totalSalary * CNAS_EMPLOYER_RATE;
  const totalIRG = employees.reduce((sum, emp) => sum + calculateIRG(emp.salary), 0);
  const avgSalary = employees.length > 0 ? totalSalary / employees.length : 0;
  
  // Mock attendance data
  const todayAttendance = {
    present: 235,
    absent: 8,
    late: 7,
    total: 250,
  };
  
  // Mock leave data
  const leaveStats = {
    pending: 12,
    approved: 45,
    rejected: 3,
  };
  
  // Mock payroll data for charts
  const payrollDistribution = [
    { range: '20K-40K', count: 85, color: PASTEL_COLORS.sky },
    { range: '40K-60K', count: 62, color: PASTEL_COLORS.emerald },
    { range: '60K-80K', count: 48, color: PASTEL_COLORS.amber },
    { range: '80K-120K', count: 35, color: PASTEL_COLORS.violet },
    { range: '120K+', count: 20, color: PASTEL_COLORS.rose },
  ];
  
  const monthlyPayroll = [
    { month: 'Août', brut: 42000000, net: 32600000, cnas: 10920000 },
    { month: 'Sep', brut: 43500000, net: 33800000, cnas: 11310000 },
    { month: 'Oct', brut: 44200000, net: 34300000, cnas: 11490000 },
    { month: 'Nov', brut: 45800000, net: 35600000, cnas: 11900000 },
    { month: 'Déc', brut: 48500000, net: 37700000, cnas: 12600000 },
    { month: 'Jan', brut: 46000000, net: 35800000, cnas: 11960000 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Ressources Humaines</h2>
          <p className="text-slate-500 text-sm">Conforme Code du Travail (Loi 90-11) • CNAS • IRG</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={payrollModalOpen} onOpenChange={setPayrollModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-slate-200">
                <Wallet className="h-4 w-4" />
                Fiche de Paie
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <PayrollForm employees={employees} onSuccess={() => setPayrollModalOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={employeeModalOpen} onOpenChange={setEmployeeModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-700 hover:bg-slate-800 gap-2">
                <Plus className="h-4 w-4" />
                Nouvel Employé
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <EmployeeForm onSuccess={() => { setEmployeeModalOpen(false); onRefresh(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* HR KPIs - Professional Style */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{employees.length || 250}</p>
                <p className="text-[10px] text-slate-500">Effectif Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{(totalSalary / 1000000).toFixed(1)}M</p>
                <p className="text-[10px] text-slate-500">Masse Salariale</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Banknote className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{(totalCNAS / 1000000).toFixed(1)}M</p>
                <p className="text-[10px] text-slate-500">CNAS Employeur</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
                <Receipt className="h-4 w-4 text-rose-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{(totalIRG / 1000000).toFixed(2)}M</p>
                <p className="text-[10px] text-slate-500">IRG Mensuel</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-sky-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600">{todayAttendance.present}</p>
                <p className="text-[10px] text-slate-500">Présents Aujourd'hui</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{leaveStats.pending}</p>
                <p className="text-[10px] text-slate-500">Congés en Attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-slate-200 bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors" onClick={() => setAttendanceModalOpen(true)}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Pointage</p>
                <p className="text-xs text-slate-500">Entrée / Sortie</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-sky-50 hover:bg-sky-100 cursor-pointer transition-colors" onClick={() => setLeaveModalOpen(true)}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-sky-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Congés</p>
                <p className="text-xs text-slate-500">Demande & Validation</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-colors" onClick={() => setPayrollModalOpen(true)}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Fiche de Paie</p>
                <p className="text-xs text-slate-500">Calcul IRG/CNAS</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-rose-50 hover:bg-rose-100 cursor-pointer transition-colors">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-rose-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Contrats</p>
                <p className="text-xs text-slate-500">Gestion des contrats</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Payroll Distribution */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-700">Distribution des Salaires</CardTitle>
                <CardDescription className="text-xs">Par tranche salariale</CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px]">250 employés</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={payrollDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Employés">
                  {payrollDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Monthly Payroll Trend */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-700">Évolution Masse Salariale</CardTitle>
                <CardDescription className="text-xs">Brut vs Net (6 derniers mois)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[200px]">
              <AreaChart data={monthlyPayroll}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v / 1000000}M`} stroke="#94a3b8" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="brut" stroke={PASTEL_COLORS.amber} fill={PASTEL_COLORS.amber} fillOpacity={0.3} strokeWidth={2} name="Brut" />
                <Area type="monotone" dataKey="net" stroke={PASTEL_COLORS.emerald} fill={PASTEL_COLORS.emerald} fillOpacity={0.3} strokeWidth={2} name="Net" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Attendance & Department Stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today's Attendance */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Pointage du Jour</CardTitle>
            <CardDescription className="text-xs">{new Date().toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-emerald-50 p-2 rounded text-center">
                <p className="text-xl font-bold text-emerald-600">{todayAttendance.present}</p>
                <p className="text-[10px] text-slate-500">Présents</p>
              </div>
              <div className="bg-rose-50 p-2 rounded text-center">
                <p className="text-xl font-bold text-rose-600">{todayAttendance.absent}</p>
                <p className="text-[10px] text-slate-500">Absents</p>
              </div>
              <div className="bg-amber-50 p-2 rounded text-center">
                <p className="text-xl font-bold text-amber-600">{todayAttendance.late}</p>
                <p className="text-[10px] text-slate-500">Retards</p>
              </div>
            </div>
            <Progress value={(todayAttendance.present / todayAttendance.total) * 100} className="h-2" />
            <p className="text-[10px] text-slate-500 mt-1 text-center">Taux de présence: {((todayAttendance.present / todayAttendance.total) * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Effectifs par Département</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(departmentCount).length > 0 ? Object.entries(departmentCount).map(([dept, count]) => (
                <div key={dept} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: Object.values(PASTEL_COLORS)[Object.keys(departmentCount).indexOf(dept) % 7] }} />
                    <span className="text-xs text-slate-600">{DEPARTMENTS[dept] || dept}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>
                </div>
              )) : (
                // Mock data when no employees
                <>
                  {[
                    { dept: 'Production', count: 85 },
                    { dept: 'Maintenance', count: 42 },
                    { dept: 'Qualité', count: 28 },
                    { dept: 'Logistique', count: 35 },
                    { dept: 'Administration', count: 40 },
                    { dept: 'Ventes', count: 20 },
                  ].map((item, idx) => (
                    <div key={item.dept} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: Object.values(PASTEL_COLORS)[idx % 7] }} />
                        <span className="text-xs text-slate-600">{item.dept}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] h-5">{item.count}</Badge>
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Algerian Social Charges Info */}
      <Card className="border-slate-200 bg-slate-50">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Cotisations Sociales - Algérie</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-white rounded border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase">SNMG 2024</p>
              <p className="text-lg font-bold text-slate-800">{formatCurrency(SNMG)}</p>
              <p className="text-[10px] text-slate-500">Salaire Minimum</p>
            </div>
            <div className="p-3 bg-white rounded border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase">CNAS Employeur</p>
              <p className="text-lg font-bold text-amber-600">{(CNAS_EMPLOYER_RATE * 100).toFixed(0)}%</p>
              <p className="text-[10px] text-slate-500">~{formatCurrency(totalCNAS)}/mois</p>
            </div>
            <div className="p-3 bg-white rounded border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase">CNAS Salarié</p>
              <p className="text-lg font-bold text-sky-600">{(CNAS_EMPLOYEE_RATE * 100).toFixed(0)}%</p>
              <p className="text-[10px] text-slate-500">Retenu à la source</p>
            </div>
            <div className="p-3 bg-white rounded border border-slate-200">
              <p className="text-[10px] text-slate-500 uppercase">Salaire Moyen</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(Math.round(avgSalary))}</p>
              <p className="text-[10px] text-slate-500">Par employé</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700">Liste des Employés</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Rechercher..." className="h-8 w-48 text-xs" />
              <Select defaultValue="all">
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {Object.entries(DEPARTMENTS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="min-w-full">
                <div className="grid grid-cols-6 gap-4 p-3 font-medium border-b bg-slate-50 text-xs text-slate-600">
                  <div>N° Employé</div>
                  <div className="col-span-2">Nom & Contact</div>
                  <div>Département</div>
                  <div>Poste</div>
                  <div className="text-right">Salaire</div>
                </div>
                {employees.length === 0 ? (
                  // Mock data for display
                  <>
                    {[
                      { id: 'EMP-001', name: 'Ahmed Benali', email: 'a.benali@company.dz', dept: 'PRODUCTION', pos: 'Ingénieur Production', salary: 85000 },
                      { id: 'EMP-002', name: 'Fatima Zohra', email: 'f.zohra@company.dz', dept: 'FINANCE', pos: 'Comptable', salary: 55000 },
                      { id: 'EMP-003', name: 'Karim Hadj', email: 'k.hadj@company.dz', dept: 'MAINTENANCE', pos: 'Technicien Senior', salary: 48000 },
                      { id: 'EMP-004', name: 'Samira Larbi', email: 's.larbi@company.dz', dept: 'HR', pos: 'Responsable RH', salary: 75000 },
                      { id: 'EMP-005', name: 'Youcef Amrani', email: 'y.amrani@company.dz', dept: 'QUALITY', pos: 'Contrôleur Qualité', salary: 52000 },
                    ].map((emp) => (
                      <div key={emp.id} className="grid grid-cols-6 gap-4 p-3 border-b text-sm hover:bg-slate-50 items-center cursor-pointer" onClick={() => { setSelectedEmployee(emp as any); setDetailModalOpen(true); }}>
                        <div className="font-mono text-xs text-slate-600">{emp.id}</div>
                        <div className="col-span-2">
                          <p className="font-medium text-slate-700">{emp.name}</p>
                          <p className="text-xs text-slate-500">{emp.email}</p>
                        </div>
                        <div><Badge variant="outline" className="text-xs border-slate-200">{DEPARTMENTS[emp.dept] || emp.dept}</Badge></div>
                        <div className="text-xs text-slate-600">{emp.pos}</div>
                        <div className="text-right font-medium text-slate-700">{formatCurrency(emp.salary)}</div>
                      </div>
                    ))}
                  </>
                ) : (
                  employees.map((emp) => (
                    <div key={emp.id} className="grid grid-cols-6 gap-4 p-3 border-b text-sm hover:bg-slate-50 items-center cursor-pointer" onClick={() => { setSelectedEmployee(emp); setDetailModalOpen(true); }}>
                      <div className="font-mono text-xs text-slate-600">{emp.employeeNumber}</div>
                      <div className="col-span-2">
                        <p className="font-medium text-slate-700">{emp.fullName}</p>
                        <p className="text-xs text-slate-500">{emp.email}</p>
                      </div>
                      <div><Badge variant="outline" className="text-xs border-slate-200">{DEPARTMENTS[emp.department] || emp.department}</Badge></div>
                      <div className="text-xs text-slate-600">{emp.position}</div>
                      <div className="text-right font-medium text-slate-700">{formatCurrency(emp.salary)}</div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Attendance Modal */}
      <Dialog open={attendanceModalOpen} onOpenChange={setAttendanceModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pointage - {new Date().toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</DialogTitle>
            <DialogDescription>Enregistrement des entrées et sorties - Conforme Code du Travail</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button className="h-20 bg-emerald-600 hover:bg-emerald-700 flex-col">
                <UserCheck className="h-6 w-6 mb-1" />
                Pointer Entrée
              </Button>
              <Button variant="outline" className="h-20 border-amber-300 hover:bg-amber-50 flex-col">
                <Clock className="h-6 w-6 mb-1 text-amber-600" />
                Pointer Sortie
              </Button>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-3">Derniers Pointages</h4>
              <div className="space-y-2">
                {[
                  { time: '07:58', name: 'Ahmed Benali', type: 'ENTRÉE', status: 'normal' },
                  { time: '08:02', name: 'Fatima Zohra', type: 'ENTRÉE', status: 'normal' },
                  { time: '08:15', name: 'Karim Hadj', type: 'ENTRÉE', status: 'late' },
                  { time: '17:00', name: 'Samira Larbi', type: 'SORTIE', status: 'normal' },
                ].map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{p.time}</span>
                      <span className="text-sm text-slate-700">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn('text-[10px]', p.type === 'ENTRÉE' ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700')}>{p.type}</Badge>
                      {p.status === 'late' && <Badge className="bg-rose-400 text-[10px]">Retard</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendanceModalOpen(false)}>Fermer</Button>
            <Button className="bg-slate-700 hover:bg-slate-800">Exporter Rapport</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Request Modal */}
      <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gestion des Congés</DialogTitle>
            <DialogDescription>Conforme au Code du Travail - 30 jours/an + congés exceptionnels</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-amber-50 p-4 rounded text-center border border-amber-200">
                <p className="text-2xl font-bold text-amber-600">{leaveStats.pending}</p>
                <p className="text-xs text-slate-600">En attente</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded text-center border border-emerald-200">
                <p className="text-2xl font-bold text-emerald-600">{leaveStats.approved}</p>
                <p className="text-xs text-slate-600">Approuvés</p>
              </div>
              <div className="bg-rose-50 p-4 rounded text-center border border-rose-200">
                <p className="text-2xl font-bold text-rose-600">{leaveStats.rejected}</p>
                <p className="text-xs text-slate-600">Refusés</p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Demandes Récentes</h4>
              {[
                { name: 'Ahmed Benali', type: 'Congé Annuel', from: '15/01/2024', to: '30/01/2024', status: 'pending' },
                { name: 'Fatima Zohra', type: 'Congé Exceptionnel', from: '10/01/2024', to: '12/01/2024', status: 'approved' },
                { name: 'Karim Hadj', type: 'Maladie', from: '05/01/2024', to: '08/01/2024', status: 'approved' },
              ].map((leave, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{leave.name}</p>
                    <p className="text-xs text-slate-500">{leave.type}: {leave.from} - {leave.to}</p>
                  </div>
                  <Badge className={cn(
                    'text-[10px]',
                    leave.status === 'pending' ? 'bg-amber-400' :
                    leave.status === 'approved' ? 'bg-emerald-400' : 'bg-rose-400'
                  )}>
                    {leave.status === 'pending' ? 'En attente' : leave.status === 'approved' ? 'Approuvé' : 'Refusé'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveModalOpen(false)}>Fermer</Button>
            <Button className="bg-slate-700 hover:bg-slate-800 gap-2"><Plus className="h-4 w-4" />Nouvelle Demande</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          {selectedEmployee && (
            <>
              <DialogHeader>
                <DialogTitle>Détail Employé</DialogTitle>
                <DialogDescription>{selectedEmployee.fullName || selectedEmployee.employeeNumber}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-slate-700">Informations Personnelles</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">N° Employé:</span><span className="font-medium">{selectedEmployee.employeeNumber}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Email:</span><span className="font-medium">{selectedEmployee.email}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Téléphone:</span><span className="font-medium">{selectedEmployee.phone || '-'}</span></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-slate-700">Informations Professionnelles</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Département:</span><Badge variant="outline">{DEPARTMENTS[selectedEmployee.department] || selectedEmployee.department}</Badge></div>
                      <div className="flex justify-between"><span className="text-slate-500">Poste:</span><span className="font-medium">{selectedEmployee.position}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Date embauche:</span><span className="font-medium">{selectedEmployee.hireDate ? new Date(selectedEmployee.hireDate).toLocaleDateString('fr-DZ') : '-'}</span></div>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-slate-700">Calcul Salaire (Algerian Law)</h4>
                  <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between"><span className="text-slate-600">Salaire de Base:</span><span className="font-bold">{formatCurrency(selectedEmployee.salary)}</span></div>
                    <Separator />
                    <div className="flex justify-between text-rose-600"><span>CNAS Salarié (9%):</span><span>- {formatCurrency(selectedEmployee.salary * CNAS_EMPLOYEE_RATE)}</span></div>
                    <div className="flex justify-between text-amber-600"><span>IRG:</span><span>- {formatCurrency(calculateIRG(selectedEmployee.salary))}</span></div>
                    <Separator />
                    <div className="flex justify-between text-emerald-600 font-bold text-lg"><span>Salaire Net:</span><span>{formatCurrency(selectedEmployee.salary - (selectedEmployee.salary * CNAS_EMPLOYEE_RATE) - calculateIRG(selectedEmployee.salary))}</span></div>
                  </div>
                  <p className="text-xs text-slate-500">Conformément à la législation algérienne: CNAS employeur {(CNAS_EMPLOYER_RATE * 100).toFixed(0)}%, CNAS salarié {(CNAS_EMPLOYEE_RATE * 100).toFixed(0)}%, IRG selon barème progressif</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailModalOpen(false)}>Fermer</Button>
                <Button className="bg-slate-700 hover:bg-slate-800">Modifier</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


// PAYROLL FORM - ALGERIAN COMPLIANCE


function PayrollForm({ employees, onSuccess }: { employees: Employee[]; onSuccess: () => void }) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [overtime, setOvertime] = useState('0');
  const [bonuses, setBonuses] = useState('0');
  const [deductions, setDeductions] = useState('0');
  
  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
  const baseSalary = selectedEmployee?.salary || 0;
  const overtimeAmount = parseFloat(overtime) || 0;
  const bonusAmount = parseFloat(bonuses) || 0;
  const deductionAmount = parseFloat(deductions) || 0;
  
  const grossSalary = baseSalary + overtimeAmount + bonusAmount;
  const cnasEmployee = grossSalary * CNAS_EMPLOYEE_RATE;
  const irg = calculateIRG(grossSalary);
  const netSalary = grossSalary - cnasEmployee - irg - deductionAmount;
  const cnasEmployer = grossSalary * CNAS_EMPLOYER_RATE;
  
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSuccess(); }}>
      <DialogHeader>
        <DialogTitle>Fiche de Paie</DialogTitle>
        <DialogDescription>Calcul conforme Code du Travail Algérien - IRG, CNAS</DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Employé</Label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un employé" />
              </SelectTrigger>
              <SelectContent>
                {employees.length === 0 ? (
                  // Mock employees
                  <>
                    <SelectItem value="emp1">Ahmed Benali - EMP-001</SelectItem>
                    <SelectItem value="emp2">Fatima Zohra - EMP-002</SelectItem>
                    <SelectItem value="emp3">Karim Hadj - EMP-003</SelectItem>
                  </>
                ) : (
                  employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.fullName} - {emp.employeeNumber}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Mois</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="font-medium text-sm text-slate-700">Éléments Variables</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Heures Supplémentaires (DZD)</Label>
              <Input type="number" value={overtime} onChange={(e) => setOvertime(e.target.value)} placeholder="0" />
            </div>
            <div className="grid gap-2">
              <Label>Primes & Bonus (DZD)</Label>
              <Input type="number" value={bonuses} onChange={(e) => setBonuses(e.target.value)} placeholder="0" />
            </div>
            <div className="grid gap-2">
              <Label>Retenues (DZD)</Label>
              <Input type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="font-medium text-sm text-slate-700">Calcul du Salaire</h4>
          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-600">Salaire de Base:</span><span className="font-medium">{baseSalary.toLocaleString('fr-DZ')} DZD</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-600">Heures Supplémentaires:</span><span className="font-medium">{overtimeAmount.toLocaleString('fr-DZ')} DZD</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-600">Primes & Bonus:</span><span className="font-medium">{bonusAmount.toLocaleString('fr-DZ')} DZD</span></div>
            <Separator />
            <div className="flex justify-between text-sm font-semibold"><span className="text-slate-700">Salaire Brut:</span><span>{grossSalary.toLocaleString('fr-DZ')} DZD</span></div>
            <Separator />
            <div className="flex justify-between text-sm text-rose-600"><span>CNAS Salarié (9%):</span><span>- {cnasEmployee.toLocaleString('fr-DZ')} DZD</span></div>
            <div className="flex justify-between text-sm text-amber-600"><span>IRG (Barème Progressif):</span><span>- {irg.toLocaleString('fr-DZ')} DZD</span></div>
            <div className="flex justify-between text-sm text-slate-600"><span>Autres Retenues:</span><span>- {deductionAmount.toLocaleString('fr-DZ')} DZD</span></div>
            <Separator />
            <div className="flex justify-between text-lg font-bold text-emerald-600"><span>Salaire Net à Payer:</span><span>{netSalary.toLocaleString('fr-DZ')} DZD</span></div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-700">
          <p><strong>Charges Employeur:</strong> CNAS ({(CNAS_EMPLOYER_RATE * 100).toFixed(0)}%) = {cnasEmployer.toLocaleString('fr-DZ')} DZD</p>
          <p className="mt-1"><strong>Coût Total Employeur:</strong> {(grossSalary + cnasEmployer).toLocaleString('fr-DZ')} DZD</p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSuccess}>Annuler</Button>
        <Button type="submit" className="bg-slate-700 hover:bg-slate-800 gap-2">
          <Printer className="h-4 w-4" />
          Générer Fiche de Paie
        </Button>
      </DialogFooter>
    </form>
  );
}


// REPORTS TAB - ENRICHED


function ReportsTab() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Report types available
  const reportTypes = [
    { id: 'production', name: 'Rapport Production', icon: Factory, description: 'Analyse complète de la production', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { id: 'inventory', name: 'État des Stocks', icon: Package, description: 'Valeur et mouvements de stock', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { id: 'financial', name: 'Rapport Financier', icon: Banknote, description: 'Compte de résultat et bilan', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { id: 'hr', name: 'Rapport RH', icon: Users, description: 'Effectifs et masse salariale', color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { id: 'quality', name: 'Contrôle Qualité', icon: CheckCircle2, description: 'Taux de conformité et défauts', color: 'text-sky-600', bgColor: 'bg-sky-50' },
    { id: 'maintenance', name: 'Maintenance', icon: Wrench, description: 'Interventions et pannes', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  ];

  // Mock data for charts
  const monthlyRevenue = [
    { month: 'Jan', revenue: 8500000, costs: 6200000 },
    { month: 'Fév', revenue: 9200000, costs: 6800000 },
    { month: 'Mar', revenue: 10500000, costs: 7500000 },
    { month: 'Avr', revenue: 11800000, costs: 8100000 },
    { month: 'Mai', revenue: 13500000, costs: 9200000 },
    { month: 'Juin', revenue: 12000000, costs: 8500000 },
  ];

  const productionByProduct = [
    { product: 'Pompe P200', quantity: 45, target: 50 },
    { product: 'Turbine T500', quantity: 12, target: 15 },
    { product: 'Échangeur E100', quantity: 28, target: 30 },
    { product: 'Compresseur C300', quantity: 8, target: 10 },
  ];

  const stockValueByCategory = [
    { category: 'Matières Premières', value: 2850000, percentage: 45 },
    { category: 'Produits Finis', value: 1980000, percentage: 31 },
    { category: 'En Cours', value: 950000, percentage: 15 },
    { category: 'Consommables', value: 560000, percentage: 9 },
  ];

  const employeeDistribution = [
    { department: 'Production', count: 85, percentage: 34 },
    { department: 'Maintenance', count: 42, percentage: 17 },
    { department: 'Qualité', count: 28, percentage: 11 },
    { department: 'Logistique', count: 35, percentage: 14 },
    { department: 'Administration', count: 60, percentage: 24 },
  ];

  const kpiSummary = [
    { label: 'Chiffre d\'Affaires', value: '12.0M DZD', change: '+8.5%', positive: true },
    { label: 'Marge Brute', value: '48.4%', change: '+2.1%', positive: true },
    { label: 'Taux de Réclamation', value: '1.2%', change: '-0.5%', positive: true },
    { label: 'Efficacité Production', value: '87.3%', change: '+1.8%', positive: true },
    { label: 'Turnover', value: '3.2%', change: '-1.1%', positive: true },
    { label: 'Retard Livraison', value: '5.8%', change: '+0.3%', positive: false },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Rapports & Analyses</h2>
          <p className="text-slate-500 text-sm">États financiers et indicateurs de performance</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Cette Semaine</SelectItem>
              <SelectItem value="month">Ce Mois</SelectItem>
              <SelectItem value="quarter">Ce Trimestre</SelectItem>
              <SelectItem value="year">Cette Année</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2 border-slate-200">
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
          <Button variant="outline" className="gap-2 border-slate-200">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* KPI Summary */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-slate-700">Indicateurs Clés de Performance</CardTitle>
          <CardDescription className="text-xs">Période: {selectedPeriod === 'month' ? 'Janvier 2024' : selectedPeriod === 'quarter' ? 'T1 2024' : '2024'}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {kpiSummary.map((kpi) => (
              <div key={kpi.label} className="p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-500 uppercase">{kpi.label}</p>
                <p className="text-lg font-bold text-slate-800">{kpi.value}</p>
                <p className={cn('text-xs font-medium', kpi.positive ? 'text-emerald-600' : 'text-rose-600')}>
                  {kpi.change}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Report Types Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {reportTypes.map((report) => (
          <Card 
            key={report.id} 
            className="border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => { setSelectedReport(report.id); setReportModalOpen(true); }}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col items-center text-center">
                <div className={cn('h-12 w-12 rounded-lg flex items-center justify-center mb-2', report.bgColor)}>
                  <report.icon className={cn('h-6 w-6', report.color)} />
                </div>
                <p className="text-xs font-medium text-slate-700">{report.name}</p>
                <p className="text-[10px] text-slate-500">{report.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Reports Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue vs Costs */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-700">Revenus vs Coûts</CardTitle>
                <CardDescription className="text-xs">Évolution mensuelle</CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px]">6 mois</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[250px]">
              <AreaChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v / 1000000}M`} stroke="#94a3b8" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="revenue" stroke={PASTEL_COLORS.emerald} fill={PASTEL_COLORS.emerald} fillOpacity={0.4} strokeWidth={2} name="Revenus" />
                <Area type="monotone" dataKey="costs" stroke={PASTEL_COLORS.rose} fill={PASTEL_COLORS.rose} fillOpacity={0.4} strokeWidth={2} name="Coûts" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Production by Product */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Production par Produit</CardTitle>
            <CardDescription className="text-xs">Quantités produites vs objectifs</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[250px]">
              <BarChart data={productionByProduct} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis dataKey="product" type="category" width={100} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="quantity" fill={PASTEL_COLORS.sky} radius={[0, 4, 4, 0]} name="Produit" />
                <Bar dataKey="target" fill={PASTEL_COLORS.slate} radius={[0, 4, 4, 0]} name="Objectif" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Stock Value Distribution */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Valeur des Stocks</CardTitle>
            <CardDescription className="text-xs">Répartition par catégorie</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[250px]">
              <RechartsPie>
                <Pie
                  data={stockValueByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ category, percentage }) => `${category.split(' ')[0]}: ${percentage}%`}
                >
                  {stockValueByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={[PASTEL_COLORS.emerald, PASTEL_COLORS.sky, PASTEL_COLORS.amber, PASTEL_COLORS.violet][index]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
              </RechartsPie>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Employee Distribution */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Effectifs par Département</CardTitle>
            <CardDescription className="text-xs">Répartition des 250 employés</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={chartConfig} className="h-[250px]">
              <BarChart data={employeeDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="department" tick={{ fontSize: 9 }} stroke="#94a3b8" angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill={PASTEL_COLORS.violet} radius={[4, 4, 0, 0]} name="Employés" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Products */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700">Top Produits (Revenus)</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7">Voir tout</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {[
                { name: 'Turbine T500', revenue: '2.5M DZD', growth: '+15%' },
                { name: 'Pompe P200', revenue: '1.8M DZD', growth: '+8%' },
                { name: 'Échangeur E100', revenue: '1.2M DZD', growth: '+12%' },
                { name: 'Compresseur C300', revenue: '0.9M DZD', growth: '-3%' },
                { name: 'Vanney V150', revenue: '0.7M DZD', growth: '+5%' },
              ].map((product, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{idx + 1}</div>
                    <span className="text-xs font-medium text-slate-700">{product.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-600">{product.revenue}</span>
                    <span className={cn('text-xs font-medium', product.growth.startsWith('+') ? 'text-emerald-600' : 'text-rose-600')}>{product.growth}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Warnings */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700">Alertes & Avertissements</CardTitle>
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">4 alertes</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {[
                { type: 'critical', message: 'Rupture stock Cuivre Électrolytique', action: 'Réapprovisionner' },
                { type: 'warning', message: 'Stock bas Acier Inox (-45%)', action: 'Commander' },
                { type: 'warning', message: 'Work Order WO-20240115-0001 en retard', action: 'Vérifier' },
                { type: 'info', message: '3 factures impayées > 60 jours', action: 'Relancer' },
              ].map((alert, idx) => (
                <div key={idx} className={cn('flex items-center justify-between p-2 rounded', 
                  alert.type === 'critical' ? 'bg-rose-50' : 
                  alert.type === 'warning' ? 'bg-amber-50' : 'bg-sky-50'
                )}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={cn('h-4 w-4',
                      alert.type === 'critical' ? 'text-rose-600' :
                      alert.type === 'warning' ? 'text-amber-600' : 'text-sky-600'
                    )} />
                    <span className="text-xs text-slate-700">{alert.message}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]">{alert.action}</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Résumé Financier</CardTitle>
          <CardDescription className="text-xs">Conforme au Plan Comptable Algérien</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">Produits d'Exploitation</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Ventes de produits</span><span>11,500,000 DZD</span></div>
                <div className="flex justify-between text-xs"><span>Prestations services</span><span>500,000 DZD</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between text-xs font-semibold"><span>Total</span><span>12,000,000 DZD</span></div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">Charges d'Exploitation</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>Achats consommés</span><span>5,200,000 DZD</span></div>
                <div className="flex justify-between text-xs"><span>Charges personnel</span><span>2,800,000 DZD</span></div>
                <div className="flex justify-between text-xs"><span>Autres charges</span><span>600,000 DZD</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between text-xs font-semibold"><span>Total</span><span>8,600,000 DZD</span></div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">Résultat d'Exploitation</h4>
              <div className="bg-emerald-50 p-3 rounded">
                <p className="text-xl font-bold text-emerald-600">+3,400,000 DZD</p>
                <p className="text-xs text-slate-500">Marge: 28.3%</p>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase">Impôts & Taxes</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span>TVA collectée</span><span>2,280,000 DZD</span></div>
                <div className="flex justify-between text-xs"><span>TVA déductible</span><span>1,634,000 DZD</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between text-xs font-semibold"><span>TVA à payer</span><span className="text-rose-600">646,000 DZD</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Detail Modal */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {reportTypes.find(r => r.id === selectedReport)?.name || 'Rapport'}
            </DialogTitle>
            <DialogDescription>
              {reportTypes.find(r => r.id === selectedReport)?.description}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="py-4">
              {selectedReport === 'production' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-3 rounded text-center">
                      <p className="text-xl font-bold text-slate-800">89</p>
                      <p className="text-xs text-slate-500">Ordres ce mois</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded text-center">
                      <p className="text-xl font-bold text-emerald-600">67</p>
                      <p className="text-xs text-slate-500">Terminés</p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded text-center">
                      <p className="text-xl font-bold text-amber-600">18</p>
                      <p className="text-xs text-slate-500">En cours</p>
                    </div>
                    <div className="bg-rose-50 p-3 rounded text-center">
                      <p className="text-xl font-bold text-rose-600">4</p>
                      <p className="text-xs text-slate-500">En retard</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">Ce rapport présente une analyse détaillée de la production mensuelle, incluant les temps de cycle, les rendements par machine, et les écarts par rapport aux objectifs.</p>
                </div>
              )}
              {selectedReport === 'financial' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Rapport financier conforme au Plan Comptable Algérien (PCA). Inclut:</p>
                  <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
                    <li>Compte de résultat</li>
                    <li>Bilan simplifié</li>
                    <li>Tableau de flux de trésorerie</li>
                    <li>Détail des charges par nature</li>
                    <li>Calcul TVA et IBS</li>
                  </ul>
                </div>
              )}
              {selectedReport === 'hr' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-3 rounded text-center">
                      <p className="text-xl font-bold text-slate-800">250</p>
                      <p className="text-xs text-slate-500">Effectif total</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded text-center">
                      <p className="text-xl font-bold text-emerald-600">8</p>
                      <p className="text-xs text-slate-500">Nouvelles embauches</p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded text-center">
                      <p className="text-xl font-bold text-amber-600">3.2%</p>
                      <p className="text-xs text-slate-500">Turnover</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">Rapport RH conforme au Code du Travail (Loi 90-11). Analyse des effectifs, masse salariale, formations et absences.</p>
                </div>
              )}
              {!['production', 'financial', 'hr'].includes(selectedReport || '') && (
                <p className="text-sm text-slate-600">Sélectionnez un rapport pour voir les détails.</p>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportModalOpen(false)}>Fermer</Button>
            <Button variant="outline" className="gap-2"><Printer className="h-4 w-4" />Imprimer</Button>
            <Button className="bg-slate-700 hover:bg-slate-800 gap-2"><Download className="h-4 w-4" />Télécharger PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// SETTINGS TAB


function SettingsTab({ onSeed, isSeeding }: { onSeed: () => void; isSeeding: boolean }) {
  const { theme, setTheme } = useTheme();
  
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-800">Paramètres</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base font-semibold text-slate-700">Apparence</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-slate-500 mb-4">Personnalisez l'apparence de l'application</p>
            <div className="flex gap-2">
              <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('light')} className={theme === 'light' ? 'bg-slate-700' : 'border-slate-200'}>Clair</Button>
              <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('dark')} className={theme === 'dark' ? 'bg-slate-700' : 'border-slate-200'}>Sombre</Button>
              <Button variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('system')} className={theme === 'system' ? 'bg-slate-700' : 'border-slate-200'}>Système</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base font-semibold text-slate-700">Base de Données</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-slate-500 mb-4">Réinitialiser les données de démonstration</p>
            <Button onClick={onSeed} disabled={isSeeding} variant="outline" className="border-slate-200">
              {isSeeding ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Réinitialiser
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base font-semibold text-slate-700">Informations Légales - Algérie</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 text-sm text-slate-600">
            <p><strong>TVA:</strong> 19% (taux normal), 9% (taux réduit), 0% (exonéré)</p>
            <p><strong>IRG:</strong> Impôt sur le Revenu Global (barème progressif)</p>
            <p><strong>IBS:</strong> Impôt sur les Bénéfices des Sociétés (19% ou 26%)</p>
            <p><strong>CNAS:</strong> Cotisations sociales employeur ~26%, salarié ~9%</p>
            <p><strong>SNMG:</strong> Salaire National Minimum Garanti = 20 000 DZD</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


