import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PolicyFilters } from './useFilteredPolicies';
import { startOfMonth, endOfMonth, addDays, startOfToday, differenceInDays } from 'date-fns';

export interface PolicyKPIs {
  totalActive: number;
  totalPremium: number;
  estimatedCommission: number;
  expiringSoon: number;
}

export function usePolicyKPIs(filters: PolicyFilters) {
  const { user } = useAuth();

  const { data: kpis, isLoading, error } = useQuery({
    queryKey: ['policy-kpis', filters, user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      console.log('📊 Calculating KPIs with filters:', filters);

      // Construir query base (mesmos filtros da paginação, mas SEM .range())
      let query = supabase
        .from('apolices')
        .select('premium_value, commission_rate, status, expiration_date')
        .eq('user_id', user.id);

      // Aplicar filtro por Status
      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }

      // Aplicar filtro por Seguradora
      if (filters.insuranceCompany && filters.insuranceCompany !== 'todas') {
        query = query.eq('insurance_company', filters.insuranceCompany);
      }

      // Aplicar filtro por Ramo
      if (filters.ramo && filters.ramo !== 'todos') {
        query = query.eq('type', filters.ramo);
      }

      // Aplicar filtro por Produtor
      if (filters.producerId && filters.producerId !== 'todos') {
        query = query.eq('producer_id', filters.producerId);
      }

      // Aplicar filtro por Termo de Busca
      if (filters.searchTerm && filters.searchTerm.trim()) {
        const searchTerm = filters.searchTerm.trim();
        query = query.or(`policy_number.ilike.%${searchTerm}%,insured_asset.ilike.%${searchTerm}%`);
      }

      // Aplicar filtro por Período de Vencimento
      if (filters.period && filters.period !== 'todos') {
        const hoje = startOfToday();

        if (filters.period === 'custom' && filters.customStart && filters.customEnd) {
          query = query
            .gte('expiration_date', filters.customStart)
            .lte('expiration_date', filters.customEnd);
        } else {
          switch (filters.period) {
            case 'current-month':
              const inicioMes = startOfMonth(hoje);
              const fimMes = endOfMonth(hoje);
              query = query
                .gte('expiration_date', inicioMes.toISOString())
                .lte('expiration_date', fimMes.toISOString());
              break;
            case 'next-30-days':
              const prox30 = addDays(hoje, 30);
              query = query
                .gte('expiration_date', hoje.toISOString())
                .lte('expiration_date', prox30.toISOString());
              break;
            case 'next-90-days':
              const prox90 = addDays(hoje, 90);
              query = query
                .gte('expiration_date', hoje.toISOString())
                .lte('expiration_date', prox90.toISOString());
              break;
            case 'expired':
              query = query.lt('expiration_date', hoje.toISOString());
              break;
          }
        }
      }

      // Executar query (SEM PAGINAÇÃO!)
      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching KPIs:', error);
        throw error;
      }

      // Calcular KPIs no client-side
      const hoje = new Date();
      const calculatedKPIs = (data || []).reduce(
        (acc, policy) => {
          // Total de Apólices Ativas
          if (policy.status === 'Ativa') {
            acc.totalActive++;
          }

          // Prêmio Total
          acc.totalPremium += Number(policy.premium_value) || 0;

          // Comissão Estimada (premium * commission_rate / 100)
          const premium = Number(policy.premium_value) || 0;
          const commissionRate = Number(policy.commission_rate) || 0;
          acc.estimatedCommission += (premium * commissionRate) / 100;

          // Apólices Vencendo nos Próximos 30 Dias
          if (policy.status === 'Ativa' && policy.expiration_date) {
            const daysUntilExpiration = differenceInDays(
              new Date(policy.expiration_date),
              hoje
            );
            if (daysUntilExpiration >= 0 && daysUntilExpiration <= 30) {
              acc.expiringSoon++;
            }
          }

          return acc;
        },
        {
          totalActive: 0,
          totalPremium: 0,
          estimatedCommission: 0,
          expiringSoon: 0,
        }
      );

      console.log('✅ KPIs calculated:', calculatedKPIs);
      return calculatedKPIs;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  return {
    kpis: kpis || {
      totalActive: 0,
      totalPremium: 0,
      estimatedCommission: 0,
      expiringSoon: 0,
    },
    isLoading,
    error,
  };
}
