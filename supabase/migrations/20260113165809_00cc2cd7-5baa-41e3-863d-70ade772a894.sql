-- Fix: Remove incorrect ::text cast from UUID parameter in settle_commission_transaction
-- The related_entity_id column is UUID, so we should not cast the UUID parameter to text

CREATE OR REPLACE FUNCTION public.settle_commission_transaction(
  p_transaction_id UUID,
  p_bank_account_id UUID,
  p_settlement_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transaction RECORD;
  v_user_id UUID;
  v_amount NUMERIC;
  v_receivables_account_id UUID;
  v_new_ft_id UUID;
BEGIN
  -- Get the legacy transaction
  SELECT t.*, c.name as client_name
  INTO v_transaction
  FROM transactions t
  LEFT JOIN clientes c ON t.client_id = c.id
  WHERE t.id = p_transaction_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada');
  END IF;

  IF v_transaction.status = 'pago' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transação já está paga');
  END IF;

  v_user_id := v_transaction.user_id;
  v_amount := v_transaction.amount;

  -- Get or create receivables account
  SELECT id INTO v_receivables_account_id
  FROM financial_accounts
  WHERE user_id = v_user_id 
    AND type = 'asset' 
    AND name ILIKE '%receber%'
  LIMIT 1;

  IF v_receivables_account_id IS NULL THEN
    INSERT INTO financial_accounts (user_id, name, type, code, is_system)
    VALUES (v_user_id, 'Contas a Receber', 'asset', '1.1.2', true)
    RETURNING id INTO v_receivables_account_id;
  END IF;

  -- Create financial transaction for settlement
  INSERT INTO financial_transactions (
    user_id,
    created_by,
    description,
    transaction_date,
    status,
    related_entity_id,
    related_entity_type
  ) VALUES (
    v_user_id,
    v_user_id,
    'Liquidação: ' || v_transaction.description,
    p_settlement_date,
    'completed',
    p_transaction_id,  -- FIX: removed ::text cast - UUID to UUID
    'settlement'
  )
  RETURNING id INTO v_new_ft_id;

  -- Create ledger entries:
  -- Debit bank account (increase asset)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_new_ft_id, p_bank_account_id, v_amount, 'Recebimento em conta');

  -- Credit receivables (decrease asset)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_new_ft_id, v_receivables_account_id, -v_amount, 'Baixa de conta a receber');

  -- Update legacy transaction status
  UPDATE transactions
  SET status = 'pago',
      paid_date = p_settlement_date,
      updated_at = NOW()
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'financial_transaction_id', v_new_ft_id,
    'amount', v_amount,
    'settlement_date', p_settlement_date
  );
END;
$$;