import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Transaction, TransactionPayment } from '@/types';
import { getCommissionTypeId } from '@/services/commissionService';
import { transformTransactionData } from '@/utils/dataTransformers';

export function useSupabaseTransactions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 🚀 **ETAPA 1: MIGRAÇÃO PARA REACT QUERY** - Query principal COM JOIN DE APÓLICES
  const { data: transactions = [], isLoading: loading, error } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // ✅ NOVA QUERY: JOIN com apolices para buscar premium_value
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          apolices:policy_id (
            premium_value,
            commission_rate
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar transactions:', error);
        throw error;
      }

      // ✅ TRANSFORMAR DADOS COM CÁLCULO DE PRÊMIO E COMISSÃO
      const formattedTransactions: Transaction[] = data?.map(row => {
        const baseTransaction = transformTransactionData(row);
        
        // 📊 ENRIQUECER COM DADOS DA APÓLICE
        const policyData = row.apolices as any;
        
        return {
          ...baseTransaction,
          // Se tem apólice vinculada, usar premium_value e commission_value calculada
          premiumValue: policyData?.premium_value || baseTransaction.amount,
          commissionValue: baseTransaction.amount, // amount já É a comissão
          commissionRate: policyData?.commission_rate || 100,
          // Flag para identificar tipo
          transactionType: row.policy_id ? 'policy_commission' : 'manual_bonus'
        } as Transaction;
      }) || [];

      console.log('✅ Transações carregadas com dados de apólices:', formattedTransactions.length);
      return formattedTransactions;
    },
    enabled: !!user,
    staleTime: 0, // ⚡️ FORÇA A REVALIDAÇÃO EM CADA VISITA
  });

  // 🚀 **ETAPA 1: MUTATIONS COM INVALIDAÇÃO AUTOMÁTICA**
  const addTransactionMutation = useMutation({
    mutationFn: async (transactionData: Omit<Transaction, 'id' | 'createdAt'>) => {
      if (!user) throw new Error('Usuário não autenticado');

      // 🎯 ENRIQUECIMENTO AUTOMÁTICO - Se policyId for fornecido, buscar dados da apólice
      let enrichedData = { ...transactionData };
      
      if (transactionData.policyId) {
        try {
          const { data: policy, error: policyError } = await supabase
            .from('apolices')
            .select('insurance_company, producer_id, type, ramo_id, brokerage_id')
            .eq('id', transactionData.policyId)
            .eq('user_id', user.id)
            .single();

          if (!policyError && policy) {
            // Enriquecer automaticamente com dados da apólice
            if (!enrichedData.companyId && policy.insurance_company) {
              enrichedData.companyId = policy.insurance_company;
            }
            if (!enrichedData.producerId && policy.producer_id) {
              enrichedData.producerId = policy.producer_id;
            }
            if (!enrichedData.brokerageId && policy.brokerage_id) {
              enrichedData.brokerageId = policy.brokerage_id;
            }
            // ✅ CORREÇÃO: Atribuir o ramo_id da apólice para a transação
            if (!enrichedData.ramoId && policy.ramo_id) {
              enrichedData.ramoId = policy.ramo_id;
            }
            
            console.log('✅ Transação enriquecida automaticamente com dados da apólice:', {
              companyId: enrichedData.companyId,
              producerId: enrichedData.producerId,
              brokerageId: enrichedData.brokerageId,
            });
          }
        } catch (error) {
          console.warn('⚠️ Não foi possível enriquecer transação com dados da apólice:', error);
          // Continua com os dados originais se houver erro
        }
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert([
          {
            user_id: user.id,
            type_id: enrichedData.typeId,
            description: enrichedData.description,
            amount: enrichedData.amount,
            status: enrichedData.status,
            date: enrichedData.date,
            
            // 🆕 INSERÇÃO DOS CAMPOS FINANCEIRO
            nature: enrichedData.nature,
            transaction_date: enrichedData.transactionDate,
            due_date: enrichedData.dueDate,
            
            // 🆕 INSERÇÃO DOS NOVOS CAMPOS DNA DA CORRETAGEM (ENRIQUECIDOS)
            brokerage_id: enrichedData.brokerageId || null,
            producer_id: enrichedData.producerId || null,
            // ✅ CORREÇÃO: Incluir o ramo_id no objeto de inserção
            ramo_id: enrichedData.ramoId || null,
            
            client_id: enrichedData.clientId || null,
            policy_id: enrichedData.policyId || null,
            company_id: enrichedData.companyId || null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar transaction:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      // 🎯 **INVALIDAÇÃO AUTOMÁTICA** - Invalida TODAS as queries relacionadas a transações
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['reports-transacoes'] });
      console.log('✅ Transaction criada e cache invalidado (lista principal + paginada + relatórios)');
    },
    onError: (error) => {
      console.error('Erro ao criar transaction:', error);
    }
  });

  // 🆕 NOVA FUNÇÃO PARA ADICIONAR PAGAMENTO PARCIAL COM INVALIDAÇÃO
  const addPartialPaymentMutation = useMutation({
    mutationFn: async ({ transactionId, amountPaid, description }: { 
      transactionId: string; 
      amountPaid: number; 
      description?: string 
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Inserir o pagamento parcial
      const { error: paymentError } = await supabase
        .from('transaction_payments')
        .insert([
          {
            transaction_id: transactionId,
            user_id: user.id,
            amount_paid: amountPaid,
            payment_date: new Date().toISOString().split('T')[0],
            description: description || 'Pagamento parcial'
          }
        ]);

      if (paymentError) {
        console.error('Erro ao criar pagamento parcial:', paymentError);
        throw paymentError;
      }

      // 2. Buscar o total pago até agora
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('transaction_payments')
        .select('amount_paid')
        .eq('transaction_id', transactionId);

      if (paymentsError) {
        console.error('Erro ao buscar pagamentos:', paymentsError);
        throw paymentsError;
      }

      // 3. Calcular o total pago
      const totalPaid = paymentsData?.reduce((sum, payment) => sum + parseFloat(payment.amount_paid.toString()), 0) || 0;

      // 4. Buscar o valor total da transação
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('id', transactionId)
        .single();

      if (transactionError) throw transactionError;

      const transactionAmount = parseFloat(transactionData.amount.toString());

      // 5. Determinar o novo status
      let newStatus: Transaction['status'] = 'PARCIALMENTE_PAGO';
      if (totalPaid >= transactionAmount) {
        newStatus = 'PAGO';
      }

      // 6. Atualizar o status da transação
      await updateTransactionMutation.mutateAsync({ id: transactionId, updates: { status: newStatus } });

      console.log('✅ Pagamento parcial registrado:', { transactionId, amountPaid, totalPaid, newStatus });
    },
    onSuccess: () => {
      // 🎯 **INVALIDAÇÃO AUTOMÁTICA** - Atualiza transações, pagamentos e relatórios
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['reports-transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-payments'] });
      console.log('✅ Pagamento parcial registrado - cache invalidado (lista + paginada + pagamentos + relatórios)');
    },
    onError: (error) => {
      console.error('Erro ao processar pagamento parcial:', error);
    }
  });

  // ✅ FUNÇÃO PARA BUSCAR PAGAMENTOS DE UMA TRANSAÇÃO
  const getTransactionPayments = async (transactionId: string): Promise<TransactionPayment[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('transaction_payments')
        .select('*')
        .eq('transaction_id', transactionId)
        .eq('user_id', user.id)
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('Erro ao buscar pagamentos da transação:', error);
        return [];
      }

      return data?.map((payment: any) => ({
        id: payment.id,
        transactionId: payment.transaction_id,
        amountPaid: parseFloat(payment.amount_paid.toString()),
        paymentDate: payment.payment_date,
        description: payment.description,
        createdAt: payment.created_at,
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar pagamentos:', error);
      return [];
    }
  };

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Transaction> }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const updateData: any = {};
      
      if (updates.typeId) updateData.type_id = updates.typeId;
      if (updates.description) updateData.description = updates.description;
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (updates.status) updateData.status = updates.status;
      if (updates.date) updateData.date = updates.date;
      
      if (updates.nature) updateData.nature = updates.nature;
      if (updates.transactionDate) updateData.transaction_date = updates.transactionDate;
      if (updates.dueDate) updateData.due_date = updates.dueDate;
      
      if (updates.brokerageId !== undefined) updateData.brokerage_id = updates.brokerageId;
      if (updates.producerId !== undefined) updateData.producer_id = updates.producerId;
      
      if (updates.clientId !== undefined) updateData.client_id = updates.clientId;
      if (updates.policyId !== undefined) updateData.policy_id = updates.policyId;
      if (updates.companyId !== undefined) updateData.company_id = updates.companyId;

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao atualizar transaction:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // 🎯 **INVALIDAÇÃO AUTOMÁTICA** - Invalida todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['reports-transacoes'] });
      console.log('✅ Transaction atualizada - cache invalidado (lista + paginada + relatórios)');
    },
    onError: (error) => {
      console.error('Erro ao atualizar transaction:', error);
    }
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao deletar transaction:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // 🎯 **INVALIDAÇÃO AUTOMÁTICA** - Invalida todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['reports-transacoes'] });
      console.log('✅ Transaction deletada - cache invalidado (lista + paginada + relatórios)');
    },
    onError: (error) => {
      console.error('Erro ao deletar transaction:', error);
    }
  });

  // ✅ FUNÇÃO ATUALIZADA PARA CRIAR TRANSAÇÃO ÚNICA DE COMISSÃO COM INVALIDAÇÃO
  

  // 🆕 NOVA MUTATION PARA VINCULAR TRANSAÇÕES AOS RAMOS
  const linkTransactionsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.rpc('link_manual_transactions', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Erro ao vincular transações:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (message) => {
      // 🎯 **INVALIDAÇÃO GLOBAL** - Atualiza TUDO relacionado a transações e ramos
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['reports-transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      console.log('✅ Transações vinculadas aos ramos - cache global invalidado:', message);
    },
    onError: (error) => {
      console.error('Erro ao vincular transações:', error);
    }
  });

  return {
    transactions,
    loading,
    addTransaction: addTransactionMutation.mutateAsync,
    updateTransaction: (id: string, updates: Partial<Transaction>) => 
      updateTransactionMutation.mutateAsync({ id, updates }),
    deleteTransaction: deleteTransactionMutation.mutateAsync,
    // 🆕 NOVAS FUNÇÕES PARA PAGAMENTOS PARCIAIS
    addPartialPayment: (transactionId: string, amountPaid: number, description?: string) =>
      addPartialPaymentMutation.mutateAsync({ transactionId, amountPaid, description }),
    getTransactionPayments,
    // 🆕 NOVA FUNÇÃO PARA VINCULAR TRANSAÇÕES AOS RAMOS
    linkTransactions: linkTransactionsMutation.mutateAsync,
    isLinkingTransactions: linkTransactionsMutation.isPending,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['reports-transacoes'] });
    },
  };
}

// 🆕 HOOK PARA BUSCAR TRANSAÇÕES ÓRFÃS (PENDENTES SEM RAMO)
export function useOrphanTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['orphan-transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_orphan_transactions', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Erro ao buscar transações órfãs:', error);
        throw error;
      }

      return (data || []) as Array<{
        id: string;
        description: string;
        date: string;
        amount: number;
        company_id?: string;
        nature: string;
      }>;
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 segundos
  });
}

// 🆕 HOOK PARA ATUALIZAR TRANSAÇÕES EM LOTE
export function useBatchUpdateTransactions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Array<{
      id: string;
      ramo_id: string | null;
      company_id: string | null;
    }>) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Filtrar apenas atualizações com ramo_id
      const validUpdates = updates.filter(u => u.ramo_id);

      if (validUpdates.length === 0) {
        throw new Error('Nenhuma transação selecionada para vincular');
      }

      const { data, error } = await supabase.rpc('batch_update_transactions', {
        p_user_id: user.id,
        updates: validUpdates
      });

      if (error) {
        console.error('Erro ao atualizar transações:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (message) => {
      // Invalidação global de cache
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['orphan-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['reports-transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      console.log('✅ Transações atualizadas:', message);
    },
  });
}
