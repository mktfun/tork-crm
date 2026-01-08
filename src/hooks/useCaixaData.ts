import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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
export function useAccountBalances() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['account-balances', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_account_balances');

      if (error) {
        console.error('Erro ao buscar saldos:', error);
        throw error;
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

  return useQuery({
    queryKey: ['account-statement', user?.id, accountId, startDate, endDate],
    queryFn: async () => {
      if (!user || !accountId) return [];

      const { data, error } = await supabase.rpc('get_account_statement', {
        p_account_id: accountId,
        p_start_date: startDate || null,
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
