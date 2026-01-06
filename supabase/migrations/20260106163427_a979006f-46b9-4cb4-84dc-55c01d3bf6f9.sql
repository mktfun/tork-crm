-- =====================================================
-- FASE 3-6: Atualização das RPCs do Financeiro
-- =====================================================

-- Dropar funções existentes para poder alterar
DROP FUNCTION IF EXISTS public.get_financial_summary(DATE, DATE);
DROP FUNCTION IF EXISTS public.bulk_confirm_receipts(UUID[]);
DROP FUNCTION IF EXISTS public.settle_commission_transaction(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_user_financial_settings();

-- Função para ler financial_settings da corretora do usuário
CREATE FUNCTION public.get_user_financial_settings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
BEGIN
  SELECT COALESCE(financial_settings, '{}'::jsonb)
  INTO v_settings
  FROM brokerages
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(v_settings, '{}'::jsonb);
END;
$$;

-- Recriar get_financial_summary para filtrar apenas transações confirmadas
CREATE FUNCTION public.get_financial_summary(
  p_start_date DATE,
  p_end_date DATE
)
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
  v_net_result NUMERIC := 0;
  v_transaction_count INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Calculate totals from financial_ledger entries
  -- Only include transactions that are NOT void
  SELECT
    COALESCE(SUM(CASE 
      WHEN fa.type = 'revenue' THEN fl.amount 
      ELSE 0 
    END), 0),
    COALESCE(SUM(CASE 
      WHEN fa.type = 'expense' THEN ABS(fl.amount) 
      ELSE 0 
    END), 0),
    COUNT(DISTINCT ft.id)
  INTO v_total_income, v_total_expense, v_transaction_count
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = v_user_id
    AND ft.transaction_date >= p_start_date
    AND ft.transaction_date <= p_end_date
    AND (ft.is_void IS NULL OR ft.is_void = false)
    AND fa.type IN ('revenue', 'expense');

  v_net_result := v_total_income - v_total_expense;

  v_result := json_build_object(
    'totalIncome', v_total_income,
    'totalExpense', v_total_expense,
    'netResult', v_net_result,
    'transactionCount', v_transaction_count
  );

  RETURN v_result;
END;
$$;

-- RPC de baixa de comissão com sincronização de tabelas
CREATE FUNCTION public.settle_commission_transaction(
  p_transaction_id UUID,
  p_bank_account_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tx RECORD;
  v_amount NUMERIC;
  v_bank_id UUID;
  v_financial_settings JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

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

  v_amount := COALESCE(v_tx.total_amount, 0);

  IF p_bank_account_id IS NOT NULL THEN
    v_bank_id := p_bank_account_id;
  ELSE
    v_financial_settings := get_user_financial_settings();
    v_bank_id := (v_financial_settings->>'default_commission_asset_account_id')::UUID;
    
    IF v_bank_id IS NULL THEN
      SELECT id INTO v_bank_id 
      FROM financial_accounts 
      WHERE user_id = v_user_id AND type = 'asset' AND status = 'active'
      LIMIT 1;
    END IF;
  END IF;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'No bank account found for settlement';
  END IF;

  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (p_transaction_id, v_bank_id, v_amount, 'Baixa de comissão');

  UPDATE financial_transactions
  SET reference_number = COALESCE(reference_number, '') || '-PAID-' || NOW()::DATE::TEXT
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
    'amount', v_amount
  );
END;
$$;

-- bulk_confirm_receipts com sincronização
CREATE FUNCTION public.bulk_confirm_receipts(p_transaction_ids UUID[])
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_confirmed_count INT := 0;
  v_tx_id UUID;
  v_tx RECORD;
  v_bank_id UUID;
  v_amount NUMERIC;
  v_financial_settings JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  v_financial_settings := get_user_financial_settings();
  v_bank_id := (v_financial_settings->>'default_commission_asset_account_id')::UUID;
  
  IF v_bank_id IS NULL THEN
    SELECT id INTO v_bank_id 
    FROM financial_accounts 
    WHERE user_id = v_user_id AND type = 'asset' AND status = 'active'
    LIMIT 1;
  END IF;

  FOREACH v_tx_id IN ARRAY p_transaction_ids
  LOOP
    SELECT ft.*, 
           (SELECT SUM(ABS(fl.amount)) FROM financial_ledger fl 
            JOIN financial_accounts fa ON fa.id = fl.account_id 
            WHERE fl.transaction_id = ft.id AND fa.type = 'revenue') as total_amount
    INTO v_tx
    FROM financial_transactions ft
    WHERE ft.id = v_tx_id
      AND ft.user_id = v_user_id
      AND (ft.is_void IS NULL OR ft.is_void = false)
      AND NOT EXISTS (
        SELECT 1 FROM financial_ledger fl
        JOIN financial_accounts fa ON fa.id = fl.account_id
        WHERE fl.transaction_id = ft.id AND fa.type = 'asset'
      );

    IF v_tx IS NOT NULL AND v_bank_id IS NOT NULL THEN
      v_amount := COALESCE(v_tx.total_amount, 0);
      
      INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
      VALUES (v_tx_id, v_bank_id, v_amount, 'Confirmação de recebimento');

      UPDATE financial_transactions
      SET reference_number = COALESCE(reference_number, '') || '-PAID-' || NOW()::DATE::TEXT
      WHERE id = v_tx_id;

      IF v_tx.related_entity_type = 'policy' AND v_tx.related_entity_id IS NOT NULL THEN
        UPDATE transactions
        SET status = 'PAGO', paid_date = NOW()
        WHERE policy_id = v_tx.related_entity_id::UUID
          AND user_id = v_user_id
          AND status = 'PENDENTE'
          AND nature IN ('GANHO', 'RECEITA');
      END IF;

      v_confirmed_count := v_confirmed_count + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'confirmedCount', v_confirmed_count,
    'success', true
  );
END;
$$;