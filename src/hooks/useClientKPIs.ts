import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { subDays } from 'date-fns';

export interface ClientFilters {
  searchTerm?: string;
  status?: string;
}

export interface ClientKPIs {
  totalActive: number;
  newClientsLast30d: number;
  clientsWithPolicies: number;
  totalPoliciesValue: number;
}

export function useClientKPIs(filters: ClientFilters) {
  const { user } = useAuth();

  const { data: kpis, isLoading, error } = useQuery({
    queryKey: ['client-kpis', filters, user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      console.log('📊 Calculating Client KPIs with filters:', filters);

      // Construir query base para clientes (SEM paginação)
      let clientQuery = supabase
        .from('clientes')
        .select('id, status, created_at')
        .eq('user_id', user.id);

      // Aplicar filtro por Status
      if (filters.status && filters.status !== 'todos') {
        clientQuery = clientQuery.eq('status', filters.status);
      }

      // Aplicar filtro por Termo de Busca
      if (filters.searchTerm && filters.searchTerm.trim()) {
        const searchTerm = filters.searchTerm.trim();
        clientQuery = clientQuery.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,cpf_cnpj.ilike.%${searchTerm}%`);
      }

      // Executar query de clientes
      const { data: clientsData, error: clientsError } = await clientQuery;

      if (clientsError) {
        console.error('❌ Error fetching clients for KPIs:', clientsError);
        throw clientsError;
      }

      // Buscar todas as apólices ativas dos clientes filtrados
      const clientIds = (clientsData || []).map(c => c.id);
      
      let policiesValue = 0;
      let clientsWithActivePolicies = new Set<string>();

      if (clientIds.length > 0) {
        const { data: policiesData, error: policiesError } = await supabase
          .from('apolices')
          .select('client_id, premium_value, status')
          .eq('user_id', user.id)
          .in('client_id', clientIds)
          .eq('status', 'Ativa');

        if (policiesError) {
          console.error('❌ Error fetching policies for KPIs:', policiesError);
        } else {
          (policiesData || []).forEach(policy => {
            policiesValue += Number(policy.premium_value) || 0;
            clientsWithActivePolicies.add(policy.client_id);
          });
        }
      }

      // Calcular KPIs
      const hoje = new Date();
      const trinta_dias_atras = subDays(hoje, 30);

      const calculatedKPIs = (clientsData || []).reduce(
        (acc, client) => {
          // Total de Clientes Ativos
          if (client.status === 'Ativo') {
            acc.totalActive++;
          }

          // Novos Clientes (Últimos 30 dias)
          if (client.created_at && new Date(client.created_at) >= trinta_dias_atras) {
            acc.newClientsLast30d++;
          }

          return acc;
        },
        {
          totalActive: 0,
          newClientsLast30d: 0,
          clientsWithPolicies: clientsWithActivePolicies.size,
          totalPoliciesValue: policiesValue,
        }
      );

      console.log('✅ Client KPIs calculated:', calculatedKPIs);
      return calculatedKPIs;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  return {
    kpis: kpis || {
      totalActive: 0,
      newClientsLast30d: 0,
      clientsWithPolicies: 0,
      totalPoliciesValue: 0,
    },
    isLoading,
    error,
  };
}
