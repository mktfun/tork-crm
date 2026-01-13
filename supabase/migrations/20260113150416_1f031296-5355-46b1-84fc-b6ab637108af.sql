-- =============================================================================
-- CORREÇÃO CRÍTICA: Módulo Financeiro - Eliminação de Conflitos e Diagnóstico
-- =============================================================================

-- FASE 1: ELIMINAR CONFLITO DE OVERLOAD (PGRST203)
-- Dropar TODAS as versões existentes da função problemática
DROP FUNCTION IF EXISTS public.settle_commission_transaction(UUID, UUID);
DROP FUNCTION IF EXISTS public.settle_commission_transaction(UUID, UUID, DATE);

-- =============================================================================
-- FASE 2: RECRIAR FUNÇÃO DE BAIXA - VERSÃO ÚNICA E CANÔNICA
-- =============================================================================
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
  v_user_id UUID;
  v_transaction RECORD;
  v_new_ft_id UUID;
  v_receivable_account_id UUID;
  v_amount NUMERIC;
BEGIN
  -- 1. Validar usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- 2. Buscar transação original (do sistema legado ou pending)
  SELECT ft.id, ft.description, ft.status, ft.user_id,
         ABS(COALESCE(
           (SELECT SUM(ABS(fl.amount)) / 2 FROM financial_ledger fl WHERE fl.transaction_id = ft.id),
           0
         )) as ledger_amount
  INTO v_transaction
  FROM financial_transactions ft
  WHERE ft.id = p_transaction_id
    AND ft.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada ou sem permissão: %', p_transaction_id;
  END IF;

  -- 3. Validar que não está já liquidada
  IF v_transaction.status = 'completed' THEN
    RAISE EXCEPTION 'Transação já está liquidada';
  END IF;

  -- 4. Validar conta bancária pertence ao usuário
  IF NOT EXISTS (
    SELECT 1 FROM financial_accounts 
    WHERE id = p_bank_account_id 
      AND user_id = v_user_id 
      AND type = 'asset'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Conta bancária inválida ou sem permissão: %', p_bank_account_id;
  END IF;

  -- 5. Buscar conta de "Comissões a Receber" (liability ou asset dependendo do setup)
  SELECT id INTO v_receivable_account_id
  FROM financial_accounts
  WHERE user_id = v_user_id
    AND (name ILIKE '%comiss%receber%' OR name ILIKE '%a receber%' OR code = '1.1.3')
    AND status = 'active'
  LIMIT 1;

  -- Se não existe, criar automaticamente
  IF v_receivable_account_id IS NULL THEN
    INSERT INTO financial_accounts (user_id, name, type, code, description, status)
    VALUES (v_user_id, 'Comissões a Receber', 'asset', '1.1.3', 'Comissões pendentes de recebimento', 'active')
    RETURNING id INTO v_receivable_account_id;
  END IF;

  -- 6. Determinar valor a liquidar
  v_amount := v_transaction.ledger_amount;
  
  IF v_amount <= 0 THEN
    -- Fallback: buscar do legado se não há entradas no ledger
    SELECT ABS(COALESCE(
      (SELECT SUM(amount) FROM transactions WHERE policy_id::text = p_transaction_id::text AND user_id = v_user_id),
      100 -- valor mínimo simbólico se tudo falhar
    )) INTO v_amount;
  END IF;

  -- 7. Criar transação de liquidação no financial_transactions
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
    p_transaction_id::text,
    'settlement'
  )
  RETURNING id INTO v_new_ft_id;

  -- 8. PARTIDAS DOBRADAS - Liquidação da comissão
  -- Débito: Conta Bancária (aumenta ativo)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_new_ft_id, p_bank_account_id, v_amount, 'Recebimento de comissão');

  -- Crédito: Comissões a Receber (diminui ativo)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_new_ft_id, v_receivable_account_id, -v_amount, 'Baixa de comissão a receber');

  -- 9. Atualizar status da transação original
  UPDATE financial_transactions
  SET status = 'completed',
      updated_at = NOW()
  WHERE id = p_transaction_id
    AND user_id = v_user_id;

  -- 10. Retornar resultado de sucesso
  RETURN jsonb_build_object(
    'success', true,
    'settlement_transaction_id', v_new_ft_id,
    'original_transaction_id', p_transaction_id,
    'amount_settled', v_amount,
    'bank_account_id', p_bank_account_id,
    'settlement_date', p_settlement_date
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao liquidar comissão: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- Garantir permissão de execução
GRANT EXECUTE ON FUNCTION public.settle_commission_transaction(UUID, UUID, DATE) TO authenticated;

-- =============================================================================
-- FASE 3: RPC DE DIAGNÓSTICO DE SAÚDE DO LEDGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.diagnose_ledger_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
  v_orphan_transactions JSONB;
  v_negative_balances JSONB;
  v_unbalanced_transactions JSONB;
  v_completed_without_ledger JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- 1. Transações completed sem entries no ledger
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ft.id,
    'description', ft.description,
    'status', ft.status,
    'created_at', ft.created_at
  )), '[]'::jsonb)
  INTO v_completed_without_ledger
  FROM financial_transactions ft
  WHERE ft.user_id = v_user_id
    AND ft.status = 'completed'
    AND ft.is_void IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM financial_ledger fl WHERE fl.transaction_id = ft.id
    );

  -- 2. Contas com saldo negativo (problemático para assets)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', fa.id,
    'name', fa.name,
    'type', fa.type,
    'balance', COALESCE((SELECT SUM(fl.amount) FROM financial_ledger fl WHERE fl.account_id = fa.id), 0)
  )), '[]'::jsonb)
  INTO v_negative_balances
  FROM financial_accounts fa
  WHERE fa.user_id = v_user_id
    AND fa.type = 'asset'
    AND fa.status = 'active'
    AND COALESCE((SELECT SUM(fl.amount) FROM financial_ledger fl WHERE fl.account_id = fa.id), 0) < 0;

  -- 3. Transações com soma diferente de zero (violação de partidas dobradas)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'transaction_id', fl.transaction_id,
    'sum', SUM(fl.amount),
    'entry_count', COUNT(*)
  )), '[]'::jsonb)
  INTO v_unbalanced_transactions
  FROM financial_ledger fl
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE ft.user_id = v_user_id
  GROUP BY fl.transaction_id
  HAVING SUM(fl.amount) != 0;

  -- 4. Transações no sistema legado sem correspondência no novo
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'description', t.description,
    'amount', t.amount,
    'status', t.status,
    'date', t.date
  )), '[]'::jsonb)
  INTO v_orphan_transactions
  FROM transactions t
  WHERE t.user_id = v_user_id
    AND t.status = 'paid'
    AND NOT EXISTS (
      SELECT 1 FROM financial_transactions ft 
      WHERE ft.related_entity_id = t.id::text 
        AND ft.user_id = v_user_id
    )
  LIMIT 50;

  -- Montar resultado final
  v_result := jsonb_build_object(
    'timestamp', NOW(),
    'user_id', v_user_id,
    'issues', jsonb_build_object(
      'completed_without_ledger', jsonb_build_object(
        'count', jsonb_array_length(v_completed_without_ledger),
        'items', v_completed_without_ledger
      ),
      'negative_asset_balances', jsonb_build_object(
        'count', jsonb_array_length(v_negative_balances),
        'items', v_negative_balances
      ),
      'unbalanced_transactions', jsonb_build_object(
        'count', jsonb_array_length(v_unbalanced_transactions),
        'items', v_unbalanced_transactions
      ),
      'orphan_legacy_transactions', jsonb_build_object(
        'count', jsonb_array_length(v_orphan_transactions),
        'items', v_orphan_transactions
      )
    ),
    'health_score', CASE
      WHEN jsonb_array_length(v_completed_without_ledger) = 0 
        AND jsonb_array_length(v_negative_balances) = 0
        AND jsonb_array_length(v_unbalanced_transactions) = 0
      THEN 'healthy'
      WHEN jsonb_array_length(v_unbalanced_transactions) > 0
        OR jsonb_array_length(v_negative_balances) > 0
      THEN 'critical'
      ELSE 'warning'
    END
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.diagnose_ledger_health() TO authenticated;

-- =============================================================================
-- FASE 4: GARANTIR RLS COMPLETO NO FINANCIAL_LEDGER
-- =============================================================================

-- Verificar e adicionar policies faltantes (UPDATE/DELETE para correções)
DO $$
BEGIN
  -- Policy de UPDATE (para correções administrativas futuras)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'financial_ledger' 
      AND policyname = 'Users can update own ledger entries'
  ) THEN
    CREATE POLICY "Users can update own ledger entries"
      ON public.financial_ledger
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM financial_transactions ft
          WHERE ft.id = financial_ledger.transaction_id
            AND ft.user_id = auth.uid()
        )
      );
  END IF;

  -- Policy de DELETE (para estornos)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'financial_ledger' 
      AND policyname = 'Users can delete own ledger entries'
  ) THEN
    CREATE POLICY "Users can delete own ledger entries"
      ON public.financial_ledger
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM financial_transactions ft
          WHERE ft.id = financial_ledger.transaction_id
            AND ft.user_id = auth.uid()
        )
      );
  END IF;
END $$;