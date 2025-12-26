-- ============================================
-- OPERAÇÃO RECONCILIAÇÃO TOTAL - FASE 12
-- Diagnóstico e migração de transações órfãs
-- ============================================

-- 1. Função de Diagnóstico: Conta e soma transações faltantes no Ledger
CREATE OR REPLACE FUNCTION public.diagnose_ledger_gaps()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
  v_total_value numeric;
BEGIN
  -- Transações pagas/realizadas que NÃO têm correspondência no financial_transactions
  SELECT 
    COUNT(*),
    COALESCE(SUM(t.amount), 0)
  INTO v_count, v_total_value
  FROM transactions t
  WHERE t.user_id = auth.uid()
    AND t.status IN ('PAGO', 'pago', 'realizado', 'Realizado', 'REALIZADO')
    AND t.nature = 'RECEITA'
    AND NOT EXISTS (
      SELECT 1 FROM financial_transactions ft
      WHERE ft.related_entity_id = t.id::uuid
        AND ft.related_entity_type = 'legacy_transaction'
        AND ft.user_id = auth.uid()
        AND ft.is_void = false
    );
  
  RETURN jsonb_build_object(
    'missing_count', v_count,
    'missing_value', v_total_value
  );
END;
$$;

-- 2. Função de Migração: Migra transações órfãs para o Ledger
CREATE OR REPLACE FUNCTION public.migrate_missing_transactions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_migrated_count integer := 0;
  v_total_value numeric := 0;
  v_asset_account_id uuid;
  v_revenue_account_id uuid;
  v_new_transaction_id uuid;
  rec record;
BEGIN
  -- Buscar conta de ativo padrão (Banco Padrão)
  SELECT id INTO v_asset_account_id
  FROM financial_accounts
  WHERE user_id = auth.uid()
    AND type = 'asset'
    AND status = 'active'
  ORDER BY is_system DESC, created_at ASC
  LIMIT 1;
  
  -- Buscar conta de receita padrão (Receita de Comissões)
  SELECT id INTO v_revenue_account_id
  FROM financial_accounts
  WHERE user_id = auth.uid()
    AND type = 'revenue'
    AND status = 'active'
  ORDER BY is_system DESC, created_at ASC
  LIMIT 1;
  
  -- Verificar se temos as contas necessárias
  IF v_asset_account_id IS NULL OR v_revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Contas padrão não encontradas. Execute a sincronização de histórico primeiro.';
  END IF;
  
  -- Iterar apenas pelas transações faltantes
  FOR rec IN
    SELECT 
      t.id,
      t.amount,
      t.date AS original_date,
      t.description,
      c.name AS client_name,
      a.policy_number
    FROM transactions t
    LEFT JOIN clientes c ON c.id = t.client_id AND c.user_id = t.user_id
    LEFT JOIN apolices a ON a.id = t.policy_id AND a.user_id = t.user_id
    WHERE t.user_id = auth.uid()
      AND t.status IN ('PAGO', 'pago', 'realizado', 'Realizado', 'REALIZADO')
      AND t.nature = 'RECEITA'
      AND NOT EXISTS (
        SELECT 1 FROM financial_transactions ft
        WHERE ft.related_entity_id = t.id::uuid
          AND ft.related_entity_type = 'legacy_transaction'
          AND ft.user_id = auth.uid()
          AND ft.is_void = false
      )
    ORDER BY t.date ASC
  LOOP
    -- Criar transação financeira com data ORIGINAL
    INSERT INTO financial_transactions (
      user_id,
      created_by,
      description,
      transaction_date,
      related_entity_type,
      related_entity_id,
      reference_number
    ) VALUES (
      auth.uid(),
      auth.uid(),
      COALESCE(
        NULLIF(TRIM(rec.description), ''),
        'Comissão - ' || COALESCE(rec.client_name, 'Cliente') || 
        CASE WHEN rec.policy_number IS NOT NULL THEN ' - Apólice ' || rec.policy_number ELSE '' END
      ),
      rec.original_date,
      'legacy_transaction',
      rec.id,
      'RECONCILE-' || LEFT(rec.id::text, 8)
    )
    RETURNING id INTO v_new_transaction_id;
    
    -- Criar lançamentos no Ledger (Débito no Ativo, Crédito na Receita)
    INSERT INTO financial_ledger (transaction_id, account_id, amount, memo) VALUES
      (v_new_transaction_id, v_asset_account_id, rec.amount, 'Débito - Entrada'),
      (v_new_transaction_id, v_revenue_account_id, -rec.amount, 'Crédito - Receita');
    
    v_migrated_count := v_migrated_count + 1;
    v_total_value := v_total_value + rec.amount;
  END LOOP;
  
  RETURN jsonb_build_object(
    'migrated_count', v_migrated_count,
    'total_value', v_total_value
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.diagnose_ledger_gaps() TO authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_missing_transactions() TO authenticated;