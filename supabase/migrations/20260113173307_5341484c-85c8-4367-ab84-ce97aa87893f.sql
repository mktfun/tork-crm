-- Recriar função com status em MAIÚSCULO para respeitar a constraint transactions_status_check
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
  v_legacy_id UUID;
  v_transaction RECORD;
  v_commission_amount NUMERIC;
  v_new_financial_tx_id UUID;
  v_accounts_receivable_id UUID;
  v_id_source TEXT := 'unknown';
BEGIN
  -- Obter usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'AUTH_REQUIRED',
      'error', 'Usuário não autenticado'
    );
  END IF;

  -- Validar conta bancária
  IF NOT EXISTS (
    SELECT 1 FROM financial_accounts 
    WHERE id = p_bank_account_id 
      AND user_id = v_user_id 
      AND type = 'asset'
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_BANK_ACCOUNT',
      'error', 'Conta bancária inválida ou não encontrada'
    );
  END IF;

  -- RESOLUÇÃO INTELIGENTE DO ID
  -- Tenta primeiro como ID legado (transactions), depois como ID moderno (financial_transactions)
  SELECT t.id, t.amount, t.status, t.user_id, t.description
  INTO v_transaction
  FROM transactions t
  WHERE t.id = p_transaction_id AND t.user_id = v_user_id;

  IF FOUND THEN
    v_legacy_id := p_transaction_id;
    v_id_source := 'legacy_direct';
  ELSE
    -- Tentar encontrar via financial_transactions.related_entity_id
    SELECT ft.related_entity_id, 'financial_tx_lookup'
    INTO v_legacy_id, v_id_source
    FROM financial_transactions ft
    WHERE ft.id = p_transaction_id
      AND ft.user_id = v_user_id
      AND ft.related_entity_type = 'legacy_transaction'
      AND ft.related_entity_id IS NOT NULL;

    IF v_legacy_id IS NOT NULL THEN
      -- Buscar dados da transação legada
      SELECT t.id, t.amount, t.status, t.user_id, t.description
      INTO v_transaction
      FROM transactions t
      WHERE t.id = v_legacy_id AND t.user_id = v_user_id;
    END IF;
  END IF;

  -- Verificar se encontrou a transação
  IF v_transaction.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'TRANSACTION_NOT_FOUND',
      'error', 'Transação não encontrada',
      'debug', jsonb_build_object(
        'provided_id', p_transaction_id,
        'id_source', v_id_source,
        'resolved_legacy_id', v_legacy_id
      )
    );
  END IF;

  v_legacy_id := v_transaction.id;
  v_commission_amount := v_transaction.amount;

  -- Validar status atual - USANDO MAIÚSCULO
  IF v_transaction.status = 'PAGO' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_SETTLED',
      'error', 'Esta comissão já foi baixada anteriormente'
    );
  END IF;

  -- Buscar conta de Comissões a Receber
  SELECT id INTO v_accounts_receivable_id
  FROM financial_accounts
  WHERE user_id = v_user_id
    AND type = 'asset'
    AND (name ILIKE '%comiss%receber%' OR name ILIKE '%comissões a receber%')
    AND status = 'active'
  LIMIT 1;

  IF v_accounts_receivable_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ACCOUNTS_RECEIVABLE_NOT_FOUND',
      'error', 'Conta de Comissões a Receber não encontrada'
    );
  END IF;

  -- 1. Atualizar status na tabela transactions - USANDO MAIÚSCULO
  UPDATE transactions
  SET status = 'PAGO',
      paid_date = p_settlement_date,
      updated_at = NOW()
  WHERE id = v_legacy_id;

  -- 2. Criar transação financeira de baixa
  INSERT INTO financial_transactions (
    user_id,
    created_by,
    description,
    transaction_date,
    related_entity_type,
    related_entity_id,
    status
  ) VALUES (
    v_user_id,
    v_user_id,
    'Baixa de comissão: ' || COALESCE(v_transaction.description, 'Sem descrição'),
    p_settlement_date,
    'commission_settlement',
    v_legacy_id,
    'confirmed'
  )
  RETURNING id INTO v_new_financial_tx_id;

  -- 3. Criar lançamentos contábeis (partidas dobradas)
  -- Débito na conta bancária (entrada de dinheiro)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_new_financial_tx_id, p_bank_account_id, v_commission_amount, 'Recebimento de comissão');

  -- Crédito na conta de Comissões a Receber (baixa do recebível)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_new_financial_tx_id, v_accounts_receivable_id, -v_commission_amount, 'Baixa de comissão a receber');

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_new_financial_tx_id,
    'legacy_transaction_id', v_legacy_id,
    'amount', v_commission_amount,
    'settlement_date', p_settlement_date,
    'id_source', v_id_source
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error_code', 'UNEXPECTED_ERROR',
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;