import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { useSearchParams } from 'react-router-dom';
import { 
  Wallet, 
  TrendingDown, 
  TrendingUp, 
  Loader2, 
  BarChart3,
  FileSpreadsheet,
  Settings,
  CalendarClock,
  Landmark,
  Clock,
  ArrowDownToLine,
  Banknote,
  Info
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

import { CashFlowChart } from '@/components/financeiro/CashFlowChart';
import { DreTable } from '@/components/financeiro/DreTable';
import { ImportTransactionsModal } from '@/components/financeiro/ImportTransactionsModal';
import { ImportReceiptsModal } from '@/components/financeiro/ImportReceiptsModal';
import { ConfiguracoesTab } from '@/components/financeiro/ConfiguracoesTab';
import { DateRangeFilter } from '@/components/financeiro/DateRangeFilter';
import { ReceitasTab } from '@/components/financeiro/ReceitasTab';
import { DespesasTab } from '@/components/financeiro/DespesasTab';
import { CaixaTab } from '@/components/financeiro/CaixaTab';
import { TransactionDetailsSheet } from '@/components/financeiro/TransactionDetailsSheet';
import { 
  useFinancialAccountsWithDefaults, 
  useRecentTransactions,
  useCashFlowData,
  useFinancialSummary
} from '@/hooks/useFinanceiro';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { parseLocalDate } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';

// ============ KPI CONFIGURATION ============

const ALL_KPIS = [
  { id: 'cashBalance', label: 'Saldo em Caixa' },
  { id: 'netResult', label: 'Resultado Líquido' },
  { id: 'totalIncome', label: 'Receita Confirmada' },
  { id: 'totalExpense', label: 'Despesas' },
  { id: 'pendingIncome', label: 'Saldo em Aberto' },
  { id: 'pendingExpense', label: 'Projeção (A Pagar)' },
] as const;

const DEFAULT_VISIBLE_KPIS = ['totalIncome', 'totalExpense', 'pendingIncome', 'pendingExpense'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// ============ 3 KPIs GLOBAIS NO HEADER ============

interface GlobalKpiCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  variant: 'primary' | 'success' | 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  subtitle?: string;
  tooltip?: string;
}

function GlobalKpiCard({ title, value, icon: Icon, variant, isLoading, subtitle, tooltip }: GlobalKpiCardProps) {
  const styles = {
    primary: 'from-primary/10 to-primary/5 border-primary/20',
    success: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
    danger: 'from-rose-500/10 to-rose-600/5 border-rose-500/20',
    warning: 'from-amber-500/10 to-amber-600/5 border-amber-500/20',
    info: 'from-sky-500/10 to-sky-600/5 border-sky-500/20',
  };
  const iconStyles = {
    primary: 'bg-primary/20 text-primary',
    success: 'bg-emerald-500/20 text-emerald-500',
    danger: 'bg-rose-500/20 text-rose-500',
    warning: 'bg-amber-500/20 text-amber-500',
    info: 'bg-sky-500/20 text-sky-500',
  };
  const valueStyles = {
    primary: 'text-foreground',
    success: 'text-emerald-500',
    danger: 'text-rose-500',
    warning: 'text-amber-500',
    info: 'text-sky-500',
  };

  const cardContent = (
    <Card className={cn('bg-gradient-to-br border', styles[variant])}>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={cn('p-3 rounded-lg', iconStyles[variant])}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="text-sm text-muted-foreground">{title}</p>
              {tooltip && (
                <Info className="w-3.5 h-3.5 text-muted-foreground/50" />
              )}
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-24 mt-1" />
            ) : (
              <>
                <p className={cn('text-xl font-bold', valueStyles[variant])}>
                  {formatCurrency(value)}
                </p>
                {subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {cardContent}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}

// ============ KPI SECTION WITH CONFIGURATOR ============

interface KpiSectionProps {
  summary: {
    cashBalance?: number;
    netResult?: number;
    totalIncome?: number;
    totalExpense?: number;
    pendingIncome?: number;
    pendingExpense?: number;
  } | null | undefined;
  isLoading: boolean;
}

function KpiSection({ summary, isLoading }: KpiSectionProps) {
  const [visibleKpis, setVisibleKpis] = useLocalStorage<string[]>(
    'financeiro-kpis-visible',
    DEFAULT_VISIBLE_KPIS
  );

  const gridCols = useMemo(() => {
    const count = visibleKpis.length;
    if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
    if (count <= 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6';
  }, [visibleKpis.length]);

  const handleToggleKpi = (kpiId: string, checked: boolean) => {
    if (checked) {
      setVisibleKpis([...visibleKpis, kpiId]);
    } else {
      setVisibleKpis(visibleKpis.filter(id => id !== kpiId));
    }
  };

  const kpiConfigs: Record<string, { title: string; icon: React.ElementType; variant: 'primary' | 'success' | 'danger' | 'warning' | 'info'; value: number; subtitle?: string; tooltip: string }> = {
    cashBalance: {
      title: 'Saldo em Caixa',
      icon: Banknote,
      variant: 'info',
      value: summary?.cashBalance ?? 0,
      tooltip: 'Saldo acumulado de todas as contas bancárias (histórico completo)',
    },
    netResult: {
      title: 'Resultado Líquido',
      icon: Landmark,
      variant: 'primary',
      value: summary?.netResult ?? 0,
      subtitle: 'Período selecionado',
      tooltip: 'Diferença entre receitas e despesas confirmadas no período selecionado',
    },
    totalIncome: {
      title: 'Receita do Período',
      icon: TrendingUp,
      variant: 'success',
      value: summary?.totalIncome ?? 0,
      tooltip: 'Total de receitas confirmadas (status = completed) no período selecionado',
    },
    totalExpense: {
      title: 'Despesa do Período',
      icon: TrendingDown,
      variant: 'danger',
      value: summary?.totalExpense ?? 0,
      tooltip: 'Total de despesas confirmadas (status = completed) no período selecionado',
    },
    pendingIncome: {
      title: 'A Receber',
      icon: Clock,
      variant: 'warning',
      value: summary?.pendingIncome ?? 0,
      subtitle: 'Comissões pendentes',
      tooltip: 'Receitas com status = pending no período selecionado',
    },
    pendingExpense: {
      title: 'A Pagar',
      icon: ArrowDownToLine,
      variant: 'danger',
      value: summary?.pendingExpense ?? 0,
      subtitle: 'Despesas pendentes',
      tooltip: 'Despesas com status = pending no período selecionado',
    },
  };

  return (
    <div className="relative">
      {/* Botão de configuração */}
      <div className="absolute -top-1 right-0 z-10">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <div className="space-y-3">
              <p className="text-sm font-medium">Exibir KPIs:</p>
              {ALL_KPIS.map((kpi) => (
                <label key={kpi.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={visibleKpis.includes(kpi.id)}
                    onCheckedChange={(checked) => handleToggleKpi(kpi.id, !!checked)}
                  />
                  <span className="text-sm">{kpi.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Grid de KPIs */}
      <div className={cn('grid gap-4', gridCols)}>
        {ALL_KPIS.filter(kpi => visibleKpis.includes(kpi.id)).map((kpi) => {
          const config = kpiConfigs[kpi.id];
          return (
            <GlobalKpiCard
              key={kpi.id}
              title={config.title}
              value={config.value}
              icon={config.icon}
              variant={config.variant}
              isLoading={isLoading}
              subtitle={config.subtitle}
              tooltip={config.tooltip}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============ VISÃO GERAL (APENAS GRÁFICO) ============

interface VisaoGeralProps {
  dateRange: DateRange | undefined;
}

function VisaoGeral({ dateRange }: VisaoGeralProps) {
  const { isLoading: accountsLoading, isEnsuring } = useFinancialAccountsWithDefaults();

  const chartPeriod = useMemo(() => {
    const from = dateRange?.from || subMonths(new Date(), 1);
    const to = dateRange?.to || new Date();
    return {
      startDate: format(startOfDay(from), 'yyyy-MM-dd'),
      endDate: format(endOfDay(to), 'yyyy-MM-dd')
    };
  }, [dateRange]);

  const { data: cashFlowData = [], isLoading: cashFlowLoading } = useCashFlowData(
    chartPeriod.startDate,
    chartPeriod.endDate,
    'day'
  );

  if (accountsLoading || isEnsuring) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">
          {isEnsuring ? 'Configurando contas...' : 'Carregando...'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CashFlowChart
        data={cashFlowData}
        isLoading={cashFlowLoading}
        granularity="day"
      />
    </div>
  );
}

// ============ DRE TAB ============

function DreTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">DRE / Relatórios</h2>
        <p className="text-sm text-muted-foreground">
          Demonstrativo de Resultado do Exercício - visão consolidada de receitas e despesas
        </p>
      </div>
      <DreTable />
    </div>
  );
}

// ============ ÚLTIMAS MOVIMENTAÇÕES (COMPACTO NO FINAL) ============

interface RecentMovementsProps {
  onViewDetails: (id: string) => void;
}

function RecentMovements({ onViewDetails }: RecentMovementsProps) {
  const { data: transactions = [], isLoading } = useRecentTransactions();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Últimas Movimentações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Últimas Movimentações
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {transactions.length} recentes
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {transactions.slice(0, 8).map((tx) => {
            const txDate = parseLocalDate(String(tx.transaction_date));
            // ✅ Usar status real da RPC (não inferir por reference_number)
            const isPending = tx.status === 'pending';
            
            return (
              <div 
                key={tx.id} 
                className={cn(
                  "p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer",
                  isPending && "border-l-2 border-amber-500/50"
                )}
                onClick={() => onViewDetails(tx.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      {isPending && (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px] px-1 py-0 h-4 flex-shrink-0">
                          Pendente
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(txDate, "dd/MM", { locale: ptBR })}
                    </p>
                  </div>
                  <p className={cn(
                    "text-sm font-semibold flex-shrink-0",
                    tx.total_amount > 0 ? 'text-emerald-500' : 'text-rose-500'
                  )}>
                    {tx.total_amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.total_amount))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ MAIN COMPONENT ============

export default function FinanceiroERP() {
  usePageTitle('Financeiro');
  const [searchParams, setSearchParams] = useSearchParams();

  // Estado global de filtro de datas
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  // Estado para controle da aba e detalhes
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [detailsTransactionId, setDetailsTransactionId] = useState<string | null>(null);
  const [isLegacyLookup, setIsLegacyLookup] = useState(false);

  // Datas normalizadas para queries
  const { startDate, endDate } = useMemo(() => {
    const from = dateRange?.from || startOfMonth(new Date());
    const to = dateRange?.to || endOfMonth(new Date());
    return {
      startDate: format(startOfDay(from), 'yyyy-MM-dd'),
      endDate: format(endOfDay(to), 'yyyy-MM-dd')
    };
  }, [dateRange]);

  // KPIs globais - apenas transações EFETIVADAS (completed)
  const { data: summary, isLoading: summaryLoading } = useFinancialSummary(startDate, endDate);

  // Deep link: verificar parâmetros da URL ao carregar
  useEffect(() => {
    const transactionId = searchParams.get('transactionId');
    const legacyId = searchParams.get('legacyId');
    
    if (transactionId || legacyId) {
      setDetailsTransactionId(transactionId || legacyId);
      setIsLegacyLookup(!!legacyId && !transactionId);
      setActiveTab('receitas');
    }
  }, [searchParams]);

  // Limpar URL quando fechar a gaveta
  const handleCloseDetails = () => {
    setDetailsTransactionId(null);
    setIsLegacyLookup(false);
    
    if (searchParams.has('transactionId') || searchParams.has('legacyId')) {
      searchParams.delete('transactionId');
      searchParams.delete('legacyId');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleViewTransactionDetails = (id: string) => {
    setDetailsTransactionId(id);
    setIsLegacyLookup(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-sm text-muted-foreground">
              Controle de despesas e receitas
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <ImportReceiptsModal />
          <ImportTransactionsModal />
        </div>
      </div>

      {/* KPIs Globais Configuráveis */}
      <KpiSection 
        summary={summary} 
        isLoading={summaryLoading} 
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="visao-geral" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="caixa" className="gap-2">
            <Landmark className="w-4 h-4" />
            Caixa
          </TabsTrigger>
          <TabsTrigger value="receitas" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Receitas
          </TabsTrigger>
          <TabsTrigger value="despesas" className="gap-2">
            <TrendingDown className="w-4 h-4" />
            Despesas
          </TabsTrigger>
          <TabsTrigger value="dre" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            DRE
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="w-4 h-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <VisaoGeral dateRange={dateRange} />
          <div className="mt-6">
            <RecentMovements onViewDetails={handleViewTransactionDetails} />
          </div>
        </TabsContent>

        <TabsContent value="caixa">
          <CaixaTab dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="receitas">
          <ReceitasTab dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="despesas">
          <DespesasTab dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="dre">
          <DreTab />
        </TabsContent>

        <TabsContent value="config">
          <ConfiguracoesTab />
        </TabsContent>
      </Tabs>


      {/* Deep Link Details Sheet */}
      <TransactionDetailsSheet 
        transactionId={detailsTransactionId}
        isLegacyId={isLegacyLookup}
        open={!!detailsTransactionId}
        onClose={handleCloseDetails}
      />
    </div>
  );
}
