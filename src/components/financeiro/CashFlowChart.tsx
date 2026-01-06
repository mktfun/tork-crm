import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Loader2, Clock } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CashFlowDataPoint } from '@/types/financeiro';
import { parseLocalDate } from '@/utils/dateUtils';

interface CashFlowChartProps {
  data: CashFlowDataPoint[];
  isLoading: boolean;
  granularity?: 'day' | 'month';
  showProjection?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatPeriod(period: string, granularity: 'day' | 'month'): string {
  try {
    if (granularity === 'month') {
      const [year, month] = period.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      return format(date, "MMM 'yy", { locale: ptBR });
    } else {
      // Usar parseLocalDate para evitar problema de timezone
      const date = parseLocalDate(period);
      return format(date, 'dd/MM', { locale: ptBR });
    }
  } catch {
    return period;
  }
}

const CustomTooltip = ({ active, payload, label, granularity }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-foreground mb-2">
        {formatPeriod(label, granularity)}
      </p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function CashFlowChart({ data, isLoading, granularity = 'day', showProjection = false }: CashFlowChartProps) {
  const chartData = useMemo(() => {
    return data.map(point => {
      // Suportar tanto o formato antigo quanto o novo com projeção
      const pendingIncome = (point as any).pending_income ?? 0;
      const pendingExpense = (point as any).pending_expense ?? 0;
      
      return {
        ...point,
        formattedPeriod: formatPeriod(point.period, granularity),
        // Projeção = realizado + pendentes
        projectedIncome: point.income + pendingIncome,
        projectedExpense: point.expense + pendingExpense
      };
    });
  }, [data, granularity]);

  const hasData = chartData.length > 0;
  const hasProjectionData = chartData.some(p => p.projectedIncome > p.income || p.projectedExpense > p.expense);
  
  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, point) => ({
        income: acc.income + point.income,
        expense: acc.expense + point.expense,
        projectedIncome: acc.projectedIncome + point.projectedIncome,
        projectedExpense: acc.projectedExpense + point.projectedExpense
      }),
      { income: 0, expense: 0, projectedIncome: 0, projectedExpense: 0 }
    );
  }, [chartData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Caixa</CardTitle>
          <CardDescription>Evolução de receitas e despesas</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[350px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Fluxo de Caixa</CardTitle>
            <CardDescription>Evolução de receitas e despesas</CardDescription>
          </div>
          {hasData && (
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Receitas:</span>
                <span className="text-sm font-semibold text-emerald-500">
                  {formatCurrency(totals.income)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                <span className="text-sm text-muted-foreground">Despesas:</span>
                <span className="text-sm font-semibold text-rose-500">
                  {formatCurrency(totals.expense)}
                </span>
              </div>
              {hasProjectionData && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">Projeção:</span>
                  <span className="text-sm font-semibold text-amber-500">
                    {formatCurrency(totals.projectedIncome - totals.projectedExpense)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <TrendingUp className="w-12 h-12 mb-4 opacity-50" />
            <p>Nenhum dado disponível para o período.</p>
            <p className="text-sm">Registre despesas ou marque comissões como pagas.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="formattedPeriod" 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => formatCurrency(value)}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={80}
              />
              <Tooltip content={<CustomTooltip granularity={granularity} />} />
              <Legend 
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) => (
                  <span className="text-sm text-muted-foreground">{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="income"
                name="Receitas"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                fill="url(#colorIncome)"
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Despesas"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#colorExpense)"
              />
              {/* Linhas de projeção tracejadas */}
              {hasProjectionData && (
                <>
                  <Line
                    type="monotone"
                    dataKey="projectedIncome"
                    name="Receita Projetada"
                    stroke="hsl(142, 76%, 36%)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="projectedExpense"
                    name="Despesa Projetada"
                    stroke="hsl(0, 84%, 60%)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
