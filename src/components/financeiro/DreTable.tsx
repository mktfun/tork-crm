import { useMemo, useState } from 'react';
import { FileSpreadsheet, TrendingUp, TrendingDown, Calculator, ChevronDown } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

import { useDreData } from '@/hooks/useFinanceiro';
import { DreRow, DreSummary } from '@/types/financeiro';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function YearSelector({ value, onChange }: { value: number; onChange: (year: number) => void }) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <Select value={value.toString()} onValueChange={(v) => onChange(parseInt(v))}>
      <SelectTrigger className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((year) => (
          <SelectItem key={year} value={year.toString()}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DreTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}

function EmptyDreState() {
  return (
    <div className="text-center py-16">
      <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
      <h3 className="text-lg font-medium mb-2">Nenhum dado disponível</h3>
      <p className="text-muted-foreground max-w-sm mx-auto">
        Ainda não há lançamentos registrados para este período.
        Comece registrando despesas ou marcando comissões como pagas.
      </p>
    </div>
  );
}

interface DreTableProps {
  className?: string;
}

export function DreTable({ className }: DreTableProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { data: rows = [], isLoading } = useDreData(selectedYear);

  // Separar receitas e despesas
  const { revenueRows, expenseRows, summary } = useMemo(() => {
    const revenueRows = rows.filter(r => r.account_type === 'revenue');
    const expenseRows = rows.filter(r => r.account_type === 'expense');

    // Calcular totais por mês
    const sumByMonth = (items: DreRow[], month: typeof MONTHS[number]) => 
      items.reduce((acc, row) => acc + row[month], 0);

    const totalRevenue = revenueRows.reduce((acc, row) => acc + row.total, 0);
    const totalExpense = expenseRows.reduce((acc, row) => acc + row.total, 0);

    const summary: DreSummary & { byMonth: Record<string, { revenue: number; expense: number; net: number }> } = {
      totalRevenue,
      totalExpense,
      netResult: totalRevenue - totalExpense,
      byMonth: MONTHS.reduce((acc, month) => {
        const rev = sumByMonth(revenueRows, month);
        const exp = sumByMonth(expenseRows, month);
        acc[month] = { revenue: rev, expense: exp, net: rev - exp };
        return acc;
      }, {} as Record<string, { revenue: number; expense: number; net: number }>)
    };

    return { revenueRows, expenseRows, summary };
  }, [rows]);

  if (isLoading) {
    return <DreTableSkeleton />;
  }

  const hasData = rows.length > 0;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calculator className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle>Demonstrativo de Resultado (DRE)</CardTitle>
            <CardDescription>Análise de receitas e despesas por período</CardDescription>
          </div>
        </div>
        <YearSelector value={selectedYear} onChange={setSelectedYear} />
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyDreState />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="min-w-[180px] font-semibold">Categoria</TableHead>
                  {MONTH_LABELS.map((label, i) => (
                    <TableHead key={i} className="text-right min-w-[80px] font-medium">
                      {label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[100px] font-semibold bg-muted/50">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* SEÇÃO DE RECEITAS */}
                <TableRow className="bg-emerald-500/5 hover:bg-emerald-500/10">
                  <TableCell colSpan={14} className="font-semibold text-emerald-600 dark:text-emerald-400">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      (+) RECEITAS
                    </div>
                  </TableCell>
                </TableRow>
                {revenueRows.map((row, idx) => (
                  <TableRow key={`rev-${idx}`} className="hover:bg-muted/30">
                    <TableCell className="pl-8 text-muted-foreground">{row.category}</TableCell>
                    {MONTHS.map((month) => (
                      <TableCell key={month} className="text-right tabular-nums">
                        {row[month] > 0 ? formatCurrency(row[month], true) : '-'}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium bg-muted/20 tabular-nums">
                      {formatCurrency(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Subtotal Receitas */}
                <TableRow className="bg-emerald-500/10 border-t-2 border-emerald-500/20">
                  <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                    = Subtotal Receitas
                  </TableCell>
                  {MONTHS.map((month) => (
                    <TableCell key={month} className="text-right font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {summary.byMonth[month].revenue > 0 ? formatCurrency(summary.byMonth[month].revenue, true) : '-'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatCurrency(summary.totalRevenue)}
                  </TableCell>
                </TableRow>

                {/* Espaçador */}
                <TableRow className="h-4 hover:bg-transparent">
                  <TableCell colSpan={14}></TableCell>
                </TableRow>

                {/* SEÇÃO DE DESPESAS */}
                <TableRow className="bg-rose-500/5 hover:bg-rose-500/10">
                  <TableCell colSpan={14} className="font-semibold text-rose-600 dark:text-rose-400">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      (-) DESPESAS
                    </div>
                  </TableCell>
                </TableRow>
                {expenseRows.map((row, idx) => (
                  <TableRow key={`exp-${idx}`} className="hover:bg-muted/30">
                    <TableCell className="pl-8 text-muted-foreground">{row.category}</TableCell>
                    {MONTHS.map((month) => (
                      <TableCell key={month} className="text-right tabular-nums">
                        {row[month] > 0 ? formatCurrency(row[month], true) : '-'}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium bg-muted/20 tabular-nums">
                      {formatCurrency(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Subtotal Despesas */}
                <TableRow className="bg-rose-500/10 border-t-2 border-rose-500/20">
                  <TableCell className="font-semibold text-rose-600 dark:text-rose-400">
                    = Subtotal Despesas
                  </TableCell>
                  {MONTHS.map((month) => (
                    <TableCell key={month} className="text-right font-medium text-rose-600 dark:text-rose-400 tabular-nums">
                      {summary.byMonth[month].expense > 0 ? formatCurrency(summary.byMonth[month].expense, true) : '-'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatCurrency(summary.totalExpense)}
                  </TableCell>
                </TableRow>

                {/* Espaçador */}
                <TableRow className="h-4 hover:bg-transparent">
                  <TableCell colSpan={14}></TableCell>
                </TableRow>

                {/* RESULTADO LÍQUIDO */}
                <TableRow className={`border-t-4 ${summary.netResult >= 0 ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-rose-500/15 border-rose-500/30'}`}>
                  <TableCell className="font-bold text-lg">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      RESULTADO
                      <Badge variant={summary.netResult >= 0 ? 'default' : 'destructive'} className="ml-2">
                        {summary.netResult >= 0 ? 'Lucro' : 'Prejuízo'}
                      </Badge>
                    </div>
                  </TableCell>
                  {MONTHS.map((month) => {
                    const net = summary.byMonth[month].net;
                    return (
                      <TableCell 
                        key={month} 
                        className={`text-right font-semibold tabular-nums ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                      >
                        {net !== 0 ? formatCurrency(net, true) : '-'}
                      </TableCell>
                    );
                  })}
                  <TableCell 
                    className={`text-right font-bold text-lg tabular-nums ${summary.netResult >= 0 ? 'bg-emerald-500/25 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/25 text-rose-600 dark:text-rose-400'}`}
                  >
                    {formatCurrency(summary.netResult)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}