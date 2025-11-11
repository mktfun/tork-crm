import { Client, Policy, Transaction } from '@/types';
import { formatCurrency } from '@/utils/formatCurrency';
import { AppCard } from '@/components/ui/app-card';
import { TrendingUp, DollarSign, Target, Percent } from 'lucide-react';
import { GraficoComissaoDinamico } from '@/components/dashboard/GraficoComissaoDinamico';
import { format, startOfMonth, startOfDay, eachMonthOfInterval, eachDayOfInterval, differenceInDays, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface RelatorioFaturamentoProps {
  apolices: Policy[];
  clientes: Client[];
  transactions: Transaction[];
  intervalo: DateRange | undefined;
}

export function RelatorioFaturamento({ 
  apolices, 
  clientes, 
  transactions,
  intervalo 
}: RelatorioFaturamentoProps) {
  // Cálculos dos KPIs financeiros
  const totalFaturado = apolices.reduce((sum, p) => sum + (p.premiumValue || 0), 0);

  // Definir "verdade" de comissões como transações de ganho de comissão (realizadas)
  const isCommissionTx = (t: Transaction) => {
    const desc = (t.description || '').toLowerCase();
    const isReceita = t.nature === 'RECEITA';
    const isCommissionLike = desc.includes('comiss') || !!t.policyId; // marcações de comissão
    return isReceita && isCommissionLike;
  };

  // Aplicar filtro de período quando existir (usa start_date da apólice se disponível)
  const inRange = (t: Transaction) => {
    if (!intervalo?.from || !intervalo?.to) return true;
    // Usar start_date da apólice para transações de comissão
    const raw = (t as any).policyStartDate || t.transactionDate || t.date;
    if (!raw) return false;
    const d = new Date(raw);
    return d >= intervalo.from && d <= intervalo.to;
  };

  const comissoesTransacoes = transactions.filter(isCommissionTx).filter(inRange);

  const totalComissoes = comissoesTransacoes.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const comissaoMedia = apolices.length > 0 ? totalComissoes / apolices.length : 0;
  const percentualComissao = totalFaturado > 0 ? (totalComissoes / totalFaturado) * 100 : 0;

  // Preparar dados para o gráfico de evolução de comissões com granularidade dinâmica
  const dadosGraficoComissao = () => {
    if (!intervalo?.from || !intervalo?.to) return [];

    // LÓGICA CONDICIONAL: Decidir granularidade baseada no intervalo
    const diasDiferenca = differenceInDays(intervalo.to, intervalo.from);
    const usarGranularidadeDiaria = diasDiferenca <= 31;

    console.log(`📊 Granularidade dinâmica: ${diasDiferenca} dias -> ${usarGranularidadeDiaria ? 'DIÁRIA' : 'MENSAL'}`);

    if (usarGranularidadeDiaria) {
      // AGRUPAMENTO POR DIA (≤ 31 dias) baseado em transações
      const dias = eachDayOfInterval({
        start: startOfDay(intervalo.from),
        end: startOfDay(intervalo.to)
      });

      return dias.map(dia => {
        const comissaoDia = comissoesTransacoes
          .filter(t => {
            // Usar start_date da apólice para transações de comissão
            const raw = (t as any).policyStartDate || t.transactionDate || t.date;
            if (!raw) return false;
            return format(new Date(raw), 'yyyy-MM-dd') === format(dia, 'yyyy-MM-dd');
          })
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        return {
          periodo: format(dia, 'dd/MM', { locale: ptBR }),
          comissao: comissaoDia
        };
      });
    } else {
      // AGRUPAMENTO POR MÊS (> 31 dias) baseado em transações
      const meses = eachMonthOfInterval({
        start: startOfMonth(intervalo.from),
        end: startOfMonth(intervalo.to)
      });

      return meses.map(mes => {
        const comissaoMes = comissoesTransacoes
          .filter(t => {
            // Usar start_date da apólice para transações de comissão
            const raw = (t as any).policyStartDate || t.transactionDate || t.date;
            if (!raw) return false;
            return format(new Date(raw), 'yyyy-MM') === format(mes, 'yyyy-MM');
          })
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        return {
          periodo: format(mes, 'MMM/yy', { locale: ptBR }),
          comissao: comissaoMes
        };
      });
    }
  };

  // Determinar qual granularidade está sendo usada para mostrar ao usuário
  const granularidadeAtiva = intervalo?.from && intervalo?.to && 
    differenceInDays(intervalo.to, intervalo.from) <= 31 ? 'Diária' : 'Mensal';

  const metrics = [
    {
      title: "Total Faturado (Prêmios)",
      value: formatCurrency(totalFaturado),
      icon: TrendingUp,
      bgColor: "bg-blue-600",
      description: "Soma de todos os prêmios das apólices"
    },
    {
      title: "Total de Comissões",
      value: formatCurrency(totalComissoes),
      icon: DollarSign,
      bgColor: "bg-green-600",
      description: "Comissões ganhas no período"
    },
    {
      title: "Comissão Média / Apólice",
      value: formatCurrency(comissaoMedia),
      icon: Target,
      bgColor: "bg-purple-600",
      description: "Valor médio de comissão por apólice"
    },
    {
      title: "% Comissão sobre Faturamento",
      value: `${percentualComissao.toFixed(1)}%`,
      icon: Percent,
      bgColor: "bg-orange-600",
      description: "Percentual de comissão sobre o faturamento total"
    }
  ];

  return (
    <AppCard className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">Análise Financeira</h2>
        <p className="text-slate-400">Métricas de faturamento e rentabilidade</p>
      </div>

      {/* KPIs FINANCEIROS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="relative overflow-hidden rounded-lg bg-slate-800 p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-400 mb-1">{metric.title}</p>
                  <p className="text-2xl font-bold text-white">{metric.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{metric.description}</p>
                </div>
                <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* GRÁFICO DE EVOLUÇÃO DE COMISSÕES */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Evolução de Comissões</h3>
          <span className="text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
            Visualização: {granularidadeAtiva}
          </span>
        </div>
        <div className="h-[300px] bg-slate-800 rounded-lg p-4">
          <GraficoComissaoDinamico data={dadosGraficoComissao()} />
        </div>
      </div>

      {/* DETALHAMENTO ADICIONAL */}
      <div className="mt-6 pt-6 border-t border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 rounded-lg bg-slate-800">
            <p className="text-sm text-slate-400 mb-2">Prêmio Médio por Apólice</p>
            <p className="text-xl font-bold text-white">
              {formatCurrency(apolices.length > 0 ? totalFaturado / apolices.length : 0)}
            </p>
            <p className="text-xs text-slate-500">Valor médio de prêmio</p>
          </div>
          
          <div className="p-4 rounded-lg bg-slate-800">
            <p className="text-sm text-slate-400 mb-2">Taxa de Comissão Média</p>
            <p className="text-xl font-bold text-white">
              {apolices.length > 0 ? 
                (apolices.reduce((sum, p) => sum + (p.commissionRate || 0), 0) / apolices.length).toFixed(1) : 0
              }%
            </p>
            <p className="text-xs text-slate-500">Percentual médio de comissão</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-800">
            <p className="text-sm text-slate-400 mb-2">Faturamento por Cliente</p>
            <p className="text-xl font-bold text-white">
              {formatCurrency(clientes.length > 0 ? totalFaturado / clientes.length : 0)}
            </p>
            <p className="text-xs text-slate-500">Valor médio de faturamento por cliente</p>
          </div>
        </div>
      </div>
    </AppCard>
  );
}
