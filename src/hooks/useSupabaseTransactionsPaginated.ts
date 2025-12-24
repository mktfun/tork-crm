import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Transaction } from '@/types';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

export interface TransactionFilters {
  companyId: string;
  page: number;
  pageSize: number;
  dateRange?: DateRange;
  clientId?: string | null;
  nature?: 'receita' | 'despesa';
  sourceFilter?: 'all' | 'automatic' | 'manual';
}

interface TransactionMetrics {
  totalGanhos: number;
  totalPerdas: number; 
  saldoLiquido: number;
  totalPrevisto: number;
}

interface TransactionResponse {
  transactions: Transaction[];
  totalCount: number;
  metrics: TransactionMetrics;
  loading: boolean;
  error: any;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  markAllPendingCommissionsAsPaid: () => Promise<number>;
}

// Interface para o retorno da RPC
interface RPCFaturamentoData {
  transactions: any[];
  totalCount: number;
  metrics: {
    totalGanhos: number;
    totalPerdas: number;
    saldoLiquido: number;
    totalPrevisto: number;
  };
}

export function useSupabaseTransactionsPaginated(filters: TransactionFilters): TransactionResponse {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 🚀 QUERY PRINCIPAL: Busca transações + métricas
  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions-paginated', user?.id, filters],
    queryFn: async () => {
      if (!user) {
        return {
          transactions: [],
          totalCount: 0,
          metrics: {
            totalGanhos: 0,
            totalPerdas: 0,
            saldoLiquido: 0,
            totalPrevisto: 0,
          },
        };
      }

      // 📅 CONVERTER DATAS PARA STRING (yyyy-MM-dd)
      const startDate = filters.dateRange?.from 
        ? format(filters.dateRange.from, 'yyyy-MM-dd') 
        : format(new Date(), 'yyyy-MM-01');
      const endDate = filters.dateRange?.to 
        ? format(filters.dateRange.to, 'yyyy-MM-dd') 
        : format(new Date(), 'yyyy-MM-dd');

      // 🎯 CHAMADA À RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_faturamento_data', {
        p_user_id: user.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_company_id: filters.companyId || 'all',
        p_client_id: filters.clientId || null,
        p_page: filters.page,
        p_page_size: filters.pageSize,
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      } as any);

      if (rpcError) {
        console.error('Erro ao buscar dados de faturamento:', rpcError);
        throw rpcError;
      }

      // Type assertion para o retorno da RPC
      const typedData = rpcData as unknown as RPCFaturamentoData;

      // 🔄 MAPEAR PARA FORMATO TypeScript
      let formattedTransactions: Transaction[] = (typedData.transactions || []).map((t: any) => ({
        id: t.id,
        typeId: t.type_id,
        description: t.description,
        amount: parseFloat(t.amount),
        status: t.status,
        date: t.date,
        nature: t.nature,
        userId: t.user_id,
        policyId: t.policy_id,
        clientId: t.client_id,
        producerId: t.producer_id,
        brokerageId: t.brokerage_id,
        companyId: t.company_id,
        ramoId: t.ramo_id,
        dueDate: t.due_date,
        transactionDate: t.transaction_date,
        paidDate: t.paid_date,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));

      // 🎯 FILTRO POR ORIGEM (automatic/manual) - aplicado client-side
      if (filters.sourceFilter === 'automatic') {
        formattedTransactions = formattedTransactions.filter(t => t.policyId !== null);
      } else if (filters.sourceFilter === 'manual') {
        formattedTransactions = formattedTransactions.filter(t => t.policyId === null);
      }

      return {
        transactions: formattedTransactions,
        totalCount: filters.sourceFilter && filters.sourceFilter !== 'all' 
          ? formattedTransactions.length 
          : (typedData.totalCount || 0),
        metrics: {
          totalGanhos: parseFloat(String(typedData.metrics?.totalGanhos || 0)),
          totalPerdas: parseFloat(String(typedData.metrics?.totalPerdas || 0)),
          saldoLiquido: parseFloat(String(typedData.metrics?.saldoLiquido || 0)),
          totalPrevisto: parseFloat(String(typedData.metrics?.totalPrevisto || 0)),
        },
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // 🔄 MUTATION PARA ATUALIZAR TRANSAÇÃO
  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Transaction> }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const updateData: any = {};
      if (updates.status) updateData.status = updates.status;

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['reports-transacoes'] });
    },
  });

  // 🆕 AÇÃO EM LOTE: marcar todas as comissões pendentes como pagas (respeita filtros atuais)
  const markAllPendingCommissionsAsPaid = async (): Promise<number> => {
    if (!user) return 0;

    // 🔧 USAR FORMATO 'yyyy-MM-dd' (comparação DATE com DATE)
    const startDate = filters.dateRange?.from 
      ? format(filters.dateRange.from, 'yyyy-MM-dd')
      : null;
    const endDate = filters.dateRange?.to 
      ? format(filters.dateRange.to, 'yyyy-MM-dd')
      : null;

    let updateQuery = supabase
      .from('transactions')
      .update({ 
        status: 'PAGO',
        paid_date: new Date().toISOString() 
      })
      .eq('user_id', user.id)
      .eq('status', 'PENDENTE')
      .in('nature', ['GANHO', 'RECEITA'])
      .not('policy_id', 'is', null);

    if (startDate && endDate) {
      updateQuery = updateQuery.gte('date', startDate).lte('date', endDate);
    }

    if (filters.companyId !== 'all') {
      updateQuery = updateQuery.eq('company_id', filters.companyId);
    }

    if (filters.clientId) {
      updateQuery = updateQuery.eq('client_id', filters.clientId);
    }

    const { data: updatedRows, error: updateError } = await updateQuery.select('id');
    if (updateError) throw updateError;

    // Invalida todas as queries relacionadas
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
    queryClient.invalidateQueries({ queryKey: ['reports-transacoes'] });
    return updatedRows?.length || 0;
  };

  return {
    transactions: data?.transactions || [],
    totalCount: data?.totalCount || 0,
    metrics: data?.metrics || { totalGanhos: 0, totalPerdas: 0, saldoLiquido: 0, totalPrevisto: 0 },
    loading: isLoading,
    error,
    updateTransaction: (id: string, updates: Partial<Transaction>) =>
      updateTransactionMutation.mutateAsync({ id, updates }),
    markAllPendingCommissionsAsPaid,
  };
}
