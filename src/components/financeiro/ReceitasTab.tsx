import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowRightLeft,
  Check,
  Lock,
  Info
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { NovaReceitaModal } from './NovaReceitaModal';
import { TransactionDetailsSheet } from './TransactionDetailsSheet';
import { 
  useRevenueTransactions, 
  useBulkConfirmReceipts 
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
      </div>
    );
  }

  // Filtrar transações que podem ser selecionadas (não confirmadas E não sincronizadas)
  // Transações sincronizadas (legacy_status não nulo) não podem ser selecionadas manualmente
  const selectableTransactions = transactions.filter(tx => !tx.is_confirmed);
  const allSelectableSelected = selectableTransactions.length > 0 && 
    selectableTransactions.every(tx => selectedIds.has(tx.id));

  const handleSelectAllSelectable = (checked: boolean) => {
    onSelectAll(checked);
  };

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox 
                checked={allSelectableSelected}
                onCheckedChange={(checked) => handleSelectAllSelectable(!!checked)}
                disabled={selectableTransactions.length === 0}
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
            const isConfirmed = tx.is_confirmed;
            // Transação sincronizada do legado (vinda de apólice)
            const isSynchronized = tx.legacy_status !== null;
            
            // Parse date correctly using local date helper
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
                    <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                      Confirmado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-500/30">
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

  // Filtrar apenas transações que podem ser selecionadas (não confirmadas e não sincronizadas)
  const selectableTransactions = transactions.filter(tx => !tx.is_confirmed && tx.legacy_status === null);

  const handleToggleSelect = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    // Não permite selecionar se confirmada ou sincronizada
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

  const handleBulkConfirm = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const result = await bulkConfirm.mutateAsync(Array.from(selectedIds));
      
      if (result.confirmedCount > 0) {
        toast.success(`${result.confirmedCount} receita(s) confirmada(s) com sucesso!`);
      } else {
        toast.info('Nenhuma receita foi confirmada.');
      }
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error('Erro ao confirmar receitas:', error);
      toast.error(error.message || 'Erro ao confirmar receitas');
    }
  };

  // Contar transações sincronizadas para info
  const syncedCount = transactions.filter(tx => tx.legacy_status !== null && !tx.is_confirmed).length;

  return (
    <div className="space-y-6">
      {/* Header com Ações */}
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

      {/* Info sobre transações sincronizadas */}
      {syncedCount > 0 && (
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
        isLegacyId={false}
        open={!!detailsId}
        onClose={() => setDetailsId(null)}
      />
    </div>
  );
}