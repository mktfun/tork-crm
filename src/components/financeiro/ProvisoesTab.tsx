import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { 
  BarChart3, 
  Calendar,
  Filter
} from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

import { ProjectedCashFlowChart } from './ProjectedCashFlowChart';
import { RecurringConfigsList } from './RecurringConfigsList';
import { useProjectedCashFlow } from '@/hooks/useRecurringConfigs';

interface ProvisoesTabProps {
  dateRange?: DateRange;
}

type GranularityOption = 'day' | 'week' | 'month';

export function ProvisoesTab({ dateRange }: ProvisoesTabProps) {
  const [granularity, setGranularity] = useState<GranularityOption>('day');
  const [horizonMonths, setHorizonMonths] = useState(3);

  // Calcular período de projeção
  const projectionPeriod = useMemo(() => {
    const start = dateRange?.from || new Date();
    const end = dateRange?.to || addMonths(new Date(), horizonMonths);
    
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    };
  }, [dateRange, horizonMonths]);

  const { 
    data: projectionData = [], 
    isLoading: projectionLoading 
  } = useProjectedCashFlow(
    projectionPeriod.startDate,
    projectionPeriod.endDate,
    granularity
  );

  return (
    <div className="space-y-6">
      {/* Header com Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Provisões e Projeções
          </h2>
          <p className="text-sm text-muted-foreground">
            Visualize o fluxo de caixa futuro com despesas recorrentes e receitas pendentes
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Horizonte de Projeção */}
          <div className="flex items-center gap-2">
            <Label htmlFor="horizon" className="text-sm whitespace-nowrap">
              <Calendar className="w-4 h-4 inline mr-1" />
              Horizonte:
            </Label>
            <Select 
              value={String(horizonMonths)} 
              onValueChange={(v) => setHorizonMonths(Number(v))}
            >
              <SelectTrigger id="horizon" className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mês</SelectItem>
                <SelectItem value="3">3 meses</SelectItem>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Granularidade */}
          <div className="flex items-center gap-2">
            <Label htmlFor="granularity" className="text-sm whitespace-nowrap">
              <Filter className="w-4 h-4 inline mr-1" />
              Agrupar:
            </Label>
            <Select 
              value={granularity} 
              onValueChange={(v) => setGranularity(v as GranularityOption)}
            >
              <SelectTrigger id="granularity" className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Por Dia</SelectItem>
                <SelectItem value="week">Por Semana</SelectItem>
                <SelectItem value="month">Por Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Gráfico de Ponte de Caixa */}
      <ProjectedCashFlowChart
        data={projectionData}
        isLoading={projectionLoading}
        granularity={granularity}
      />

      {/* Lista de Configurações Recorrentes */}
      <RecurringConfigsList />
    </div>
  );
}
