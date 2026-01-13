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
  Info,
  LineChart
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { CashFlowChart } from '@/components/financeiro/CashFlowChart';
import { DreTable } from '@/components/financeiro/DreTable';
import { ImportTransactionsModal } from '@/components/financeiro/ImportTransactionsModal';
import { ImportReceiptsModal } from '@/components/financeiro/ImportReceiptsModal';
import { ConfiguracoesTab } from '@/components/financeiro/ConfiguracoesTab';
import { DateRangeFilter } from '@/components/financeiro/DateRangeFilter';
import { ReceitasTab } from '@/components/financeiro/ReceitasTab';
import { DespesasTab } from '@/components/financeiro/DespesasTab';
import { CaixaTab } from '@/components/financeiro/CaixaTab';
import { ProvisoesTab } from '@/components/financeiro/ProvisoesTab';
import { TransactionDetailsSheet } from '@/components/financeiro/TransactionDetailsSheet';
import { 
  useFinancialAccountsWithDefaults, 
  useRecentTransactions,
  useCashFlowData,
  useFinancialSummary,
  useTotalPendingReceivables,
  usePendingThisMonth
} from '@/hooks/useFinanceiro';
import { usePageTitle } from '@/hooks/usePageTitle';
import { parseLocalDate } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';

// ============ KPI CONFIGURATION - 4 KPIS SIMPLES ============

const FIXED_KPIS = [
  { id: 'totalIncome', label: 'Recebido no Mês' },
  { id: 'totalExpense', label: 'Despesas do Mês' },
  { id: 'pendingThisMonth', label: 'Vencendo este Mês' },
  { id: 'totalPending', label: 'Total Geral a Receber' },
] as const;

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

// ============ SIMPLE 4 KPI SECTION ============

interface KpiSectionProps {
  summary: {
    totalIncome?: number;
    totalExpense?: number;
  } | null | undefined;
  pendingThisMonth: { total_amount: number; pending_count: number } | undefined;
  totalPending: { total_amount: number; pending_count: number } | undefined;
  isLoading: boolean;
}

function KpiSection({ summary, pendingThisMonth, totalPending, isLoading }: KpiSectionProps) {
  const kpis = [
    {
      title: 'Recebido no Mês',
      value: summary?.totalIncome ?? 0,
      icon: TrendingUp,
      variant: 'success' as const,
      tooltip: 'Receitas confirmadas (status = completed) no mês selecionado',
    },
    {
      title: 'Despesas do Mês',
      value: summary?.totalExpense ?? 0,
      icon: TrendingDown,
      variant: 'danger' as const,
      tooltip: 'Despesas confirmadas (status = completed) no mês selecionado',
    },
    {
      title: 'Vencendo este Mês',
      value: pendingThisMonth?.total_amount ?? 0,
      icon: CalendarClock,
      variant: 'warning' as const,
      subtitle: pendingThisMonth?.pending_count ? `${pendingThisMonth.pending_count} parcelas` : undefined,
      tooltip: 'Receitas pendentes com vencimento no mês atual',
    },
    {
      title: 'Total Geral a Receber',
      value: totalPending?.total_amount ?? 0,
      icon: Clock,
      variant: 'info' as const,
      subtitle: totalPending?.pending_count ? `${totalPending.pending_count} parcelas` : undefined,
      tooltip: 'TODAS as receitas pendentes de todas as datas (sem filtro)',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <GlobalKpiCard
          key={kpi.title}
          title={kpi.title}
          value={kpi.value}
          icon={kpi.icon}
          variant={kpi.variant}
          isLoading={isLoading}
          subtitle={kpi.subtitle}
          tooltip={kpi.tooltip}
        />
      ))}
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
  
  // KPIs adicionais - pendentes
  const { data: pendingThisMonth, isLoading: pendingThisMonthLoading } = usePendingThisMonth();
  const { data: totalPending, isLoading: totalPendingLoading } = useTotalPendingReceivables();

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

      {/* KPIs Fixos - 4 Cards Simples */}
      <KpiSection 
        summary={summary} 
        pendingThisMonth={pendingThisMonth}
        totalPending={totalPending}
        isLoading={summaryLoading || pendingThisMonthLoading || totalPendingLoading} 
      />
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
          <TabsTrigger value="provisoes" className="gap-2">
            <LineChart className="w-4 h-4" />
            Provisões
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

        <TabsContent value="provisoes">
          <ProvisoesTab dateRange={dateRange} />
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
