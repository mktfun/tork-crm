// ============= Types for Financial Recurring Configs =============

/**
 * Frequência de recorrência
 */
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * Natureza da configuração (receita ou despesa)
 */
export type RecurringNature = 'expense' | 'revenue';

/**
 * Configuração de despesa/receita recorrente
 */
export interface RecurringConfig {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  amount: number;
  nature: RecurringNature;
  account_id?: string | null;
  frequency: RecurringFrequency;
  day_of_month?: number | null;
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
  last_generated_date?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payload para criar/atualizar configuração recorrente
 */
export interface RecurringConfigPayload {
  name: string;
  description?: string;
  amount: number;
  nature: RecurringNature;
  account_id?: string;
  frequency: RecurringFrequency;
  day_of_month?: number;
  start_date: string;
  end_date?: string | null;
  is_active?: boolean;
}

/**
 * Dados de projeção de fluxo de caixa
 */
export interface ProjectedCashFlowPoint {
  period: string;
  period_date: string;
  realized_income: number;
  realized_expense: number;
  projected_income: number;
  projected_expense: number;
  running_balance: number;
}

/**
 * Mapeamento de frequências para labels em português
 */
export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

/**
 * Mapeamento de natureza para labels
 */
export const NATURE_LABELS: Record<RecurringNature, string> = {
  expense: 'Despesa',
  revenue: 'Receita',
};
