import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { getCurrentMonthRange } from '@/utils/dateUtils';
import { VisaoGeralCarteira } from '@/components/reports/VisaoGeralCarteira';
import { RelatorioFaturamento } from '@/components/reports/RelatorioFaturamento';
import { FiltrosAvancados } from '@/components/reports/FiltrosAvancados';
import { SkeletonKpiReports } from '@/components/reports/SkeletonKpiReports';
import { SkeletonEnhancedCharts } from '@/components/reports/SkeletonEnhancedCharts';
import { EstadoVazio } from '@/components/reports/EstadoVazio';
import { PlaceholderGraficos } from '@/components/reports/PlaceholderGraficos';
import { EnhancedGrowthChart } from '@/components/reports/enhanced/EnhancedGrowthChart';
import { EnhancedProducerPerformanceChart } from '@/components/reports/enhanced/EnhancedProducerPerformanceChart';
import { EnhancedExpirationCalendarChart } from '@/components/reports/enhanced/EnhancedExpirationCalendarChart';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { useFilteredDataForReports } from '@/hooks/useFilteredDataForReports';
import { useClientesPreview } from '@/hooks/useClientesPreview';
import { useClientesPreviewWithStats } from '@/hooks/useClientesPreviewWithStats';
import { useApolicesPreview } from '@/hooks/useApolicesPreview';
import PreviewCard from '@/components/PreviewCard';
import { KpiCard } from '@/components/reports/KpiCard';
import { TrendingUp, TrendingDown, DollarSign, FileDown, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import { BranchDistributionChart } from '@/components/dashboard/charts/BranchDistributionChart';
import { CompanyDistributionChart } from '@/components/dashboard/charts/CompanyDistributionChart';
import { Button } from '@/components/ui/button';
import { generateManagementReport } from '@/utils/pdf/generateManagementReport';
import { toast } from 'sonner';

interface FiltrosGlobais {
  intervalo: DateRange | undefined;
  seguradoraIds: string[];
  ramos: string[];
  produtorIds: string[];
  statusIds: string[];
}

export default function Reports() {
  const [filtrosGlobais, setFiltrosGlobais] = useState<FiltrosGlobais>({
    intervalo: getCurrentMonthRange(),
    seguradoraIds: [],
    ramos: [],
    produtorIds: [],
    statusIds: [],
  });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const previewFilters = {
    seguradoraId: (filtrosGlobais.seguradoraIds && filtrosGlobais.seguradoraIds[0]) || null,
    ramo: (filtrosGlobais.ramos && filtrosGlobais.ramos[0]) || null,
  } as const;
  const { data: clientesPreview } = useClientesPreviewWithStats(previewFilters);
  const { data: apolicesPreview } = useApolicesPreview(previewFilters);
  const isFilterActive = Boolean(
    (filtrosGlobais.seguradoraIds && filtrosGlobais.seguradoraIds.length > 0) ||
    (filtrosGlobais.ramos && filtrosGlobais.ramos.length > 0)
  );

  const { 
    apolicesFiltradas, 
    clientesFiltrados,
    transacoesFiltradas,
    seguradoras,
    ramosDisponiveis,
    statusDisponiveis,
    produtores,
    dadosEvolucaoCarteira,
    dadosPerformanceProdutor,
    dadosVencimentosCriticos,
    branchDistributionDataFromTransactions,
    companyDistributionDataFromTransactions,
    totalGanhos,
    totalPerdas,
    saldoLiquido,
    temFiltrosAtivos,
    temDados,
    isLoading
  } = useFilteredDataForReports(filtrosGlobais);

  const handleFiltrosChange = (novosFiltros: FiltrosGlobais) => {
    setFiltrosGlobais(novosFiltros);
  };

  const clearAllFilters = () => {
    handleFiltrosChange({
      intervalo: filtrosGlobais.intervalo,
      seguradoraIds: [],
      ramos: [],
      produtorIds: [],
      statusIds: []
    });
  };

  const handleExportManagementReport = async () => {
    if (!temDados) {
      toast.error('Não há dados para exportar');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      // Calcular KPIs da carteira
      const apolicesAtivas = apolicesFiltradas.filter(p => p.status === 'Ativa');
      const valorTotalCarteira = apolicesAtivas.reduce((sum, p) => sum + (p.premium_value || 0), 0);
      const numeroClientes = new Set(apolicesFiltradas.map(p => p.client_id)).size;
      const numeroApolices = apolicesFiltradas.length;
      const ticketMedio = numeroApolices > 0 ? valorTotalCarteira / numeroApolices : 0;

      await generateManagementReport({
        period: { from: filtrosGlobais.intervalo?.from, to: filtrosGlobais.intervalo?.to },
        portfolio: {
          valorTotalCarteira,
          numeroClientes,
          numeroApolices,
          ticketMedio
        },
        financial: {
          totalGanhos,
          totalPerdas,
          saldoLiquido
        },
        branchDistribution: branchDistributionDataFromTransactions,
        companyDistribution: companyDistributionDataFromTransactions,
        producerPerformance: dadosPerformanceProdutor.data
      });

      toast.success('Relatório de Gestão gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Relatórios</h1>
          <p className="text-slate-400">Central de inteligência para análise completa da carteira e tomada de decisões estratégicas</p>
        </div>
        <Button
          onClick={handleExportManagementReport}
          variant="outline"
          className="gap-2"
          disabled={isLoading || !temDados || isGeneratingPDF}
        >
          {isGeneratingPDF ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
          {isGeneratingPDF ? 'Gerando...' : 'Baixar Relatório Gerencial'}
        </Button>
      </div>

      <FiltrosAvancados
        filtros={filtrosGlobais}
        onFiltrosChange={handleFiltrosChange}
        seguradoras={seguradoras}
        ramos={ramosDisponiveis}
        produtores={produtores}
        statusDisponiveis={statusDisponiveis}
      />

      <div className="space-y-6">
        {isLoading ? (
          <>
            <SkeletonKpiReports />
            <SkeletonKpiReports />
            <SkeletonEnhancedCharts />
          </>
        ) : !temDados ? (
          <EstadoVazio onLimparFiltros={clearAllFilters} temFiltrosAtivos={temFiltrosAtivos} />
        ) : (
          <>
            <VisaoGeralCarteira clientes={clientesFiltrados} apolices={apolicesFiltradas} />
            
            {/* Resumo Financeiro Geral (Faturamento) */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Resumo Financeiro Geral</h2>
                <p className="text-sm text-slate-400">Análise de fluxo de caixa real da corretora (transações efetivadas)</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard
                  title="Total de Ganhos"
                  value={formatCurrency(totalGanhos)}
                  subtitle="Receitas realizadas no período"
                  icon={TrendingUp}
                  trend="up"
                  trendValue={`${((transacoesFiltradas || []).filter(t => t.nature === 'RECEITA' && (t.status === 'PAGO' || t.status === 'REALIZADO')).length)} transações`}
                />
                <KpiCard
                  title="Total de Perdas"
                  value={formatCurrency(totalPerdas)}
                  subtitle="Despesas realizadas no período"
                  icon={TrendingDown}
                  trend="down"
                  trendValue={`${((transacoesFiltradas || []).filter(t => t.nature === 'DESPESA' && (t.status === 'PAGO' || t.status === 'REALIZADO')).length)} transações`}
                />
                <KpiCard
                  title="Saldo Líquido"
                  value={formatCurrency(saldoLiquido)}
                  subtitle="Ganhos - Perdas"
                  icon={DollarSign}
                  trend={saldoLiquido > 0 ? 'up' : saldoLiquido < 0 ? 'down' : 'neutral'}
                  trendValue={saldoLiquido > 0 ? 'Positivo' : saldoLiquido < 0 ? 'Negativo' : 'Neutro'}
                />
              </div>
              
              {/* Gráficos de Distribuição */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <BranchDistributionChart 
                  data={branchDistributionDataFromTransactions}
                  dateRange={filtrosGlobais.intervalo}
                  insight="Distribuição de comissões realizadas por ramo no período selecionado."
                />
                
                <CompanyDistributionChart 
                  data={companyDistributionDataFromTransactions}
                  dateRange={filtrosGlobais.intervalo}
                  insight="Distribuição de comissões realizadas por seguradora no período selecionado."
                />
              </div>
            </div>

            <RelatorioFaturamento apolices={apolicesFiltradas} clientes={clientesFiltrados} transactions={transacoesFiltradas} intervalo={filtrosGlobais.intervalo} />
            <div className="flex flex-col gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Análises Avançadas e Detalhadas</h3>
                  <p className="text-sm text-slate-400">Arraste para navegar • Gráficos interativos com métricas expandidas</p>
                </div>
                <Carousel className="w-full" opts={{ align: 'start', loop: true }}>
                  <div className="flex items-center justify-end gap-2 mb-4">
                    <CarouselPrevious />
                    <CarouselNext />
                  </div>
                  <CarouselContent>
                    <CarouselItem>
                      <div className="h-full">
                        <EnhancedGrowthChart data={dadosEvolucaoCarteira.data} dateRange={filtrosGlobais.intervalo} insight={dadosEvolucaoCarteira.insight} />
                      </div>
                    </CarouselItem>
                    <CarouselItem>
                      <div className="h-full">
                        <EnhancedProducerPerformanceChart data={dadosPerformanceProdutor.data} insight={dadosPerformanceProdutor.insight} />
                      </div>
                    </CarouselItem>
                    <CarouselItem>
                      <div className="h-full">
                        <EnhancedExpirationCalendarChart data={dadosVencimentosCriticos.data} insight={dadosVencimentosCriticos.insight} />
                      </div>
                    </CarouselItem>
                  </CarouselContent>
                </Carousel>
              </div>
            </div>
            <PlaceholderGraficos />
          </>
        )}
      </div>

      {isFilterActive && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <PreviewCard
            title="Clientes Encontrados"
            data={clientesPreview}
            linkTo="/dashboard/clients"
            filters={previewFilters}
            extraParams={{
              start: filtrosGlobais.intervalo?.from ? filtrosGlobais.intervalo.from.toISOString().split('T')[0] : '',
              end: filtrosGlobais.intervalo?.to ? filtrosGlobais.intervalo.to.toISOString().split('T')[0] : '',
            }}
          />
          <PreviewCard
            title="Apólices Encontradas"
            data={apolicesPreview}
            linkTo="/dashboard/policies"
            filters={previewFilters}
            extraParams={{
              start: filtrosGlobais.intervalo?.from ? filtrosGlobais.intervalo.from.toISOString().split('T')[0] : '',
              end: filtrosGlobais.intervalo?.to ? filtrosGlobais.intervalo.to.toISOString().split('T')[0] : '',
            }}
          />
        </div>
      )}
    </div>
  );
}
