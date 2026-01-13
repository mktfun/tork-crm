-- ============================================================
-- Atualizar RPC settle_commission_transaction para marcar status como completed
-- ============================================================

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
  v_transaction RECORD;
  v_legacy_id UUID;
  v_new_transaction_id UUID;
  v_amount NUMERIC;
  v_pending_account_id UUID;
BEGIN
  -- Obter user_id do contexto
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Resolução inteligente de ID
  SELECT id, status, amount, user_id INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id AND user_id = v_user_id;

  IF v_transaction.id IS NOT NULL THEN
    v_legacy_id := v_transaction.id;
  ELSE
    SELECT t.id, t.status, t.amount, t.user_id INTO v_transaction
    FROM financial_transactions ft
    JOIN transactions t ON t.id = ft.related_entity_id
    WHERE ft.id = p_transaction_id 
      AND ft.related_entity_type = 'legacy_transaction'
      AND t.user_id = v_user_id;
    
    IF v_transaction.id IS NOT NULL THEN
      v_legacy_id := v_transaction.id;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada');
    END IF;
  END IF;

  IF v_transaction.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  IF v_transaction.status = 'PAGO' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação já está paga');
  END IF;

  v_amount := v_transaction.amount;

  IF NOT EXISTS (
    SELECT 1 FROM financial_accounts 
    WHERE id = p_bank_account_id 
      AND user_id = v_user_id 
      AND type = 'asset'
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta bancária inválida');
  END IF;

  SELECT id INTO v_pending_account_id
  FROM financial_accounts
  WHERE user_id = v_user_id 
    AND type = 'asset'
    AND name ILIKE '%comiss%receber%'
  LIMIT 1;

  IF v_pending_account_id IS NULL THEN
    SELECT id INTO v_pending_account_id
    FROM financial_accounts
    WHERE user_id = v_user_id AND type = 'asset' AND is_system = true
    LIMIT 1;
  END IF;

  IF v_pending_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta de comissões a receber não encontrada');
  END IF;

  -- 1. Atualizar status na tabela transactions (legado)
  UPDATE transactions
  SET status = 'PAGO',
      paid_date = p_settlement_date,
      updated_at = NOW()
  WHERE id = v_legacy_id;

  -- 2. Atualizar status das financial_transactions originais para 'completed'
  UPDATE financial_transactions
  SET status = 'completed'
  WHERE related_entity_id = v_legacy_id
    AND related_entity_type = 'legacy_transaction'
    AND status = 'pending'
    AND user_id = v_user_id;

  -- 3. Criar transação de baixa
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
    'Baixa de comissão - Recebimento',
    p_settlement_date,
    'commission_settlement',
    v_legacy_id,
    'confirmed'
  )
  RETURNING id INTO v_new_transaction_id;

  -- 4. Criar lançamentos contábeis
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_new_transaction_id, p_bank_account_id, v_amount, 'Recebimento de comissão');

  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_new_transaction_id, v_pending_account_id, -v_amount, 'Baixa de comissão a receber');

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_new_transaction_id,
    'legacy_id', v_legacy_id,
    'amount', v_amount,
    'message', 'Comissão baixada com sucesso'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================
-- Correção de dados existentes
-- ============================================================

UPDATE financial_transactions ft
SET status = 'completed'
WHERE ft.related_entity_type = 'legacy_transaction'
  AND ft.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM transactions t 
    WHERE t.id = ft.related_entity_id 
      AND t.status = 'PAGO'
  );