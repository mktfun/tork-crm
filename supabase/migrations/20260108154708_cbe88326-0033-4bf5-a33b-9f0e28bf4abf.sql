-- =====================================================
-- 🧬 SANEAMENTO FINANCEIRO - MIGRAÇÃO COMPLETA
-- =====================================================

-- 1. ATUALIZAR get_financial_summary PARA SEPARAR PENDENTES DE CONFIRMADOS
-- =====================================================
CREATE OR REPLACE FUNCTION get_financial_summary(p_start_date DATE, p_end_date DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_user_id UUID;
  v_total_income NUMERIC := 0;
  v_total_expense NUMERIC := 0;
  v_pending_income NUMERIC := 0;
  v_pending_expense NUMERIC := 0;
  v_transaction_count INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Receita/Despesa EFETIVADA (apenas completed)
  SELECT
    COALESCE(SUM(CASE 
      WHEN fa.type = 'revenue' THEN ABS(fl.amount) 
      ELSE 0 
    END), 0),
    COALESCE(SUM(CASE 
      WHEN fa.type = 'expense' THEN ABS(fl.amount) 
      ELSE 0 
    END), 0)
  INTO v_total_income, v_total_expense
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = v_user_id
    AND ft.transaction_date BETWEEN p_start_date AND p_end_date
    AND ft.is_void = false
    AND COALESCE(ft.status, 'pending') = 'completed'
    AND fa.type IN ('revenue', 'expense')
    AND ((fa.type = 'revenue' AND fl.amount < 0) OR (fa.type = 'expense' AND fl.amount > 0));

  -- Valores PENDENTES (A Receber / A Pagar)
  SELECT
    COALESCE(SUM(CASE 
      WHEN fa.type = 'revenue' THEN ABS(fl.amount) 
      ELSE 0 
    END), 0),
    COALESCE(SUM(CASE 
      WHEN fa.type = 'expense' THEN ABS(fl.amount) 
      ELSE 0 
    END), 0)
  INTO v_pending_income, v_pending_expense
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = v_user_id
    AND ft.transaction_date BETWEEN p_start_date AND p_end_date
    AND ft.is_void = false
    AND COALESCE(ft.status, 'pending') = 'pending'
    AND fa.type IN ('revenue', 'expense')
    AND ((fa.type = 'revenue' AND fl.amount < 0) OR (fa.type = 'expense' AND fl.amount > 0));

  -- Contagem total
  SELECT COUNT(DISTINCT ft.id) INTO v_transaction_count
  FROM financial_transactions ft
  WHERE ft.user_id = v_user_id
    AND ft.transaction_date BETWEEN p_start_date AND p_end_date
    AND ft.is_void = false;

  v_result := json_build_object(
    'totalIncome', v_total_income,
    'totalExpense', v_total_expense,
    'netResult', v_total_income - v_total_expense,
    'pendingIncome', v_pending_income,
    'pendingExpense', v_pending_expense,
    'transactionCount', v_transaction_count
  );

  RETURN v_result;
END;
$$;

-- 2. DROPAR VERSÕES ANTIGAS DE get_revenue_transactions
-- =====================================================
DROP FUNCTION IF EXISTS get_revenue_transactions(DATE, DATE, INT);
DROP FUNCTION IF EXISTS get_revenue_transactions(UUID, DATE, DATE, INT, INT);

-- 3. RECRIAR get_revenue_transactions UNIFICADA
-- =====================================================
CREATE OR REPLACE FUNCTION get_revenue_transactions(
  p_start_date DATE,
  p_end_date DATE,
  p_limit INT DEFAULT 100
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
  policy_number TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  reference_number TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (ft.id)
    ft.id,
    ft.description,
    ft.transaction_date::DATE,
    ABS(fl.amount) as amount,
    fa.name as account_name,
    (COALESCE(ft.status, 'pending') IN ('completed', 'settled')) as is_confirmed,
    COALESCE(ft.status, 'pending') as legacy_status,
    COALESCE(c.name, 'Cliente não informado') as client_name,
    a.policy_number,
    ft.related_entity_type,
    ft.related_entity_id,
    ft.reference_number,
    COALESCE(ft.status, 'pending') as status
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  LEFT JOIN apolices a ON ft.related_entity_type = 'policy' 
    AND ft.related_entity_id = a.id::TEXT
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

-- 4. CORRIGIR settle_commission_transaction (BAIXA COM PARTIDAS DOBRADAS)
-- =====================================================
CREATE OR REPLACE FUNCTION settle_commission_transaction(
  p_transaction_id UUID,
  p_bank_account_id UUID,
  p_settlement_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_receivable_account_id UUID;
  v_amount NUMERIC;
  v_tx_status TEXT;
  v_tx_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Verificar se a transação existe e pegar status
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions WHERE id = p_transaction_id AND user_id = v_user_id
  ), 
  (SELECT COALESCE(status, 'pending') FROM financial_transactions WHERE id = p_transaction_id AND user_id = v_user_id)
  INTO v_tx_exists, v_tx_status;

  IF NOT v_tx_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada');
  END IF;

  IF v_tx_status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação já está confirmada');
  END IF;

  -- Buscar conta "Comissões a Receber" (criar se não existir)
  SELECT id INTO v_receivable_account_id
  FROM financial_accounts 
  WHERE user_id = v_user_id 
    AND name = 'Comissões a Receber' 
    AND type = 'asset' 
    AND status = 'active'
  LIMIT 1;

  IF v_receivable_account_id IS NULL THEN
    -- Criar conta se não existir
    INSERT INTO financial_accounts (user_id, name, type, code, description, status)
    VALUES (v_user_id, 'Comissões a Receber', 'asset', '1.1.3', 'Comissões pendentes de recebimento', 'active')
    RETURNING id INTO v_receivable_account_id;
  END IF;

  -- Buscar valor a receber (débito na conta de comissões a receber)
  SELECT ABS(fl.amount) INTO v_amount
  FROM financial_ledger fl
  WHERE fl.transaction_id = p_transaction_id 
    AND fl.account_id = v_receivable_account_id 
    AND fl.amount > 0
  LIMIT 1;

  -- Se não encontrou na conta de recebíveis, buscar na conta de receita
  IF v_amount IS NULL OR v_amount = 0 THEN
    SELECT ABS(fl.amount) INTO v_amount
    FROM financial_ledger fl
    JOIN financial_accounts fa ON fa.id = fl.account_id
    WHERE fl.transaction_id = p_transaction_id 
      AND fa.type = 'revenue'
      AND fl.amount < 0
    LIMIT 1;
  END IF;

  IF v_amount IS NULL OR v_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor da comissão não encontrado no ledger');
  END IF;

  -- 1. DÉBITO no Banco (dinheiro entra) - valor positivo
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (p_transaction_id, p_bank_account_id, v_amount, 'Recebimento de comissão - Entrada no banco');

  -- 2. CRÉDITO em Comissões a Receber (limpa a dívida) - valor negativo
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (p_transaction_id, v_receivable_account_id, -v_amount, 'Baixa de comissão a receber');

  -- 3. Atualizar status para completed
  UPDATE financial_transactions 
  SET status = 'completed', 
      updated_at = NOW()
  WHERE id = p_transaction_id
    AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'settled_amount', v_amount,
    'bank_account_id', p_bank_account_id,
    'message', 'Comissão confirmada com sucesso'
  );
END;
$$;

-- 5. ATUALIZAR register_policy_commission PARA USAR related_entity_type = 'policy'
-- =====================================================
CREATE OR REPLACE FUNCTION register_policy_commission(
  p_policy_id UUID,
  p_client_name TEXT,
  p_ramo_name TEXT,
  p_policy_number TEXT,
  p_commission_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Montar descrição limpa
  v_description := 'Comissão: ' || v_clean_client_name || ' (' || v_clean_ramo_name || ') - Apólice ' || v_clean_policy_number;

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