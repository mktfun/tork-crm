import { supabase } from '@/integrations/supabase/client';
import { 
  FinancialAccount, 
  FinancialAccountType,
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
  status: string; // ✅ Campo adicionado pela migration
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
 */
export async function registerExpense(payload: {
  description: string;
  amount: number;
  transactionDate: string;
  expenseAccountId: string;
  assetAccountId: string;
  referenceNumber?: string;
  memo?: string;
}): Promise<string> {
  const movements: Array<{ account_id: string; amount: number; memo?: string }> = [
    { account_id: payload.expenseAccountId, amount: payload.amount, memo: payload.memo },
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
  revenueAccountId: string;
  assetAccountId: string;
  referenceNumber?: string;
  memo?: string;
}): Promise<string> {
  const movements: Array<{ account_id: string; amount: number; memo?: string }> = [
    { account_id: payload.assetAccountId, amount: payload.amount, memo: payload.memo },
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

// ============ INTERFACE PARA RESULTADO DE ESTORNO ============

export interface ReverseTransactionResult {
  success: boolean;
  reversalId?: string;
  originalId?: string;
  reversedAmount?: number;
  error?: string;
  message?: string;
}

/**
 * Estorna uma transação usando a RPC void_financial_transaction.
 * Cria lançamentos inversos no ledger e marca a transação original como void.
 */
export async function reverseTransaction(
  transactionId: string, 
  reason: string
): Promise<ReverseTransactionResult> {
  const { data, error } = await supabase.rpc('void_financial_transaction', {
    p_transaction_id: transactionId,
    p_reason: reason
  });

  if (error) throw error;
  
  const result = data as any;
  return {
    success: result?.success ?? false,
    reversalId: result?.reversal_id,
    originalId: result?.original_id,
    reversedAmount: result?.reversed_amount,
    error: result?.error,
    message: result?.message
  };
}

/**
 * @deprecated Use reverseTransaction instead - mantido para compatibilidade
 * Anula uma transação (soft delete) - Esta função não funciona mais devido aos triggers de imutabilidade
 */
export async function voidTransaction(transactionId: string, reason: string): Promise<void> {
  // Redirecionar para a nova função de estorno
  const result = await reverseTransaction(transactionId, reason);
  if (!result.success) {
    throw new Error(result.error || 'Falha ao estornar transação');
  }
}

// ============ FLUXO DE CAIXA ============

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
  
  // A RPC retorna JSON diretamente, não array
  const row = data as any || {};
  return {
    totalIncome: Number(row.totalIncome) || 0,
    totalExpense: Number(row.totalExpense) || 0,
    netResult: Number(row.netResult) || 0,
    pendingIncome: Number(row.pendingIncome) || 0,
    pendingExpense: Number(row.pendingExpense) || 0,
    transactionCount: Number(row.transactionCount) || 0,
    cashBalance: Number(row.cashBalance) || 0
  };
}

// ============ DRE ============

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

// ============ IMPORTAÇÃO EM MASSA ============

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
  
  const result = data as any;
  
  return {
    successCount: result.success_count || 0,
    errorCount: result.error_count || 0,
    totalProcessed: result.total_processed || 0,
    errors: result.errors || []
  };
}

// ============ GESTÃO DE CONTAS ============

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

// ============ SAFE DELETE E RECEITAS ============

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

// Interface para transações de receita
export interface RevenueTransaction {
  id: string;
  description: string;
  transaction_date: string;
  amount: number;
  account_name: string | null;
  is_confirmed: boolean;
  legacy_status: string | null;
  client_name: string | null;
  policy_number: string | null;
  related_entity_id: string | null;
  related_entity_type: string | null;
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
  
  return (data || []).map((row: any) => ({
    id: row.id,
    description: row.description || '',
    transaction_date: row.transaction_date,
    amount: Number(row.amount) || 0,
    account_name: row.account_name || null,
    is_confirmed: row.is_confirmed ?? false,
    legacy_status: row.legacy_status || null,
    client_name: row.client_name || null,
    policy_number: row.policy_number || null,
    related_entity_id: row.related_entity_id || null,
    related_entity_type: row.related_entity_type || null
  }));
}

interface RevenueTotals {
  financialTotal: number;
  legacyTotal: number;
}

/**
 * Busca totais de receita
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

// ============ BAIXA EM LOTE ============

interface BulkConfirmResult {
  confirmedCount: number;
  skippedCount: number;
  success: boolean;
  message?: string;
}

/**
 * Confirma recebimento em lote de transações selecionadas.
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

// ============ LIQUIDAÇÃO (BAIXA) DE COMISSÕES ============

interface SettleCommissionResult {
  success: boolean;
  settledAmount?: number;
  message?: string;
}

/**
 * Liquida (dá baixa em) uma comissão pendente, creditando em uma conta bancária.
 * @param transactionId - ID da transação no financial_transactions
 * @param bankAccountId - ID da conta bancária (asset) onde o dinheiro entrou
 * @param settlementDate - Data da liquidação (opcional, default: hoje)
 */
export async function settleCommission(params: {
  transactionId: string;
  bankAccountId: string;
  settlementDate?: string;
}): Promise<SettleCommissionResult> {
  console.log('📡 SERVICE - Chamando RPC settle_commission_transaction:', {
    p_transaction_id: params.transactionId,
    p_bank_account_id: params.bankAccountId
  });

  const { data, error } = await supabase.rpc('settle_commission_transaction', {
    p_transaction_id: params.transactionId,
    p_bank_account_id: params.bankAccountId
  });

  console.log('📡 SERVICE - Resposta RPC:', { data, error });

  if (error) {
    console.error('📡 SERVICE - Erro RPC:', error);
    throw error;
  }
  
  const result = data as any;
  return {
    success: result?.success ?? false,
    settledAmount: result?.amount,
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
  attachments: string[];
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
 * @param transactionId - ID da transação no financial_transactions
 * @param legacyId - ID da transação legada na tabela transactions (opcional)
 */
export async function getTransactionDetails(
  transactionId?: string | null,
  legacyId?: string | null
): Promise<TransactionDetails> {
  const { data, error } = await supabase.rpc('get_transaction_details', {
    p_transaction_id: transactionId || null,
    p_legacy_id: legacyId || null
  });

  // Fallback: Se a RPC falhar ou não existir, tenta buscar direto das tabelas
  if (error) {
    console.warn("RPC get_transaction_details falhou, tentando fallback...", error);
    
    const id = transactionId || legacyId;
    if (!id) throw new Error("ID da transação não fornecido");
    
    // CORREÇÃO DE SEGURANÇA: Obter user_id do contexto de auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");
    
    const { data: tx, error: txError } = await supabase
      .from('financial_transactions')
      .select(`
        *,
        financial_ledger (
          id, amount, memo, account_id,
          financial_accounts ( name, type )
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)  // CORREÇÃO: Filtrar por user_id
      .single();
    
    if (txError) throw txError;
    
    // Formata para o mesmo padrão da RPC
    return {
      id: tx.id,
      description: tx.description || '',
      transactionDate: tx.transaction_date,
      referenceNumber: tx.reference_number,
      relatedEntityId: tx.related_entity_id,
      relatedEntityType: tx.related_entity_type,
      isVoid: tx.is_void ?? false,
      voidReason: tx.void_reason,
      createdAt: tx.created_at,
      attachments: tx.attachments || [],
      ledgerEntries: (tx.financial_ledger || []).map((l: any) => ({
        id: l.id,
        amount: l.amount,
        memo: l.memo,
        accountId: l.account_id,
        accountName: l.financial_accounts?.name || 'Conta Desconhecida',
        accountType: l.financial_accounts?.type || 'unknown'
      })),
      legacyData: null
    };
  }
  
  const raw = data as any;
  
  if (raw?.error) {
    throw new Error(raw.error);
  }
  
  // Smart Mapper: aceita tanto camelCase (novo) quanto snake_case (legado)
  const rawMovements = raw.ledgerEntries || raw.ledger_entries || [];
  const rawLegacy = raw.legacyData || raw.legacy_data;
  
  return {
    id: raw.id,
    description: raw.description,
    // Tenta camelCase primeiro (novo padrão), depois snake_case (legado)
    transactionDate: raw.transactionDate || raw.transaction_date,
    referenceNumber: raw.referenceNumber || raw.reference_number,
    relatedEntityId: raw.relatedEntityId || raw.related_entity_id,
    relatedEntityType: raw.relatedEntityType || raw.related_entity_type,
    isVoid: raw.isVoid ?? raw.is_void ?? false,
    voidReason: raw.voidReason || raw.void_reason,
    createdAt: raw.createdAt || raw.created_at,
    attachments: raw.attachments || [],
    
    // Mapeamento profundo do Ledger (aceita ambos os formatos)
    ledgerEntries: rawMovements.map((entry: any) => ({
      id: entry.id,
      amount: entry.amount,
      memo: entry.memo,
      accountId: entry.accountId || entry.account_id,
      accountName: entry.accountName || entry.account_name || 'Conta Desconhecida',
      accountType: entry.accountType || entry.account_type || 'unknown'
    })),
    
    // Legacy data (aceita ambos os formatos)
    legacyData: rawLegacy ? {
      clientId: rawLegacy.clientId || rawLegacy.client_id,
      clientName: rawLegacy.clientName || rawLegacy.client_name,
      policyId: rawLegacy.policyId || rawLegacy.policy_id,
      policyNumber: rawLegacy.policyNumber || rawLegacy.policy_number,
      ramo: rawLegacy.ramo,
      company: rawLegacy.company,
      originalAmount: rawLegacy.originalAmount || rawLegacy.original_amount || rawLegacy.amount,
      originalStatus: rawLegacy.originalStatus || rawLegacy.original_status || rawLegacy.status
    } : null
  };
}

// Buscar totais pendentes (A Receber e A Pagar)
export async function getPendingTotals(startDate?: string, endDate?: string) {
  const { data, error } = await supabase.rpc('get_pending_totals', {
    p_start_date: startDate || null,
    p_end_date: endDate || null
  });

  if (error) throw error;
  return data as {
    total_a_receber: number;
    total_a_pagar: number;
    count_a_receber: number;
    count_a_pagar: number;
  };
}

// Buscar cash flow com projeção
export async function getCashFlowWithProjection(
  startDate: string,
  endDate: string,
  granularity: 'day' | 'month' = 'day'
) {
  const { data, error } = await supabase.rpc('get_cash_flow_with_projection', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_granularity: granularity
  });

  if (error) throw error;
  return data as Array<{
    period: string;
    income: number;
    expense: number;
    pending_income: number;
    pending_expense: number;
    net: number;
    projected_net: number;
  }>;
}

// ============ NOVOS KPIs: TOTAL GERAL E MÊS ATUAL ============

/**
 * Busca total geral de receitas pendentes (TODAS as datas)
 */
export async function getTotalPendingReceivables(): Promise<{
  total_amount: number;
  pending_count: number;
}> {
  const { data, error } = await supabase.rpc('get_total_pending_receivables');

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    total_amount: Number(row?.total_amount || 0),
    pending_count: Number(row?.pending_count || 0)
  };
}

/**
 * Busca total de receitas pendentes vencendo no mês atual
 */
export async function getPendingThisMonth(): Promise<{
  total_amount: number;
  pending_count: number;
}> {
  const { data, error } = await supabase.rpc('get_pending_this_month');

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    total_amount: Number(row?.total_amount || 0),
    pending_count: Number(row?.pending_count || 0)
  };
}

// ============ AUDITORIA CONTÁBIL ============

export interface LedgerIntegrityIssue {
  issue_type: 'UNBALANCED_TRANSACTION' | 'NEGATIVE_ASSET_BALANCE' | 'ORPHAN_TRANSACTION';
  transaction_id: string | null;
  account_id: string | null;
  description: string;
  amount: number;
}

/**
 * Executa auditoria de integridade contábil
 * Retorna lista de problemas encontrados no ledger
 */
export async function auditLedgerIntegrity(): Promise<LedgerIntegrityIssue[]> {
  const { data, error } = await supabase.rpc('audit_ledger_integrity');

  if (error) throw error;
  
  return (data || []).map((row: any) => ({
    issue_type: row.issue_type,
    transaction_id: row.transaction_id,
    account_id: row.account_id,
    description: row.description,
    amount: Number(row.amount) || 0
  }));
}
