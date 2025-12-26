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

// ============ HOOKS PARA IMPORTAÇÃO (FASE 5) ============

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

// ============ HOOKS PARA CONFIGURAÇÕES (FASE 6) ============

/**
 * Hook para contar transações legadas pendentes
 */
export function usePendingLegacyCount() {
  return useQuery({
    queryKey: ['pending-legacy-count'],
    queryFn: financialService.countPendingLegacyTransactions,
    staleTime: 1000 * 60 * 5 // 5 minutos
  });
}

/**
 * Hook para backfill de transações legadas
 */
export function useBackfillLegacy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financialService.backfillLegacyTransactions,
    onSuccess: () => {
      // Invalidar TODOS os caches financeiros
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dre-data'] });
      queryClient.invalidateQueries({ queryKey: ['pending-legacy-count'] });
    }
  });
}

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

// ============ HOOKS PARA SAFE DELETE E RECEITAS (FASE 7) ============

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
 * Hook para buscar totais de receita (comparação)
 */
export function useRevenueTotals(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['revenue-totals', startDate, endDate],
    queryFn: () => financialService.getRevenueTotals({ startDate, endDate }),
    enabled: !!startDate && !!endDate
  });
}

// ============ HOOKS PARA CORREÇÃO E BAIXA EM LOTE (FASE 8) ============

/**
 * Hook para contar descrições problemáticas
 */
export function useProblematicDescriptionsCount() {
  return useQuery({
    queryKey: ['problematic-descriptions-count'],
    queryFn: financialService.countProblematicDescriptions,
    staleTime: 1000 * 60 * 2 // 2 minutos
  });
}

/**
 * Hook para corrigir descrições problemáticas
 */
export function useFixLedgerDescriptions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financialService.fixLedgerDescriptions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['problematic-descriptions-count'] });
    }
  });
}

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
 * Hook para buscar detalhes de uma transação
 */
export function useTransactionDetails(transactionId: string | null) {
  return useQuery({
    queryKey: ['transaction-details', transactionId],
    queryFn: () => financialService.getTransactionDetails(transactionId!),
    enabled: !!transactionId
  });
}

// ============ HOOKS PARA CORREÇÃO DE DATAS (FASE 10) ============

/**
 * Hook para contar datas erradas do backfill
 */
export function useWrongDatesCount() {
  return useQuery({
    queryKey: ['wrong-dates-count'],
    queryFn: financialService.countWrongDates,
    staleTime: 1000 * 60 * 2 // 2 minutos
  });
}

/**
 * Hook para corrigir datas do backfill
 */
export function useFixBackfillDates() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financialService.fixBackfillDates,
    onSuccess: () => {
      // Invalidar todos os caches afetados
      queryClient.invalidateQueries({ queryKey: ['wrong-dates-count'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dre-data'] });
    }
  });
}

// ============ HOOKS PARA RECONCILIAÇÃO (FASE 12) ============

/**
 * Hook para diagnosticar gaps no Ledger
 */
export function useLedgerGaps() {
  return useQuery({
    queryKey: ['ledger-gaps'],
    queryFn: financialService.diagnoseLedgerGaps,
    staleTime: 1000 * 60 * 2 // 2 minutos
  });
}

/**
 * Hook para migrar transações faltantes para o Ledger
 */
export function useMigrateGaps() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financialService.migrateGapsToLedger,
    onSuccess: () => {
      // Invalidar TODOS os caches financeiros para atualização imediata
      queryClient.invalidateQueries({ queryKey: ['ledger-gaps'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['dre-data'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['pending-legacy-count'] });
    }
  });
}
