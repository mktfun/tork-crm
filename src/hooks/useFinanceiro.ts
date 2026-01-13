import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as financialService from '@/services/financialService';
import { FinancialAccountType, BulkImportPayload } from '@/types/financeiro';

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
 * Hook para anular transação (deprecated - use useReverseTransaction)
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
      queryClient.invalidateQueries({ queryKey: ['revenue-transactions'] });
    }
  });
}

/**
 * Hook para estornar transação (cria lançamentos inversos no ledger)
 */
export function useReverseTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) =>
      financialService.reverseTransaction(transactionId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-details'] });
    }
  });
}

// ============ HOOKS PARA FLUXO DE CAIXA ============

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

// ============ HOOKS PARA DRE ============

/**
 * Hook para buscar dados do DRE (Demonstrativo de Resultado)
 */
export function useDreData(year?: number) {
  return useQuery({
    queryKey: ['dre-data', year],
    queryFn: () => financialService.getDreData(year)
  });
}

// ============ HOOKS PARA IMPORTAÇÃO ============

/**
 * Hook para importação em massa de transações
 */
export function useBulkImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BulkImportPayload) => 
      financialService.bulkImportTransactions(payload),
    onSuccess: () => {
      // Invalidar todos os caches relacionados
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dre-data'] });
    }
  });
}

// ============ HOOKS PARA CONFIGURAÇÕES ============

/**
 * Hook para atualizar conta financeira
 */
export function useUpdateAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ accountId, updates }: { 
      accountId: string; 
      updates: { name: string; code?: string; description?: string } 
    }) => financialService.updateAccount(accountId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
    }
  });
}

/**
 * Hook para arquivar conta financeira
 */
export function useArchiveAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financialService.archiveAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
    }
  });
}

// ============ HOOKS PARA SAFE DELETE E RECEITAS ============

/**
 * Hook para contar lançamentos de uma conta
 */
export function useLedgerEntryCount(accountId: string | null) {
  return useQuery({
    queryKey: ['ledger-entry-count', accountId],
    queryFn: () => financialService.countLedgerEntriesByAccount(accountId!),
    enabled: !!accountId
  });
}

/**
 * Hook para exclusão segura de conta
 */
export function useSafeDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetAccountId, migrateToAccountId }: {
      targetAccountId: string;
      migrateToAccountId?: string;
    }) => financialService.deleteAccountSafe(targetAccountId, migrateToAccountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['ledger-entry-count'] });
    }
  });
}

/**
 * Hook para buscar transações de receita
 */
export function useRevenueTransactions(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['revenue-transactions', startDate, endDate],
    queryFn: () => financialService.getRevenueTransactions({ startDate, endDate }),
    enabled: !!startDate && !!endDate
  });
}

/**
 * Hook para buscar totais de receita
 */
export function useRevenueTotals(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['revenue-totals', startDate, endDate],
    queryFn: () => financialService.getRevenueTotals({ startDate, endDate }),
    enabled: !!startDate && !!endDate
  });
}

// ============ HOOKS PARA BAIXA EM LOTE ============

/**
 * Hook para baixa em lote de receitas
 */
export function useBulkConfirmReceipts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financialService.bulkConfirmReceipts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
    }
  });
}

/**
 * Hook para liquidar (dar baixa em) comissão pendente
 */
export function useSettleCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      transactionId: string;
      bankAccountId: string;
      settlementDate?: string;
    }) => financialService.settleCommission(params),
    onSuccess: async () => {
      // Invalidar todos os caches relacionados
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['revenue-transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['transaction-details'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['cash-flow'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['account-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['account-statement'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-totals'] }),
      ]);
      
      // Forçar refetch imediato dos saldos para garantir atualização
      queryClient.refetchQueries({ queryKey: ['account-balances'] });
    }
  });
}

/**
 * Hook para buscar detalhes de uma transação
 * @param transactionId - ID da transação (pode ser ID moderno ou legado)
 * @param isLegacyId - Se true, busca pelo ID legado (tabela transactions)
 */
export function useTransactionDetails(transactionId: string | null, isLegacyId = false) {
  return useQuery({
    queryKey: ['transaction-details', transactionId, isLegacyId],
    queryFn: () => financialService.getTransactionDetails(
      isLegacyId ? null : transactionId,
      isLegacyId ? transactionId : null
    ),
    enabled: !!transactionId
  });
}

/**
 * Hook para buscar totais pendentes (A Receber e A Pagar)
 */
export function usePendingTotals(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['pending-totals', startDate, endDate],
    queryFn: () => financialService.getPendingTotals(startDate, endDate)
  });
}

/**
 * Hook para buscar cash flow com projeção
 */
export function useCashFlowWithProjection(
  startDate: string,
  endDate: string,
  granularity: 'day' | 'month' = 'day'
) {
  return useQuery({
    queryKey: ['cash-flow-projection', startDate, endDate, granularity],
    queryFn: () => financialService.getCashFlowWithProjection(startDate, endDate, granularity),
    enabled: !!startDate && !!endDate
  });
}

/**
 * Hook para buscar total geral de pendentes a receber (sem filtro de data)
 */
export function useTotalPendingReceivables() {
  return useQuery({
    queryKey: ['total-pending-receivables'],
    queryFn: () => financialService.getTotalPendingReceivables()
  });
}

/**
 * Hook para buscar pendentes vencendo no mês atual
 */
export function usePendingThisMonth() {
  return useQuery({
    queryKey: ['pending-this-month'],
    queryFn: () => financialService.getPendingThisMonth()
  });
}
