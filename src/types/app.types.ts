
export interface Profile {
  id: string;
  nome_completo: string;
  email: string;
  telefone?: string;
  avatar_url?: string;
  role: 'admin' | 'corretor' | 'assistente';
  ativo: boolean;
  created_at: string;
  updated_at: string;
  birthday_message_template?: string;
  onboarding_completed?: boolean;
  settle_commissions_automatically?: boolean;
  commission_settlement_days?: number;
  commission_settlement_strategy?: 'first' | 'all' | 'custom';
  commission_settlement_installments?: number;
}
