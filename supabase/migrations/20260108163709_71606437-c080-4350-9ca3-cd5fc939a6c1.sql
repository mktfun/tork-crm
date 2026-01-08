
-- 1. DROP E RECRIAÇÃO DO register_policy_commission COM SEGURADORA NA DESCRIÇÃO
DROP FUNCTION IF EXISTS public.register_policy_commission(UUID, TEXT, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.register_policy_commission(
  p_policy_id UUID,
  p_client_name TEXT,
  p_ramo_name TEXT,
  p_policy_number TEXT,
  p_commission_amount NUMERIC,
  p_company_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_transaction_id UUID;
  v_receivable_account_id UUID;
  v_revenue_account_id UUID;
  v_reference_number TEXT;
  v_clean_client_name TEXT;
  v_clean_ramo_name TEXT;
  v_clean_policy_number TEXT;
  v_clean_company_name TEXT;
  v_description TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Limpar nomes (nunca undefined)
  v_clean_client_name := COALESCE(NULLIF(TRIM(p_client_name), ''), 'Cliente não informado');
  v_clean_ramo_name := COALESCE(NULLIF(TRIM(p_ramo_name), ''), 'Ramo não informado');
  v_clean_policy_number := COALESCE(NULLIF(TRIM(p_policy_number), ''), 'S/N');
  v_clean_company_name := COALESCE(NULLIF(TRIM(p_company_name), ''), '');

  -- Verificar se já existe transação para esta apólice
  SELECT ft.id INTO v_transaction_id
  FROM financial_transactions ft
  WHERE ft.user_id = v_user_id
    AND ft.related_entity_type = 'policy'
    AND ft.related_entity_id = p_policy_id::TEXT
    AND ft.is_void = false
  LIMIT 1;

  IF v_transaction_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Comissão já registrada para esta apólice',
      'existing_transaction_id', v_transaction_id
    );
  END IF;

  -- Buscar ou criar conta "Comissões a Receber" (Ativo)
  SELECT id INTO v_receivable_account_id
  FROM financial_accounts
  WHERE user_id = v_user_id
    AND name = 'Comissões a Receber'
    AND type = 'asset'
    AND status = 'active'
  LIMIT 1;

  IF v_receivable_account_id IS NULL THEN
    INSERT INTO financial_accounts (user_id, name, type, code, description, status)
    VALUES (v_user_id, 'Comissões a Receber', 'asset', '1.1.3', 'Comissões pendentes de recebimento', 'active')
    RETURNING id INTO v_receivable_account_id;
  END IF;

  -- Buscar ou criar conta "Receita de Comissões" (Receita)
  SELECT id INTO v_revenue_account_id
  FROM financial_accounts
  WHERE user_id = v_user_id
    AND name = 'Receita de Comissões'
    AND type = 'revenue'
    AND status = 'active'
  LIMIT 1;

  IF v_revenue_account_id IS NULL THEN
    INSERT INTO financial_accounts (user_id, name, type, code, description, status)
    VALUES (v_user_id, 'Receita de Comissões', 'revenue', '4.1.1', 'Receitas de comissões de apólices', 'active')
    RETURNING id INTO v_revenue_account_id;
  END IF;

  -- Gerar reference_number único
  v_reference_number := 'COM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- Montar descrição limpa: Nome do Cliente (Ramo) - Cia Seguradora
  IF v_clean_company_name != '' THEN
    v_description := v_clean_client_name || ' (' || v_clean_ramo_name || ') - ' || v_clean_company_name;
  ELSE
    v_description := v_clean_client_name || ' (' || v_clean_ramo_name || ')';
  END IF;

  -- Criar transação com status PENDING e related_entity_type = 'policy'
  INSERT INTO financial_transactions (
    user_id,
    created_by,
    description,
    transaction_date,
    reference_number,
    related_entity_type,
    related_entity_id,
    status,
    is_void
  ) VALUES (
    v_user_id,
    v_user_id,
    v_description,
    CURRENT_DATE,
    v_reference_number,
    'policy',
    p_policy_id::TEXT,
    'pending',
    false
  )
  RETURNING id INTO v_transaction_id;

  -- Lançamento 1: DÉBITO em Comissões a Receber (Ativo aumenta)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_transaction_id, v_receivable_account_id, p_commission_amount, 'Comissão a receber - ' || v_clean_client_name);

  -- Lançamento 2: CRÉDITO em Receita de Comissões (Receita aumenta)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_transaction_id, v_revenue_account_id, -p_commission_amount, 'Receita de comissão - ' || v_clean_client_name);

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'reference_number', v_reference_number,
    'amount', p_commission_amount,
    'description', v_description
  );
END;
$$;

-- 2. RPC PARA BUSCAR SALDOS DAS CONTAS BANCÁRIAS (ATIVOS)
CREATE OR REPLACE FUNCTION public.get_account_balances()
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT,
  type TEXT,
  balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fa.id,
    fa.name::TEXT,
    fa.code::TEXT,
    fa.type::TEXT,
    COALESCE(SUM(fl.amount), 0)::NUMERIC as balance
  FROM financial_accounts fa
  LEFT JOIN financial_ledger fl ON fl.account_id = fa.id
  LEFT JOIN financial_transactions ft ON ft.id = fl.transaction_id AND ft.is_void = false
  WHERE fa.user_id = auth.uid()
    AND fa.status = 'active'
    AND fa.type = 'asset'
  GROUP BY fa.id, fa.name, fa.code, fa.type
  ORDER BY fa.code, fa.name;
END;
$$;

-- 3. RPC PARA BUSCAR EXTRATO DE UMA CONTA (MOVIMENTAÇÕES COM SALDO PROGRESSIVO)
CREATE OR REPLACE FUNCTION public.get_account_statement(
  p_account_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  transaction_date DATE,
  description TEXT,
  amount NUMERIC,
  running_balance NUMERIC,
  is_reversal BOOLEAN,
  memo TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_initial_balance NUMERIC;
  v_effective_start DATE;
  v_effective_end DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Verificar se a conta pertence ao usuário
  IF NOT EXISTS (
    SELECT 1 FROM financial_accounts 
    WHERE id = p_account_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;

  -- Datas padrão: últimos 30 dias
  v_effective_start := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_effective_end := COALESCE(p_end_date, CURRENT_DATE);

  -- Calcular saldo inicial (antes do período)
  SELECT COALESCE(SUM(fl.amount), 0)
  INTO v_initial_balance
  FROM financial_ledger fl
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fl.account_id = p_account_id
    AND ft.is_void = false
    AND ft.transaction_date < v_effective_start;

  -- Retornar movimentações com saldo progressivo
  RETURN QUERY
  SELECT 
    ft.id as transaction_id,
    ft.transaction_date::DATE as transaction_date,
    ft.description,
    fl.amount,
    (v_initial_balance + SUM(fl.amount) OVER (ORDER BY ft.transaction_date, ft.created_at))::NUMERIC as running_balance,
    (ft.reference_number LIKE '%-REV-%' OR ft.description ILIKE '%estorno%')::BOOLEAN as is_reversal,
    fl.memo
  FROM financial_ledger fl
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fl.account_id = p_account_id
    AND ft.is_void = false
    AND ft.transaction_date BETWEEN v_effective_start AND v_effective_end
    AND ft.user_id = v_user_id
  ORDER BY ft.transaction_date DESC, ft.created_at DESC;
END;
$$;

-- 4. ATUALIZAR settle_commission_transaction PARA ATUALIZAR STATUS
DROP FUNCTION IF EXISTS public.settle_commission_transaction(UUID, UUID);

CREATE OR REPLACE FUNCTION public.settle_commission_transaction(
  p_transaction_id UUID,
  p_bank_account_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_tx RECORD;
  v_amount NUMERIC;
  v_bank_id UUID;
  v_financial_settings JSONB;
  v_receivable_account_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Buscar transação e valor total
  SELECT ft.*, 
         (SELECT SUM(ABS(fl.amount)) FROM financial_ledger fl 
          JOIN financial_accounts fa ON fa.id = fl.account_id 
          WHERE fl.transaction_id = ft.id AND fa.type = 'revenue') as total_amount
  INTO v_tx
  FROM financial_transactions ft
  WHERE ft.id = p_transaction_id
    AND ft.user_id = v_user_id
    AND (ft.is_void IS NULL OR ft.is_void = false);

  IF v_tx IS NULL THEN
    RAISE EXCEPTION 'Transaction not found or already voided';
  END IF;

  -- Verificar se já foi baixada
  IF v_tx.status = 'settled' OR v_tx.status = 'completed' THEN
    RAISE EXCEPTION 'Transaction already settled';
  END IF;

  v_amount := COALESCE(v_tx.total_amount, 0);

  -- Determinar conta bancária de destino
  IF p_bank_account_id IS NOT NULL THEN
    -- Verificar se a conta existe e pertence ao usuário
    IF NOT EXISTS (
      SELECT 1 FROM financial_accounts 
      WHERE id = p_bank_account_id 
        AND user_id = v_user_id 
        AND type = 'asset' 
        AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Invalid bank account';
    END IF;
    v_bank_id := p_bank_account_id;
  ELSE
    -- Fallback: buscar configuração ou primeira conta disponível
    v_financial_settings := get_user_financial_settings();
    v_bank_id := (v_financial_settings->>'default_commission_asset_account_id')::UUID;
    
    IF v_bank_id IS NULL THEN
      SELECT id INTO v_bank_id 
      FROM financial_accounts 
      WHERE user_id = v_user_id AND type = 'asset' AND status = 'active'
      ORDER BY name LIMIT 1;
    END IF;
  END IF;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'No bank account found for settlement';
  END IF;

  -- Buscar conta "Comissões a Receber" para dar baixa
  SELECT id INTO v_receivable_account_id
  FROM financial_accounts
  WHERE user_id = v_user_id
    AND name = 'Comissões a Receber'
    AND type = 'asset'
    AND status = 'active'
  LIMIT 1;

  -- Lançamento 1: DÉBITO no Banco (Ativo aumenta - entrada de dinheiro)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (p_transaction_id, v_bank_id, v_amount, 'Recebimento de comissão');

  -- Lançamento 2: CRÉDITO em Comissões a Receber (Ativo diminui - baixa do a receber)
  IF v_receivable_account_id IS NOT NULL THEN
    INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
    VALUES (p_transaction_id, v_receivable_account_id, -v_amount, 'Baixa de comissão a receber');
  END IF;

  -- Atualizar status da transação para 'settled'
  UPDATE financial_transactions
  SET status = 'settled',
      reference_number = COALESCE(reference_number, '') || '-PAID-' || NOW()::DATE::TEXT
  WHERE id = p_transaction_id;

  -- Sincronizar com tabela transactions (legado)
  IF v_tx.related_entity_type = 'policy' AND v_tx.related_entity_id IS NOT NULL THEN
    UPDATE transactions
    SET status = 'PAGO', paid_date = NOW()
    WHERE policy_id = v_tx.related_entity_id::UUID
      AND user_id = v_user_id
      AND status = 'PENDENTE'
      AND nature IN ('GANHO', 'RECEITA');
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Commission settled successfully',
    'bank_account_id', v_bank_id,
    'amount', v_amount,
    'new_status', 'settled'
  );
END;
$$;

-- 5. ATUALIZAR get_revenue_transactions PARA INCLUIR STATUS CORRETO
DROP FUNCTION IF EXISTS public.get_revenue_transactions(DATE, DATE, INTEGER);

CREATE OR REPLACE FUNCTION public.get_revenue_transactions(
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  description TEXT,
  transaction_date DATE,
  amount NUMERIC,
  account_name TEXT,
  is_confirmed BOOLEAN,
  legacy_status TEXT,
  client_name TEXT,
  policy_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (ft.id)
    ft.id,
    ft.description,
    ft.transaction_date::DATE as transaction_date,
    ABS(fl.amount) as amount,
    fa.name as account_name,
    (COALESCE(ft.status, 'pending') IN ('completed', 'settled')) as is_confirmed,
    COALESCE(ft.status, 'pending') as legacy_status,
    COALESCE(c.name, 'Cliente não informado') as client_name,
    a.policy_number
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  LEFT JOIN apolices a ON ft.related_entity_type = 'policy' 
    AND ft.related_entity_id::UUID = a.id
  LEFT JOIN clientes c ON a.client_id = c.id
  WHERE ft.user_id = auth.uid()
    AND ft.transaction_date BETWEEN p_start_date AND p_end_date
    AND ft.is_void = false
    AND fa.type = 'revenue'
    AND fl.amount < 0
  ORDER BY ft.id, ft.transaction_date DESC
  LIMIT p_limit;
END;
$$;
