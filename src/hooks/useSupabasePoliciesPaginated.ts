import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Policy } from '@/types';
import { PolicyFilters } from './useFilteredPolicies';
import { startOfMonth, endOfMonth, addDays, startOfToday } from 'date-fns';

interface PaginationParams {
  page: number;
  limit: number;
  filters: PolicyFilters;
}

interface PaginatedResult {
  policies: Policy[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  isLoading: boolean;
  error: Error | null;
}

export function useSupabasePoliciesPaginated({
  page = 1,
  limit = 10,
  filters
}: PaginationParams): PaginatedResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['policies-paginated', page, limit, filters, user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');

      console.log('🔍 Fetching policies - Page:', page, 'Limit:', limit, 'Filters:', filters);

      // Construir query base com JOINs e contagem exata
      let query = supabase
        .from('apolices')
        .select(`
          *,
          companies:insurance_company (id, name),
          ramos:ramo_id (id, nome)
        `, { count: 'exact' })
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

      // Aplicar filtro por Termo de Busca (policy_number e insured_asset)
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

      // Ordenação (antes da paginação)
      query = query.order('created_at', { ascending: false });

      // APLICAR PAGINAÇÃO (sempre por último!)
      const start = (page - 1) * limit;
      const end = start + limit - 1;
      query = query.range(start, end);

      // Executar query
      const { data, count, error } = await query;

      if (error) {
        console.error('❌ Error fetching policies:', error);
        throw error;
      }

      console.log(`✅ Loaded page ${page}: ${data?.length || 0} policies (Total: ${count})`);

      // Mapear dados para o formato Policy
      const policies: Policy[] = (data || []).map(p => ({
        id: p.id,
        clientId: p.client_id,
        policyNumber: p.policy_number,
        insuranceCompany: p.insurance_company,
        companies: p.companies,
        ramos: p.ramos,
        type: p.type,
        insuredAsset: p.insured_asset,
        premiumValue: Number(p.premium_value),
        commissionRate: Number(p.commission_rate),
        status: p.status as "Aguardando Apólice" | "Ativa" | "Cancelada" | "Orçamento" | "Renovada",
        expirationDate: p.expiration_date,
        startDate: p.start_date,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        bonusClass: p.bonus_class,
        renewalStatus: p.renewal_status as "Pendente" | "Em Contato" | "Proposta Enviada" | "Renovada" | "Não Renovada" | undefined,
        producerId: p.producer_id,
        brokerageId: p.brokerage_id,
        automaticRenewal: p.automatic_renewal,
        ramoId: p.ramo_id,
        installments: p.installments,
        pdfUrl: p.pdf_url,
        pdfAttachedName: p.pdf_attached_name,
        pdfAttachedData: p.pdf_attached_data,
        userId: p.user_id
      }));

      return {
        policies,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  return {
    policies: data?.policies || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    currentPage: data?.currentPage || page,
    isLoading,
    error: error as Error | null,
  };
}
