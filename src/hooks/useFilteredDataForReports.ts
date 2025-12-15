import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseReports } from './useSupabaseReports';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, differenceInDays, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FiltrosGlobais {
  intervalo: DateRange | undefined;
  seguradoraIds: string[];
  ramos: string[];
  produtorIds: string[];
  statusIds: string[];
}

interface ReportOptions {
  /** Se true, agrupa itens pequenos em "Outros" (para gráficos). Default: true */
  limitResults?: boolean;
}

export function useFilteredDataForReports(filtros: FiltrosGlobais, options: ReportOptions = {}) {
  const { limitResults = true } = options;
  // ✅ BUSCAR DEPENDÊNCIAS DIRETAMENTE DENTRO DO HOOK
  const { data: ramos, isLoading: ramosLoading } = useQuery({
    queryKey: ['ramos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ramos')
        .select('id, nome')
        .order('nome');
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: seguradoras, isLoading: seguradorasLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  // ✅ NOVA ARQUITETURA: Usar o hook especializado do Supabase
  const {
    apolices: apolicesFiltradas,
    clientes: clientesFiltrados,
    transacoes: transacoesFiltradas,
    statusDisponiveis,
    produtores,
    totalGanhos,
    totalPerdas,
    saldoLiquido,
    isLoading: supabaseLoading,
    temDados,
    temFiltrosAtivos
  } = useSupabaseReports(filtros);

  // 🛡️ GUARD: Verificar se TODOS os dados críticos estão prontos
  const isDataReady = Boolean(
    ramos && ramos.length > 0 &&
    seguradoras && seguradoras.length > 0 &&
    produtores && produtores.length > 0
  );

  console.log('🔍 [useFilteredDataForReports] Estado dos dados:', {
    transacoes: transacoesFiltradas?.length || 0,
    ramos: ramos?.length || 0,
    seguradoras: seguradoras?.length || 0,
    produtores: produtores?.length || 0,
    isDataReady,
    ramosLoading,
    seguradorasLoading,
    supabaseLoading
  });

  // 📊 DADOS CALCULADOS: Manter apenas a formatação para os gráficos
  const dadosEvolucaoCarteira = useMemo(() => {
    if (!filtros.intervalo?.from || !filtros.intervalo?.to || !apolicesFiltradas.length) {
      return { data: [], insight: 'Selecione um período para visualizar a evolução da carteira.' };
    }

    const diasNoPeriodo = differenceInDays(filtros.intervalo.to, filtros.intervalo.from);
    const usarGranularidadeDiaria = diasNoPeriodo <= 31;

    const apolicesNovas = apolicesFiltradas.filter(policy => policy.status !== 'Renovada');
    const apolicesRenovadas = apolicesFiltradas.filter(policy => policy.status === 'Renovada');

    let dadosAgrupados: { [key: string]: { novas: number; renovadas: number } } = {};

    [...apolicesNovas, ...apolicesRenovadas].forEach(policy => {
      // Usar start_date (data de vigência) em vez de created_at
      const dataPolicy = parseISO(policy.start_date);
      const chave = usarGranularidadeDiaria 
        ? format(dataPolicy, 'dd/MM', { locale: ptBR })
        : format(startOfMonth(dataPolicy), 'MMM/yy', { locale: ptBR });
      
      if (!dadosAgrupados[chave]) {
        dadosAgrupados[chave] = { novas: 0, renovadas: 0 };
      }
      
      if (policy.status === 'Renovada') {
        dadosAgrupados[chave].renovadas += 1;
      } else {
        dadosAgrupados[chave].novas += 1;
      }
    });

    const dataFormatada = Object.entries(dadosAgrupados)
      .map(([periodo, dados]) => ({
        month: periodo,
        novas: dados.novas,
        renovadas: dados.renovadas
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const totalNovas = apolicesNovas.length;
    const totalRenovadas = apolicesRenovadas.length;
    const totalApolices = totalNovas + totalRenovadas;
    
    let insight = '';
    if (totalApolices === 0) {
      insight = 'Nenhuma apólice encontrada no período selecionado.';
    } else {
      const percentualNovas = ((totalNovas / totalApolices) * 100).toFixed(0);
      const percentualRenovadas = ((totalRenovadas / totalApolices) * 100).toFixed(0);
      
      if (totalNovas > totalRenovadas) {
        insight = `Crescimento positivo: ${percentualNovas}% são apólices novas vs. ${percentualRenovadas}% renovações. Foco na aquisição está funcionando!`;
      } else if (totalRenovadas > totalNovas) {
        insight = `Base sólida: ${percentualRenovadas}% são renovações vs. ${percentualNovas}% novas. Excelente retenção de clientes!`;
      } else {
        insight = `Equilíbrio perfeito: ${percentualNovas}% novas e ${percentualRenovadas}% renovações. Crescimento sustentável!`;
      }
    }

    return { data: dataFormatada, insight };
  }, [apolicesFiltradas, filtros.intervalo]);

  const dadosPerformanceProdutor = useMemo(() => {
    // 🛡️ GUARD CLAUSE ROBUSTA
    if (!produtores || produtores.length === 0 || !transacoesFiltradas || !apolicesFiltradas) {
      console.warn('⚠️ [dadosPerformanceProdutor] Aguardando dados completos');
      return { data: [], insight: 'Carregando dados de performance...' };
    }

    const performanceMap = new Map<string, { produtorId: string; nome: string; totalApolices: number; valorTotal: number; comissaoTotal: number; ticketMedio: number }>();

    produtores.forEach(producer => {
      performanceMap.set(producer.id, {
        produtorId: producer.id,
        nome: producer.name,
        totalApolices: 0,
        valorTotal: 0,
        comissaoTotal: 0,
        ticketMedio: 0
      });
    });

    // Volume (prêmios) por produtor segue baseado nas apólices
    apolicesFiltradas.forEach(policy => {
      if (policy.producer_id) {
        const current = performanceMap.get(policy.producer_id);
        if (current) {
          performanceMap.set(policy.producer_id, {
            ...current,
            totalApolices: current.totalApolices + 1,
            valorTotal: current.valorTotal + policy.premium_value
          });
        }
      }
    });

    // Comissões REALIZADAS por produtor baseadas nas transações
    const isCommissionTx = (t: any) => {
      const desc = (t.description || '').toLowerCase();
      return (['GANHO', 'RECEITA'].includes(t.nature)) && (desc.includes('comiss') || !!t.policy_id || !!t.policyId);
    };

    transacoesFiltradas.filter(isCommissionTx).forEach(tx => {
      const producerId = tx.producer_id || tx.producerId;
      if (!producerId) return;
      const current = performanceMap.get(producerId);
      if (!current) return;
      performanceMap.set(producerId, {
        ...current,
        comissaoTotal: current.comissaoTotal + (Number(tx.amount) || 0)
      });
    });

    const dadosFormatados = Array.from(performanceMap.values())
      .map(data => ({
        ...data,
        ticketMedio: data.totalApolices > 0 ? data.valorTotal / data.totalApolices : 0
      }))
      .filter(data => data.totalApolices > 0 || data.comissaoTotal > 0)
      .sort((a, b) => b.valorTotal - a.valorTotal);

    let insight = '';
    if (dadosFormatados.length === 0) {
      insight = 'Nenhum produtor com atividade no período selecionado.';
    } else {
      const topProdutor = dadosFormatados[0];
      const totalGeral = dadosFormatados.reduce((sum, p) => sum + p.valorTotal, 0);
      const participacaoTop = totalGeral > 0 ? ((topProdutor.valorTotal / totalGeral) * 100).toFixed(0) : '0';

      insight = `${topProdutor.nome} lidera com ${participacaoTop}% do volume total (R$ ${topProdutor.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). ${dadosFormatados.length} produtores ativos no período.`;
    }

    return { data: dadosFormatados, insight };
  }, [apolicesFiltradas, produtores, transacoesFiltradas]);

  const dadosRenovacoesPorStatus = useMemo(() => {
    const apolicesComRenovacao = apolicesFiltradas.filter(policy => policy.renewal_status);
    const statusCount = new Map();
    
    apolicesComRenovacao.forEach(policy => {
      const status = policy.renewal_status || 'Pendente';
      statusCount.set(status, (statusCount.get(status) || 0) + 1);
    });

    const total = apolicesComRenovacao.length;
    const dadosFormatados = Array.from(statusCount.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }));

    let insight = '';
    if (total === 0) {
      insight = 'Nenhuma apólice com processo de renovação no período selecionado.';
    } else {
      const renovadas = statusCount.get('Renovada') || 0;
      const pendentes = statusCount.get('Pendente') || 0;
      const taxaRenovacao = ((renovadas / total) * 100).toFixed(0);
      
      if (renovadas > 0) {
        insight = `Taxa de renovação: ${taxaRenovacao}% (${renovadas}/${total} apólices). ${pendentes} ainda pendentes.`;
      } else {
        insight = `${total} apólices em processo de renovação. ${pendentes} pendentes de ação.`;
      }
    }

    return { data: dadosFormatados, insight };
  }, [apolicesFiltradas]);

  const dadosVencimentosCriticos = useMemo(() => {
    const hoje = new Date();
    const em30Dias = addDays(hoje, 30);
    const em60Dias = addDays(hoje, 60);
    const em90Dias = addDays(hoje, 90);

    const apolicesVencidas = apolicesFiltradas.filter(policy => {
      const vencimento = parseISO(policy.expiration_date);
      return isBefore(vencimento, hoje);
    });

    const apolicesVencendoEm30 = apolicesFiltradas.filter(policy => {
      const vencimento = parseISO(policy.expiration_date);
      return isAfter(vencimento, hoje) && isBefore(vencimento, em30Dias);
    });

    const apolicesVencendoEm60 = apolicesFiltradas.filter(policy => {
      const vencimento = parseISO(policy.expiration_date);
      return isAfter(vencimento, em30Dias) && isBefore(vencimento, em60Dias);
    });

    const apolicesVencendoEm90 = apolicesFiltradas.filter(policy => {
      const vencimento = parseISO(policy.expiration_date);
      return isAfter(vencimento, em60Dias) && isBefore(vencimento, em90Dias);
    });

    const dadosAgrupados: { [key: string]: { vencidas: number; em30: number; em60: number; em90: number } } = {};

    [...apolicesVencidas, ...apolicesVencendoEm30, ...apolicesVencendoEm60, ...apolicesVencendoEm90].forEach(policy => {
      const vencimento = parseISO(policy.expiration_date);
      const chave = format(startOfMonth(vencimento), 'MMM/yy', { locale: ptBR });
      
      if (!dadosAgrupados[chave]) {
        dadosAgrupados[chave] = { vencidas: 0, em30: 0, em60: 0, em90: 0 };
      }
      
      const dataVencimento = parseISO(policy.expiration_date);
      if (isBefore(dataVencimento, hoje)) {
        dadosAgrupados[chave].vencidas += 1;
      } else if (isBefore(dataVencimento, em30Dias)) {
        dadosAgrupados[chave].em30 += 1;
      } else if (isBefore(dataVencimento, em60Dias)) {
        dadosAgrupados[chave].em60 += 1;
      } else if (isBefore(dataVencimento, em90Dias)) {
        dadosAgrupados[chave].em90 += 1;
      }
    });

    const dataFormatada = Object.entries(dadosAgrupados)
      .map(([periodo, dados]) => ({
        periodo,
        vencendoEm30Dias: dados.em30,
        vencendoEm60Dias: dados.em60,
        vencendoEm90Dias: dados.em90,
        vencidas: dados.vencidas
      }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo));

    const totalVencidas = apolicesVencidas.length;
    const totalVencendoEm30 = apolicesVencendoEm30.length;
    const totalCriticas = totalVencidas + totalVencendoEm30;
    
    let insight = '';
    if (totalCriticas === 0) {
      insight = 'Nenhuma apólice com vencimento crítico nos próximos 30 dias.';
    } else if (totalVencidas > 0) {
      insight = `ATENÇÃO: ${totalVencidas} apólices vencidas! ${totalVencendoEm30} vencem em 30 dias. Ação imediata necessária.`;
    } else {
      insight = `${totalVencendoEm30} apólices vencem em 30 dias. Agende contatos para renovação.`;
    }

    return { data: dataFormatada, insight };
  }, [apolicesFiltradas]);

  // 📊 DISTRIBUIÇÃO POR RAMOS (baseada em RPC otimizada)
  const { data: branchDistributionFromRPC } = useQuery({
    queryKey: ['reports-branch-distribution', filtros, limitResults],
    queryFn: async () => {
      if (!filtros.intervalo?.from || !filtros.intervalo?.to) return [];

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return [];

      console.log('🔍 [Relatórios] Buscando distribuição de ramos via RPC...', {
        from: filtros.intervalo.from,
        to: filtros.intervalo.to,
        limitResults
      });

      const { data, error } = await supabase.rpc('get_producao_por_ramo', {
        p_user_id: userData.user.id,
        start_range: filtros.intervalo.from.toISOString(),
        end_range: filtros.intervalo.to.toISOString()
      });

      if (error) {
        console.error('❌ Erro ao buscar distribuição de ramos:', error);
        throw error;
      }

      console.log('✅ [Relatórios] Distribuição de ramos recebida:', data);

      // Transformar para o formato esperado
      const distribution = (data || []).map((item: any) => ({
        ramo: item.ramo_nome,
        total: Number(item.total_apolices),
        valor: Number(item.total_premio),
        valorComissao: Number(item.total_comissao),
        taxaMediaComissao: Number(item.taxa_media_comissao)
      })).sort((a, b) => b.valor - a.valor);

      // 🎯 SE limitResults=false, retorna lista completa SEM agrupamento
      if (!limitResults) {
        return distribution;
      }

      // Agrupar itens pequenos (menos de 5% do total) em "Outros" - APENAS para gráficos
      const totalValue = distribution.reduce((sum, item) => sum + item.valor, 0);
      const threshold = totalValue * 0.05;
      
      const mainItems = distribution.filter(item => item.valor >= threshold);
      const smallItems = distribution.filter(item => item.valor < threshold);
      
      if (smallItems.length > 0 && mainItems.length > 0) {
        const othersData = smallItems.reduce(
          (acc, item) => ({
            ramo: 'Outros',
            total: acc.total + item.total,
            valor: acc.valor + item.valor,
            valorComissao: acc.valorComissao + item.valorComissao,
            taxaMediaComissao: 0
          }),
          { ramo: 'Outros', total: 0, valor: 0, valorComissao: 0, taxaMediaComissao: 0 }
        );

        if (othersData.valor > 0) {
          othersData.taxaMediaComissao = (othersData.valorComissao / othersData.valor) * 100;
        }

        return [...mainItems.slice(0, 7), othersData];
      }

      return distribution;
    },
    enabled: Boolean(filtros.intervalo?.from && filtros.intervalo?.to)
  });

  const branchDistributionDataFromTransactions = branchDistributionFromRPC || [];

  // 📊 DISTRIBUIÇÃO POR SEGURADORAS (baseada em transações pagas)
  const companyDistributionDataFromTransactions = useMemo(() => {
    // 🛡️ GUARD CLAUSE ROBUSTA
    if (!transacoesFiltradas || !seguradoras || seguradoras.length === 0) {
      console.warn('⚠️ [companyDistribution] Aguardando dados: transações ou seguradoras');
      return [];
    }
    
    // Filtrar apenas transações de receita pagas
    const filteredTransactions = transacoesFiltradas.filter(t => 
      t.nature === 'RECEITA' && 
      (t.status === 'PAGO' || t.status === 'REALIZADO')
    );
    
    // Agrupar por company_id COM SUPORTE A PRÊMIO E COMISSÃO
    const companyData: { [key: string]: { count: number; premium: number; commission: number } } = {};
    
    filteredTransactions.forEach(t => {
      const companyId = t.company_id || 'Não informado';
      
      // ✅ SOLUÇÃO CORRETA: Usar premiumValue e commissionValue
      const premiumValue = t.premiumValue || t.amount || 0;
      const commissionValue = t.commissionValue || t.amount || 0;
      
      if (!companyData[companyId]) {
        companyData[companyId] = { count: 0, premium: 0, commission: 0 };
      }
      
      companyData[companyId].count += 1;
      companyData[companyId].premium += premiumValue;
      companyData[companyId].commission += commissionValue;
    });
    
    // ✅ CORREÇÃO: Helper usando dados locais do hook
    const getCompanyName = (companyId: string) => {
      if (companyId === 'Não informado') return 'Não informado';
      const company = seguradoras.find(c => c.id === companyId);
      return company?.name || 'Não informado';
    };
    
    // Converter para array e mapear nomes das seguradoras COM PRÊMIO E COMISSÃO
    let distribution = Object.entries(companyData).map(([companyId, data]) => {
      const avgCommissionRate = data.premium > 0 ? (data.commission / data.premium) * 100 : 0;
      
      return {
        seguradora: getCompanyName(companyId),
        total: data.count,
        valor: data.premium, // Valor TOTAL é o prêmio
        valorComissao: data.commission,
        taxaMediaComissao: avgCommissionRate
      };
    }).sort((a, b) => b.valor - a.valor);
    
    // 🎯 SE limitResults=false, retorna lista completa SEM agrupamento
    if (!limitResults) {
      return distribution;
    }
    
    // Agrupar itens pequenos em "Outros" (< 5% do total) - APENAS para gráficos
    const totalValue = distribution.reduce((sum, item) => sum + item.valor, 0);
    const threshold = totalValue * 0.05;
    
    const mainItems = distribution.filter(item => item.valor >= threshold);
    const smallItems = distribution.filter(item => item.valor < threshold);
    
    if (smallItems.length > 0 && mainItems.length > 0) {
      const othersData = smallItems.reduce(
        (acc, item) => ({
          seguradora: 'Outros',
          total: acc.total + item.total,
          valor: acc.valor + item.valor,
          valorComissao: acc.valorComissao + item.valorComissao,
          taxaMediaComissao: 0
        }),
        { seguradora: 'Outros', total: 0, valor: 0, valorComissao: 0, taxaMediaComissao: 0 }
      );
      
      distribution = [...mainItems.slice(0, 7), othersData];
    }
    
    return distribution;
  }, [transacoesFiltradas, seguradoras, limitResults]);

  const isLoading = supabaseLoading || ramosLoading || seguradorasLoading || !isDataReady;

  console.log('📊 Hook useFilteredDataForReports - NOVA ARQUITETURA:', {
    apolices: apolicesFiltradas.length,
    clientes: clientesFiltrados.length,
    isLoading,
    temDados
  });

  return {
    apolicesFiltradas,
    clientesFiltrados,
    transacoesFiltradas,
    seguradoras,
    ramosDisponiveis: ramos,
    statusDisponiveis,
    produtores,
    dadosEvolucaoCarteira,
    dadosPerformanceProdutor,
    dadosRenovacoesPorStatus,
    dadosVencimentosCriticos,
    branchDistributionDataFromTransactions,
    companyDistributionDataFromTransactions,
    totalGanhos,
    totalPerdas,
    saldoLiquido,
    temFiltrosAtivos,
    temDados,
    isLoading // 🛡️ Loading completo: considera todos os dados críticos
  };
}
