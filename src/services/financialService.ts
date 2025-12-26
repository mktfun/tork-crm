import { supabase } from '@/integrations/supabase/client';
import { 
  FinancialAccount, 
  FinancialAccountType,
  LedgerEntryInput 
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
