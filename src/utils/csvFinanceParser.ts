/**
 * Utilitários para parsing de CSVs financeiros (extratos bancários)
 */

import { FinancialAccount } from '@/types/financeiro';

/**
 * Converte string de moeda brasileira para número
 * Exemplos:
 *   "R$ 1.234,56" → 1234.56
 *   "-1.234,56" → -1234.56
 *   "1234,56" → 1234.56
 *   "(100,00)" → -100.00 (formato contábil)
 */
export function parseCurrencyBRL(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;
  
  let cleaned = value.trim();
  
  // Detecta valores negativos em formato contábil (100,00)
  const isNegativeParens = /^\(.*\)$/.test(cleaned);
  if (isNegativeParens) {
    cleaned = cleaned.replace(/[()]/g, '');
  }
  
  // Remove R$ e espaços
  cleaned = cleaned.replace(/R\$\s*/gi, '');
  
  // Detecta sinal negativo
  const isNegative = cleaned.startsWith('-') || isNegativeParens;
  cleaned = cleaned.replace(/^-/, '');
  
  // Remove pontos de milhar e converte vírgula decimal
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  
  const number = parseFloat(cleaned);
  if (isNaN(number)) return 0;
  
  return isNegative ? -Math.abs(number) : number;
}

/**
 * Converte data PT-BR para ISO
 * Exemplos:
 *   "25/12/2024" → "2024-12-25"
 *   "25-12-2024" → "2024-12-25"
 *   "2024-12-25" → "2024-12-25" (já está em ISO)
 */
export function parseDateBRL(value: string): string | null {
  if (!value || typeof value !== 'string') return null;
  
  const cleaned = value.trim();
  
  // Já está em formato ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Formato DD/MM/YYYY ou DD-MM-YYYY
  const match = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Tenta parse genérico
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
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
 * Detecta automaticamente qual coluna é data, valor, descrição
 * baseado em patterns dos valores
 */
export function detectColumnTypes(
  headers: string[],
  sampleRows: Record<string, any>[]
): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  
  // Keywords para cada tipo de coluna
  const dateKeywords = ['data', 'date', 'dt', 'lancto', 'lancamento', 'movimento'];
  const amountKeywords = ['valor', 'amount', 'value', 'vlr', 'quantia', 'saldo'];
  const descKeywords = ['descr', 'historico', 'descrição', 'description', 'memo', 'obs'];
  const refKeywords = ['doc', 'documento', 'ref', 'referencia', 'numero', 'num'];
  
  for (const header of headers) {
    const lowerHeader = header.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Detecta por nome da coluna
    if (!mapping.dateColumn && dateKeywords.some(k => lowerHeader.includes(k))) {
      mapping.dateColumn = header;
    }
    if (!mapping.amountColumn && amountKeywords.some(k => lowerHeader.includes(k))) {
      mapping.amountColumn = header;
    }
    if (!mapping.descriptionColumn && descKeywords.some(k => lowerHeader.includes(k))) {
      mapping.descriptionColumn = header;
    }
    if (!mapping.referenceColumn && refKeywords.some(k => lowerHeader.includes(k))) {
      mapping.referenceColumn = header;
    }
  }
  
  // Se não detectou por nome, tenta por conteúdo das primeiras linhas
  if (sampleRows.length > 0 && (!mapping.dateColumn || !mapping.amountColumn)) {
    for (const header of headers) {
      const values = sampleRows.map(row => row[header]).filter(Boolean);
      
      // Detecta coluna de data pelo conteúdo
      if (!mapping.dateColumn) {
        const hasDateValues = values.some(v => 
          typeof v === 'string' && /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(v)
        );
        if (hasDateValues) {
          mapping.dateColumn = header;
        }
      }
      
      // Detecta coluna de valor pelo conteúdo
      if (!mapping.amountColumn) {
        const hasMoneyValues = values.some(v => 
          typeof v === 'string' && /^-?[\d\.\,]+$|R\$|^\([\d\.\,]+\)$/.test(v.trim())
        );
        if (hasMoneyValues) {
          mapping.amountColumn = header;
        }
      }
    }
  }
  
  return mapping;
}

/**
 * Palavras-chave para sugestão automática de categorias
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Transporte': ['uber', '99', 'taxi', 'cabify', 'combustivel', 'gasolina', 'estacionamento', 'pedagio'],
  'Marketing': ['google ads', 'facebook', 'meta', 'instagram', 'tiktok', 'publicidade', 'marketing'],
  'Alimentação': ['ifood', 'rappi', 'uber eats', 'restaurante', 'lanchonete', 'padaria'],
  'Energia': ['luz', 'cemig', 'cpfl', 'copel', 'celesc', 'energia', 'eletricidade'],
  'Água': ['agua', 'saneamento', 'copasa', 'sabesp', 'sanepar'],
  'Internet/Telefone': ['internet', 'telefone', 'celular', 'vivo', 'claro', 'tim', 'oi'],
  'Aluguel': ['aluguel', 'locacao', 'condominio'],
  'Software': ['software', 'saas', 'assinatura', 'aws', 'azure', 'google cloud', 'heroku'],
  'Bancárias': ['tarifa', 'taxa', 'iof', 'ted', 'doc', 'pix'],
  'Comissões': ['comissao', 'comissão', 'repasse', 'honorario'],
};

/**
 * Sugere categoria baseado em palavras-chave na descrição
 * Retorna o nome da categoria sugerida ou null
 */
export function suggestCategoryName(description: string): string | null {
  if (!description) return null;
  
  const lowerDesc = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerDesc.includes(keyword)) {
        return category;
      }
    }
  }
  
  return null;
}

/**
 * Tenta encontrar uma conta que corresponda à sugestão de categoria
 */
export function suggestCategoryAccount(
  description: string,
  accounts: FinancialAccount[]
): string | null {
  const suggestedName = suggestCategoryName(description);
  if (!suggestedName) return null;
  
  // Busca conta com nome similar
  const lowerSuggestion = suggestedName.toLowerCase();
  const matchingAccount = accounts.find(acc => 
    acc.name.toLowerCase().includes(lowerSuggestion) ||
    lowerSuggestion.includes(acc.name.toLowerCase())
  );
  
  return matchingAccount?.id ?? null;
}

/**
 * Valida se um arquivo é CSV válido
 */
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const validTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
  const validExtensions = ['.csv', '.txt'];
  
  if (file.size > maxSize) {
    return { valid: false, error: 'Arquivo muito grande. Máximo permitido: 5MB' };
  }
  
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!validExtensions.includes(extension) && !validTypes.includes(file.type)) {
    return { valid: false, error: 'Formato inválido. Envie um arquivo .csv' };
  }
  
  return { valid: true };
}
