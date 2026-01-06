-- Atualiza a RPC para usar o parâmetro p_status corretamente
DROP FUNCTION IF EXISTS public.register_policy_commission(text, text, text, text, numeric, date, text);

CREATE OR REPLACE FUNCTION public.register_policy_commission(
  p_policy_id TEXT,
  p_client_name TEXT,
  p_ramo_name TEXT,
  p_policy_number TEXT,
  p_commission_amount NUMERIC,
  p_transaction_date DATE,
  p_status TEXT DEFAULT 'pending'
)
RETURNS TABLE(transaction_id UUID, reference_number TEXT, success BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy_uuid UUID;
  v_user_id UUID;
  v_transaction_id UUID;
  v_reference_number TEXT;
  v_existing_transaction UUID;
  v_ar_account_id UUID;
  v_revenue_account_id UUID;
  v_final_status TEXT;
BEGIN
  -- Cast p_policy_id para UUID com validação
  BEGIN
    v_policy_uuid := p_policy_id::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN QUERY SELECT NULL::UUID, 'INVALID_UUID'::TEXT, FALSE;
    RETURN;
  END;

  -- Define o status final (usa o parâmetro ou default 'pending')
  v_final_status := COALESCE(NULLIF(TRIM(p_status), ''), 'pending');

  -- Busca o user_id da apólice
  SELECT user_id INTO v_user_id FROM apolices WHERE id = v_policy_uuid;
  
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 'POLICY_NOT_FOUND'::TEXT, FALSE;
    RETURN;
  END IF;

  -- Verifica se já existe comissão para esta apólice
  SELECT id INTO v_existing_transaction 
  FROM financial_transactions 
  WHERE related_entity_type = 'policy' 
    AND related_entity_id = v_policy_uuid
    AND is_void = FALSE
  LIMIT 1;

  IF v_existing_transaction IS NOT NULL THEN
    SELECT ft.id, ft.reference_number, TRUE
    INTO v_transaction_id, v_reference_number
    FROM financial_transactions ft
    WHERE ft.id = v_existing_transaction;
    
    RETURN QUERY SELECT v_transaction_id, v_reference_number, TRUE;
    RETURN;
  END IF;

  -- Busca ou cria a conta "Comissões a Receber" (Ativo)
  SELECT id INTO v_ar_account_id 
  FROM financial_accounts 
  WHERE user_id = v_user_id 
    AND name = 'Comissões a Receber' 
    AND type = 'asset'
  LIMIT 1;

  IF v_ar_account_id IS NULL THEN
    INSERT INTO financial_accounts (user_id, name, type, code, description)
    VALUES (v_user_id, 'Comissões a Receber', 'asset', '1.1.3', 'Comissões pendentes de recebimento')
    RETURNING id INTO v_ar_account_id;
  END IF;

  -- Busca ou cria a conta "Receita de Comissões" (Receita)
  SELECT id INTO v_revenue_account_id 
  FROM financial_accounts 
  WHERE user_id = v_user_id 
    AND name = 'Receita de Comissões' 
    AND type = 'revenue'
  LIMIT 1;

  IF v_revenue_account_id IS NULL THEN
    INSERT INTO financial_accounts (user_id, name, type, code, description)
    VALUES (v_user_id, 'Receita de Comissões', 'revenue', '4.1.1', 'Receitas de comissões de seguros')
    RETURNING id INTO v_revenue_account_id;
  END IF;

  -- Gera reference_number único
  v_reference_number := 'COM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- Cria a transação financeira com o status correto
  INSERT INTO financial_transactions (
    user_id,
    created_by,
    description,
    transaction_date,
    related_entity_type,
    related_entity_id,
    reference_number
  ) VALUES (
    v_user_id,
    v_user_id,
    'Comissão: ' || COALESCE(p_client_name, 'Cliente') || ' - ' || COALESCE(p_ramo_name, 'Seguro') || CASE WHEN p_policy_number IS NOT NULL AND p_policy_number != '' THEN ' (Apólice: ' || p_policy_number || ')' ELSE '' END,
    COALESCE(p_transaction_date, CURRENT_DATE),
    'policy',
    v_policy_uuid,
    v_reference_number
  ) RETURNING id INTO v_transaction_id;

  -- Lançamento: Débito em Comissões a Receber (Ativo aumenta)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_transaction_id, v_ar_account_id, p_commission_amount, 'Débito - Comissão a receber');

  -- Lançamento: Crédito em Receita de Comissões (Receita aumenta)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_transaction_id, v_revenue_account_id, -p_commission_amount, 'Crédito - Receita de comissão');

  RETURN QUERY SELECT v_transaction_id, v_reference_number, TRUE;
END;
$$;