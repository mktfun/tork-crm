import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Transaction } from '@/types';
import { DateRange } from 'react-day-picker';

interface TransactionFilters {
  period: string;
  companyId: string;
  page: number;
  pageSize: number;
  dateRange?: DateRange;
  clientId?: string | null;
  nature?: 'receita' | 'despesa';
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

export function useSupabaseTransactionsPaginated(filters: TransactionFilters): TransactionResponse {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 🚀 QUERY PRINCIPAL COM PAGINAÇÃO E FILTROS NO BACKEND
  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions-paginated', user?.id, filters],
    queryFn: async () => {
      if (!user) return { transactions: [], totalCount: 0, metrics: { totalGanhos: 0, totalPerdas: 0, saldoLiquido: 0, totalPrevisto: 0 } };

      // 🎯 CONSTRUIR QUERY COM FILTROS NO BACKEND
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      // 📅 FILTRO POR PERÍODO OU INTERVALO PERSONALIZADO NO BACKEND
      if (filters.dateRange?.from && filters.dateRange?.to) {
        const from = filters.dateRange.from.toISOString().split('T')[0];
        const to = filters.dateRange.to.toISOString().split('T')[0];
        query = query.gte('date', from).lte('date', to);
      } else if (filters.period !== 'all') {
        const now = new Date();
        let startDate: Date | undefined;

        switch (filters.period) {
          case 'current-month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'last-month':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            query = query.gte('date', lastMonth.toISOString().split('T')[0])
                         .lte('date', endLastMonth.toISOString().split('T')[0]);
            break;
          case 'current-year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          case 'last-year':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            const endLastYear = new Date(now.getFullYear() - 1, 11, 31);
            query = query.gte('date', startDate.toISOString().split('T')[0])
                         .lte('date', endLastYear.toISOString().split('T')[0]);
            break;
        }

        if (filters.period === 'current-month' || filters.period === 'current-year') {
          query = query.gte('date', startDate!.toISOString().split('T')[0]);
        }
      }

      // 🏢 FILTRO POR SEGURADORA NO BACKEND
      if (filters.companyId !== 'all') {
        query = query.eq('company_id', filters.companyId);
      }

      if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      // 📄 APLICAR PAGINAÇÃO
      const from = (filters.page - 1) * filters.pageSize;
      const to = from + filters.pageSize - 1;
      query = query.range(from, to);

      const { data: transactionsData, error: transactionsError, count } = await query;

      if (transactionsError) {
        console.error('Erro ao buscar transações:', transactionsError);
        throw transactionsError;
      }

      // 🔄 CONVERTER PARA FORMATO DA APLICAÇÃO
      const formattedTransactions: Transaction[] = transactionsData?.map((transaction: any) => ({
        id: transaction.id,
        typeId: transaction.type_id,
        description: transaction.description,
        amount: typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : transaction.amount,
        status: transaction.status as Transaction['status'],
        date: transaction.date,
        nature: transaction.nature as Transaction['nature'],
        transactionDate: transaction.transaction_date,
        dueDate: transaction.due_date,
        brokerageId: transaction.brokerage_id || undefined,
        producerId: transaction.producer_id || undefined,
        clientId: transaction.client_id,
        policyId: transaction.policy_id,
        companyId: transaction.company_id,
        createdAt: transaction.created_at,
      })) || [];

      // 📊 BUSCAR MÉTRICAS SEPARADAMENTE (SEM PAGINAÇÃO)
      let metricsQuery = supabase
        .from('transactions')
        .select('amount, status, nature')
        .eq('user_id', user.id);

      // Aplicar os mesmos filtros de período/intervalo e empresa nas métricas
      if (filters.dateRange?.from && filters.dateRange?.to) {
        const from = filters.dateRange.from.toISOString().split('T')[0];
        const to = filters.dateRange.to.toISOString().split('T')[0];
        metricsQuery = metricsQuery.gte('date', from).lte('date', to);
      } else if (filters.period !== 'all') {
        const now = new Date();
        let startDate: Date | undefined;

        switch (filters.period) {
          case 'current-month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            metricsQuery = metricsQuery.gte('date', startDate.toISOString().split('T')[0]);
            break;
          case 'last-month':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            metricsQuery = metricsQuery.gte('date', lastMonth.toISOString().split('T')[0])
                                      .lte('date', endLastMonth.toISOString().split('T')[0]);
            break;
          case 'current-year':
            startDate = new Date(now.getFullYear(), 0, 1);
            metricsQuery = metricsQuery.gte('date', startDate.toISOString().split('T')[0]);
            break;
          case 'last-year':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            const endLastYear = new Date(now.getFullYear() - 1, 11, 31);
            metricsQuery = metricsQuery.gte('date', startDate.toISOString().split('T')[0])
                                      .lte('date', endLastYear.toISOString().split('T')[0]);
            break;
        }
      }

      // 🔧 FILTRO DE NATURE - Resiliência para RECEITA/DESPESA e GANHO/PERDA
      if (filters.nature) {
        const natureValues = filters.nature === 'receita'
          ? ['GANHO', 'RECEITA']
          : ['PERDA', 'DESPESA'];
        query = query.in('nature', natureValues);
      }

      if (filters.companyId !== 'all') {
        metricsQuery = metricsQuery.eq('company_id', filters.companyId);
      }

      if (filters.clientId) {
        metricsQuery = metricsQuery.eq('client_id', filters.clientId);
      }

      const { data: metricsData, error: metricsError } = await metricsQuery;

      if (metricsError) {
        console.error('Erro ao buscar métricas:', metricsError);
        throw metricsError;
      }

      // 💰 CALCULAR MÉTRICAS
      let totalGanhos = 0;
      let totalPerdas = 0;
      let totalPrevisto = 0;

      metricsData?.forEach((transaction: any) => {
        const amount = typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : transaction.amount;
        
        if (transaction.status === 'REALIZADO' || transaction.status === 'PAGO') {
          if (['GANHO', 'RECEITA'].includes(transaction.nature)) {
            totalGanhos += amount;
          } else if (['PERDA', 'DESPESA'].includes(transaction.nature)) {
            totalPerdas += amount;
          }
        } else if (transaction.status === 'PREVISTO' || transaction.status === 'PENDENTE' || transaction.status === 'PARCIALMENTE_PAGO') {
          if (['GANHO', 'RECEITA'].includes(transaction.nature)) {
            totalPrevisto += amount;
          } else if (['PERDA', 'DESPESA'].includes(transaction.nature)) {
            totalPrevisto -= amount;
          }
        }
      });

      const saldoLiquido = totalGanhos - totalPerdas;

      return {
        transactions: formattedTransactions,
        totalCount: count || 0,
        metrics: {
          totalGanhos,
          totalPerdas,
          saldoLiquido,
          totalPrevisto
        }
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutos
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
      // 🎯 INVALIDAÇÃO AUTOMÁTICA - SEM RELOAD DA PÁGINA
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
    },
  });

  // 🆕 AÇÃO EM LOTE: marcar todas as comissões pendentes como pagas (respeita filtros atuais)
  const markAllPendingCommissionsAsPaid = async (): Promise<number> => {
    if (!user) return 0;

    let updateQuery = supabase
      .from('transactions')
      .update({ status: 'PAGO', paid_date: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'PENDENTE')
      .in('nature', ['GANHO', 'RECEITA'])
      .not('policy_id', 'is', null);

    if (filters.dateRange?.from && filters.dateRange?.to) {
      const from = filters.dateRange.from.toISOString().split('T')[0];
      const to = filters.dateRange.to.toISOString().split('T')[0];
      updateQuery = updateQuery.gte('date', from).lte('date', to);
    } else if (filters.period !== 'all') {
      const now = new Date();
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      switch (filters.period) {
        case 'current-month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last-month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'current-year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'last-year':
          startDate = new Date(now.getFullYear() - 1, 0, 1);
          endDate = new Date(now.getFullYear() - 1, 11, 31);
          break;
      }
      if (startDate) updateQuery = updateQuery.gte('date', startDate.toISOString().split('T')[0]);
      if (endDate) updateQuery = updateQuery.lte('date', endDate.toISOString().split('T')[0]);
    }

    if (filters.companyId !== 'all') {
      updateQuery = updateQuery.eq('company_id', filters.companyId);
    }
    if (filters.clientId) {
      updateQuery = updateQuery.eq('client_id', filters.clientId);
    }

    const { data: updatedRows, error: updateError } = await updateQuery.select('id');
    if (updateError) throw updateError;

    queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
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
