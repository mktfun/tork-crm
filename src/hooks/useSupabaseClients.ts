import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Client } from '@/types';
import { toast } from 'sonner';

interface PaginationConfig {
  page: number;
  pageSize: number;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface UseSupabaseClientsParams {
  pagination?: PaginationConfig;
  sortConfig?: SortConfig;
  searchTerm?: string;
  filters?: {
    seguradoraId?: string | null;
    ramo?: string | null;
  };
}

interface ClientsResponse {
  clients: Client[];
  totalCount: number;
  totalPages: number;
}

export function useSupabaseClients({ pagination, sortConfig, searchTerm, filters }: UseSupabaseClientsParams = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 🚀 **PAGINAÇÃO, ORDENAÇÃO E BUSCA BACKEND** - Query principal com .range(), .order() e .ilike()
  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['clients', user?.id, pagination, sortConfig, searchTerm, filters?.seguradoraId || null, filters?.ramo || null],
    queryFn: async (): Promise<ClientsResponse> => {
      if (!user) return { clients: [], totalCount: 0, totalPages: 0 };

      // Construir a query base
      let query = supabase
        .from('clientes')
        .select('*', { count: 'exact' });

      // Aplicar filtros de Seguradora e Ramo via relação com apólices
      if ((filters?.seguradoraId && filters.seguradoraId !== 'all') || (filters?.ramo && filters.ramo !== 'all')) {
        // Buscar IDs de clientes que possuem apólices com os filtros selecionados
        let policiesQuery = supabase
          .from('apolices')
          .select('client_id')
          .eq('user_id', user.id);

        if (filters?.seguradoraId && filters.seguradoraId !== 'all') {
          policiesQuery = policiesQuery.eq('insurance_company', filters.seguradoraId);
        }
        if (filters?.ramo && filters.ramo !== 'all') {
          policiesQuery = policiesQuery.eq('type', filters.ramo);
        }

        const { data: policiesData, error: policiesError } = await policiesQuery;
        if (policiesError) {
          console.error('Erro ao buscar apólices para filtros:', policiesError);
        } else {
          const clientIds = Array.from(new Set((policiesData || []).map(p => p.client_id).filter(Boolean)));
          if (clientIds.length === 0) {
            return { clients: [], totalCount: 0, totalPages: 0 };
          }
          query = query.in('id', clientIds as string[]);
        }
      }

      // Aplicar busca se configurada
      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.trim();
        // Busca em múltiplos campos com operador OR
        query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,cpf_cnpj.ilike.%${term}%`);
      }

      // Aplicar ordenação se configurada
      if (sortConfig?.key) {
        // Mapear keys da UI para colunas do banco
        const columnMap: Record<string, string> = {
          name: 'name',
          createdAt: 'created_at',
          email: 'email',
          status: 'status'
        };
        
        const dbColumn = columnMap[sortConfig.key] || sortConfig.key;
        query = query.order(dbColumn, { ascending: sortConfig.direction === 'asc' });
      } else {
        // Ordenação padrão por data de criação (mais recentes primeiro)
        query = query.order('created_at', { ascending: false });
      }

      // Aplicar paginação se configurada
      if (pagination) {
        const from = (pagination.page - 1) * pagination.pageSize;
        const to = from + pagination.pageSize - 1;
        query = query.range(from, to);
      }

      const { data: clientsData, error, count } = await query;

      if (error) {
        console.error('Erro ao buscar clientes:', error);
        toast.error('Erro ao carregar clientes');
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

      const totalCount = count || 0;
      const totalPages = pagination ? Math.ceil(totalCount / pagination.pageSize) : 1;

      return {
        clients: mappedClients,
        totalCount,
        totalPages
      };
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 segundos - OTIMIZAÇÃO: Reduzido de 5 minutos
    refetchOnWindowFocus: true, // OTIMIZAÇÃO: Atualiza se o usuário voltar para a aba
  });

  const refetch = () => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: ['clients', user.id] });
      queryClient.invalidateQueries({ queryKey: ['all-clients'] });
    }
  };

  return {
    clients: data?.clients || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    loading,
    error,
    refetch,
  };
}
