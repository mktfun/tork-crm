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
import { format, differenceInDays, eachDayOfInterval, parseISO, isWithinInterval, isSameMonth, isSameYear, startOfDay, endOfDay, isAfter, isBefore } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { calculateCommissionValue, getCommissionRateByType } from '@/utils/commissionRates';

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
  const { transactions, loading: transactionsLoading } = useTransactions();
  const { getCompanyName } = useCompanyNames();

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

  // 🔥 KPI 1: CLIENTES ATIVOS - MEMOIZAÇÃO INDIVIDUAL
  const activeClients = useMemo(() => {
    if (clientsLoading) return 0;
    
    // Filter clients by date range if provided
    let filteredClients = clients;
    if (dateRange?.from && dateRange?.to) {
      filteredClients = clients.filter(client => isDateInRange(client.createdAt));
    }
    
    console.log('🔢 Calculando clientes ativos com filtro:', filteredClients.length);
    return filteredClients.length;
  }, [clients, clientsLoading, dateRange]);

  // 🔥 KPI 2: RENOVAÇÕES EM 30 DIAS - MEMOIZAÇÃO INDIVIDUAL
  const renewals30Days = useMemo(() => {
    if (policiesLoading) return 0;
    
    let filteredPolicies = policies;
    if (dateRange?.from && dateRange?.to) {
      filteredPolicies = policies.filter(policy => isDateInRange(policy.createdAt));
    }
    
    const renewalsCount = filteredPolicies.filter(policy => 
      policy.status === 'Ativa' && isWithinDays(policy.expirationDate, 30)
    ).length;
    
    console.log('📅 Calculando renovações em 30 dias com filtro:', renewalsCount);
    return renewalsCount;
  }, [policies, policiesLoading, dateRange]);

  // 🔥 KPI 3: RENOVAÇÕES EM 90 DIAS - MEMOIZAÇÃO INDIVIDUAL
  const renewals90Days = useMemo(() => {
    if (policiesLoading) return 0;
    
    let filteredPolicies = policies;
    if (dateRange?.from && dateRange?.to) {
      filteredPolicies = policies.filter(policy => isDateInRange(policy.createdAt));
    }
    
    const renewalsCount = filteredPolicies.filter(policy => 
      policy.status === 'Ativa' && isWithinDays(policy.expirationDate, 90)
    ).length;
    
    console.log('📅 Calculando renovações em 90 dias com filtro:', renewalsCount);
    return renewalsCount;
  }, [policies, policiesLoading, dateRange]);

  // 🔥 KPI 4: COMISSÃO DO MÊS ATUAL OU PERÍODO FILTRADO
  const comissaoMesAtual = useMemo(() => {
    if (transactionsLoading) return 0;
    
    let filteredTransactions = transactions;
    
    // Se há filtro de data, usar o filtro; senão, usar mês atual
    if (dateRange?.from && dateRange?.to) {
      filteredTransactions = transactions.filter(t => isDateInRange(t.date));
    } else {
      filteredTransactions = transactions.filter(t => isInMonth(t.date, 0));
    }
    
    const comissaoTotal = filteredTransactions
      .filter(t => {
        const isRealizado = t.status === 'REALIZADO' || t.status === 'PAGO';
        const isReceita = t.nature === 'RECEITA';
        return isRealizado && isReceita;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    console.log('💰 Comissão calculada com filtro:', comissaoTotal);
    return comissaoTotal;
  }, [transactions, transactionsLoading, dateRange]);

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

  // 🔥 KPI 6: APÓLICES NOVAS DO PERÍODO
  const apolicesNovasMes = useMemo(() => {
    if (policiesLoading) return 0;
    
    let filteredPolicies = policies;
    
    // Se há filtro de data, usar o filtro; senão, usar mês atual
    if (dateRange?.from && dateRange?.to) {
      filteredPolicies = policies.filter(policy => isDateInRange(policy.createdAt));
    } else {
      filteredPolicies = policies.filter(policy => isInMonth(policy.createdAt, 0));
    }
    
    const apolicesCount = filteredPolicies.filter(policy => policy.status === 'Ativa').length;

    console.log('📋 Apólices novas do período calculadas:', apolicesCount);
    return apolicesCount;
  }, [policies, policiesLoading, dateRange]);

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
    console.log('🎂 Saudações j�� enviadas este ano:', sentGreetings);
    
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

  // 🔥 DADOS PARA GRÁFICOS COM FILTRO DE DATA
  const monthlyCommissionData = useMemo(() => {
    if (transactionsLoading) return [];
    
    let filteredTransactions = transactions;
    
    // Se há filtro de data, aplicar filtro
    if (dateRange?.from && dateRange?.to) {
      filteredTransactions = transactions.filter(t => isDateInRange(t.date));
    }
    
    const months = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = month.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      const monthlyCommission = filteredTransactions
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
    
    console.log('📊 Dados mensais de comissão com filtro:', months);
    return months;
  }, [transactions, transactionsLoading, dateRange]);

  // 🆕 GRÁFICO DE CRESCIMENTO COM DADOS REAIS PROCESSADOS POR DIA OU MÊS
  const monthlyGrowthData = useMemo(() => {
    if (policiesLoading) return [];
    
    let filteredPolicies = policies;
    
    // Se há filtro de data, aplicar filtro
    if (dateRange?.from && dateRange?.to) {
      filteredPolicies = policies.filter(policy => isDateInRange(policy.createdAt));
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

    console.log('📈 Granularidade:', granularidade);

    if (granularidade === 'dia' && dateRange?.from && dateRange?.to) {
      // PROCESSAR DADOS POR DIA COM DADOS REAIS
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      
      return days.map(day => {
        const dayStr = format(day, 'dd/MM');
        
        const novas = filteredPolicies.filter(policy => {
          const createdDate = new Date(policy.createdAt);
          const sameDay = format(createdDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
          const isAtiva = policy.status === 'Ativa';
          
          return sameDay && isAtiva;
        }).length;
        
        const renovadas = filteredPolicies.filter(policy => {
          const renewalDate = new Date(policy.createdAt);
          const sameDay = format(renewalDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
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
          const createdDate = new Date(policy.createdAt);
          const sameMonth = createdDate.getMonth() === month.getMonth();
          const sameYear = createdDate.getFullYear() === month.getFullYear();
          const isAtiva = policy.status === 'Ativa';
          
          return sameMonth && sameYear && isAtiva;
        }).length;
        
        const renovadas = filteredPolicies.filter(policy => {
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
      
      return months;
    }
  }, [policies, policiesLoading, dateRange]);

  // GRÁFICOS DE PIZZA COM FILTRO DE DATA
  const branchDistributionData = useMemo(() => {
    if (policiesLoading) return [];
    
    let filteredPolicies = policies;
    
    // Aplicar filtro de data se fornecido
    if (dateRange?.from && dateRange?.to) {
      filteredPolicies = policies.filter(policy => isDateInRange(policy.createdAt));
    }
    
    const branchData: { [key: string]: { count: number; value: number; commission: number; totalPolicies: any[] } } = {};
    
    filteredPolicies
      .filter(policy => policy.status === 'Ativa')
      .forEach(policy => {
        const branch = policy.type || 'Não informado';
        const value = policy.premiumValue || 0;
        const commission = calculateCommissionValue(value, policy.type || '');

        if (!branchData[branch]) {
          branchData[branch] = { count: 0, value: 0, commission: 0, totalPolicies: [] };
        }
        branchData[branch].count += 1;
        branchData[branch].value += value;
        branchData[branch].commission += commission;
        branchData[branch].totalPolicies.push(policy);
      });

    // Converter para array e ordenar por valor
    let distribution = Object.entries(branchData).map(([ramo, data]) => {
      // Calcular taxa média de comissão para este ramo
      const avgCommissionRate = data.value > 0 ? (data.commission / data.value) * 100 : 0;

      return {
        ramo,
        total: data.count,
        valor: data.value,
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
          ramo: 'Outros',
          total: acc.total + item.total,
          valor: acc.valor + item.valor,
          valorComissao: acc.valorComissao + item.valorComissao,
          taxaMediaComissao: 0 // Será recalculado abaixo
        }),
        { ramo: 'Outros', total: 0, valor: 0, valorComissao: 0, taxaMediaComissao: 0 }
      );

      // Recalcular taxa média de comissão para "Outros"
      if (othersData.valor > 0) {
        othersData.taxaMediaComissao = (othersData.valorComissao / othersData.valor) * 100;
      }

      distribution = [...mainItems.slice(0, 7), othersData];
    }
    
    console.log('📊 Distribuição por ramos (com filtro de data):', distribution);
    return distribution;
  }, [policies, policiesLoading, dateRange]);

  // 🆕 KPI 10: DISTRIBUIÇÃO POR SEGURADORAS COM FILTRO DE DATA
  const companyDistributionData = useMemo(() => {
    if (policiesLoading) return [];
    
    let filteredPolicies = policies;
    
    // Aplicar filtro de data se fornecido
    if (dateRange?.from && dateRange?.to) {
      filteredPolicies = policies.filter(policy => isDateInRange(policy.createdAt));
    }
    
    const companyData: { [key: string]: { count: number; value: number } } = {};
    
    filteredPolicies
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
    
    console.log('📊 Distribuição por seguradoras (com filtro de data):', distribution);
    return distribution;
  }, [policies, policiesLoading, getCompanyName, dateRange]);

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
    if (policiesLoading || clientsLoading || transactionsLoading) {
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
    policiesLoading, clientsLoading, transactionsLoading,
    apolicesNovasMes, comissaoMesAtual, renewals30Days, renewals90Days, aniversariantesHoje, dateRange
  ]);

  // 🔥 ESTADO DE LOADING GERAL
  const isLoading = policiesLoading || clientsLoading || transactionsLoading || greetingsLoading;

  // 🔥 LOG FINAL DE VALIDAÇÃO
  console.log('🎯 RESUMO DOS KPIS CALCULADOS COM FILTRO:', {
    activeClients,
    renewals30Days,
    renewals90Days,
    comissaoMesAtual,
    comissaoMesAnterior,
    apolicesNovasMes,
    todaysAppointments,
    aniversariantesHoje: aniversariantesHoje.length,
    dateRange,
    monthlyGrowthDataLength: monthlyGrowthData.length,
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
