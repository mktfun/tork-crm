import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useSearchParams } from 'react-router-dom';
import { 
  Wallet, 
  TrendingDown, 
  TrendingUp, 
  Loader2, 
  ArrowRightLeft,
  DollarSign,
  BarChart3,
  Receipt,
  FileSpreadsheet,
  Settings
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

import { NovaDespesaModal } from '@/components/financeiro/NovaDespesaModal';
import { CashFlowChart } from '@/components/financeiro/CashFlowChart';
import { DreTable } from '@/components/financeiro/DreTable';
import { ImportTransactionsModal } from '@/components/financeiro/ImportTransactionsModal';
import { ConfiguracoesTab } from '@/components/financeiro/ConfiguracoesTab';
import { DateRangeFilter } from '@/components/financeiro/DateRangeFilter';
import { ReceitasTab } from '@/components/financeiro/ReceitasTab';
import { TransactionDetailsSheet } from '@/components/financeiro/TransactionDetailsSheet';
import { 
  useFinancialAccountsWithDefaults, 
  useRecentTransactions,
  useCashFlowData,
  useFinancialSummary
} from '@/hooks/useFinanceiro';
import { FinancialAccount, ACCOUNT_TYPE_LABELS } from '@/types/financeiro';
import { usePageTitle } from '@/hooks/usePageTitle';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// ============ KPI CARD ============

interface KpiCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  variant: 'success' | 'danger' | 'info' | 'default';
  showSign?: boolean;
}

function FinancialKpiCard({ title, value, icon: Icon, variant, showSign = false }: KpiCardProps) {
  const variantStyles = {
    success: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
    danger: 'from-rose-500/10 to-rose-600/5 border-rose-500/20',
    info: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
    default: 'from-muted/50 to-muted/30 border-border/50'
  };

  const iconStyles = {
    success: 'bg-emerald-500/20 text-emerald-500',
    danger: 'bg-rose-500/20 text-rose-500',
    info: 'bg-blue-500/20 text-blue-500',
    default: 'bg-muted text-muted-foreground'
  };

  const valueStyles = {
    success: 'text-emerald-500',
    danger: 'text-rose-500',
    info: 'text-blue-500',
    default: 'text-foreground'
  };

  const displayValue = showSign && value > 0 
    ? `+${formatCurrency(value)}` 
    : formatCurrency(value);

  return (
    <Card className={`bg-gradient-to-br ${variantStyles[variant]}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${iconStyles[variant]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className={`text-xl font-bold ${valueStyles[variant]}`}>
              {displayValue}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ TRANSACTION COUNT CARD ============

function TransactionCountCard({ count, isLoading }: { count: number; isLoading: boolean }) {
  return (
    <Card className="bg-gradient-to-br from-muted/50 to-muted/30 border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-muted text-muted-foreground">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Transações</p>
            {isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <p className="text-xl font-bold text-foreground">{count}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ TRANSACTIONS LIST ============

function TransactionsList() {
  const { data: transactions = [], isLoading } = useRecentTransactions();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma transação registrada ainda.</p>
        <p className="text-sm">Use o botão "Nova Despesa" para começar.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2">
        {transactions.slice(0, 10).map((tx) => (
          <Card key={tx.id} className="bg-card/30 border-border/30 hover:bg-card/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{format(new Date(tx.transaction_date), "dd 'de' MMM", { locale: ptBR })}</span>
                    {tx.reference_number && (
                      <>
                        <span>•</span>
                        <span className="truncate">{tx.reference_number}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className={`font-semibold ${tx.total_amount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {tx.total_amount > 0 ? '+' : ''}{formatCurrency(Math.abs(tx.total_amount))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============ VISÃO GERAL (COM KPIS E GRÁFICO) ============

interface VisaoGeralProps {
  dateRange: DateRange | undefined;
}

function VisaoGeral({ dateRange }: VisaoGeralProps) {
  const { isLoading: accountsLoading, isEnsuring } = useFinancialAccountsWithDefaults();

  // Usar o dateRange passado por props - FASE 10: Normalizar com startOfDay/endOfDay
  const { startDate, endDate } = useMemo(() => {
    const from = dateRange?.from || startOfMonth(new Date());
    const to = dateRange?.to || endOfMonth(new Date());
    
    // Forçar início e fim do dia no fuso local para evitar problemas de timezone
    const normalizedFrom = startOfDay(from);
    const normalizedTo = endOfDay(to);
    
    return {
      startDate: format(normalizedFrom, 'yyyy-MM-dd'),
      endDate: format(normalizedTo, 'yyyy-MM-dd')
    };
  }, [dateRange]);

  // Período para o gráfico (mesmo do filtro) - FASE 10: Normalizar timezone
  const chartPeriod = useMemo(() => {
    const from = dateRange?.from || subMonths(new Date(), 1);
    const to = dateRange?.to || new Date();
    
    // Normalizar para evitar problemas de timezone
    const normalizedFrom = startOfDay(from);
    const normalizedTo = endOfDay(to);
    
    return {
      startDate: format(normalizedFrom, 'yyyy-MM-dd'),
      endDate: format(normalizedTo, 'yyyy-MM-dd')
    };
  }, [dateRange]);

  // Hooks de dados
  const { data: summary, isLoading: summaryLoading } = useFinancialSummary(startDate, endDate);
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

  const netResultVariant = (summary?.netResult ?? 0) >= 0 ? 'success' : 'danger';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinancialKpiCard
          title="Receita do Período"
          value={summary?.totalIncome ?? 0}
          icon={TrendingUp}
          variant="success"
        />
        <FinancialKpiCard
          title="Despesas do Período"
          value={summary?.totalExpense ?? 0}
          icon={TrendingDown}
          variant="danger"
        />
        <FinancialKpiCard
          title="Resultado Líquido"
          value={summary?.netResult ?? 0}
          icon={DollarSign}
          variant={netResultVariant}
          showSign
        />
        <TransactionCountCard 
          count={summary?.transactionCount ?? 0} 
          isLoading={summaryLoading}
        />
      </div>

      {/* Gráfico de Fluxo de Caixa */}
      <CashFlowChart
        data={cashFlowData}
        isLoading={cashFlowLoading}
        granularity="day"
      />

      {/* Últimos movimentos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Últimos Movimentos</CardTitle>
            <CardDescription>Transações registradas no sistema</CardDescription>
          </div>
          <NovaDespesaModal />
        </CardHeader>
        <CardContent>
          <TransactionsList />
        </CardContent>
      </Card>
    </div>
  );
}

// ============ DESPESAS TAB ============

interface DespesasTabProps {
  dateRange: DateRange | undefined;
}

function DespesasTab({ dateRange }: DespesasTabProps) {
  const { data: transactions = [], isLoading } = useRecentTransactions('expense');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Despesas</h2>
          <p className="text-sm text-muted-foreground">Gerencie suas saídas financeiras</p>
        </div>
        <NovaDespesaModal />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingDown className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma despesa registrada.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <Card key={tx.id} className="bg-card/30 border-border/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{tx.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(tx.transaction_date), "dd/MM/yyyy")}
                            {tx.reference_number && ` • ${tx.reference_number}`}
                          </p>
                        </div>
                        <p className="font-semibold text-rose-500">
                          - {formatCurrency(tx.total_amount)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
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

  // Deep link: verificar parâmetros da URL ao carregar
  useEffect(() => {
    const transactionId = searchParams.get('transactionId');
    
    if (transactionId) {
      // Abrir a gaveta de detalhes automaticamente
      setDetailsTransactionId(transactionId);
      // Navegar para a aba de receitas (comissões são receitas)
      setActiveTab('receitas');
    }
  }, [searchParams]);

  // Limpar URL quando fechar a gaveta
  const handleCloseDetails = () => {
    setDetailsTransactionId(null);
    
    // Remover o parâmetro da URL sem reload
    if (searchParams.has('transactionId')) {
      searchParams.delete('transactionId');
      setSearchParams(searchParams, { replace: true });
    }
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
              Controle de despesas e receitas com partidas dobradas
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <ImportTransactionsModal />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="visao-geral" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="despesas" className="gap-2">
            <TrendingDown className="w-4 h-4" />
            Despesas
          </TabsTrigger>
          <TabsTrigger value="receitas" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Receitas
          </TabsTrigger>
          <TabsTrigger value="dre" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            DRE / Relatórios
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="w-4 h-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <VisaoGeral dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="despesas">
          <DespesasTab dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="receitas">
          <ReceitasTab dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="dre">
          <DreTab />
        </TabsContent>

        <TabsContent value="config">
          <ConfiguracoesTab />
        </TabsContent>
      </Tabs>

      {/* Deep Link Details Sheet - independente das abas */}
      <TransactionDetailsSheet 
        transactionId={detailsTransactionId}
        open={!!detailsTransactionId}
        onClose={handleCloseDetails}
      />
    </div>
  );
}
