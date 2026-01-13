import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Data de corte: início do sistema financeiro (1 de janeiro de 2026)
const FINANCIAL_SYSTEM_START_DATE = '2026-01-01';

export interface AccountBalance {
  id: string;
  name: string;
  code: string;
  type: string;
  balance: number;
}

export interface AccountStatement {
  transaction_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  running_balance: number;
  is_reversal: boolean;
  memo: string | null;
}

// Hook para buscar saldos de todas as contas de ativo (bancos)
// Filtra apenas transações a partir de 2026-01-01
export function useAccountBalances() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['account-balances', user?.id, FINANCIAL_SYSTEM_START_DATE],
    queryFn: async () => {
      if (!user) return [];

      // Usar a nova função com filtro de data
      const { data, error } = await supabase.rpc('get_account_balances_from_date' as any, {
        p_start_date: FINANCIAL_SYSTEM_START_DATE
      });

      if (error) {
        // Fallback para a função antiga se a nova não existir
        console.warn('Função get_account_balances_from_date não existe, usando fallback');
        const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_account_balances');
        if (fallbackError) {
          console.error('Erro ao buscar saldos:', fallbackError);
          throw fallbackError;
        }
        return (fallbackData || []) as AccountBalance[];
      }

      return (data || []) as AccountBalance[];
    },
    enabled: !!user,
    staleTime: 60 * 1000, // 1 minuto
  });
}

// Hook para buscar extrato de uma conta específica
export function useAccountStatement(
  accountId: string | null,
  startDate?: string,
  endDate?: string
) {
  const { user } = useAuth();

  // Garantir que a data mínima seja 2026-01-01
  const effectiveStartDate = startDate && startDate >= FINANCIAL_SYSTEM_START_DATE 
    ? startDate 
    : FINANCIAL_SYSTEM_START_DATE;

  return useQuery({
    queryKey: ['account-statement', user?.id, accountId, effectiveStartDate, endDate],
    queryFn: async () => {
      if (!user || !accountId) return [];

      const { data, error } = await supabase.rpc('get_account_statement', {
        p_account_id: accountId,
        p_start_date: effectiveStartDate,
        p_end_date: endDate || null,
      });

      if (error) {
        console.error('Erro ao buscar extrato:', error);
        throw error;
      }

      return (data || []) as AccountStatement[];
    },
    enabled: !!user && !!accountId,
    staleTime: 30 * 1000, // 30 segundos
  });
}

// Hook para buscar contas de ativo para seleção
export function useAssetAccounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['asset-accounts', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('financial_accounts')
        .select('id, name, code')
        .eq('user_id', user.id)
        .eq('type', 'asset')
        .eq('status', 'active')
        .order('code', { ascending: true });

      if (error) {
        console.error('Erro ao buscar contas:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Hook para buscar pendentes a receber a partir de 2026
export function useTotalPendingReceivablesFrom2026() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['total-pending-receivables-2026', user?.id],
    queryFn: async () => {
      if (!user) return { total_amount: 0, pending_count: 0 };

      // Usar a nova função com filtro de data
      const { data, error } = await supabase.rpc('get_pending_receivables_from_date' as any, {
        p_start_date: FINANCIAL_SYSTEM_START_DATE
      });

      if (error) {
        // Fallback para a função antiga
        console.warn('Função get_pending_receivables_from_date não existe, usando fallback');
        const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_total_pending_receivables');
        if (fallbackError) {
          console.error('Erro ao buscar pendentes:', fallbackError);
          throw fallbackError;
        }
        const row = Array.isArray(fallbackData) ? fallbackData[0] : fallbackData;
        return {
          total_amount: Number((row as any)?.total_amount || 0),
          pending_count: Number((row as any)?.pending_count || 0)
        };
      }

      const row = Array.isArray(data) ? data[0] : data;
      return {
        total_amount: Number((row as any)?.total_amount || 0),
        pending_count: Number((row as any)?.pending_count || 0)
      };
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}
