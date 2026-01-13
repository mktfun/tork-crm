import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  TrendingUp, 
  TrendingDown, 
  Loader2, 
  AlertTriangle,
  Wallet
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ProjectedCashFlowPoint } from '@/types/recurring';
import { parseLocalDate } from '@/utils/dateUtils';

interface ProjectedCashFlowChartProps {
  data: ProjectedCashFlowPoint[];
  isLoading: boolean;
  granularity?: 'day' | 'week' | 'month';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;

  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg min-w-[220px]">
      <p className="text-sm font-medium text-foreground mb-3 border-b pb-2">
        {data?.period || label}
      </p>
      <div className="space-y-2">
        {/* Realizado */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Realizado</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-500">Receitas</span>
            <span className="text-xs font-medium">{formatCurrency(data?.realized_income || 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-rose-500">Despesas</span>
            <span className="text-xs font-medium">{formatCurrency(data?.realized_expense || 0)}</span>
          </div>
        </div>
        {/* Projetado */}
        <div className="space-y-1 pt-2 border-t">
          <p className="text-xs text-muted-foreground font-medium">Projetado</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-400">Receitas</span>
            <span className="text-xs font-medium">{formatCurrency(data?.projected_income || 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-rose-400">Despesas</span>
            <span className="text-xs font-medium">{formatCurrency(data?.projected_expense || 0)}</span>
          </div>
        </div>
        {/* Saldo */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-primary font-medium">Saldo Projetado</span>
            <span className={`text-sm font-bold ${(data?.running_balance || 0) < 0 ? 'text-rose-500' : 'text-primary'}`}>
              {formatCurrency(data?.running_balance || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export function ProjectedCashFlowChart({ 
  data, 
  isLoading, 
  granularity = 'day' 
}: ProjectedCashFlowChartProps) {
  const chartData = useMemo(() => {
    return data.map(point => ({
      ...point,
      // Total de receitas e despesas para as barras
      totalIncome: point.realized_income + point.projected_income,
      totalExpense: point.realized_expense + point.projected_expense,
    }));
  }, [data]);

  const hasData = chartData.length > 0;
  
  // Calcular totais e verificar déficits
  const analysis = useMemo(() => {
    if (!hasData) return null;

    const minBalance = Math.min(...chartData.map(p => p.running_balance));
    const maxBalance = Math.max(...chartData.map(p => p.running_balance));
    const finalBalance = chartData[chartData.length - 1]?.running_balance || 0;
    const hasDeficit = minBalance < 0;
    const deficitPeriod = hasDeficit 
      ? chartData.find(p => p.running_balance < 0)?.period 
      : null;

    const totalProjectedIncome = chartData.reduce((sum, p) => sum + p.projected_income, 0);
    const totalProjectedExpense = chartData.reduce((sum, p) => sum + p.projected_expense, 0);
    const totalRealizedIncome = chartData.reduce((sum, p) => sum + p.realized_income, 0);
    const totalRealizedExpense = chartData.reduce((sum, p) => sum + p.realized_expense, 0);

    return {
      minBalance,
      maxBalance,
      finalBalance,
      hasDeficit,
      deficitPeriod,
      totalProjectedIncome,
      totalProjectedExpense,
      totalRealizedIncome,
      totalRealizedExpense,
    };
  }, [chartData, hasData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Projeção de Tesouraria
          </CardTitle>
          <CardDescription>Ponte de Caixa com Recorrências</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px]">
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
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Projeção de Tesouraria
            </CardTitle>
            <CardDescription>
              Ponte de caixa com receitas pendentes e despesas recorrentes
            </CardDescription>
          </div>
          {hasData && analysis && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Projetado:</span>
                <span className="text-sm font-semibold text-emerald-500">
                  {formatCurrency(analysis.totalProjectedIncome)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                <span className="text-xs text-muted-foreground">Projetado:</span>
                <span className="text-sm font-semibold text-rose-500">
                  {formatCurrency(analysis.totalProjectedExpense)}
                </span>
              </div>
              <Badge 
                variant={analysis.finalBalance >= 0 ? 'default' : 'destructive'}
                className="gap-1"
              >
                <Wallet className="w-3 h-3" />
                Saldo Final: {formatCurrency(analysis.finalBalance)}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Alerta de Déficit */}
        {analysis?.hasDeficit && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Projeção de Déficit</AlertTitle>
            <AlertDescription>
              Saldo projetado ficará negativo em <strong>{analysis.deficitPeriod}</strong>.
              Considere antecipar recebimentos ou postergar pagamentos.
            </AlertDescription>
          </Alert>
        )}

        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
            <Wallet className="w-12 h-12 mb-4 opacity-50" />
            <p>Nenhum dado disponível para o período.</p>
            <p className="text-sm">Configure receitas pendentes ou despesas recorrentes.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              
              <YAxis 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => formatCurrency(value)}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={90}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              <Legend 
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />

              {/* Linha de referência zero */}
              <ReferenceLine 
                y={0} 
                stroke="hsl(var(--destructive))" 
                strokeDasharray="5 5" 
                strokeWidth={1.5}
                label={{
                  value: 'Zona Crítica',
                  position: 'right',
                  fill: 'hsl(var(--destructive))',
                  fontSize: 10,
                }}
              />

              {/* Barras de Receitas (verde) */}
              <Bar 
                dataKey="totalIncome" 
                name="Receitas" 
                fill="hsl(142, 76%, 36%)"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />

              {/* Barras de Despesas (vermelho) */}
              <Bar 
                dataKey="totalExpense" 
                name="Despesas" 
                fill="hsl(0, 84%, 60%)"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />

              {/* Linha de Saldo Acumulado */}
              <Line
                type="monotone"
                dataKey="running_balance"
                name="Saldo Projetado"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
