import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as financialService from '@/services/financialService';
import { FinancialAccountType } from '@/types/financeiro';

/**
 * Hook para buscar contas financeiras
 */
export function useFinancialAccounts(type?: FinancialAccountType) {
  return useQuery({
    queryKey: ['financial-accounts', type],
    queryFn: () => type 
      ? financialService.getAccountsByType(type)
      : financialService.getAllAccounts()
  });
}

/**
 * Hook para garantir contas padrão e buscar todas
 */
export function useFinancialAccountsWithDefaults() {
  // Primeiro, garantir que existam contas padrão
  const ensureDefaults = useQuery({
    queryKey: ['financial-accounts-ensure'],
    queryFn: async () => {
      await financialService.ensureDefaultAccounts();
      return true;
    },
    staleTime: Infinity, // Só roda uma vez
    retry: false
  });

  // Depois buscar as contas
  const accountsQuery = useQuery({
    queryKey: ['financial-accounts'],
    queryFn: financialService.getAllAccounts,
    enabled: ensureDefaults.isSuccess
  });

  return {
    ...accountsQuery,
    isLoading: ensureDefaults.isLoading || accountsQuery.isLoading,
    isEnsuring: ensureDefaults.isLoading
  };
}

/**
 * Hook para buscar transações recentes
 */
export function useRecentTransactions(type?: 'expense' | 'revenue') {
  return useQuery({
    queryKey: ['financial-transactions', type],
    queryFn: () => financialService.getRecentTransactions({ type })
  });
}

/**
 * Hook para registrar despesa
 */
export function useRegisterExpense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financialService.registerExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    }
  });
}

/**
 * Hook para registrar receita
 */
export function useRegisterRevenue() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financialService.registerRevenue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    }
  });
}

/**
 * Hook para criar conta
 */
export function useCreateAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financialService.createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
    }
  });
}

/**
 * Hook para anular transação
 */
export function useVoidTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) =>
      financialService.voidTransaction(transactionId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    }
  });
}

// ============ HOOKS PARA FLUXO DE CAIXA (FASE 3) ============

/**
 * Hook para buscar dados de fluxo de caixa
 */
export function useCashFlowData(startDate: string, endDate: string, granularity: 'day' | 'month' = 'day') {
  return useQuery({
    queryKey: ['cash-flow', startDate, endDate, granularity],
    queryFn: () => financialService.getCashFlowData({ startDate, endDate, granularity }),
    enabled: !!startDate && !!endDate
  });
}

/**
 * Hook para buscar resumo financeiro (KPIs)
 */
export function useFinancialSummary(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['financial-summary', startDate, endDate],
    queryFn: () => financialService.getFinancialSummary({ startDate, endDate }),
    enabled: !!startDate && !!endDate
  });
}

// ============ HOOKS PARA DRE (FASE 4) ============

/**
 * Hook para buscar dados do DRE (Demonstrativo de Resultado)
 */
export function useDreData(year?: number) {
  return useQuery({
    queryKey: ['dre-data', year],
    queryFn: () => financialService.getDreData(year)
  });
}
