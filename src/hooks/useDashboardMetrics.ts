import { useMemo, useEffect } from 'react';
import { useClients, usePolicies, useAppointments } from '@/hooks/useAppData';
import { useCompanyNames } from '@/hooks/useCompanyNames';
import { useProfile } from '@/hooks/useProfile';
import { useBirthdayGreetings } from '@/hooks/useBirthdayGreetings';
import { useSupabaseRamos } from '@/hooks/useSupabaseRamos';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { isBirthdayToday, isWithinDays, isInMonth, isToday } from '@/utils/dateUtils';
import { formatCurrency } from '@/utils/formatCurrency';
import { format, differenceInDays, eachDayOfInterval, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { useRealCommissionRates } from '@/hooks/useRealCommissionRates';

// Helper: check if string is UUID
const isUuid = (str: string): boolean => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(str);

interface UseDashboardMetricsProps {
  dateRange?: DateRange;
}

export function useDashboardMetrics(options: UseDashboardMetricsProps = {}) {
  const { dateRange } = options;
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { processClients } = useBirthdayGreetings();

  // Use Supabase hooks directly instead of store
  const { policies, loading: policiesLoading } = usePolicies();
  const { appointments } = useAppointments();
  const { clients, loading: clientsLoading } = useClients();
  const { getCompanyName, companies, loading: companiesLoading } = useCompanyNames();
  const { data: ramos = [], isLoading: ramosLoading } = useSupabaseRamos();

  // Hook para taxas de comissão reais baseadas nos dados da corretora
  const {
    calculateCommissionValue,
    hasReliableData,
    stats,
    commissionRatesReport,
    dataCoverage,
    getOverallAverageRate
  } = useRealCommissionRates();

  // Helper function to check if a date is within the selected range
  const isDateInRange = (date: string | Date) => {
    if (!dateRange?.from || !dateRange?.to) return true;

    const checkDate = typeof date === 'string' ? new Date(date) : date;
    return isWithinInterval(checkDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) });
  };

  // 🎂 NOVA QUERY: Buscar saudações já enviadas este ano
  const { data: sentGreetings = [], isLoading: greetingsLoading } = useQuery({
    queryKey: ['birthday-greetings', user?.id, new Date().getFullYear()],
    queryFn: async () => {
      if (!user) return [];

      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('birthday_greetings')
        .select('client_id')
        .eq('user_id', user.id)
        .eq('year', currentYear);

      if (error) {
        console.error('Erro ao buscar saudações enviadas:', error);
        return [];
      }

      return data.map(item => item.client_id);
    },
    enabled: !!user
  });

  // 🆕 QUERY PARA KPIS FINANCEIROS - VIA LEDGER (FONTE ÚNICA DE VERDADE)
  // ⚠️ IMPORTANTE: Sempre usa o MÊS ATUAL para comissões, não o período selecionado
  const { data: financialKpis, isLoading: financialKpisLoading } = useQuery({
    queryKey: ['dashboard-financial-kpis', user?.id, 'current-month'],
    queryFn: async () => {
      if (!user) return null;

      // Sempre usar o mês atual para KPI de comissão
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const startDate = startOfMonth.toISOString().split('T')[0];
      const endDate = endOfMonth.toISOString().split('T')[0];

      const { data, error } = await supabase.rpc('get_dashboard_financial_kpis', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Erro ao buscar KPIs financeiros do ledger:', error);
        return { totalCommission: 0, pendingCommission: 0, netCommission: 0 };
      }

      return data as { totalCommission: number; pendingCommission: number; netCommission: number };
    },
    enabled: !!user
  });

  // 🆕 QUERY PARA GRÁFICO MENSAL DE COMISSÕES - VIA LEDGER
  const { data: monthlyCommissionFromLedger = [], isLoading: monthlyCommissionLoading } = useQuery({
    queryKey: ['monthly-commission-chart', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_monthly_commission_chart', {
        p_months: 6
      });

      if (error) {
        console.error('Erro ao buscar gráfico de comissões do ledger:', error);
        return [];
      }

      // Transformar para o formato esperado pelo componente
      return (data || []).map((item: any) => ({
        mes: item.month_label,
        comissao: Number(item.confirmed_amount) + Number(item.pending_amount),
        confirmado: Number(item.confirmed_amount),
        pendente: Number(item.pending_amount)
      }));
    },
    enabled: !!user
  });

  // 🛡️ GUARD CLAUSE CENTRAL - Dados prontos para cálculos
  const isDataReady = useMemo(() =>
    !ramosLoading && !companiesLoading &&
    Array.isArray(ramos) && Array.isArray(companies),
    [ramosLoading, companiesLoading, ramos, companies]
  );

  // 🔥 KPI 1: CLIENTES ATIVOS - MEMOIZAÇÃO INDIVIDUAL
  const activeClients = useMemo(() => {
    if (clientsLoading) return 0;

    // Filter clients by date range if provided
    let filteredClients = clients;
    if (dateRange?.from && dateRange?.to) {
      filteredClients = clients.filter(client => isDateInRange(client.createdAt));
    }

    return filteredClients.length;
  }, [clients, clientsLoading, dateRange]);

  // 🔥 KPI 2: RENOVAÇÕES EM 30 DIAS - BASEADO EM VIGÊNCIA
  const renewals30Days = useMemo(() => {
    if (policiesLoading) return 0;

    let filteredPolicies = policies;
    // ✅ CORREÇÃO: Usar start_date (vigência) em vez de createdAt
    if (dateRange?.from && dateRange?.to) {
      filteredPolicies = policies.filter(policy => isDateInRange(policy.startDate));
    }

    const renewalsCount = filteredPolicies.filter(policy =>
      policy.status === 'Ativa' && isWithinDays(policy.expirationDate, 30)
    ).length;

    return renewalsCount;
  }, [policies, policiesLoading, dateRange]);

  // 🔥 KPI 3: RENOVAÇÕES EM 90 DIAS - BASEADO EM VIGÊNCIA
  const renewals90Days = useMemo(() => {
    if (policiesLoading) return 0;

    let filteredPolicies = policies;
    // ✅ CORREÇÃO: Usar start_date (vigência) em vez de createdAt
    if (dateRange?.from && dateRange?.to) {
      filteredPolicies = policies.filter(policy => isDateInRange(policy.startDate));
    }

    const renewalsCount = filteredPolicies.filter(policy =>
      policy.status === 'Ativa' && isWithinDays(policy.expirationDate, 90)
    ).length;

    return renewalsCount;
  }, [policies, policiesLoading, dateRange]);

  // 🔥 KPI 4: COMISSÃO DO MÊS ATUAL OU PERÍODO FILTRADO - AGORA VIA LEDGER!
  const comissaoMesAtual = useMemo(() => {
    // ✅ CORREÇÃO: Usar dados do Ledger (fonte única de verdade)
    return financialKpis?.totalCommission ?? 0;
  }, [financialKpis]);

  // 🔥 KPI 5: COMISSÃO PENDENTE - AGORA VIA LEDGER!
  const comissaoPendente = useMemo(() => {
    return financialKpis?.pendingCommission ?? 0;
  }, [financialKpis]);

  // 🔥 KPI LEGADO: COMISSÃO DO MÊS ANTERIOR (para comparação)
  // TODO: Implementar via Ledger no futuro
  const comissaoMesAnterior = useMemo(() => {
    return 0; // Temporariamente desabilitado - comparação será recalculada via Ledger
  }, []);

  // 🔥 KPI 6: APÓLICES NOVAS DO PERÍODO (BASEADO EM VIGÊNCIA - start_date)
  const apolicesNovasMes = useMemo(() => {
    if (policiesLoading) return 0;

    let filteredPolicies = policies;

    // ✅ CORREÇÃO: Usar start_date (vigência) em vez de createdAt (registro)
    if (dateRange?.from && dateRange?.to) {
      filteredPolicies = policies.filter(policy => isDateInRange(policy.startDate));
    } else {
      filteredPolicies = policies.filter(policy => isInMonth(policy.startDate, 0));
    }

    const apolicesCount = filteredPolicies.filter(policy => policy.status === 'Ativa').length;

    return apolicesCount;
  }, [policies, policiesLoading, dateRange]);

  // 🔥 KPI 7: AGENDAMENTOS DE HOJE
  const todaysAppointments = useMemo(() => {
    const appointmentsCount = appointments.filter(appointment =>
      appointment.status === 'Pendente' && isToday(appointment.date)
    ).length;

    return appointmentsCount;
  }, [appointments]);

  // 🎂 KPI 8: ANIVERSARIANTES DE HOJE - LÓGICA INTELIGENTE COM CONTROLE DE SAUDAÇÕES
  const aniversariantesHoje = useMemo(() => {
    if (clientsLoading || greetingsLoading) return [];

    // 1. Filtrar clientes que fazem aniversário hoje
    const birthdayClientsToday = clients.filter(client =>
      client.birthDate && isBirthdayToday(client.birthDate)
    );

    // 2. Filtrar apenas os que NÃO receberam saudação este ano
    const unsalutedClients = birthdayClientsToday.filter(client =>
      !sentGreetings.includes(client.id)
    );

    // 3. Processar mensagens personalizadas
    const processedClients = processClients(unsalutedClients);

    return processedClients;
  }, [clients, clientsLoading, sentGreetings, greetingsLoading, processClients]);

  // 🔥 KPI 9: ANIVERSARIANTES DA SEMANA (para compatibilidade)
  const aniversariantesSemana = useMemo(() => {
    return aniversariantesHoje; // Simplificado - usar os mesmos dados
  }, [aniversariantesHoje]);

  // 🔥 DADOS PARA GRÁFICOS COM FILTRO DE DATA - AGORA VIA LEDGER!
  const monthlyCommissionData = useMemo(() => {
    // ✅ CORREÇÃO: Usar dados do Ledger (fonte única de verdade)
    return monthlyCommissionFromLedger;
  }, [monthlyCommissionFromLedger]);

  // 🆕 GRÁFICO DE CRESCIMENTO COM DADOS REAIS PROCESSADOS POR DIA OU MÊS
  const monthlyGrowthData = useMemo(() => {
    if (policiesLoading) return [];

    let filteredPolicies = policies;

    // Se há filtro de data, aplicar filtro pela data de início de vigência
    if (dateRange?.from && dateRange?.to) {
      filteredPolicies = policies.filter(policy =>
        policy.startDate && isDateInRange(policy.startDate)
      );
    }

    console.log('��� Processando dados de crescimento...');
    console.log('📈 Apólices filtradas:', filteredPolicies.length);
    console.log('📈 DateRange:', dateRange);

    // Determinar granularidade baseada no período
    let granularidade: 'dia' | 'mes' = 'mes';
    if (dateRange?.from && dateRange?.to) {
      const diasDiferenca = differenceInDays(dateRange.to, dateRange.from);
      if (diasDiferenca <= 90) { // Se for 90 dias ou menos, usar granularidade diária
        granularidade = 'dia';
      }
    }



    if (granularidade === 'dia' && dateRange?.from && dateRange?.to) {
      // PROCESSAR DADOS POR DIA COM DADOS REAIS
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });

      return days.map(day => {
        const dayStr = format(day, 'dd/MM');

        const novas = filteredPolicies.filter(policy => {
          // Usar start_date em vez de created_at
          if (!policy.startDate) return false;

          const startDate = new Date(policy.startDate);
          const sameDay = format(startDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
          const isAtiva = policy.status === 'Ativa';

          return sameDay && isAtiva;
        }).length;

        const renovadas = filteredPolicies.filter(policy => {
          // Usar start_date em vez de created_at
          if (!policy.startDate) return false;

          const startDate = new Date(policy.startDate);
          const sameDay = format(startDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
          const isRenovada = policy.renewalStatus === 'Renovada';

          return sameDay && isRenovada;
        }).length;

        return {
          month: dayStr,
          novas,
          renovadas
        };
      });
    } else {
      // PROCESSAR DADOS POR MÊS
      const months = [];
      const today = new Date();

      for (let i = 5; i >= 0; i--) {
        const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthStr = month.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

        const novas = filteredPolicies.filter(policy => {
          // Usar start_date em vez de created_at
          if (!policy.startDate) return false;

          const startDate = new Date(policy.startDate);
          const sameMonth = startDate.getMonth() === month.getMonth();
          const sameYear = startDate.getFullYear() === month.getFullYear();
          const isAtiva = policy.status === 'Ativa';

          return sameMonth && sameYear && isAtiva;
        }).length;

        const renovadas = filteredPolicies.filter(policy => {
          // Usar start_date em vez de created_at
          if (!policy.startDate) return false;

          const startDate = new Date(policy.startDate);
          const sameMonth = startDate.getMonth() === month.getMonth();
          const sameYear = startDate.getFullYear() === month.getFullYear();
          const isRenovada = policy.renewalStatus === 'Renovada';

          return sameMonth && sameYear && isRenovada;
        }).length;

        months.push({
          month: monthStr,
          novas,
          renovadas
        });
      }

      return months;
    }
  }, [policies, policiesLoading, dateRange]);

  // 📊 GRÁFICOS DE PIZZA COM FILTRO DE DATA - USANDO RPC OTIMIZADA
  // Query para buscar distribuição de ramos usando RPC
  const { data: branchDistributionFromRPC } = useQuery({
    queryKey: ['branch-distribution', user?.id, dateRange],
    queryFn: async () => {
      if (!user || !dateRange?.from || !dateRange?.to) return [];

      const { data, error } = await supabase.rpc('get_producao_por_ramo', {
        p_user_id: user.id,
        start_range: dateRange.from.toISOString(),
        end_range: dateRange.to.toISOString()
      });

      if (error) {
        console.error('❌ Erro ao buscar distribuição de ramos:', error);
        throw error;
      }

      // Transformar para o formato esperado pelo componente
      const distribution = (data || []).map((item: any) => ({
        ramo: item.ramo_nome,
        total: Number(item.total_apolices),
        valor: Number(item.total_premio),
        valorComissao: Number(item.total_comissao),
        taxaMediaComissao: Number(item.taxa_media_comissao)
      }));

      // Agrupar itens pequenos (menos de 5% do total) em "Outros"
      const totalValue = distribution.reduce((sum: number, item: any) => sum + item.valor, 0);
      const threshold = totalValue * 0.05;

      const mainItems = distribution.filter((item: any) => item.valor >= threshold);
      const smallItems = distribution.filter((item: any) => item.valor < threshold);

      if (smallItems.length > 0 && mainItems.length > 0) {
        const othersData = smallItems.reduce(
          (acc: any, item: any) => ({
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
    enabled: Boolean(user && dateRange?.from && dateRange?.to)
  });

  // Usar os dados da RPC ou array vazio
  const branchDistributionData = branchDistributionFromRPC || [];

  // 📊 DISTRIBUIÇÃO POR SEGURADORAS COM FILTRO DE DATA - BASEADO EM POLÍTICAS ATIVAS
  const companyDistributionData = useMemo(() => {
    if (!isDataReady || policiesLoading) return [];

    let filteredPolicies = policies;

    // Aplicar filtro de data se fornecido (usando start_date)
    if (dateRange?.from && dateRange?.to) {
      filteredPolicies = policies.filter(p => p.startDate && isDateInRange(p.startDate));
    }

    // Filtrar apenas apólices ativas
    const activePolicies = filteredPolicies.filter(p => p.status === 'Ativa');

    // Agrupar por insurance_company
    const companyData: { [key: string]: { count: number; premium: number; commission: number } } = {};

    activePolicies.forEach(policy => {
      const companyId = policy.insuranceCompany || 'Não informado';
      const premiumValue = policy.premiumValue || 0;
      const commissionRate = policy.commissionRate || 0;
      const commissionValue = (premiumValue * commissionRate) / 100;

      if (!companyData[companyId]) {
        companyData[companyId] = { count: 0, premium: 0, commission: 0 };
      }
      companyData[companyId].count += 1;
      companyData[companyId].premium += premiumValue;
      companyData[companyId].commission += commissionValue;
    });

    // Converter para array e ordenar por valor
    let distribution = Object.entries(companyData).map(([companyId, data]) => {
      const avgCommissionRate = data.premium > 0 ? (data.commission / data.premium) * 100 : 0;

      return {
        seguradora: companyId === 'Não informado' ? 'Não informado' : getCompanyName(companyId),
        total: data.count,
        valor: data.premium,
        valorComissao: data.commission,
        taxaMediaComissao: avgCommissionRate
      };
    }).sort((a, b) => b.valor - a.valor);

    // Agrupar itens pequenos (menos de 5% do total de valor) em "Outros"
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

      if (othersData.valor > 0) {
        othersData.taxaMediaComissao = (othersData.valorComissao / othersData.valor) * 100;
      }

      distribution = [...mainItems.slice(0, 7), othersData];
    }

    return distribution;
  }, [isDataReady, policiesLoading, policies, getCompanyName, dateRange]);

  // 🆕 INSIGHTS DINÂMICOS - ANÁLISE INTELIGENTE DOS DADOS
  const insightRamoPrincipal = useMemo(() => {
    if (policiesLoading || branchDistributionData.length === 0) {
      return 'Carregando análise de ramos...';
    }

    const totalValue = branchDistributionData.reduce((sum, item) => sum + item.valor, 0);
    const principal = branchDistributionData.reduce((prev, current) =>
      current.valor > prev.valor ? current : prev
    );

    if (totalValue === 0) {
      return 'Sem dados de produção para análise no período selecionado.';
    }

    const percentage = Math.round((principal.valor / totalValue) * 100);
    const periodText = dateRange?.from && dateRange?.to ? 'no período selecionado' : 'na sua produção';

    if (percentage >= 60) {
      return `O ramo "${principal.ramo}" domina ${periodText} com ${percentage}% do faturamento. Considere diversificar para reduzir riscos.`;
    } else if (percentage >= 40) {
      return `O ramo "${principal.ramo}" é o carro-chefe ${periodText}, representando ${percentage}% da produção total.`;
    } else {
      return `Produção bem diversificada ${periodText}! O ramo líder "${principal.ramo}" representa apenas ${percentage}% do faturamento.`;
    }
  }, [branchDistributionData, policiesLoading, dateRange]);

  const insightSeguradoraPrincipal = useMemo(() => {
    if (policiesLoading || companyDistributionData.length === 0) {
      return 'Carregando análise de seguradoras...';
    }

    const totalValue = companyDistributionData.reduce((sum, item) => sum + item.valor, 0);
    const principal = companyDistributionData.reduce((prev, current) =>
      current.valor > prev.valor ? current : prev
    );

    if (totalValue === 0) {
      return 'Sem dados de faturamento para análise no período selecionado.';
    }

    const percentage = Math.round((principal.valor / totalValue) * 100);
    const periodText = dateRange?.from && dateRange?.to ? 'no período selecionado' : '';

    if (percentage >= 70) {
      return `Concentração alta ${periodText}: ${principal.seguradora} representa ${percentage}% do faturamento. Diversifique para reduzir dependência.`;
    } else if (percentage >= 50) {
      return `${principal.seguradora} é sua parceira principal ${periodText} com ${percentage}% do faturamento total.`;
    } else {
      return `Boa distribuição entre seguradoras ${periodText}. ${principal.seguradora} lidera com ${percentage}% do faturamento.`;
    }
  }, [companyDistributionData, policiesLoading, dateRange]);

  const insightCrescimento = useMemo(() => {
    if (policiesLoading || monthlyGrowthData.length === 0) {
      return 'Carregando análise de crescimento...';
    }

    const mesComMaisNovas = monthlyGrowthData.reduce((prev, current) =>
      current.novas > prev.novas ? current : prev
    );

    const ultimoMes = monthlyGrowthData[monthlyGrowthData.length - 1];
    const penultimoMes = monthlyGrowthData[monthlyGrowthData.length - 2];

    if (!ultimoMes || !penultimoMes) {
      return 'Dados insuficientes para análise de tendência.';
    }

    const totalUltimoMes = ultimoMes.novas + ultimoMes.renovadas;
    const totalPenultimoMes = penultimoMes.novas + penultimoMes.renovadas;

    const periodText = dateRange?.from && dateRange?.to ? 'no período filtrado' : '';

    if (totalUltimoMes > totalPenultimoMes) {
      return `Tendência positiva ${periodText}! ${ultimoMes.month} teve ${totalUltimoMes} apólices vs. ${totalPenultimoMes} no período anterior.`;
    } else if (totalUltimoMes < totalPenultimoMes) {
      return `Atenção ${periodText}: queda de ${totalPenultimoMes} para ${totalUltimoMes} apólices entre ${penultimoMes.month} e ${ultimoMes.month}.`;
    } else {
      return `${mesComMaisNovas.month} foi seu melhor período ${periodText} com ${mesComMaisNovas.novas} novas apólices. Mantenha o ritmo!`;
    }
  }, [monthlyGrowthData, policiesLoading, dateRange]);

  // 🆕 INSIGHT GLOBAL - RESUMO ESTRATÉGICO INTELIGENTE
  const dashboardGlobalInsight = useMemo(() => {
    if (policiesLoading || clientsLoading || financialKpisLoading) {
      return 'Carregando análise estratégica...';
    }

    // Construir insight baseado nos dados mais críticos
    let insights = [];
    const periodText = dateRange?.from && dateRange?.to ? 'no período selecionado' : 'este mês';

    // 1. ANÁLISE DE CRESCIMENTO (Positiva)
    if (apolicesNovasMes > 0 && comissaoMesAtual > 0) {
      insights.push(`📈 Forte: ${apolicesNovasMes} apólices novas geraram ${formatCurrency(comissaoMesAtual)} ${periodText}`);
    } else if (apolicesNovasMes > 0) {
      insights.push(`📋 Movimento: ${apolicesNovasMes} apólices novas criadas ${periodText}`);
    } else {
      insights.push(`🎯 Oportunidade: Foque em prospecção - nenhuma apólice nova ${periodText}`);
    }

    // 2. ANÁLISE DE RISCO (Crítica)
    if (renewals30Days > 0) {
      insights.push(`⚠️ Atenção: ${renewals30Days} renovações precisam de contato urgente nos próximos 30 dias`);
    } else if (renewals90Days > 0) {
      insights.push(`📅 Planeje: ${renewals90Days} renovações se aproximam nos próximos 90 dias`);
    } else {
      insights.push(`✅ Tranquilo: Nenhuma renovação crítica no horizonte próximo`);
    }

    // 3. ANÁLISE DE RELACIONAMENTO (Se houver aniversariantes)
    if (aniversariantesHoje.length > 0) {
      insights.push(`🎂 Relacionamento: ${aniversariantesHoje.length} clientes fazem aniversário hoje - hora de cumprimentar!`);
    }

    // Juntar os insights com separador
    return insights.join('. ') + '.';
  }, [
    policiesLoading, clientsLoading, financialKpisLoading,
    apolicesNovasMes, comissaoMesAtual, renewals30Days, renewals90Days, aniversariantesHoje, dateRange
  ]);

  // 🔥 ESTADO DE LOADING GERAL
  const isLoading = policiesLoading || clientsLoading || financialKpisLoading || monthlyCommissionLoading || greetingsLoading || ramosLoading || companiesLoading;

  // ====================== INÍCIO DO BLOCO DE DIAGNÓSTICO ======================
  useEffect(() => {
    // Logs removidos para limpeza
  }, [isDataReady, ramos, companies]);
  // ======================= FIM DO BLOCO DE DIAGNÓSTICO ========================

  return {
    renewals90Days,
    renewals30Days,
    todaysAppointments,
    activeClients,
    comissaoMesAtual,
    comissaoPendente,
    comissaoMesAnterior,
    apolicesNovasMes,
    aniversariantesSemana,
    aniversariantesHoje,
    monthlyCommissionData,
    monthlyGrowthData,
    branchDistributionData,
    companyDistributionData,
    insightRamoPrincipal,
    insightSeguradoraPrincipal,
    insightCrescimento,
    dashboardGlobalInsight,

    // Informações sobre taxas de comissão reais calculadas dinamicamente
    commissionRates: {
      // Se há dados suficientes para confiar nas taxas calculadas
      hasReliableData,

      // Estatísticas resumidas das taxas de comissão
      stats,

      // Relatório detalhado por tipo de apólice
      report: commissionRatesReport,

      // Cobertura e validação dos dados
      dataCoverage,

      // Taxa média geral da corretora
      overallAverageRate: getOverallAverageRate
    },

    isLoading
  };
}
