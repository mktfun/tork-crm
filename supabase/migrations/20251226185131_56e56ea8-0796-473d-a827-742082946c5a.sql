-- ============= Fase 2: Motor de Transação (RPC) =============

-- 1. Função principal: Criar movimento financeiro (atômico)
CREATE OR REPLACE FUNCTION public.create_financial_movement(
  p_description TEXT,
  p_transaction_date DATE,
  p_movements JSONB, -- Array de {account_id: uuid, amount: numeric, memo?: text}
  p_reference_number TEXT DEFAULT NULL,
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_user_id UUID;
  v_movement JSONB;
  v_balance NUMERIC := 0;
BEGIN
  -- Obter usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Validar que há pelo menos 2 movimentos
  IF jsonb_array_length(p_movements) < 2 THEN
    RAISE EXCEPTION 'Transação deve ter pelo menos 2 movimentos (partidas dobradas)';
  END IF;

  -- Calcular saldo antes de inserir
  SELECT COALESCE(SUM((mov->>'amount')::NUMERIC), 0)
  INTO v_balance
  FROM jsonb_array_elements(p_movements) AS mov;

  -- Validar balanceamento (tolerância de R$0.01)
  IF ABS(v_balance) > 0.01 THEN
    RAISE EXCEPTION 'Transação desbalanceada! Soma: %. Deve ser 0.00', v_balance;
  END IF;

  -- Criar a transação (cabeçalho)
  INSERT INTO public.financial_transactions (
    user_id, description, transaction_date, reference_number,
    related_entity_type, related_entity_id, created_by
  ) VALUES (
    v_user_id, p_description, p_transaction_date, p_reference_number,
    p_related_entity_type, p_related_entity_id, v_user_id
  )
  RETURNING id INTO v_transaction_id;

  -- Inserir movimentos no ledger
  FOR v_movement IN SELECT * FROM jsonb_array_elements(p_movements)
  LOOP
    INSERT INTO public.financial_ledger (
      transaction_id, account_id, amount, memo
    ) VALUES (
      v_transaction_id,
      (v_movement->>'account_id')::UUID,
      (v_movement->>'amount')::NUMERIC,
      v_movement->>'memo'
    );
  END LOOP;

  RETURN v_transaction_id;
END;
$$;

-- 2. Buscar contas por tipo
CREATE OR REPLACE FUNCTION public.get_financial_accounts_by_type(p_type TEXT)
RETURNS SETOF public.financial_accounts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.financial_accounts
  WHERE user_id = auth.uid()
    AND status = 'active'
    AND type::text = p_type
  ORDER BY name;
$$;

-- 3. Buscar transações recentes com detalhes
CREATE OR REPLACE FUNCTION public.get_recent_financial_transactions(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  description TEXT,
  transaction_date DATE,
  reference_number TEXT,
  created_at TIMESTAMPTZ,
  is_void BOOLEAN,
  total_amount NUMERIC,
  account_names TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ft.id,
    ft.description,
    ft.transaction_date,
    ft.reference_number,
    ft.created_at,
    ft.is_void,
    COALESCE(SUM(ABS(fl.amount)) / 2, 0) as total_amount,
    STRING_AGG(DISTINCT fa.name, ', ' ORDER BY fa.name) as account_names
  FROM public.financial_transactions ft
  LEFT JOIN public.financial_ledger fl ON fl.transaction_id = ft.id
  LEFT JOIN public.financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = auth.uid()
    AND ft.is_void = false
    AND (
      p_type IS NULL 
      OR EXISTS (
        SELECT 1 FROM public.financial_ledger fl2
        JOIN public.financial_accounts fa2 ON fa2.id = fl2.account_id
        WHERE fl2.transaction_id = ft.id AND fa2.type::text = p_type
      )
    )
  GROUP BY ft.id, ft.description, ft.transaction_date, ft.reference_number, ft.created_at, ft.is_void
  ORDER BY ft.transaction_date DESC, ft.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- 4. Garantir contas padrão para novos usuários
CREATE OR REPLACE FUNCTION public.ensure_default_financial_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.financial_accounts WHERE user_id = v_user_id;
  
  IF v_count = 0 THEN
    INSERT INTO public.financial_accounts (user_id, name, code, type, is_system) VALUES
      (v_user_id, 'Caixa', '1.1.01', 'asset', true),
      (v_user_id, 'Banco Principal', '1.1.02', 'asset', true),
      (v_user_id, 'Comissões a Receber', '1.2.01', 'asset', true),
      (v_user_id, 'Receita de Comissões', '4.1.01', 'revenue', true),
      (v_user_id, 'Outras Receitas', '4.9.01', 'revenue', true),
      (v_user_id, 'Despesas Operacionais', '5.1.01', 'expense', true),
      (v_user_id, 'Despesas Administrativas', '5.2.01', 'expense', true),
      (v_user_id, 'Marketing e Publicidade', '5.3.01', 'expense', true),
      (v_user_id, 'Despesas com Pessoal', '5.4.01', 'expense', true);
  END IF;
END;
$$;