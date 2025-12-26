-- ============= FASE 1: Sistema Financeiro ERP - Double-Entry Ledger =============

-- 1. Criar ENUMs para tipos de conta
CREATE TYPE public.financial_account_type AS ENUM (
  'asset',      -- Ativo (Banco, Caixa, Contas a Receber)
  'liability',  -- Passivo (Contas a Pagar, Empréstimos)
  'equity',     -- Patrimônio Líquido
  'revenue',    -- Receita (Comissões, Honorários)
  'expense'     -- Despesa (Marketing, Aluguel)
);

CREATE TYPE public.financial_account_status AS ENUM (
  'active',
  'archived'
);

-- 2. Tabela: financial_accounts (Plano de Contas)
CREATE TABLE public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Identificação
  name TEXT NOT NULL,
  code TEXT, -- Código contábil opcional (ex: 1.1.01)
  description TEXT,
  
  -- Classificação
  type public.financial_account_type NOT NULL,
  parent_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  
  -- Controle
  is_system BOOLEAN DEFAULT false, -- Contas do sistema não podem ser deletadas
  status public.financial_account_status NOT NULL DEFAULT 'active',
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_user_account_name UNIQUE(user_id, name),
  CONSTRAINT unique_user_account_code UNIQUE(user_id, code)
);

-- 3. Tabela: financial_transactions (Cabeçalho da Operação)
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Dados da Transação
  description TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT, -- Número de referência externo (NF, recibo, etc)
  
  -- Vínculo com Entidades Existentes
  related_entity_type TEXT, -- 'policy', 'client', 'sinistro', etc
  related_entity_id UUID,   -- ID da entidade relacionada
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  -- Controle de Anulação
  is_void BOOLEAN DEFAULT false,
  void_reason TEXT,
  voided_at TIMESTAMPTZ,
  voided_by UUID
);

-- 4. Tabela: financial_ledger (Movimentos Atômicos - A Verdade)
CREATE TABLE public.financial_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  
  -- Valor do Movimento (Positivo = DÉBITO, Negativo = CRÉDITO)
  amount NUMERIC(15,2) NOT NULL CHECK (amount != 0),
  
  -- Descrição específica do movimento
  memo TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Índices para Performance
CREATE INDEX idx_financial_accounts_user_id ON public.financial_accounts(user_id);
CREATE INDEX idx_financial_accounts_type ON public.financial_accounts(type);
CREATE INDEX idx_financial_accounts_parent_id ON public.financial_accounts(parent_id);
CREATE INDEX idx_financial_accounts_status ON public.financial_accounts(status);

CREATE INDEX idx_financial_transactions_user_id ON public.financial_transactions(user_id);
CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(transaction_date);
CREATE INDEX idx_financial_transactions_related ON public.financial_transactions(related_entity_type, related_entity_id);
CREATE INDEX idx_financial_transactions_is_void ON public.financial_transactions(is_void);

CREATE INDEX idx_financial_ledger_transaction_id ON public.financial_ledger(transaction_id);
CREATE INDEX idx_financial_ledger_account_id ON public.financial_ledger(account_id);

-- 6. Trigger para updated_at em financial_accounts
CREATE OR REPLACE FUNCTION public.handle_updated_at_financial_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_updated_at_financial_accounts
BEFORE UPDATE ON public.financial_accounts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_financial_accounts();

-- 7. Função para validar transação (partidas dobradas)
CREATE OR REPLACE FUNCTION public.validate_financial_transaction(p_transaction_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_entry_count INTEGER;
BEGIN
  SELECT SUM(amount), COUNT(*) 
  INTO v_balance, v_entry_count
  FROM public.financial_ledger
  WHERE transaction_id = p_transaction_id;
  
  -- Deve ter pelo menos 2 entradas
  IF v_entry_count < 2 THEN
    RETURN false;
  END IF;
  
  -- Saldo deve ser zero (tolerância de R$0.01 para arredondamentos)
  IF ABS(COALESCE(v_balance, 0)) > 0.01 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- 8. Trigger para validar partidas dobradas após INSERT
CREATE OR REPLACE FUNCTION public.validate_ledger_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_entry_count INTEGER;
BEGIN
  -- Calcular saldo da transação
  SELECT SUM(amount), COUNT(*) 
  INTO v_balance, v_entry_count
  FROM public.financial_ledger
  WHERE transaction_id = NEW.transaction_id;
  
  -- Permitir inserção parcial (validação será feita na transação completa)
  IF v_entry_count < 2 THEN
    RETURN NEW;
  END IF;
  
  -- Saldo deve ser zero (tolerância de R$0.01 para arredondamentos)
  IF ABS(v_balance) > 0.01 THEN
    RAISE EXCEPTION 'Transação desbalanceada! Soma dos movimentos: R$ %. Deve ser R$ 0.00', v_balance;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_ledger_balance
AFTER INSERT OR UPDATE ON public.financial_ledger
FOR EACH ROW EXECUTE FUNCTION public.validate_ledger_balance();

-- 9. RLS para financial_accounts
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own financial accounts"
ON public.financial_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own financial accounts"
ON public.financial_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own non-system accounts"
ON public.financial_accounts FOR UPDATE
USING (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete their own non-system accounts"
ON public.financial_accounts FOR DELETE
USING (auth.uid() = user_id AND is_system = false);

-- 10. RLS para financial_transactions
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own financial transactions"
ON public.financial_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own financial transactions"
ON public.financial_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own non-void transactions"
ON public.financial_transactions FOR UPDATE
USING (auth.uid() = user_id AND is_void = false);

-- 11. RLS para financial_ledger (acesso via transação)
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ledger entries of their transactions"
ON public.financial_ledger FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.financial_transactions ft
    WHERE ft.id = financial_ledger.transaction_id
    AND ft.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create ledger entries for their transactions"
ON public.financial_ledger FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.financial_transactions ft
    WHERE ft.id = financial_ledger.transaction_id
    AND ft.user_id = auth.uid()
  )
);

-- 12. View para saldo das contas
CREATE OR REPLACE VIEW public.financial_account_balances AS
SELECT 
  fa.id,
  fa.user_id,
  fa.name,
  fa.code,
  fa.description,
  fa.type,
  fa.parent_id,
  fa.is_system,
  fa.status,
  fa.created_at,
  fa.updated_at,
  COALESCE(SUM(fl.amount) FILTER (WHERE ft.is_void = false), 0) as balance,
  COUNT(fl.id) FILTER (WHERE ft.is_void = false) as entry_count
FROM public.financial_accounts fa
LEFT JOIN public.financial_ledger fl ON fl.account_id = fa.id
LEFT JOIN public.financial_transactions ft ON ft.id = fl.transaction_id
GROUP BY fa.id, fa.user_id, fa.name, fa.code, fa.description, fa.type, 
         fa.parent_id, fa.is_system, fa.status, fa.created_at, fa.updated_at;