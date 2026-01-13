import { useState, useMemo } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowRightLeft,
  Check,
  Lock,
  Info,
  Clock,
  TrendingUp
} from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { NovaReceitaModal } from './NovaReceitaModal';
import { TransactionDetailsSheet } from './TransactionDetailsSheet';
import { SettleTransactionModal } from './SettleTransactionModal';
import { 
  useRevenueTransactions,
  useFinancialSummary
} from '@/hooks/useFinanceiro';
import { parseLocalDate } from '@/utils/dateUtils';

function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

interface ReceitasTabProps {
  dateRange: DateRange | undefined;
}

// ============ KPI CARD INTERNO ============

interface KpiProps {
  title: string;
  value: number;
  variant: 'success' | 'warning';
  icon: React.ElementType;
}

function KpiCard({ title, value, variant, icon: Icon }: KpiProps) {
  const styles = {
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-600'
  };
  const iconStyles = {
    success: 'bg-emerald-500/20 text-emerald-500',
    warning: 'bg-amber-500/20 text-amber-500'
  };

  return (
    <Card className={cn('border', styles[variant])}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', iconStyles[variant])}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-lg font-bold">{formatCurrency(value)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ TRANSACTIONS TABLE ============

interface TransactionsTableProps {
  transactions: Array<{
    id: string;
    transaction_date: string | null;
    description: string;
    client_name?: string | null;
    account_name?: string | null;
    amount: number | null;
    is_confirmed: boolean;
    legacy_status: string | null;
    related_entity_id?: string | null;
    related_entity_type?: string | null;
  }>;
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onViewDetails: (id: string) => void;
  viewMode: 'efetivado' | 'a_receber';
}

function TransactionsTable({ 
  transactions,
  isLoading,
  selectedIds, 
  onToggleSelect, 
  onSelectAll,
  onViewDetails,
  viewMode
}: TransactionsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>
          {viewMode === 'efetivado' 
            ? 'Nenhuma receita confirmada no período.'
            : 'Nenhuma receita pendente.'}
        </p>
      </div>
    );
  }

  // Filtrar transações que podem ser selecionadas (não confirmadas E não sincronizadas)
  const selectableTransactions = transactions.filter(tx => !tx.is_confirmed && tx.legacy_status === null);
  const allSelectableSelected = selectableTransactions.length > 0 && 
    selectableTransactions.every(tx => selectedIds.has(tx.id));

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            {viewMode === 'a_receber' && (
              <TableHead className="w-10">
                <Checkbox 
                  checked={allSelectableSelected}
                  onCheckedChange={(checked) => onSelectAll(!!checked)}
                  disabled={selectableTransactions.length === 0}
                />
              </TableHead>
            )}
            <TableHead className="w-24">Data</TableHead>
            <TableHead className="min-w-[280px]">Descrição</TableHead>
            <TableHead className="w-40">Categoria</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="text-right w-32">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            const isConfirmed = tx.is_confirmed;
            const isSynchronized = tx.legacy_status !== null;
            
            const displayDate = tx.transaction_date 
              ? format(parseLocalDate(String(tx.transaction_date)), 'dd/MM', { locale: ptBR })
              : '-';
            
            return (
              <TableRow 
                key={tx.id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50",
                  isConfirmed && "opacity-60"
                )}
                onClick={() => onViewDetails(tx.id)}
              >
                {viewMode === 'a_receber' && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isSynchronized && !isConfirmed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center w-4 h-4">
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p className="font-medium">Transação Sincronizada</p>
                          <p className="text-xs text-muted-foreground">
                            Alterações devem ser feitas na Apólice
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Checkbox 
                        checked={selectedIds.has(tx.id)}
                        onCheckedChange={() => onToggleSelect(tx.id)}
                        disabled={isConfirmed}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell className="font-mono text-sm">
                  {displayDate}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="whitespace-normal break-words">
                        {tx.description}
                      </span>
                      {isSynchronized && (
                        <Badge variant="outline" className="text-xs gap-1 flex-shrink-0">
                          <Lock className="w-2.5 h-2.5" />
                          Sync
                        </Badge>
                      )}
                    </div>
                    {tx.client_name && (
                      <span className="text-xs text-muted-foreground">
                        {tx.client_name}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {tx.account_name && (
                    <Badge variant="secondary" className="text-xs truncate max-w-[120px]">
                      {tx.account_name}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {isConfirmed ? (
                    <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 gap-1">
                      <Check className="w-3 h-3" />
                      Confirmado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1">
                      <Clock className="w-3 h-3" />
                      Pendente
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold text-emerald-500">
                  +{formatCurrency(tx.amount)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}

// ============ MAIN COMPONENT ============

export function ReceitasTab({ dateRange }: ReceitasTabProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'efetivado' | 'a_receber'>('efetivado');
  const [settleModalOpen, setSettleModalOpen] = useState(false);

  // Datas normalizadas
  const { startDate, endDate } = useMemo(() => {
    const from = dateRange?.from || new Date();
    const to = dateRange?.to || new Date();
    return {
      startDate: format(startOfDay(from), 'yyyy-MM-dd'),
      endDate: format(endOfDay(to), 'yyyy-MM-dd')
    };
  }, [dateRange]);

  // Transações do período (para aba Efetivado)
  const { data: periodTransactions = [], isLoading: loadingPeriod } = useRevenueTransactions(startDate, endDate);
  
  // TODAS as transações pendentes (para aba A Receber) - sem filtro de data
  const { data: allHistoricalTransactions = [], isLoading: loadingAll } = useRevenueTransactions('2000-01-01', '2100-12-31');
  
  const { data: summary } = useFinancialSummary(startDate, endDate);

  // Transações a exibir conforme a aba selecionada
  const displayTransactions = useMemo(() => {
    if (viewMode === 'a_receber') {
      // Aba "A Receber": mostrar TODAS as pendentes (sem filtro de data)
      return allHistoricalTransactions.filter(tx => !tx.is_confirmed);
    } else {
      // Aba "Efetivado": mostrar confirmadas do período
      return periodTransactions.filter(tx => tx.is_confirmed);
    }
  }, [viewMode, periodTransactions, allHistoricalTransactions]);

  const isLoading = viewMode === 'a_receber' ? loadingAll : loadingPeriod;

  // Calcular KPIs
  const kpis = useMemo(() => {
    const confirmadas = periodTransactions.filter(tx => tx.is_confirmed);
    
    return {
      recebido: confirmadas.reduce((sum, tx) => sum + (tx.amount || 0), 0),
      // Usa o total histórico do summary (sem filtro de data)
      aReceber: summary?.pendingIncome ?? 0
    };
  }, [periodTransactions, summary]);

  // Filtrar transações que podem ser selecionadas (pendentes na aba atual)
  const selectableTransactions = displayTransactions.filter(tx => !tx.is_confirmed && tx.legacy_status === null);

  const handleToggleSelect = (id: string) => {
    const tx = displayTransactions.find(t => t.id === id);
    if (tx?.is_confirmed || tx?.legacy_status !== null) return;
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(selectableTransactions.map(tx => tx.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleOpenSettleModal = () => {
    if (selectedIds.size === 0) return;
    setSettleModalOpen(true);
  };

  const handleSettleSuccess = () => {
    setSelectedIds(new Set());
  };

  // Calcular valor total selecionado
  const selectedTotalAmount = useMemo(() => {
    return displayTransactions
      .filter(tx => selectedIds.has(tx.id))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [displayTransactions, selectedIds]);

  // Contar transações sincronizadas para info
  const syncedCount = displayTransactions.filter(tx => tx.legacy_status !== null && !tx.is_confirmed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Receitas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie suas entradas financeiras
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NovaReceitaModal />
        </div>
      </div>

      {/* Toggle + KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(val) => val && setViewMode(val as 'efetivado' | 'a_receber')}
          className="bg-muted/50 p-1 rounded-lg"
        >
          <ToggleGroupItem value="efetivado" className="gap-2 data-[state=on]:bg-background">
            <Check className="w-4 h-4" />
            Efetivado
          </ToggleGroupItem>
          <ToggleGroupItem value="a_receber" className="gap-2 data-[state=on]:bg-background">
            <Clock className="w-4 h-4" />
            A Receber
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex-1 grid grid-cols-2 gap-3">
          <KpiCard title="Recebido no Período" value={kpis.recebido} variant="success" icon={Check} />
          <KpiCard title="Previsão a Receber" value={kpis.aReceber} variant="warning" icon={Clock} />
        </div>
      </div>

      {/* Info sobre transações sincronizadas */}
      {syncedCount > 0 && viewMode === 'a_receber' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">
            {syncedCount} transação(ões) sincronizada(s) com apólices. 
            Para alterá-las, edite diretamente na apólice correspondente.
          </span>
        </div>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>
              {viewMode === 'efetivado' ? 'Receitas Confirmadas' : 'Receitas Pendentes'}
            </CardTitle>
            <CardDescription>
              {viewMode === 'efetivado' 
                ? 'Transações já recebidas no período'
                : 'Previsões de recebimento'}
            </CardDescription>
          </div>
          
          {/* Batch Action Button */}
          {viewMode === 'a_receber' && selectedIds.size > 0 && (
            <Button 
              onClick={handleOpenSettleModal}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="w-4 h-4" />
              Confirmar Recebimento ({selectedIds.size})
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <TransactionsTable 
              transactions={displayTransactions}
              isLoading={isLoading}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onViewDetails={(id) => setDetailsId(id)}
              viewMode={viewMode}
            />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Details Sheet */}
      <TransactionDetailsSheet 
        transactionId={detailsId}
        isLegacyId={false}
        open={!!detailsId}
        onClose={() => setDetailsId(null)}
      />

      {/* Settle Modal */}
      <SettleTransactionModal
        open={settleModalOpen}
        onClose={() => setSettleModalOpen(false)}
        transactionIds={
          // Usar related_entity_id (ID legado) para comissões, pois a RPC busca na tabela transactions
          (() => {
            const ids = Array.from(selectedIds).map(id => {
              const tx = displayTransactions.find(t => t.id === id);
              console.log('🔍 SETTLE - Transação encontrada:', {
                selectedId: id,
                txEncontrada: !!tx,
                related_entity_id: tx?.related_entity_id,
                related_entity_type: tx?.related_entity_type,
                idQueSeraUsado: tx?.related_entity_id || id
              });
              // Se for uma comissão (has related_entity_id), usar o ID legado
              return tx?.related_entity_id || id;
            });
            console.log('🔍 SETTLE - IDs finais para modal:', ids);
            return ids;
          })()
        }
        totalAmount={selectedTotalAmount}
        onSuccess={handleSettleSuccess}
      />
    </div>
  );
}
