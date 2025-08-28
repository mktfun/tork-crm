import { useMemo } from 'react';
import { useClients, usePolicies, useTransactions, useAppointments } from '@/hooks/useAppData';
import { useCompanyNames } from '@/hooks/useCompanyNames';
import { useProfile } from '@/hooks/useProfile';
import { useBirthdayGreetings } from '@/hooks/useBirthdayGreetings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { isBirthdayToday, isWithinDays, isInMonth, isToday } from '@/utils/dateUtils';
import { formatCurrency } from '@/utils/formatCurrency';
import { format, differenceInDays, eachDayOfInterval, parseISO } from 'date-fns';

export function useDashboardMetrics() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { processClients } = useBirthdayGreetings();
  
  // Use Supabase hooks directly instead of store
  const { policies, loading: policiesLoading } = usePolicies();
  const { appointments } = useAppointments();
  const { clients, loading: clientsLoading } = useClients();
  const { transactions, loading: transactionsLoading } = useTransactions();
  const { getCompanyName } = useCompanyNames();

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

  // 🔥 KPI 1: CLIENTES ATIVOS - MEMOIZAÇÃO INDIVIDUAL
  const activeClients = useMemo(() => {
    if (clientsLoading) return 0;
    console.log('🔢 Calculando clientes ativos:', clients.length);
    return clients.length;
  }, [clients, clientsLoading]);

  // 🔥 KPI 2: RENOVAÇÕES EM 30 DIAS - MEMOIZAÇÃO INDIVIDUAL
  const renewals30Days = useMemo(() => {
    if (policiesLoading) return 0;
    
    const renewalsCount = policies.filter(policy => 
      policy.status === 'Ativa' && isWithinDays(policy.expirationDate, 30)
    ).length;
    
    console.log('📅 Calculando renovações em 30 dias:', renewalsCount);
    return renewalsCount;
  }, [policies, policiesLoading]);

  // 🔥 KPI 3: RENOVAÇÕES EM 90 DIAS - MEMOIZAÇÃO INDIVIDUAL
  const renewals90Days = useMemo(() => {
    if (policiesLoading) return 0;
    
    const renewalsCount = policies.filter(policy => 
      policy.status === 'Ativa' && isWithinDays(policy.expirationDate, 90)
    ).length;
    
    console.log('📅 Calculando renovações em 90 dias:', renewalsCount);
    return renewalsCount;
  }, [policies, policiesLoading]);

  // 🔥 KPI 4: COMISSÃO DO MÊS ATUAL - CORREÇÃO CRÍTICA
  const comissaoMesAtual = useMemo(() => {
    if (transactionsLoading) return 0;
    
    const comissaoTotal = transactions
      .filter(t => {
        const isThisMonth = isInMonth(t.date, 0);
        const isRealizado = t.status === 'REALIZADO' || t.status === 'PAGO';
        const isReceita = t.nature === 'RECEITA';
        
        console.log('💰 Transação:', {
          id: t.id,
          amount: t.amount,
          date: t.date,
          status: t.status,
          nature: t.nature,
          isThisMonth,
          isRealizado,
          isReceita,
          incluir: isThisMonth && isRealizado && isReceita
        });
        
        return isThisMonth && isRealizado && isReceita;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    console.log('💰 Comissão calculada do mês atual:', comissaoTotal);
    return comissaoTotal;
  }, [transactions, transactionsLoading]);

  // 🔥 KPI 5: COMISSÃO DO MÊS ANTERIOR - CORREÇÃO CRÍTICA
  const comissaoMesAnterior = useMemo(() => {
    if (transactionsLoading) return 0;
    
    const comissaoTotal = transactions
      .filter(t => {
        const isLastMonth = isInMonth(t.date, -1);
        const isRealizado = t.status === 'REALIZADO' || t.status === 'PAGO';
        const isReceita = t.nature === 'RECEITA';
        
        return isLastMonth && isRealizado && isReceita;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    console.log('💰 Comissão calculada do mês anterior:', comissaoTotal);
    return comissaoTotal;
  }, [transactions, transactionsLoading]);

  // 🔥 KPI 6: APÓLICES NOVAS DO MÊS - CORREÇÃO CRÍTICA
  const apolicesNovasMes = useMemo(() => {
    if (policiesLoading) return 0;
    
    const apolicesCount = policies.filter(policy => {
      const isThisMonth = isInMonth(policy.createdAt, 0);
      const isAtiva = policy.status === 'Ativa';
      
      console.log('📋 Apólice nova:', {
        id: policy.id,
        status: policy.status,
        createdAt: policy.createdAt,
        isThisMonth,
        isAtiva,
        incluir: isThisMonth && isAtiva
      });
      
      return isThisMonth && isAtiva;
    }).length;

    console.log('📋 Apólices novas do mês calculadas:', apolicesCount);
    return apolicesCount;
  }, [policies, policiesLoading]);

  // 🔥 KPI 7: AGENDAMENTOS DE HOJE
  const todaysAppointments = useMemo(() => {
    const appointmentsCount = appointments.filter(appointment => 
      appointment.status === 'Pendente' && isToday(appointment.date)
    ).length;
    
    console.log('📅 Agendamentos de hoje:', appointmentsCount);
    return appointmentsCount;
  }, [appointments]);

  // 🎂 KPI 8: ANIVERSARIANTES DE HOJE - LÓGICA INTELIGENTE COM CONTROLE DE SAUDAÇÕES
  const aniversariantesHoje = useMemo(() => {
    if (clientsLoading || greetingsLoading) return [];
    
    console.log('🎂 Buscando aniversariantes de hoje...');
    console.log('🎂 Saudações já enviadas este ano:', sentGreetings);
    
    // 1. Filtrar clientes que fazem aniversário hoje
    const birthdayClientsToday = clients.filter(client => 
      client.birthDate && isBirthdayToday(client.birthDate)
    );
    
    console.log('🎂 Clientes que fazem aniversário hoje:', birthdayClientsToday.length);
    
    // 2. Filtrar apenas os que NÃO receberam saudação este ano
    const unsalutedClients = birthdayClientsToday.filter(client => 
      !sentGreetings.includes(client.id)
    );
    
    console.log('🎂 Clientes que ainda não receberam saudação:', unsalutedClients.length);
    
    // 3. Processar mensagens personalizadas
    const processedClients = processClients(unsalutedClients);
    
    console.log('🎂 Aniversariantes processados para saudação:', processedClients);
    return processedClients;
  }, [clients, clientsLoading, sentGreetings, greetingsLoading, processClients]);

  // 🔥 KPI 9: ANIVERSARIANTES DA SEMANA (para compatibilidade)
  const aniversariantesSemana = useMemo(() => {
    return aniversariantesHoje; // Simplificado - usar os mesmos dados
  }, [aniversariantesHoje]);

  // 🔥 DADOS PARA GRÁFICOS COM GRANULARIDADE INTELIGENTE
  const monthlyCommissionData = useMemo(() => {
    if (transactionsLoading) return [];
    
    const months = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = month.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      const monthlyCommission = transactions
        .filter(t => {
          const transactionDate = new Date(t.date);
          const sameMonth = transactionDate.getMonth() === month.getMonth();
          const sameYear = transactionDate.getFullYear() === month.getFullYear();
          const isRealizado = t.status === 'REALIZADO' || t.status === 'PAGO';
          const isReceita = t.nature === 'RECEITA';
          
          return sameMonth && sameYear && isRealizado && isReceita;
        })
        .reduce((sum, t) => sum + t.amount, 0);

      months.push({
        mes: monthStr,
        comissao: monthlyCommission
      });
    }
    
    console.log('📊 Dados mensais de comissão:', months);
    return months;
  }, [transactions, transactionsLoading]);

  // 🆕 GRÁFICO DE CRESCIMENTO COM GRANULARIDADE ADAPTÁVEL
  const monthlyGrowthData = useMemo(() => {
    if (policiesLoading) return [];
    
    const months = [];
    const today = new Date();
    
    // Sempre gerar dados mensais - a granularidade será ajustada no componente
    for (let i = 5; i >= 0; i--) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = month.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      const novas = policies.filter(policy => {
        const createdDate = new Date(policy.createdAt);
        const sameMonth = createdDate.getMonth() === month.getMonth();
        const sameYear = createdDate.getFullYear() === month.getFullYear();
        const isAtiva = policy.status === 'Ativa';
        
        return sameMonth && sameYear && isAtiva;
      }).length;
      
      const renovadas = policies.filter(policy => {
        const renewalDate = new Date(policy.createdAt);
        const sameMonth = renewalDate.getMonth() === month.getMonth();
        const sameYear = renewalDate.getFullYear() === month.getFullYear();
        const isRenovada = policy.renewalStatus === 'Renovada';
        
        return sameMonth && sameYear && isRenovada;
      }).length;

      months.push({
        month: monthStr,
        novas,
        renovadas
      });
    }
    
    console.log('📈 Dados de crescimento mensal:', months);
    return months;
  }, [policies, policiesLoading]);

  const branchDistributionData = useMemo(() => {
    if (policiesLoading) return [];
    
    const branchData: { [key: string]: { count: number; value: number } } = {};
    
    policies
      .filter(policy => policy.status === 'Ativa')
      .forEach(policy => {
        const branch = policy.type || 'Não informado';
        const value = policy.premiumValue || 0;
        
        if (!branchData[branch]) {
          branchData[branch] = { count: 0, value: 0 };
        }
        branchData[branch].count += 1;
        branchData[branch].value += value;
      });

    // Converter para array e ordenar por valor
    let distribution = Object.entries(branchData).map(([ramo, data]) => ({
      ramo,
      total: data.count,
      valor: data.value
    })).sort((a, b) => b.valor - a.valor);

    // Agrupar itens pequenos (menos de 5% do total de valor) em "Outros"
    const totalValue = distribution.reduce((sum, item) => sum + item.valor, 0);
    const threshold = totalValue * 0.05;
    
    const mainItems = distribution.filter(item => item.valor >= threshold);
    const smallItems = distribution.filter(item => item.valor < threshold);
    
    if (smallItems.length > 0 && mainItems.length > 0) {
      const othersData = smallItems.reduce(
        (acc, item) => ({
          ramo: 'Outros',
          total: acc.total + item.total,
          valor: acc.valor + item.valor
        }),
        { ramo: 'Outros', total: 0, valor: 0 }
      );
      
      distribution = [...mainItems.slice(0, 7), othersData];
    }
    
    console.log('📊 Distribuição por ramos (por valor):', distribution);
    return distribution;
  }, [policies, policiesLoading]);

  // 🆕 KPI 10: DISTRIBUIÇÃO POR SEGURADORAS
  const companyDistributionData = useMemo(() => {
    if (policiesLoading) return [];
    
    const companyData: { [key: string]: { count: number; value: number } } = {};
    
    policies
      .filter(policy => policy.status === 'Ativa')
      .forEach(policy => {
        const companyId = policy.insuranceCompany || 'Não informado';
        const value = policy.premiumValue || 0;
        
        if (!companyData[companyId]) {
          companyData[companyId] = { count: 0, value: 0 };
        }
        companyData[companyId].count += 1;
        companyData[companyId].value += value;
      });

    // Converter para array e ordenar por valor
    let distribution = Object.entries(companyData).map(([companyId, data]) => ({
      seguradora: companyId === 'Não informado' ? 'Não informado' : getCompanyName(companyId),
      total: data.count,
      valor: data.value
    })).sort((a, b) => b.valor - a.valor);

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
          valor: acc.valor + item.valor
        }),
        { seguradora: 'Outros', total: 0, valor: 0 }
      );
      
      distribution = [...mainItems.slice(0, 7), othersData];
    }
    
    console.log('📊 Distribuição por seguradoras (por valor):', distribution);
    return distribution;
  }, [policies, policiesLoading, getCompanyName]);

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
      return 'Sem dados de produção para análise.';
    }
    
    const percentage = Math.round((principal.valor / totalValue) * 100);
    
    if (percentage >= 60) {
      return `O ramo "${principal.ramo}" domina sua produção com ${percentage}% do faturamento. Considere diversificar para reduzir riscos.`;
    } else if (percentage >= 40) {
      return `O ramo "${principal.ramo}" é o carro-chefe, representando ${percentage}% da sua produção total.`;
    } else {
      return `Produção bem diversificada! O ramo líder "${principal.ramo}" representa apenas ${percentage}% do faturamento.`;
    }
  }, [branchDistributionData, policiesLoading]);

  const insightSeguradoraPrincipal = useMemo(() => {
    if (policiesLoading || companyDistributionData.length === 0) {
      return 'Carregando análise de seguradoras...';
    }
    
    const totalValue = companyDistributionData.reduce((sum, item) => sum + item.valor, 0);
    const principal = companyDistributionData.reduce((prev, current) => 
      current.valor > prev.valor ? current : prev
    );
    
    if (totalValue === 0) {
      return 'Sem dados de faturamento para análise.';
    }
    
    const percentage = Math.round((principal.valor / totalValue) * 100);
    
    if (percentage >= 70) {
      return `Concentração alta: ${principal.seguradora} representa ${percentage}% do faturamento. Diversifique para reduzir dependência.`;
    } else if (percentage >= 50) {
      return `${principal.seguradora} é sua parceira principal com ${percentage}% do faturamento total.`;
    } else {
      return `Boa distribuição entre seguradoras. ${principal.seguradora} lidera com ${percentage}% do faturamento.`;
    }
  }, [companyDistributionData, policiesLoading]);

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
    
    if (totalUltimoMes > totalPenultimoMes) {
      return `Tendência positiva! ${ultimoMes.month} teve ${totalUltimoMes} apólices vs. ${totalPenultimoMes} no mês anterior.`;
    } else if (totalUltimoMes < totalPenultimoMes) {
      return `Atenção: queda de ${totalPenultimoMes} para ${totalUltimoMes} apólices entre ${penultimoMes.month} e ${ultimoMes.month}.`;
    } else {
      return `${mesComMaisNovas.month} foi seu melhor mês com ${mesComMaisNovas.novas} novas apólices. Mantenha o ritmo!`;
    }
  }, [monthlyGrowthData, policiesLoading]);

  // 🆕 INSIGHT GLOBAL - RESUMO ESTRATÉGICO INTELIGENTE
  const dashboardGlobalInsight = useMemo(() => {
    if (policiesLoading || clientsLoading || transactionsLoading) {
      return 'Carregando análise estratégica...';
    }

    // Construir insight baseado nos dados mais críticos
    let insights = [];

    // 1. ANÁLISE DE CRESCIMENTO (Positiva)
    if (apolicesNovasMes > 0 && comissaoMesAtual > 0) {
      insights.push(`📈 Forte: ${apolicesNovasMes} apólices novas geraram ${formatCurrency(comissaoMesAtual)}`);
    } else if (apolicesNovasMes > 0) {
      insights.push(`📋 Movimento: ${apolicesNovasMes} apólices novas criadas este mês`);
    } else {
      insights.push(`🎯 Oportunidade: Foque em prospecção - nenhuma apólice nova este mês`);
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
    policiesLoading, clientsLoading, transactionsLoading,
    apolicesNovasMes, comissaoMesAtual, renewals30Days, renewals90Days, aniversariantesHoje
  ]);

  // 🔥 ESTADO DE LOADING GERAL
  const isLoading = policiesLoading || clientsLoading || transactionsLoading || greetingsLoading;

  // 🔥 LOG FINAL DE VALIDAÇÃO
  console.log('🎯 RESUMO DOS KPIS CALCULADOS:', {
    activeClients,
    renewals30Days,
    renewals90Days,
    comissaoMesAtual,
    comissaoMesAnterior,
    apolicesNovasMes,
    todaysAppointments,
    aniversariantesHoje: aniversariantesHoje.length,
    isLoading
  });

  return {
    renewals90Days,
    renewals30Days,
    todaysAppointments,
    activeClients,
    comissaoMesAtual,
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
    isLoading
  };
}
