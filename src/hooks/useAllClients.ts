import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Client } from '@/types';

/**
 * Hook para carregar TODOS os clientes do usuário (sem paginação)
 * Usado especificamente para deduplicação e busca global
 */
export function useAllClients() {
  const { user } = useAuth();

  const { data: allClients, isLoading: loading, error } = useQuery({
    queryKey: ['all-clients', user?.id],
    queryFn: async (): Promise<Client[]> => {
      if (!user) return [];

      const { data: clientsData, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar todos os clientes:', error);
        throw error;
      }

      // Mapear dados do Supabase para o formato esperado
      const mappedClients: Client[] = (clientsData || []).map(item => ({
        id: item.id,
        name: item.name,
        phone: item.phone || undefined,
        email: item.email || undefined,
        createdAt: item.created_at,
        cpfCnpj: item.cpf_cnpj || undefined,
        birthDate: item.birth_date || undefined,
        maritalStatus: item.marital_status as any || undefined,
        profession: item.profession || undefined,
        status: item.status as any,
        cep: item.cep || undefined,
        address: item.address || undefined,
        number: item.number || undefined,
        complement: item.complement || undefined,
        neighborhood: item.neighborhood || undefined,
        city: item.city || undefined,
        state: item.state || undefined,
        observations: item.observations || undefined,
      }));

      return mappedClients;
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000, // 30 minutos (dados podem ficar mais tempo em cache)
  });

  return {
    allClients: allClients || [],
    loading,
    error
  };
}
