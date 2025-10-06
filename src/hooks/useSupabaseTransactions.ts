import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Transaction, TransactionPayment } from '@/types';
import { getCommissionTypeId } from '@/services/commissionService';

export function useSupabaseTransactions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 🚀 **ETAPA 1: MIGRAÇÃO PARA REACT QUERY** - Query principal
  const { data: transactions = [], isLoading: loading, error } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar transactions:', error);
        throw error;
      }

      // ✅ CONVERSÃO ATUALIZADA INCLUINDO NOVO STATUS PARCIALMENTE_PAGO
      const formattedTransactions: Transaction[] = data?.map((transaction: any) => ({
        id: transaction.id,
        typeId: transaction.type_id,
        description: transaction.description,
        amount: typeof transaction.amount === 'string' ? parseFloat(transaction.amount) : transaction.amount,
        status: transaction.status as Transaction['status'],
        date: transaction.date,
        
        // 🆕 MAPEAMENTO DOS CAMPOS FINANCEIRO
        nature: transaction.nature as Transaction['nature'],
        transactionDate: transaction.transaction_date,
        dueDate: transaction.due_date,
        
        // 🆕 MAPEAMENTO DOS NOVOS CAMPOS DNA DA CORRETAGEM
        brokerageId: transaction.brokerage_id || undefined,
        producerId: transaction.producer_id || undefined,
        
        clientId: transaction.client_id,
        policyId: transaction.policy_id,
        companyId: transaction.company_id,
        createdAt: transaction.created_at,
      })) || [];

      console.log('✅ Transações carregadas:', formattedTransactions.length);
      return formattedTransactions;
    },
    enabled: !!user,
    // 🚀 **ETAPA 2: OTIMIZAÇÃO DE PERFORMANCE** - Adicionando staleTime
    staleTime: 2 * 60 * 1000, // 2 minutos - dados financeiros precisam ser mais frescos
  });

  // 🚀 **ETAPA 1: MUTATIONS COM INVALIDAÇÃO AUTOMÁTICA**
  const addTransactionMutation = useMutation({
    mutationFn: async (transactionData: Omit<Transaction, 'id' | 'createdAt'>) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('transactions')
        .insert([
          {
            user_id: user.id,
            type_id: transactionData.typeId,
            description: transactionData.description,
            amount: transactionData.amount,
            status: transactionData.status,
            date: transactionData.date,
            
            // 🆕 INSERÇÃO DOS CAMPOS FINANCEIRO
            nature: transactionData.nature,
            transaction_date: transactionData.transactionDate,
            due_date: transactionData.dueDate,
            
            // 🆕 INSERÇÃO DOS NOVOS CAMPOS DNA DA CORRETAGEM
            brokerage_id: transactionData.brokerageId || null,
            producer_id: transactionData.producerId || null,
            
            client_id: transactionData.clientId || null,
            policy_id: transactionData.policyId || null,
            company_id: transactionData.companyId || null,
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
      // 🎯 **INVALIDAÇÃO AUTOMÁTICA**
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      console.log('✅ Transaction criada e cache invalidado');
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
      // 🎯 **INVALIDAÇÃO AUTOMÁTICA** - Atualiza tanto transações quanto pagamentos
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-payments'] });
      console.log('Cache de transações invalidado. A UI deve atualizar agora.');
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
      // 🎯 **INVALIDAÇÃO AUTOMÁTICA**
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      console.log('✅ Transaction atualizada com sucesso');
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
      // 🎯 **INVALIDAÇÃO AUTOMÁTICA**
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      console.log('✅ Transaction deletada com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao deletar transaction:', error);
    }
  });

  // ✅ FUNÇÃO ATUALIZADA PARA CRIAR TRANSAÇÃO ÚNICA DE COMISSÃO COM INVALIDAÇÃO
  

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
    refetch: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  };
}
