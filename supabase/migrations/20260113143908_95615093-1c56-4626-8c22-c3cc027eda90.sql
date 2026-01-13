-- ================================================
-- FASE 1: Corrigir get_account_balances (excluir transações anuladas)
-- ================================================
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
    COALESCE(SUM(
      CASE 
        WHEN ft.is_void = false OR ft.is_void IS NULL THEN fl.amount 
        ELSE 0 
      END
    ), 0)::NUMERIC as balance
  FROM financial_accounts fa
  LEFT JOIN financial_ledger fl ON fl.account_id = fa.id
  LEFT JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = auth.uid()
    AND fa.status = 'active'
    AND fa.type = 'asset'
  GROUP BY fa.id, fa.name, fa.code, fa.type
  ORDER BY fa.code, fa.name;
END;
$$;

-- ================================================
-- FASE 3: Padronizar status de 'settled' para 'completed'
-- ================================================
UPDATE financial_transactions
SET status = 'completed'
WHERE status = 'settled';

-- Recriar settle_commission_transaction com status padronizado
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
  v_tx_exists BOOLEAN;
  v_tx_status TEXT;
  v_tx_description TEXT;
  v_pending_account_id UUID;
  v_bank_account_id UUID;
  v_pending_amount NUMERIC;
  v_settlement_tx_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;
  
  -- Verificar se a transação existe e pertence ao usuário
  SELECT EXISTS(
    SELECT 1 FROM financial_transactions 
    WHERE id = p_transaction_id AND user_id = v_user_id
  ), status, description
  INTO v_tx_exists, v_tx_status, v_tx_description
  FROM financial_transactions
  WHERE id = p_transaction_id AND user_id = v_user_id;
  
  IF NOT v_tx_exists THEN
    RETURN json_build_object('success', false, 'error', 'Transação não encontrada');
  END IF;
  
  IF v_tx_status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Transação já está baixada');
  END IF;
  
  -- Buscar conta de receita pendente (onde está o valor a receber)
  SELECT fa.id INTO v_pending_account_id
  FROM financial_accounts fa
  WHERE fa.user_id = v_user_id 
    AND fa.type = 'revenue'
    AND fa.status = 'active'
  ORDER BY fa.code
  LIMIT 1;
  
  IF v_pending_account_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Conta de receita não encontrada');
  END IF;
  
  -- Definir conta bancária de destino
  IF p_bank_account_id IS NOT NULL THEN
    v_bank_account_id := p_bank_account_id;
  ELSE
    -- Usar primeira conta ativa de ativo
    SELECT fa.id INTO v_bank_account_id
    FROM financial_accounts fa
    WHERE fa.user_id = v_user_id 
      AND fa.type = 'asset'
      AND fa.status = 'active'
    ORDER BY fa.code
    LIMIT 1;
  END IF;
  
  IF v_bank_account_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Conta bancária não encontrada');
  END IF;
  
  -- Calcular valor pendente (soma positiva dos lançamentos de receita)
  SELECT COALESCE(ABS(SUM(fl.amount)), 0) INTO v_pending_amount
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE fl.transaction_id = p_transaction_id
    AND fa.type = 'revenue';
  
  IF v_pending_amount <= 0 THEN
    -- Se não há lançamento de receita, pegar o valor absoluto total
    SELECT COALESCE(ABS(SUM(fl.amount)), 0) / 2 INTO v_pending_amount
    FROM financial_ledger fl
    WHERE fl.transaction_id = p_transaction_id;
  END IF;
  
  IF v_pending_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Valor da transação inválido');
  END IF;
  
  -- Criar transação de liquidação (entrada no banco)
  INSERT INTO financial_transactions (
    id, user_id, created_by, description, transaction_date, 
    reference_number, related_entity_id, related_entity_type, status
  ) VALUES (
    gen_random_uuid(), v_user_id, v_user_id,
    'Liquidação: ' || COALESCE(v_tx_description, 'Comissão'),
    CURRENT_DATE,
    'SETTL-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS'),
    p_transaction_id, 'settlement', 'completed'
  ) RETURNING id INTO v_settlement_tx_id;
  
  -- Lançamentos de partida dobrada:
  -- Débito na conta de receita (reduz pendente)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_settlement_tx_id, v_pending_account_id, -v_pending_amount, 'Baixa de receita pendente');
  
  -- Crédito na conta bancária (aumenta saldo)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_settlement_tx_id, v_bank_account_id, v_pending_amount, 'Recebimento em conta');
  
  -- Atualizar status da transação original para 'completed'
  UPDATE financial_transactions
  SET status = 'completed',
      reference_number = COALESCE(reference_number, '') || 
        CASE WHEN reference_number IS NOT NULL AND reference_number != '' THEN ' | ' ELSE '' END ||
        'PAID-' || TO_CHAR(NOW(), 'YYYY-MM-DD')
  WHERE id = p_transaction_id;
  
  RETURN json_build_object(
    'success', true,
    'settlement_transaction_id', v_settlement_tx_id,
    'amount_settled', v_pending_amount,
    'bank_account_id', v_bank_account_id,
    'new_status', 'completed'
  );
END;
$$;

-- ================================================
-- FASE 5: Criar função de auditoria do ledger
-- ================================================
CREATE OR REPLACE FUNCTION public.audit_ledger_integrity()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_orphan_ledger_count INT;
  v_unbalanced_tx_count INT;
  v_void_with_ledger_count INT;
  v_total_asset_balance NUMERIC;
  v_total_ledger_sum NUMERIC;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;
  
  -- 1. Contar lançamentos órfãos (ledger sem transação pai válida)
  SELECT COUNT(*) INTO v_orphan_ledger_count
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE fa.user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM financial_transactions ft 
      WHERE ft.id = fl.transaction_id
    );
  
  -- 2. Contar transações desbalanceadas (soma dos lançamentos != 0)
  SELECT COUNT(*) INTO v_unbalanced_tx_count
  FROM (
    SELECT ft.id, SUM(fl.amount) as net
    FROM financial_transactions ft
    JOIN financial_ledger fl ON fl.transaction_id = ft.id
    WHERE ft.user_id = v_user_id 
      AND (ft.is_void = false OR ft.is_void IS NULL)
    GROUP BY ft.id
    HAVING ABS(SUM(fl.amount)) > 0.01
  ) sub;
  
  -- 3. Contar transações void que ainda têm lançamentos no ledger
  SELECT COUNT(*) INTO v_void_with_ledger_count
  FROM financial_transactions ft
  WHERE ft.user_id = v_user_id 
    AND ft.is_void = true
    AND EXISTS (
      SELECT 1 FROM financial_ledger fl WHERE fl.transaction_id = ft.id
    );
  
  -- 4. Saldo total das contas de ativo
  SELECT COALESCE(SUM(
    CASE 
      WHEN ft.is_void = false OR ft.is_void IS NULL THEN fl.amount 
      ELSE 0 
    END
  ), 0) INTO v_total_asset_balance
  FROM financial_accounts fa
  LEFT JOIN financial_ledger fl ON fl.account_id = fa.id
  LEFT JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = v_user_id
    AND fa.type = 'asset'
    AND fa.status = 'active';
  
  -- 5. Soma total do ledger (deve tender a zero em partidas dobradas perfeitas)
  SELECT COALESCE(SUM(fl.amount), 0) INTO v_total_ledger_sum
  FROM financial_ledger fl
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE ft.user_id = v_user_id
    AND (ft.is_void = false OR ft.is_void IS NULL);
  
  RETURN json_build_object(
    'success', true,
    'orphan_ledger_entries', v_orphan_ledger_count,
    'unbalanced_transactions', v_unbalanced_tx_count,
    'void_with_ledger', v_void_with_ledger_count,
    'total_asset_balance', v_total_asset_balance,
    'total_ledger_sum', v_total_ledger_sum,
    'is_healthy', (v_orphan_ledger_count = 0 AND v_unbalanced_tx_count = 0),
    'audit_timestamp', NOW()
  );
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.get_account_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_commission_transaction(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_ledger_integrity() TO authenticated;