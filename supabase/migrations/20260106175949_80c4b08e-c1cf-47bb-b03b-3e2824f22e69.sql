-- ============================================
-- RPC BULLETPROOF: register_policy_commission
-- Aceita TEXT e faz cast interno para UUID
-- ============================================

CREATE OR REPLACE FUNCTION public.register_policy_commission(
  p_policy_id TEXT,
  p_client_name TEXT DEFAULT 'Cliente',
  p_ramo_name TEXT DEFAULT 'Seguro',
  p_policy_number TEXT DEFAULT '',
  p_commission_amount NUMERIC DEFAULT 0,
  p_transaction_date DATE DEFAULT CURRENT_DATE,
  p_status TEXT DEFAULT 'pending'
)
RETURNS TABLE(
  transaction_id UUID,
  reference_number TEXT,
  success BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy_uuid UUID;
  v_user_id UUID;
  v_transaction_id UUID;
  v_reference_number TEXT;
  v_debit_account_id UUID;
  v_credit_account_id UUID;
  v_brokerage_settings JSONB;
  v_default_account_id TEXT;
BEGIN
  -- 🛡️ Cast seguro de TEXT para UUID
  BEGIN
    v_policy_uuid := p_policy_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ID da apólice inválido: %', p_policy_id;
  END;

  -- Buscar user_id da apólice
  SELECT user_id INTO v_user_id
  FROM apolices
  WHERE id = v_policy_uuid;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Apólice não encontrada: %', p_policy_id;
  END IF;

  -- 🔍 Verificar se já existe comissão para esta apólice
  IF EXISTS (
    SELECT 1 FROM financial_transactions 
    WHERE related_entity_id = v_policy_uuid 
    AND related_entity_type = 'policy'
    AND is_void = false
  ) THEN
    -- Retorna a transação existente
    SELECT id, reference_number INTO v_transaction_id, v_reference_number
    FROM financial_transactions
    WHERE related_entity_id = v_policy_uuid 
    AND related_entity_type = 'policy'
    AND is_void = false
    LIMIT 1;
    
    RETURN QUERY SELECT v_transaction_id, v_reference_number, true;
    RETURN;
  END IF;

  -- 🔧 Buscar conta de destino das configurações da corretora
  SELECT financial_settings INTO v_brokerage_settings
  FROM brokerages
  WHERE user_id = v_user_id
  LIMIT 1;

  v_default_account_id := v_brokerage_settings->>'default_commission_account';

  -- 📊 Buscar ou criar conta de débito (Comissões a Receber - ativo)
  IF v_default_account_id IS NOT NULL THEN
    BEGIN
      v_debit_account_id := v_default_account_id::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_debit_account_id := NULL;
    END;
  END IF;

  -- Se não tiver conta configurada, buscar conta padrão de comissões
  IF v_debit_account_id IS NULL THEN
    SELECT id INTO v_debit_account_id
    FROM financial_accounts
    WHERE user_id = v_user_id
    AND type = 'asset'
    AND (name ILIKE '%comiss%' OR name ILIKE '%receber%')
    AND status = 'active'
    ORDER BY is_system DESC, created_at ASC
    LIMIT 1;
  END IF;

  -- Se ainda não tiver, criar conta padrão
  IF v_debit_account_id IS NULL THEN
    INSERT INTO financial_accounts (user_id, name, type, code, is_system, status)
    VALUES (v_user_id, 'Comissões a Receber', 'asset', '1.1.3', true, 'active')
    RETURNING id INTO v_debit_account_id;
  END IF;

  -- 📊 Buscar ou criar conta de crédito (Receita de Comissões)
  SELECT id INTO v_credit_account_id
  FROM financial_accounts
  WHERE user_id = v_user_id
  AND type = 'revenue'
  AND (name ILIKE '%comiss%' OR name ILIKE '%receita%')
  AND status = 'active'
  ORDER BY is_system DESC, created_at ASC
  LIMIT 1;

  IF v_credit_account_id IS NULL THEN
    INSERT INTO financial_accounts (user_id, name, type, code, is_system, status)
    VALUES (v_user_id, 'Receita de Comissões', 'revenue', '4.1.1', true, 'active')
    RETURNING id INTO v_credit_account_id;
  END IF;

  -- 🎫 Gerar número de referência
  v_reference_number := 'COM-' || LPAD(
    (SELECT COALESCE(COUNT(*) + 1, 1)::TEXT FROM financial_transactions WHERE user_id = v_user_id),
    6, '0'
  );

  -- 📝 Criar transação financeira (cabeçalho)
  INSERT INTO financial_transactions (
    user_id,
    created_by,
    description,
    transaction_date,
    reference_number,
    related_entity_id,
    related_entity_type
  ) VALUES (
    v_user_id,
    v_user_id,
    'Comissão - ' || p_client_name || ' (' || p_ramo_name || ') - Apólice ' || COALESCE(p_policy_number, ''),
    p_transaction_date,
    v_reference_number,
    v_policy_uuid,  -- UUID já convertido
    'policy'
  ) RETURNING id INTO v_transaction_id;

  -- 📊 Criar lançamentos de partidas dobradas
  -- Débito: Comissões a Receber (ativo aumenta = positivo)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_transaction_id, v_debit_account_id, p_commission_amount, 'Débito - Comissão a receber');

  -- Crédito: Receita de Comissões (receita aumenta = negativo no ledger)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_transaction_id, v_credit_account_id, -p_commission_amount, 'Crédito - Receita de comissão');

  RETURN QUERY SELECT v_transaction_id, v_reference_number, true;
END;
$$;