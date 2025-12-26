import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2,
  ArrowRightLeft 
} from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useRevenueTransactions, useRevenueTotals } from '@/hooks/useFinanceiro';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

interface ReceitasTabProps {
  dateRange: DateRange | undefined;
}

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
  const isMatching = difference < 0.01; // Tolerância de R$ 0,01

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
              <p className="text-sm text-muted-foreground">Legado (Período)</p>
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
              <p className="text-sm text-muted-foreground">Financeiro (Período)</p>
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

function TransactionsList({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data: transactions = [], isLoading } = useRevenueTransactions(startDate, endDate);

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
        <p>Nenhuma receita encontrada no período.</p>
        <p className="text-sm">Sincronize dados do Faturamento na aba Configurações.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2">
        {transactions.map((tx) => (
          <Card key={tx.id} className="bg-card/30 border-border/30 hover:bg-card/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{format(new Date(tx.transaction_date), "dd 'de' MMM", { locale: ptBR })}</span>
                    {tx.account_names && (
                      <>
                        <span>•</span>
                        <Badge variant="secondary" className="text-xs">
                          {tx.account_names}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
                <p className="font-semibold text-emerald-500 ml-4">
                  +{formatCurrency(tx.total_amount)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

export function ReceitasTab({ dateRange }: ReceitasTabProps) {
  const startDate = dateRange?.from 
    ? format(dateRange.from, 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');
  const endDate = dateRange?.to 
    ? format(dateRange.to, 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Receitas</h2>
        <p className="text-sm text-muted-foreground">
          Comparação entre sistema legado e o novo módulo financeiro
        </p>
      </div>

      {/* Comparison Cards */}
      <ComparisonCard startDate={startDate} endDate={endDate} />

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Lançamentos de Receita</CardTitle>
          <CardDescription>
            Transações registradas no módulo Financeiro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionsList startDate={startDate} endDate={endDate} />
        </CardContent>
      </Card>
    </div>
  );
}
