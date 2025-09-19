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

  // 🚀 **MUTATIONS COM INVALIDAÇÃO AUTOMÁTICA**
  const addClientMutation = useMutation({
    mutationFn: async (clientData: Omit<Client, 'id' | 'createdAt'>) => {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Validar se tem pelo menos email ou telefone
      if (!clientData.email && !clientData.phone) {
        throw new Error('É necessário informar pelo menos email ou telefone');
      }

      const { data, error } = await supabase
        .from('clientes')
        .insert({
          user_id: user.id,
          name: clientData.name,
          phone: clientData.phone || null,
          email: clientData.email || null,
          cpf_cnpj: clientData.cpfCnpj || null,
          birth_date: clientData.birthDate || null,
          marital_status: clientData.maritalStatus || null,
          profession: clientData.profession || null,
          status: clientData.status || 'Ativo',
          cep: clientData.cep || null,
          address: clientData.address || null,
          number: clientData.number || null,
          complement: clientData.complement || null,
          neighborhood: clientData.neighborhood || null,
          city: clientData.city || null,
          state: clientData.state || null,
          observations: clientData.observations || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar cliente:', error);
        throw error;
      }

      // Mapear dados do Supabase para o formato esperado
      const mappedClient: Client = {
        id: data.id,
        name: data.name,
        phone: data.phone || undefined,
        email: data.email || undefined,
        createdAt: data.created_at,
        cpfCnpj: data.cpf_cnpj || undefined,
        birthDate: data.birth_date || undefined,
        maritalStatus: data.marital_status as any || undefined,
        profession: data.profession || undefined,
        status: data.status as any,
        cep: data.cep || undefined,
        address: data.address || undefined,
        number: data.number || undefined,
        complement: data.complement || undefined,
        neighborhood: data.neighborhood || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        observations: data.observations || undefined,
      };

      return mappedClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['all-clients'] });
      toast.success('Cliente criado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro inesperado ao criar cliente:', error);
      toast.error('Erro inesperado ao criar cliente');
    }
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Client> }) => {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('clientes')
        .update({
          name: updates.name,
          phone: updates.phone || null,
          email: updates.email || null,
          cpf_cnpj: updates.cpfCnpj || null,
          birth_date: updates.birthDate || null,
          marital_status: updates.maritalStatus || null,
          profession: updates.profession || null,
          status: updates.status,
          cep: updates.cep || null,
          address: updates.address || null,
          number: updates.number || null,
          complement: updates.complement || null,
          neighborhood: updates.neighborhood || null,
          city: updates.city || null,
          state: updates.state || null,
          observations: updates.observations || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar cliente:', error);
        throw error;
      }

      return data;
    },
    // OTIMIZAÇÃO: Update Otimístico - UI atualiza instantaneamente
    onMutate: async ({ id, updates }) => {
      // Cancela qualquer refetch pendente para não sobrescrever nosso update otimista
      await queryClient.cancelQueries({ queryKey: ['clients'] });

      // Guarda o estado anterior em caso de erro (rollback)
      const previousClientsData = queryClient.getQueryData(['clients', user?.id]);

      // Atualiza o cache otimisticamente
      queryClient.setQueryData(['clients', user?.id], (old: any) => {
        if (!old) return old;
        
        return {
          ...old,
          clients: old.clients.map((client: Client) =>
            client.id === id ? { ...client, ...updates } : client
          )
        };
      });

      // Também atualiza o cache de todos os clientes
      queryClient.setQueryData(['all-clients', user?.id], (old: Client[]) => {
        if (!old) return old;
        return old.map((client: Client) =>
          client.id === id ? { ...client, ...updates } : client
        );
      });
      
      return { previousClientsData };
    },
    // Se a mutação falhar, fazemos o rollback
    onError: (err, { id }, context) => {
      if (context?.previousClientsData) {
        queryClient.setQueryData(['clients', user?.id], context.previousClientsData);
      }
      console.error('Erro inesperado ao atualizar cliente:', err);
      toast.error('Erro inesperado ao atualizar cliente');
    },
    // Ao final, sempre revalida os dados para garantir consistência
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['all-clients'] });
    },
    onSuccess: () => {
      toast.success('Cliente atualizado com sucesso!');
    }
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar cliente:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['all-clients'] });
      toast.success('Cliente removido com sucesso!');
    },
    onError: (error) => {
      console.error('Erro inesperado ao deletar cliente:', error);
      toast.error('Erro inesperado ao deletar cliente');
    }
  });

  return {
    clients: data?.clients || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    loading,
    error,
    addClient: addClientMutation.mutateAsync,
    updateClient: (id: string, updates: Partial<Client>) => 
      updateClientMutation.mutateAsync({ id, updates }),
    deleteClient: deleteClientMutation.mutateAsync,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['all-clients'] });
    },
  };
}
