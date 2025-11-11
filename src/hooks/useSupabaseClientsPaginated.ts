import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Client } from '@/types';

export interface ClientFilters {
  searchTerm?: string;
  status?: string;
}

interface PaginationParams {
  page: number;
  limit: number;
  filters: ClientFilters;
}

interface PaginatedResult {
  clients: Client[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  isLoading: boolean;
  error: Error | null;
}

export function useSupabaseClientsPaginated({
  page = 1,
  limit = 10,
  filters
}: PaginationParams): PaginatedResult {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['clients-paginated', page, limit, filters, user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      console.log('🔍 Fetching clients - Page:', page, 'Limit:', limit, 'Filters:', filters);

      // Construir query base com contagem exata
      let query = supabase
        .from('clientes')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id);

      // Aplicar filtro por Status
      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }

      // Aplicar filtro por Termo de Busca
      if (filters.searchTerm && filters.searchTerm.trim()) {
        const searchTerm = filters.searchTerm.trim();
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,cpf_cnpj.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      // Ordenação (antes da paginação)
      query = query.order('created_at', { ascending: false });

      // APLICAR PAGINAÇÃO (sempre por último!)
      const start = (page - 1) * limit;
      const end = start + limit - 1;
      query = query.range(start, end);

      // Executar query
      const { data, count, error } = await query;

      if (error) {
        console.error('❌ Error fetching clients:', error);
        throw error;
      }

      console.log(`✅ Loaded page ${page}: ${data?.length || 0} clients (Total: ${count})`);

      // Mapear dados para o formato Client
      const clients: Client[] = (data || []).map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        cpfCnpj: c.cpf_cnpj,
        address: c.address,
        number: c.number,
        complement: c.complement,
        neighborhood: c.neighborhood,
        city: c.city,
        state: c.state,
        cep: c.cep,
        birthDate: c.birth_date,
        maritalStatus: c.marital_status as '' | 'Solteiro(a)' | 'Casado(a)' | 'Divorciado(a)' | 'Viúvo(a)',
        profession: c.profession,
        observations: c.observations,
        status: c.status as 'Ativo' | 'Inativo',
        userId: c.user_id,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }));

      return {
        clients,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  return {
    clients: data?.clients || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    currentPage: data?.currentPage || page,
    isLoading,
    error: error as Error | null,
  };
}
