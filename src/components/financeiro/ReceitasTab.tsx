import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2,
  ArrowRightLeft,
  Check
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { NovaReceitaModal } from './NovaReceitaModal';
import { TransactionDetailsSheet } from './TransactionDetailsSheet';
import { 
  useRevenueTransactions, 
  useRevenueTotals,
  useBulkConfirmReceipts 
} from '@/hooks/useFinanceiro';

// Helper para verificar se está pago
function isPaidStatus(status: string | null): boolean {
  if (!status) return false;
  const upperStatus = status.toUpperCase();
  return upperStatus === 'PAGO' || upperStatus === 'REALIZADO';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

interface ReceitasTabProps {
  dateRange: DateRange | undefined;
}

// ============ COMPARISON CARD ============

function ComparisonCard({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data: totals, isLoading } = useRevenueTotals(startDate, endDate);
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const financialTotal = totals?.financialTotal ?? 0;
  const legacyTotal = totals?.legacyTotal ?? 0;
  const difference = Math.abs(financialTotal - legacyTotal);
  const isMatching = difference < 0.01;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Legado */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Faturamento (Legado)</p>
              <p className="text-xl font-bold text-blue-500">
                {formatCurrency(legacyTotal)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financeiro */}
      <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Financeiro (Novo)</p>
              <p className="text-xl font-bold text-emerald-500">
                {formatCurrency(financialTotal)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <Card className={`bg-gradient-to-br ${
        isMatching 
          ? 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' 
          : 'from-amber-500/10 to-amber-600/5 border-amber-500/20'
      }`}>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isMatching ? 'bg-emerald-500/20' : 'bg-amber-500/20'
            }`}>
              {isMatching ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              {isMatching ? (
                <p className="text-lg font-bold text-emerald-500">Batendo!</p>
              ) : (
                <div>
                  <p className="text-sm font-medium text-amber-500">Diferença</p>
                  <p className="text-lg font-bold text-amber-500">
                    {formatCurrency(difference)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ TRANSACTIONS TABLE ============

interface TransactionsTableProps {
  startDate: string;
  endDate: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onViewDetails: (id: string) => void;
}

function TransactionsTable({ 
  startDate, 
  endDate, 
  selectedIds, 
  onToggleSelect, 
  onSelectAll,
  onViewDetails 
}: TransactionsTableProps) {
  const { data: transactions = [], isLoading } = useRevenueTransactions(startDate, endDate);

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
        <p>Nenhuma receita encontrada no período.</p>
        <p className="text-sm">Sincronize dados do Faturamento na aba Configurações.</p>
      </div>
    );
  }

  // Filtrar apenas transações pendentes para seleção
  const pendingTransactions = transactions.filter(tx => !isPaidStatus(tx.legacy_status));
  const allPendingSelected = pendingTransactions.length > 0 && 
    pendingTransactions.every(tx => selectedIds.has(tx.id));

  const handleSelectAllPending = (checked: boolean) => {
    if (checked) {
      // Seleciona apenas os que NÃO estão pagos
      onSelectAll(true);
    } else {
      onSelectAll(false);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox 
              checked={allPendingSelected}
              onCheckedChange={(checked) => handleSelectAllPending(!!checked)}
              disabled={pendingTransactions.length === 0}
            />
          </TableHead>
          <TableHead className="w-24">Data</TableHead>
          <TableHead className="min-w-[280px]">Descrição</TableHead>
          <TableHead className="w-40">Categoria</TableHead>
          <TableHead className="w-24">Status</TableHead>
          <TableHead className="text-right w-32">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => {
          const isPaid = isPaidStatus(tx.legacy_status);
          
          return (
            <TableRow 
              key={tx.id}
              className={cn(
                "cursor-pointer hover:bg-muted/50",
                isPaid && "opacity-60"
              )}
              onClick={() => onViewDetails(tx.id)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox 
                  checked={selectedIds.has(tx.id)}
                  onCheckedChange={() => onToggleSelect(tx.id)}
                  disabled={isPaid}
                />
              </TableCell>
              <TableCell className="font-mono text-sm">
                {format(new Date(tx.transaction_date), 'dd/MM', { locale: ptBR })}
              </TableCell>
              <TableCell>
                <span className="whitespace-normal break-words">
                  {tx.description}
                </span>
              </TableCell>
              <TableCell>
                {tx.account_names && (
                  <Badge variant="secondary" className="text-xs truncate max-w-[120px]">
                    {tx.account_names}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {isPaid ? (
                  <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                    Pago
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                    Pendente
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right font-semibold text-emerald-500">
                +{formatCurrency(tx.total_amount)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ============ MAIN COMPONENT ============

export function ReceitasTab({ dateRange }: ReceitasTabProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailsId, setDetailsId] = useState<string | null>(null);
  
  const bulkConfirm = useBulkConfirmReceipts();
  const { data: transactions = [] } = useRevenueTransactions(
    dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );

  const startDate = dateRange?.from 
    ? format(dateRange.from, 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');
  const endDate = dateRange?.to 
    ? format(dateRange.to, 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');

  // Filtrar apenas transações pendentes para a lógica de seleção
  const pendingTransactions = transactions.filter(tx => !isPaidStatus(tx.legacy_status));

  const handleToggleSelect = (id: string) => {
    // Verificar se a transação é pendente antes de permitir seleção
    const tx = transactions.find(t => t.id === id);
    if (tx && isPaidStatus(tx.legacy_status)) return;
    
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
      // Seleciona apenas os que NÃO estão pagos
      setSelectedIds(new Set(pendingTransactions.map(tx => tx.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkConfirm = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const result = await bulkConfirm.mutateAsync(Array.from(selectedIds));
      toast.success(`${result.confirmedCount} receita(s) confirmada(s) com sucesso!`);
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error('Erro ao confirmar receitas:', error);
      toast.error(error.message || 'Erro ao confirmar receitas');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Receitas</h2>
          <p className="text-sm text-muted-foreground">
            Comparação entre sistema legado e o novo módulo financeiro
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NovaReceitaModal />
        </div>
      </div>

      {/* Comparison Cards */}
      <ComparisonCard startDate={startDate} endDate={endDate} />

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Lançamentos de Receita</CardTitle>
            <CardDescription>
              Transações registradas no módulo Financeiro
            </CardDescription>
          </div>
          
          {/* Batch Action Button */}
          {selectedIds.size > 0 && (
            <Button 
              onClick={handleBulkConfirm}
              disabled={bulkConfirm.isPending}
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
              startDate={startDate}
              endDate={endDate}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onViewDetails={(id) => setDetailsId(id)}
            />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Details Sheet */}
      <TransactionDetailsSheet 
        transactionId={detailsId}
        open={!!detailsId}
        onClose={() => setDetailsId(null)}
      />
    </div>
  );
}
