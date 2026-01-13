// ============= Sistema Financeiro ERP - Double-Entry Ledger =============
// Fase 1: Tipos TypeScript para o módulo de Ledger (Partidas Dobradas)

/**
 * Tipos de conta no plano de contas
 * - asset: Ativo (Banco, Caixa, Contas a Receber)
 * - liability: Passivo (Contas a Pagar, Empréstimos)
 * - equity: Patrimônio Líquido
 * - revenue: Receita (Comissões, Honorários)
 * - expense: Despesa (Marketing, Aluguel)
 */
export type FinancialAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

/**
 * Status da conta
 * - active: Conta ativa e operacional
 * - archived: Conta arquivada (não pode receber novos lançamentos)
 */
export type FinancialAccountStatus = 'active' | 'archived';

/**
 * Tipos de entidades que podem ser vinculadas a transações financeiras
 */
export type RelatedEntityType = 'policy' | 'client' | 'sinistro' | 'appointment' | 'producer' | 'brokerage';

/**
 * Representa uma conta no Plano de Contas.
 * Pode ser uma conta patrimonial (Banco, Caixa) ou de resultado (Receita, Despesa).
 */
export interface FinancialAccount {
  id: string;
  userId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  type: FinancialAccountType;
  parentId?: string | null;
  isSystem: boolean;
  status: FinancialAccountStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Representa o cabeçalho de uma transação financeira.
 * Agrupa múltiplos movimentos no ledger que devem somar zero (partidas dobradas).
 */
export interface FinancialTransaction {
  id: string;
  userId: string;
  description: string;
  transactionDate: string;
  referenceNumber?: string | null;
  relatedEntityType?: RelatedEntityType | string | null;
  relatedEntityId?: string | null;
  createdAt: string;
  createdBy: string;
  isVoid: boolean;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
}

/**
 * Representa um movimento atômico no Ledger.
 * O princípio das partidas dobradas exige que a soma de todos os amounts
 * de uma transação seja igual a zero.
 * 
 * Convenção de sinais:
 * - Positivo (+) = DÉBITO (aumenta Ativo/Despesa, diminui Passivo/PL/Receita)
 * - Negativo (-) = CRÉDITO (diminui Ativo/Despesa, aumenta Passivo/PL/Receita)
 */
export interface FinancialLedgerEntry {
  id: string;
  transactionId: string;
  accountId: string;
  amount: number;
  memo?: string | null;
  createdAt: string;
}

/**
 * View materializada com saldo das contas.
 * Combina os dados da conta com o saldo calculado do ledger.
 */
export interface FinancialAccountBalance extends FinancialAccount {
  balance: number;
  entryCount: number;
}

/**
 * Representa uma entrada de ledger para criação (sem id/createdAt)
 */
export interface LedgerEntryInput {
  accountId: string;
  amount: number;
  memo?: string;
}

/**
 * Payload para criar uma transação completa com seus movimentos.
 * A soma dos amounts em entries DEVE ser zero.
 */
export interface CreateFinancialTransactionPayload {
  description: string;
  transactionDate: string;
  referenceNumber?: string;
  relatedEntityType?: RelatedEntityType | string;
  relatedEntityId?: string;
  entries: LedgerEntryInput[];
}

/**
 * Payload para atualizar uma transação (apenas campos editáveis)
 */
export interface UpdateFinancialTransactionPayload {
  description?: string;
  transactionDate?: string;
  referenceNumber?: string;
}

/**
 * Payload para criar uma conta financeira
 */
export interface CreateFinancialAccountPayload {
  name: string;
  code?: string;
  description?: string;
  type: FinancialAccountType;
  parentId?: string;
}

/**
 * Payload para atualizar uma conta financeira
 */
export interface UpdateFinancialAccountPayload {
  name?: string;
  code?: string;
  description?: string;
  status?: FinancialAccountStatus;
  parentId?: string | null;
}

/**
 * Mapeamento de tipos de conta para nomes em português
 */
export const ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  asset: 'Ativo',
  liability: 'Passivo',
  equity: 'Patrimônio Líquido',
  revenue: 'Receita',
  expense: 'Despesa',
};

/**
 * Mapeamento de status para nomes em português
 */
export const ACCOUNT_STATUS_LABELS: Record<FinancialAccountStatus, string> = {
  active: 'Ativa',
  archived: 'Arquivada',
};

/**
 * Helper para verificar se uma transação está balanceada
 * @param entries Lista de entradas do ledger
 * @returns true se a soma é zero (tolerância de 0.01)
 */
export function isTransactionBalanced(entries: LedgerEntryInput[]): boolean {
  if (entries.length < 2) return false;
  const sum = entries.reduce((acc, entry) => acc + entry.amount, 0);
  return Math.abs(sum) <= 0.01;
}

/**
 * Helper para calcular o saldo total de uma lista de entradas
 * @param entries Lista de entradas do ledger
 * @returns Soma dos valores
 */
export function calculateEntriesBalance(entries: LedgerEntryInput[]): number {
  return entries.reduce((acc, entry) => acc + entry.amount, 0);
}

// ============ TIPOS PARA FLUXO DE CAIXA (FASE 3) ============

/**
 * Ponto de dados do gráfico de fluxo de caixa
 */
export interface CashFlowDataPoint {
  period: string;
  income: number;
  expense: number;
  balance: number;
}

/**
 * Resumo financeiro para KPIs
 */
export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  pendingIncome: number;
  pendingExpense: number;
  transactionCount: number;
  cashBalance: number; // Saldo acumulado em contas de ativo (bancos)
}

// ============ TIPOS PARA DRE (FASE 4) ============

/**
 * Linha do DRE (Demonstrativo de Resultado do Exercício)
 */
export interface DreRow {
  category: string;
  account_type: 'revenue' | 'expense';
  jan: number;
  fev: number;
  mar: number;
  abr: number;
  mai: number;
  jun: number;
  jul: number;
  ago: number;
  set: number;
  out: number;
  nov: number;
  dez: number;
  total: number;
}

/**
 * Resumo do DRE
 */
export interface DreSummary {
  totalRevenue: number;
  totalExpense: number;
  netResult: number;
}

// ============ TIPOS PARA IMPORTAÇÃO (FASE 5) ============

/**
 * Linha de transação parseada do CSV
 */
export interface ImportedTransaction {
  id: string;
  description: string;
  transactionDate: string;
  amount: number;
  referenceNumber?: string;
  categoryAccountId?: string;
  originalRow: Record<string, any>;
}

/**
 * Mapeamento de colunas do CSV
 */
export interface ColumnMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  referenceColumn?: string;
}

/**
 * Payload para bulk import
 */
export interface BulkImportPayload {
  assetAccountId: string;
  transactions: Array<{
    description: string;
    transactionDate: string;
    amount: number;
    categoryAccountId: string;
    referenceNumber?: string;
    memo?: string;
  }>;
}

/**
 * Resultado do bulk import
 */
export interface BulkImportResult {
  successCount: number;
  errorCount: number;
  totalProcessed: number;
  errors: Array<{ index: number; message: string; description?: string }>;
}

// ============ TIPOS PARA OCR E COMPROVANTES (FASE 18) ============

/**
 * Dados extraídos do comprovante via OCR
 */
export interface ExtractedReceiptData {
  date: string | null;
  amount: number | null;
  merchant_name: string | null;
  category_guess: string | null;
}

/**
 * Resultado da análise de comprovante via Edge Function
 */
export interface AnalyzeReceiptResult {
  success: boolean;
  data?: ExtractedReceiptData;
  error?: string;
}

/**
 * Item para revisão na importação de recibos
 */
export interface ReceiptImportItem {
  id: string;
  file: File;
  fileUrl?: string;
  thumbnailUrl?: string;
  extractedData: ExtractedReceiptData | null;
  isLoading: boolean;
  error?: string;
  // Dados editáveis pelo usuário
  description: string;
  amount: number;
  transactionDate: string;
  categoryAccountId: string;
  selected: boolean;
}
