
import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp } from 'lucide-react';
import { DashboardChartsGrid } from './DashboardChartsGrid';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { subDays } from 'date-fns';
import { AppCard } from '@/components/ui/app-card';

export function DashboardController() {
  // Estados centralizados - o controlador manda aqui
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 180),
    // 6 meses atrás
    to: new Date()
  });
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  // Hook com dados filtrados
  const metrics = useDashboardMetrics();
  
  return (
    <div className="space-y-6">
      {/* Painel de Controle - O CHEFE */}
      <AppCard className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-white">
            Controle de Gráficos
          </h2>
          
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            {/* Filtro de Data Global */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/80">Período:</span>
              <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="w-auto" />
            </div>

            {/* Seletor de Tipo de Gráfico de Crescimento */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/80">Crescimento:</span>
              <div className="flex gap-1">
                <Button variant={chartType === 'bar' ? 'default' : 'outline'} size="sm" onClick={() => setChartType('bar')} className="gap-1">
                  <BarChart3 className="w-4 h-4" />
                  Barras
                </Button>
                <Button variant={chartType === 'line' ? 'default' : 'outline'} size="sm" onClick={() => setChartType('line')} className="gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Linha
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AppCard>

      {/* Grid de Gráficos - OS SOLDADOS */}
      <DashboardChartsGrid dateRange={dateRange} chartType={chartType} metrics={metrics} />
    </div>
  );
}
