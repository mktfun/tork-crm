
import { AppCard } from '@/components/ui/app-card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DateRange } from 'react-day-picker';
import { ChartInsight } from './ChartInsight';
import { Building2 } from 'lucide-react';

interface CompanyDistributionData {
  seguradora: string;
  total: number;
  valor: number;
}

interface CompanyDistributionChartProps {
  data: CompanyDistributionData[];
  dateRange?: DateRange;
  insight: string;
}

const COLORS = [
  '#06b6d4', // cyan-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#3b82f6'  // blue-500
];

export function CompanyDistributionChart({ data, dateRange, insight }: CompanyDistributionChartProps) {
  // Calcular total para porcentagens
  const totalPolicies = data.reduce((sum, item) => sum + item.total, 0);
  const totalValue = data.reduce((sum, item) => sum + item.valor, 0);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Não mostrar labels para fatias menores que 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
        style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Tooltip customizado com melhor contraste e informações ricas
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const valuePercentage = totalValue > 0 ? ((item.valor / totalValue) * 100).toFixed(1) : 0;
      const policyPercentage = totalPolicies > 0 ? ((item.total / totalPolicies) * 100).toFixed(1) : 0;
      
      return (
        <div className="bg-gray-900/95 backdrop-blur-sm p-3 border border-gray-700 rounded-lg shadow-lg">
          <p className="font-semibold text-white mb-2">{item.seguradora}</p>
          <div className="space-y-1 text-sm text-gray-200">
            <p>
              <span className="font-medium">Faturamento:</span> R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({valuePercentage}%)
            </p>
            <p>
              <span className="font-medium">Apólices:</span> {item.total} ({policyPercentage}%)
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Legenda customizada compacta baseada em valor
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-4 max-w-full">
        {payload.map((entry: any, index: number) => {
          const percentage = totalValue > 0 ? ((entry.payload.valor / totalValue) * 100).toFixed(0) : 0;
          return (
            <div key={`legend-${index}`} className="flex items-center gap-2 min-w-0">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-white/90 font-medium truncate">
                {entry.payload.seguradora} - {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AppCard className="p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Seguradoras × Faturamento
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={80}
              fill="#8884d8"
              dataKey="valor"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  className="hover:opacity-80 transition-opacity duration-200"
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ChartInsight icon={Building2} text={insight} />
    </AppCard>
  );
}
