import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ClientFilters {
  searchTerm?: string;
  status?: string;
}

export interface ClientKPIs {
  totalActive: number;
  newClientsLast30d: number;
  clientsWithPolicies: number;
  totalCommission: number;
}

export function useClientKPIs(filters: ClientFilters) {
  const { user } = useAuth();

  const { data: kpis, isLoading, error } = useQuery({
    queryKey: ['client-kpis', filters, user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      console.log('📊 Calling RPC get_client_kpis with filters:', filters);

      // Chamar a RPC function otimizada
      const { data, error } = await supabase.rpc('get_client_kpis', {
        p_user_id: user.id,
        p_search_term: filters.searchTerm || null,
        p_status: filters.status || 'todos'
      });

      if (error) {
        console.error('❌ Error calling get_client_kpis:', error);
        throw error;
      }

      console.log('✅ Client KPIs from RPC:', data);
      
      // Cast do tipo Json para nosso formato
      const result = data as any;
      
      return {
        totalActive: result.totalActive || 0,
        newClientsLast30d: result.newClientsLast30d || 0,
        clientsWithPolicies: result.clientsWithPolicies || 0,
        totalCommission: Number(result.totalCommission) || 0,
      } as ClientKPIs;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  return {
    kpis: kpis || {
      totalActive: 0,
      newClientsLast30d: 0,
      clientsWithPolicies: 0,
      totalCommission: 0,
    },
    isLoading,
    error,
  };
}
