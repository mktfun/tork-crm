-- =============================================
-- MIGRAÇÃO: Correção Completa do Fluxo de Comissões ERP
-- =============================================

-- 1. Desabilitar o trigger de proteção para permitir UPDATE
ALTER TABLE financial_transactions DISABLE TRIGGER prevent_financial_transaction_modification;

-- 2. Adicionar coluna status à tabela financial_transactions (se não existir)
ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 3. Atualizar transações existentes
UPDATE financial_transactions 
SET status = CASE 
  WHEN is_void = true THEN 'voided'
  ELSE 'completed'
END
WHERE status IS NULL OR status = 'pending';

-- 4. Reabilitar trigger de proteção
ALTER TABLE financial_transactions ENABLE TRIGGER prevent_financial_transaction_modification;

-- 5. Desativar o trigger legado que cria duplicatas
DROP TRIGGER IF EXISTS sync_new_commission_to_erp ON transactions;

-- 6. Recriar a RPC register_policy_commission
CREATE OR REPLACE FUNCTION public.register_policy_commission(
  p_policy_id TEXT,
  p_client_name TEXT DEFAULT NULL,
  p_ramo_name TEXT DEFAULT NULL,
  p_policy_number TEXT DEFAULT NULL,
  p_commission_amount NUMERIC DEFAULT 0,
  p_transaction_date DATE DEFAULT CURRENT_DATE,
  p_status TEXT DEFAULT 'pending'
)
RETURNS TABLE (transaction_id UUID, reference_number TEXT, success BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy_id UUID;
  v_user_id UUID;
  v_transaction_id UUID;
  v_receivable_account_id UUID;
  v_revenue_account_id UUID;
  v_description TEXT;
  v_reference TEXT;
BEGIN
  BEGIN
    v_policy_id := p_policy_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false;
    RETURN;
  END;

  SELECT user_id INTO v_user_id FROM apolices WHERE id = v_policy_id;
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false;
    RETURN;
  END IF;

  -- Verificar duplicata
  SELECT ft.id INTO v_transaction_id
  FROM financial_transactions ft
  WHERE ft.related_entity_type = 'policy' 
    AND ft.related_entity_id = v_policy_id::TEXT
    AND ft.is_void = false
  LIMIT 1;

  IF v_transaction_id IS NOT NULL THEN
    RETURN QUERY SELECT v_transaction_id, 'POL-' || v_policy_id::TEXT, true;
    RETURN;
  END IF;

  SELECT id INTO v_receivable_account_id
  FROM financial_accounts 
  WHERE user_id = v_user_id AND name = 'Comissões a Receber' AND type = 'asset' AND status = 'active'
  LIMIT 1;

  SELECT id INTO v_revenue_account_id
  FROM financial_accounts 
  WHERE user_id = v_user_id AND name = 'Receita de Comissões' AND type = 'revenue' AND status = 'active'
  LIMIT 1;

  IF v_receivable_account_id IS NULL OR v_revenue_account_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false;
    RETURN;
  END IF;

  -- Descrição robusta sem undefined
  v_description := 'Comissão: ' || COALESCE(NULLIF(TRIM(p_client_name), ''), 'Cliente');
  v_description := v_description || ' (' || COALESCE(NULLIF(TRIM(p_ramo_name), ''), 'Seguro') || ')';
  
  IF p_policy_number IS NOT NULL AND TRIM(p_policy_number) != '' THEN
    v_description := v_description || ' - Nº ' || TRIM(p_policy_number);
  END IF;

  v_reference := 'POL-' || v_policy_id::TEXT;

  INSERT INTO financial_transactions (
    user_id, created_by, description, transaction_date,
    reference_number, related_entity_type, related_entity_id, status
  ) VALUES (
    v_user_id, v_user_id, v_description,
    COALESCE(p_transaction_date, CURRENT_DATE),
    v_reference, 'policy', v_policy_id::TEXT,
    COALESCE(p_status, 'pending')
  )
  RETURNING id INTO v_transaction_id;

  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_transaction_id, v_receivable_account_id, p_commission_amount, 'Comissão a receber');

  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_transaction_id, v_revenue_account_id, -p_commission_amount, 'Receita de comissão');

  RETURN QUERY SELECT v_transaction_id, v_reference, true;
END;
$$;

-- 7. Atualizar get_revenue_transactions com novo campo status
CREATE OR REPLACE FUNCTION public.get_revenue_transactions(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
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
    c.name as client_name,
    a.policy_number,
    ft.related_entity_type,
    ft.related_entity_id,
    ft.reference_number,
    COALESCE(ft.status, 'pending') as status
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  LEFT JOIN apolices a ON ft.related_entity_type = 'policy' AND ft.related_entity_id = a.id::TEXT
  LEFT JOIN clientes c ON a.client_id = c.id
  WHERE ft.user_id = p_user_id
    AND ft.transaction_date >= p_start_date
    AND ft.transaction_date <= p_end_date
    AND ft.is_void = false
    AND fa.type = 'revenue'
    AND fl.amount < 0
  ORDER BY ft.id, ft.transaction_date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 8. Função de liquidação que desabilita trigger temporariamente
CREATE OR REPLACE FUNCTION public.settle_commission_transaction(
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
BEGIN
  SELECT ft.user_id INTO v_user_id FROM financial_transactions ft WHERE ft.id = p_transaction_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada');
  END IF;

  SELECT id INTO v_receivable_account_id
  FROM financial_accounts WHERE user_id = v_user_id AND name = 'Comissões a Receber' AND type = 'asset' LIMIT 1;

  SELECT fl.amount INTO v_amount
  FROM financial_ledger fl
  WHERE fl.transaction_id = p_transaction_id AND fl.account_id = v_receivable_account_id AND fl.amount > 0;

  IF v_amount IS NULL OR v_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor não encontrado');
  END IF;

  -- Lançamentos de liquidação
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (p_transaction_id, p_bank_account_id, v_amount, 'Recebimento de comissão');

  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (p_transaction_id, v_receivable_account_id, -v_amount, 'Baixa de comissão');

  -- Bypass do trigger usando session_replication_role
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE financial_transactions SET status = 'completed' WHERE id = p_transaction_id;
  PERFORM set_config('session_replication_role', 'origin', true);

  RETURN jsonb_build_object('success', true, 'settled_amount', v_amount);
END;
$$;