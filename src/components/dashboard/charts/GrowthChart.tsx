import { useState, useMemo } from 'react';
import { AppCard } from '@/components/ui/app-card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DateRange } from 'react-day-picker';
import { ChartInsight } from './ChartInsight';
import { TrendingUp, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { format, differenceInDays } from 'date-fns';

interface GrowthData {
  month: string;
  novas: number;
  renovadas: number;
}

interface GrowthChartProps {
  data: GrowthData[];
  type?: 'bar' | 'line';
  dateRange?: DateRange;
  insight: string;
}

export function GrowthChart({ data, type: initialType = 'bar', dateRange, insight }: GrowthChartProps) {
  const [chartType, setChartType] = useState<'bar' | 'line'>(initialType);

  // Determinar o tipo de período baseado no dateRange
  const periodType = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 'Mensal';
    
    const diasDiferenca = differenceInDays(dateRange.to, dateRange.from);
    return diasDiferenca <= 90 ? 'Diário' : 'Mensal';
  }, [dateRange]);

  // Verificar se há dados para exibir
  const hasData = data && data.length > 0;
  const totalData = hasData ? data.reduce((sum, item) => sum + item.novas + item.renovadas, 0) : 0;

  // Tooltip customizado com melhor contraste
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900/95 backdrop-blur-sm p-3 border border-gray-700 rounded-lg shadow-lg">
          <p className="font-semibold text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm text-gray-200">
              <span className="font-medium" style={{ color: entry.color }}>
                {entry.dataKey === 'novas' ? 'Novas' : 'Renovadas'}:
              </span> {entry.value} apólices
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (chartType === 'line') {
      return (
        <LineChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }}
            stroke="rgba(255,255,255,0.3)"
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }}
            stroke="rgba(255,255,255,0.3)"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}
          />
          <Line 
            type="monotone" 
            dataKey="novas" 
            stroke="#3b82f6" 
            name="Novas Apólices"
            strokeWidth={3}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="renovadas" 
            stroke="#10b981" 
            name="Apólices Renovadas"
            strokeWidth={3}
            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      );
    }

    return (
      <BarChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis 
          dataKey="month" 
          tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }}
          stroke="rgba(255,255,255,0.3)"
        />
        <YAxis 
          tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.8)' }}
          stroke="rgba(255,255,255,0.3)"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}
        />
        <Bar 
          dataKey="novas" 
          fill="#3b82f6" 
          name="Novas Apólices"
          radius={[2, 2, 0, 0]}
        />
        <Bar 
          dataKey="renovadas" 
          fill="#10b981" 
          name="Apólices Renovadas"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    );
  };

  // Estado de carregamento ou sem dados
  if (!hasData || totalData === 0) {
    return (
      <AppCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">
            Crescimento {periodType} - Novas vs Renovadas
          </h3>
        </div>
        
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <h4 className="text-lg font-semibold text-white mb-2">
              Nenhum dado encontrado
            </h4>
            <p className="text-gray-400 text-sm max-w-md">
              {dateRange?.from && dateRange?.to 
                ? 'Não há apólices criadas no período selecionado. Tente selecionar um período diferente.'
                : 'Ainda não há apólices criadas. Comece criando suas primeiras apólices para ver os dados aqui.'
              }
            </p>
          </div>
        </div>
        
        <ChartInsight icon={TrendingUp} text={insight} />
      </AppCard>
    );
  }

  return (
    <AppCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          Crescimento {periodType} - Novas vs Renovadas
        </h3>
        
        <ToggleGroup 
          type="single" 
          value={chartType} 
          onValueChange={(value) => value && setChartType(value as 'bar' | 'line')}
          className="bg-gray-800/50 border border-gray-700"
        >
          <ToggleGroupItem 
            value="bar" 
            aria-label="Visualização em barras"
            className="data-[state=on]:bg-blue-600 data-[state=on]:text-white"
          >
            <BarChart3 className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="line" 
            aria-label="Visualização em linhas"
            className="data-[state=on]:bg-blue-600 data-[state=on]:text-white"
          >
            <LineChartIcon className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
      
      <ChartInsight icon={TrendingUp} text={insight} />
    </AppCard>
  );
}
