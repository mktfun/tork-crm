import { useState, useMemo } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { 
  TrendingDown, 
  Clock,
  Check,
  ArrowRightLeft
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { NovaDespesaModal } from './NovaDespesaModal';
import { TransactionDetailsSheet } from './TransactionDetailsSheet';
import { useRecentTransactions } from '@/hooks/useFinanceiro';
import { parseLocalDate } from '@/utils/dateUtils';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

interface DespesasTabProps {
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

export function DespesasTab({ dateRange }: DespesasTabProps) {
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'efetivado' | 'a_pagar'>('efetivado');
  
  const { data: transactions = [], isLoading } = useRecentTransactions('expense');

  // Calcular datas normalizadas
  const { startDate, endDate } = useMemo(() => {
    const from = dateRange?.from || new Date();
    const to = dateRange?.to || new Date();
    return {
      startDate: format(startOfDay(from), 'yyyy-MM-dd'),
      endDate: format(endOfDay(to), 'yyyy-MM-dd')
    };
  }, [dateRange]);

  // Filtrar transações por status
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // is_void indica transação anulada, reference_number com PAID = pago
      const isPaid = tx.reference_number?.includes('PAID') || tx.is_void === false;
      
      if (viewMode === 'efetivado') {
        return isPaid;
      } else {
        return !isPaid;
      }
    });
  }, [transactions, viewMode]);

  // Calcular KPIs
  const kpis = useMemo(() => {
    const efetivadas = transactions.filter(tx => tx.reference_number?.includes('PAID') || tx.is_void === false);
    const pendentes = transactions.filter(tx => !(tx.reference_number?.includes('PAID') || tx.is_void === false));
    
    return {
      pago: efetivadas.reduce((sum, tx) => sum + Math.abs(tx.total_amount), 0),
      aPagar: pendentes.reduce((sum, tx) => sum + Math.abs(tx.total_amount), 0)
    };
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Despesas</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie suas saídas financeiras
          </p>
        </div>
        <NovaDespesaModal />
      </div>

      {/* Toggle + KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(val) => val && setViewMode(val as 'efetivado' | 'a_pagar')}
          className="bg-muted/50 p-1 rounded-lg"
        >
          <ToggleGroupItem value="efetivado" className="gap-2 data-[state=on]:bg-background">
            <Check className="w-4 h-4" />
            Efetivado
          </ToggleGroupItem>
          <ToggleGroupItem value="a_pagar" className="gap-2 data-[state=on]:bg-background">
            <Clock className="w-4 h-4" />
            A Pagar
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex-1 grid grid-cols-2 gap-3">
          <KpiCard title="Pago no Período" value={kpis.pago} variant="success" icon={Check} />
          <KpiCard title="Previsão a Pagar" value={kpis.aPagar} variant="warning" icon={Clock} />
        </div>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {viewMode === 'efetivado' ? 'Despesas Pagas' : 'Despesas Pendentes'}
          </CardTitle>
          <CardDescription>
            {viewMode === 'efetivado' 
              ? 'Transações já liquidadas no período'
              : 'Previsões de pagamento'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>
                {viewMode === 'efetivado' 
                  ? 'Nenhuma despesa paga no período.'
                  : 'Nenhuma despesa pendente.'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredTransactions.map((tx) => {
                  const txDate = parseLocalDate(String(tx.transaction_date));
                  const isPending = !(tx.reference_number?.includes('PAID') || tx.is_void === false);
                  
                  return (
                    <Card 
                      key={tx.id} 
                      className={cn(
                        "bg-card/30 border-border/30 cursor-pointer hover:bg-muted/50 transition-colors",
                        isPending && "border-l-2 border-l-amber-500"
                      )}
                      onClick={() => setDetailsId(tx.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{tx.description}</p>
                              {isPending && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 flex-shrink-0 gap-1">
                                  <Clock className="w-3 h-3" />
                                  Pendente
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(txDate, "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          <p className="font-semibold text-rose-500 flex-shrink-0 ml-2">
                            - {formatCurrency(Math.abs(tx.total_amount))}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
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
