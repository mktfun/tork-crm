
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Policy } from '@/types';
import { useAuth } from './useAuth';
import { differenceInDays, parseISO } from 'date-fns';

interface RenewalFilters {
  period: number; // dias para filtrar (30, 60, 90, 120)
  renewalStatus?: string; // status de renovação específico
}

interface PaginationConfig {
  page: number;
  pageSize: number;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface UseSupabaseRenewalsReturn {
  renewals: Policy[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useSupabaseRenewals = (
  filters: RenewalFilters,
  pagination: PaginationConfig,
  sortConfig: SortConfig = { key: 'expiration_date', direction: 'asc' }
): UseSupabaseRenewalsReturn => {
  const [renewals, setRenewals] = useState<Policy[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchRenewals = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Calcular data limite baseada no período
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + filters.period);

      // Query base: buscar apenas apólices ativas que estão próximas do vencimento
      let query = supabase
        .from('apolices')
        .select(`
          *,
          clientes!inner(
            id,
            name,
            phone,
            email
          )
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .eq('status', 'Ativa')
        .lte('expiration_date', futureDate.toISOString().split('T')[0]);

      // Aplicar filtro de status de renovação se especificado
      if (filters.renewalStatus && filters.renewalStatus !== 'all') {
        query = query.eq('renewal_status', filters.renewalStatus);
      }

      // Aplicar ordenação
      query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });

      // Aplicar paginação
      const from = (pagination.page - 1) * pagination.pageSize;
      const to = from + pagination.pageSize - 1;
      query = query.range(from, to);

      const { data, error: queryError, count } = await query;

      if (queryError) {
        throw queryError;
      }

      // Transformar dados para o formato esperado pela UI
      const transformedData = (data || []).map(item => {
        const today = new Date();
        const expirationDate = parseISO(item.expiration_date);
        const daysUntilExpiration = differenceInDays(expirationDate, today);
        
        return {
          id: item.id,
          clientId: item.client_id,
          policyNumber: item.policy_number || '',
          insuranceCompany: item.insurance_company || '',
          type: item.type || '',
          insuredAsset: item.insured_asset || '',
          premiumValue: Number(item.premium_value),
          commissionRate: Number(item.commission_rate),
          status: item.status as Policy['status'],
          expirationDate: item.expiration_date,
          createdAt: item.created_at,
          renewalStatus: item.renewal_status as Policy['renewalStatus'],
          startDate: item.start_date,
          producerId: item.producer_id,
          brokerageId: item.brokerage_id,
          userId: item.user_id,
          automaticRenewal: item.automatic_renewal || true, // ✅ ADICIONADO: Campo obrigatório do banco
          // Dados adicionais para a UI
          clientName: item.clientes?.name || 'Cliente não encontrado',
          diasParaVencer: daysUntilExpiration
        };
      });

      setRenewals(transformedData);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Erro ao buscar renovações:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewals();
  }, [user, filters.period, filters.renewalStatus, pagination.page, pagination.pageSize, sortConfig.key, sortConfig.direction]);

  return {
    renewals,
    totalCount,
    loading,
    error,
    refetch: fetchRenewals
  };
};
