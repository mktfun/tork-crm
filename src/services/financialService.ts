import { supabase } from '@/integrations/supabase/client';
import { 
  FinancialAccount, 
  FinancialAccountType,
  LedgerEntryInput,
  CashFlowDataPoint,
  FinancialSummary,
  DreRow,
  BulkImportPayload,
  BulkImportResult
} from '@/types/financeiro';

// ============ TIPOS PARA AS RPCs ============

interface RecentTransaction {
  id: string;
  description: string;
  transaction_date: string;
  reference_number: string | null;
  created_at: string;
  is_void: boolean;
  total_amount: number;
  account_names: string;
}

// ============ CONTAS ============

/**
 * Busca contas financeiras por tipo via RPC
 */
export async function getAccountsByType(type: FinancialAccountType): Promise<FinancialAccount[]> {
  const { data, error } = await supabase
    .rpc('get_financial_accounts_by_type', { p_type: type });
  
  if (error) throw error;
  
  // Mapear snake_case para camelCase
  return (data || []).map((acc: any) => ({
    id: acc.id,
    userId: acc.user_id,
    name: acc.name,
    code: acc.code,
    description: acc.description,
    type: acc.type as FinancialAccountType,
    parentId: acc.parent_id,
    isSystem: acc.is_system,
    status: acc.status,
    createdAt: acc.created_at,
    updatedAt: acc.updated_at,
  }));
}

/**
 * Busca todas as contas ativas do usuário
 */
export async function getAllAccounts(): Promise<FinancialAccount[]> {
  const { data, error } = await supabase
    .from('financial_accounts')
    .select('*')
    .eq('status', 'active')
    .order('type')
    .order('name');
  
  if (error) throw error;
  
  return (data || []).map((acc: any) => ({
    id: acc.id,
    userId: acc.user_id,
    name: acc.name,
    code: acc.code,
    description: acc.description,
    type: acc.type as FinancialAccountType,
    parentId: acc.parent_id,
    isSystem: acc.is_system,
    status: acc.status,
    createdAt: acc.created_at,
    updatedAt: acc.updated_at,
  }));
}

/**
 * Garante que existam contas padrão para o usuário
 */
export async function ensureDefaultAccounts(): Promise<void> {
  const { error } = await supabase.rpc('ensure_default_financial_accounts');
  if (error) throw error;
}

/**
 * Cria uma nova conta financeira
 */
export async function createAccount(account: {
  name: string;
  type: FinancialAccountType;
  code?: string;
  description?: string;
}): Promise<FinancialAccount> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('financial_accounts')
    .insert({
      user_id: user.id,
      name: account.name,
      type: account.type,
      code: account.code,
      description: account.description
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    code: data.code,
    description: data.description,
    type: data.type as FinancialAccountType,
    parentId: data.parent_id,
    isSystem: data.is_system ?? false,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============ TRANSAÇÕES ============

/**
 * Registra uma despesa (Conta Ativo → Conta Despesa)
 * Converte a intenção do usuário para partidas dobradas
 */
export async function registerExpense(payload: {
  description: string;
  amount: number;
  transactionDate: string;
  expenseAccountId: string; // Categoria de despesa
  assetAccountId: string;   // Conta bancária de saída
  referenceNumber?: string;
  memo?: string;
}): Promise<string> {
  const movements: Array<{ account_id: string; amount: number; memo?: string }> = [
    // DÉBITO na conta de despesa (+) - aumenta a despesa
    { account_id: payload.expenseAccountId, amount: payload.amount, memo: payload.memo },
    // CRÉDITO na conta de ativo (-) - diminui o saldo bancário
    { account_id: payload.assetAccountId, amount: -payload.amount, memo: payload.memo }
  ];

  const { data, error } = await supabase.rpc('create_financial_movement', {
    p_description: payload.description,
    p_transaction_date: payload.transactionDate,
    p_movements: movements,
    p_reference_number: payload.referenceNumber || null,
    p_related_entity_type: null,
    p_related_entity_id: null
  });

  if (error) throw error;
  return data;
}

/**
 * Registra uma receita (Conta Ativo ← Conta Receita)
 */
export async function registerRevenue(payload: {
  description: string;
  amount: number;
  transactionDate: string;
  revenueAccountId: string; // Categoria de receita
  assetAccountId: string;   // Conta bancária de entrada
  referenceNumber?: string;
  memo?: string;
}): Promise<string> {
  const movements: Array<{ account_id: string; amount: number; memo?: string }> = [
    // DÉBITO na conta de ativo (+) - aumenta o saldo bancário
    { account_id: payload.assetAccountId, amount: payload.amount, memo: payload.memo },
    // CRÉDITO na conta de receita (-) - aumenta a receita
    { account_id: payload.revenueAccountId, amount: -payload.amount, memo: payload.memo }
  ];

  const { data, error } = await supabase.rpc('create_financial_movement', {
    p_description: payload.description,
    p_transaction_date: payload.transactionDate,
    p_movements: movements,
    p_reference_number: payload.referenceNumber || null,
    p_related_entity_type: null,
    p_related_entity_id: null
  });

  if (error) throw error;
  return data;
}

/**
 * Busca transações recentes
 */
export async function getRecentTransactions(params?: {
  limit?: number;
  offset?: number;
  type?: 'expense' | 'revenue';
}): Promise<RecentTransaction[]> {
  const { data, error } = await supabase.rpc('get_recent_financial_transactions', {
    p_limit: params?.limit || 50,
    p_offset: params?.offset || 0,
    p_type: params?.type || null
  });

  if (error) throw error;
  return data || [];
}

/**
 * Anula uma transação (soft delete)
 */
export async function voidTransaction(transactionId: string, reason: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await supabase
    .from('financial_transactions')
    .update({
      is_void: true,
      void_reason: reason,
      voided_at: new Date().toISOString(),
      voided_by: user.id
    })
    .eq('id', transactionId);

  if (error) throw error;
}

// ============ FLUXO DE CAIXA (FASE 3) ============

/**
 * Busca dados de fluxo de caixa para o gráfico
 */
export async function getCashFlowData(params: {
  startDate: string;
  endDate: string;
  granularity?: 'day' | 'month';
}): Promise<CashFlowDataPoint[]> {
  const { data, error } = await supabase.rpc('get_cash_flow_data', {
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_granularity: params.granularity || 'day'
  });

  if (error) throw error;
  
  return (data || []).map((row: any) => ({
    period: row.period,
    income: Number(row.income) || 0,
    expense: Number(row.expense) || 0,
    balance: Number(row.balance) || 0
  }));
}

/**
 * Busca resumo financeiro para KPIs
 */
export async function getFinancialSummary(params: {
  startDate: string;
  endDate: string;
}): Promise<FinancialSummary> {
  const { data, error } = await supabase.rpc('get_financial_summary', {
    p_start_date: params.startDate,
    p_end_date: params.endDate
  });

  if (error) throw error;
  
  // Cast para any para acessar propriedades dinamicamente
  const row = (data as any)?.[0] || {};
  return {
    totalIncome: Number(row.total_income) || 0,
    totalExpense: Number(row.total_expense) || 0,
    netResult: Number(row.net_result) || 0,
    transactionCount: Number(row.transaction_count) || 0
  };
}

// ============ DRE (FASE 4) ============

/**
 * Busca dados do DRE para um ano específico
 */
export async function getDreData(year?: number): Promise<DreRow[]> {
  const { data, error } = await supabase.rpc('get_dre_data', {
    p_year: year || new Date().getFullYear()
  });

  if (error) throw error;
  
  return (data || []).map((row: any) => ({
    category: row.category,
    account_type: row.account_type as 'revenue' | 'expense',
    jan: Number(row.jan) || 0,
    fev: Number(row.fev) || 0,
    mar: Number(row.mar) || 0,
    abr: Number(row.abr) || 0,
    mai: Number(row.mai) || 0,
    jun: Number(row.jun) || 0,
    jul: Number(row.jul) || 0,
    ago: Number(row.ago) || 0,
    set: Number(row.set) || 0,
    out: Number(row.out) || 0,
    nov: Number(row.nov) || 0,
    dez: Number(row.dez) || 0,
    total: Number(row.total) || 0
  }));
}

// ============ IMPORTAÇÃO EM MASSA (FASE 5) ============

/**
 * Importa múltiplas transações de forma atômica
 */
export async function bulkImportTransactions(
  payload: BulkImportPayload
): Promise<BulkImportResult> {
  const transactions = payload.transactions.map(tx => ({
    description: tx.description,
    transaction_date: tx.transactionDate,
    amount: tx.amount,
    asset_account_id: payload.assetAccountId,
    category_account_id: tx.categoryAccountId,
    reference_number: tx.referenceNumber || null,
    memo: tx.memo || null
  }));

  const { data, error } = await supabase.rpc('bulk_create_financial_movements', {
    p_transactions: transactions
  });

  if (error) throw error;
  
  // O retorno é JSONB, então já é objeto
  const result = data as any;
  
  return {
    successCount: result.success_count || 0,
    errorCount: result.error_count || 0,
    totalProcessed: result.total_processed || 0,
    errors: result.errors || []
  };
}

// ============ BACKFILL E GESTÃO DE CONTAS (FASE 6) ============

interface BackfillResult {
  successCount: number;
  errorCount: number;
  errors: Array<{ transaction_id: string; error: string }>;
}

/**
 * Migra transações legadas para o sistema financeiro
 */
export async function backfillLegacyTransactions(): Promise<BackfillResult> {
  const { data, error } = await supabase.rpc('backfill_legacy_transactions');
  
  if (error) throw error;
  
  const result = data as any;
  return {
    successCount: result.success_count || 0,
    errorCount: result.error_count || 0,
    errors: result.errors || []
  };
}

/**
 * Conta transações legadas pendentes de migração
 */
export async function countPendingLegacyTransactions(): Promise<number> {
  const { data, error } = await supabase.rpc('count_pending_legacy_transactions');
  
  if (error) throw error;
  return data || 0;
}

/**
 * Atualiza uma conta financeira
 */
export async function updateAccount(accountId: string, updates: {
  name: string;
  code?: string;
  description?: string;
}): Promise<FinancialAccount> {
  const { data, error } = await supabase.rpc('update_financial_account', {
    p_account_id: accountId,
    p_name: updates.name,
    p_code: updates.code || null,
    p_description: updates.description || null
  });

  if (error) throw error;
  
  const acc = data as any;
  return {
    id: acc.id,
    userId: acc.user_id,
    name: acc.name,
    code: acc.code,
    description: acc.description,
    type: acc.type as FinancialAccountType,
    parentId: acc.parent_id,
    isSystem: acc.is_system ?? false,
    status: acc.status,
    createdAt: acc.created_at,
    updatedAt: acc.updated_at,
  };
}

/**
 * Arquiva uma conta financeira (soft delete)
 */
export async function archiveAccount(accountId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('archive_financial_account', {
    p_account_id: accountId
  });

  if (error) throw error;
  return data;
}

// ============ SAFE DELETE E RECEITAS (FASE 7) ============

interface SafeDeleteResult {
  success: boolean;
  error?: string;
  entryCount?: number;
  requiresMigration?: boolean;
  migratedEntries?: number;
  message?: string;
}

/**
 * Conta lançamentos de uma conta no ledger
 */
export async function countLedgerEntriesByAccount(accountId: string): Promise<number> {
  const { data, error } = await supabase.rpc('count_ledger_entries_by_account', {
    p_account_id: accountId
  });

  if (error) throw error;
  return data || 0;
}

/**
 * Exclusão segura de conta com migração opcional
 */
export async function deleteAccountSafe(
  targetAccountId: string,
  migrateToAccountId?: string
): Promise<SafeDeleteResult> {
  const { data, error } = await supabase.rpc('delete_financial_account_safe', {
    p_target_account_id: targetAccountId,
    p_migrate_to_account_id: migrateToAccountId || null
  });

  if (error) throw error;
  
  const result = data as any;
  return {
    success: result.success,
    error: result.error,
    entryCount: result.entry_count,
    requiresMigration: result.requires_migration,
    migratedEntries: result.migrated_entries,
    message: result.message
  };
}

// Interface alinhada com o retorno real da RPC get_revenue_transactions
export interface RevenueTransaction {
  id: string;
  description: string;
  transaction_date: string; // date retornado como string YYYY-MM-DD
  amount: number;
  account_name: string | null;
  is_confirmed: boolean;
  legacy_status: string | null;
  client_name: string | null;
  policy_number: string | null;
}

/**
 * Busca transações de receita com filtro de data
 */
export async function getRevenueTransactions(params: {
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<RevenueTransaction[]> {
  const { data, error } = await supabase.rpc('get_revenue_transactions', {
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_limit: params.limit || 100
  });

  if (error) throw error;
  
  // Garantir que os dados sejam mapeados corretamente
  return (data || []).map((row: any) => ({
    id: row.id,
    description: row.description || '',
    transaction_date: row.transaction_date,
    amount: Number(row.amount) || 0,
    account_name: row.account_name || null,
    is_confirmed: row.is_confirmed ?? false,
    legacy_status: row.legacy_status || null,
    client_name: row.client_name || null,
    policy_number: row.policy_number || null
  }));
}

interface RevenueTotals {
  financialTotal: number;
  legacyTotal: number;
}

/**
 * Busca totais de receita para comparação legado vs financeiro
 */
export async function getRevenueTotals(params: {
  startDate: string;
  endDate: string;
}): Promise<RevenueTotals> {
  const { data, error } = await supabase.rpc('get_revenue_totals', {
    p_start_date: params.startDate,
    p_end_date: params.endDate
  });

  if (error) throw error;
  
  const row = (data as any)?.[0] || {};
  return {
    financialTotal: Number(row.financial_total) || 0,
    legacyTotal: Number(row.legacy_total) || 0
  };
}

// ============ CORREÇÃO E BAIXA EM LOTE (FASE 8) ============

interface FixDescriptionsResult {
  fixedCount: number;
  success: boolean;
}

/**
 * Corrige descrições "undefined" ou vazias nas transações financeiras
 */
export async function fixLedgerDescriptions(): Promise<FixDescriptionsResult> {
  const { data, error } = await supabase.rpc('fix_ledger_descriptions');
  
  if (error) throw error;
  
  const result = data as any;
  return {
    fixedCount: result?.fixed_count ?? 0,
    success: result?.success ?? false
  };
}

/**
 * Conta transações com descrições problemáticas
 */
export async function countProblematicDescriptions(): Promise<number> {
  const { data, error } = await supabase.rpc('count_problematic_descriptions');
  
  if (error) throw error;
  return data || 0;
}

interface BulkConfirmResult {
  confirmedCount: number;
  skippedCount: number;
  success: boolean;
  message?: string;
}

/**
 * Confirma recebimento em lote de transações selecionadas.
 * Ignora transações que já estão pagas/confirmadas (proteção anti-baixa dupla).
 */
export async function bulkConfirmReceipts(transactionIds: string[]): Promise<BulkConfirmResult> {
  const { data, error } = await supabase.rpc('bulk_confirm_receipts', {
    p_transaction_ids: transactionIds
  });
  
  if (error) throw error;
  
  const result = data as any;
  return {
    confirmedCount: result?.confirmed_count ?? 0,
    skippedCount: result?.skipped_count ?? 0,
    success: result?.success ?? false,
    message: result?.message
  };
}

interface TransactionDetails {
  id: string;
  description: string;
  transactionDate: string;
  referenceNumber: string | null;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  isVoid: boolean;
  voidReason: string | null;
  createdAt: string;
  ledgerEntries: Array<{
    id: string;
    amount: number;
    memo: string | null;
    accountId: string;
    accountName: string;
    accountType: string;
  }>;
  legacyData: {
    clientId: string | null;
    clientName: string | null;
    policyId: string | null;
    policyNumber: string | null;
    ramo: string | null;
    company: string | null;
    originalAmount: number | null;
    originalStatus: string | null;
  } | null;
}

/**
 * Busca detalhes completos de uma transação
 */
// ============ CORREÇÃO DE DATAS DO BACKFILL (FASE 10) ============

interface FixBackfillResult {
  success: boolean;
  updated_count: number;
  message: string;
}

/**
 * Conta quantas transações financeiras estão com data divergente do legado
 */
export async function countWrongDates(): Promise<number> {
  const { data, error } = await supabase.rpc('count_wrong_backfill_dates');
  
  if (error) throw error;
  return data || 0;
}

/**
 * Corrige as datas das transações financeiras baseadas na origem (legado)
 */
export async function fixBackfillDates(): Promise<FixBackfillResult> {
  const { data, error } = await supabase.rpc('fix_backfill_dates');
  
  if (error) throw error;
  
  const result = data as any;
  return {
    success: result.success ?? true,
    updated_count: result.updated_count ?? 0,
    message: result.message ?? 'Datas corrigidas com sucesso.'
  };
}

export async function getTransactionDetails(transactionId: string): Promise<TransactionDetails> {
  const { data, error } = await supabase.rpc('get_transaction_details', {
    p_transaction_id: transactionId
  });
  
  if (error) throw error;
  
  const result = data as any;
  
  if (result?.error) {
    throw new Error(result.error);
  }
  
  return {
    id: result.id,
    description: result.description,
    transactionDate: result.transaction_date,
    referenceNumber: result.reference_number,
    relatedEntityId: result.related_entity_id,
    relatedEntityType: result.related_entity_type,
    isVoid: result.is_void,
    voidReason: result.void_reason,
    createdAt: result.created_at,
    ledgerEntries: (result.ledger_entries || []).map((entry: any) => ({
      id: entry.id,
      amount: entry.amount,
      memo: entry.memo,
      accountId: entry.account_id,
      accountName: entry.account_name,
      accountType: entry.account_type
    })),
    legacyData: result.legacy_data ? {
      clientId: result.legacy_data.client_id,
      clientName: result.legacy_data.client_name,
      policyId: result.legacy_data.policy_id,
      policyNumber: result.legacy_data.policy_number,
      ramo: result.legacy_data.ramo,
      company: result.legacy_data.company,
      originalAmount: result.legacy_data.original_amount,
      originalStatus: result.legacy_data.original_status
    } : null
  };
}
