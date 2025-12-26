-- ============================================
-- FASE 8: CORREÇÃO DE DESCRIÇÕES E BAIXA EM LOTE
-- ============================================

-- 1. RPC para corrigir descrições "undefined" ou vazias
CREATE OR REPLACE FUNCTION fix_ledger_descriptions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_count int := 0;
  v_ft RECORD;
  v_description text;
  v_client_name text;
  v_ramo text;
  v_company text;
BEGIN
  v_user_id := auth.uid();
  
  -- Buscar transações com descrição problemática
  FOR v_ft IN
    SELECT ft.id, ft.related_entity_id, ft.related_entity_type
    FROM financial_transactions ft
    WHERE ft.user_id = v_user_id
      AND ft.is_void = false
      AND (
        ft.description LIKE '%undefined%' 
        OR ft.description IS NULL 
        OR ft.description = ''
        OR ft.description = 'Comissão Legada'
      )
      AND ft.related_entity_type = 'legacy_transaction'
      AND ft.related_entity_id IS NOT NULL
  LOOP
    -- Buscar dados ricos da transação legada
    SELECT 
      c.name,
      r.nome,
      comp.name
    INTO v_client_name, v_ramo, v_company
    FROM transactions t
    LEFT JOIN apolices a ON a.id = t.policy_id
    LEFT JOIN clientes c ON c.id = COALESCE(t.client_id, a.client_id)
    LEFT JOIN ramos r ON r.id = COALESCE(t.ramo_id, a.ramo_id)
    LEFT JOIN companies comp ON comp.id = a.insurance_company
    WHERE t.id = v_ft.related_entity_id::uuid;
    
    -- Construir descrição rica
    IF v_client_name IS NOT NULL THEN
      v_description := v_client_name;
      IF v_ramo IS NOT NULL AND v_ramo != '' THEN
        v_description := v_description || ' - ' || v_ramo;
      END IF;
      IF v_company IS NOT NULL AND v_company != '' THEN
        v_description := v_description || ' - ' || v_company;
      END IF;
    ELSE
      -- Fallback: buscar descrição original da transação legada
      SELECT COALESCE(t.description, 'Comissão Legada #' || LEFT(v_ft.related_entity_id::text, 8))
      INTO v_description
      FROM transactions t
      WHERE t.id = v_ft.related_entity_id::uuid;
    END IF;
    
    -- Atualizar a transação financeira
    UPDATE financial_transactions
    SET description = v_description
    WHERE id = v_ft.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'fixed_count', v_count,
    'success', true
  );
END;
$$;

-- 2. RPC para baixa em lote de receitas pendentes
CREATE OR REPLACE FUNCTION bulk_confirm_receipts(p_transaction_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Atualizar data de pagamento de todas as transações selecionadas
  UPDATE financial_transactions
  SET transaction_date = CURRENT_DATE
  WHERE id = ANY(p_transaction_ids)
    AND user_id = v_user_id
    AND is_void = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'confirmed_count', v_count,
    'success', true
  );
END;
$$;

-- 3. RPC para buscar detalhes completos de uma transação
CREATE OR REPLACE FUNCTION get_transaction_details(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
  v_transaction RECORD;
  v_ledger_entries jsonb;
  v_legacy_data jsonb;
BEGIN
  v_user_id := auth.uid();
  
  -- Buscar transação principal
  SELECT 
    ft.id,
    ft.description,
    ft.transaction_date,
    ft.reference_number,
    ft.related_entity_id,
    ft.related_entity_type,
    ft.is_void,
    ft.void_reason,
    ft.created_at
  INTO v_transaction
  FROM financial_transactions ft
  WHERE ft.id = p_transaction_id
    AND ft.user_id = v_user_id;
  
  IF v_transaction IS NULL THEN
    RETURN jsonb_build_object('error', 'Transação não encontrada');
  END IF;
  
  -- Buscar movimentos do ledger
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', fl.id,
      'amount', fl.amount,
      'memo', fl.memo,
      'account_id', fa.id,
      'account_name', fa.name,
      'account_type', fa.type
    )
  ), '[]'::jsonb)
  INTO v_ledger_entries
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE fl.transaction_id = p_transaction_id;
  
  -- Se for transação legada, buscar dados adicionais
  IF v_transaction.related_entity_type = 'legacy_transaction' AND v_transaction.related_entity_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'client_id', COALESCE(t.client_id, a.client_id),
      'client_name', c.name,
      'policy_id', t.policy_id,
      'policy_number', a.policy_number,
      'ramo', r.nome,
      'company', comp.name,
      'original_amount', t.amount,
      'original_status', t.status
    )
    INTO v_legacy_data
    FROM transactions t
    LEFT JOIN apolices a ON a.id = t.policy_id
    LEFT JOIN clientes c ON c.id = COALESCE(t.client_id, a.client_id)
    LEFT JOIN ramos r ON r.id = COALESCE(t.ramo_id, a.ramo_id)
    LEFT JOIN companies comp ON comp.id = a.insurance_company
    WHERE t.id = v_transaction.related_entity_id::uuid;
  ELSE
    v_legacy_data := NULL;
  END IF;
  
  -- Montar resultado final
  v_result := jsonb_build_object(
    'id', v_transaction.id,
    'description', v_transaction.description,
    'transaction_date', v_transaction.transaction_date,
    'reference_number', v_transaction.reference_number,
    'related_entity_id', v_transaction.related_entity_id,
    'related_entity_type', v_transaction.related_entity_type,
    'is_void', v_transaction.is_void,
    'void_reason', v_transaction.void_reason,
    'created_at', v_transaction.created_at,
    'ledger_entries', v_ledger_entries,
    'legacy_data', v_legacy_data
  );
  
  RETURN v_result;
END;
$$;

-- 4. RPC para contar transações com descrição problemática
CREATE OR REPLACE FUNCTION count_problematic_descriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM financial_transactions ft
  WHERE ft.user_id = auth.uid()
    AND ft.is_void = false
    AND (
      ft.description LIKE '%undefined%' 
      OR ft.description IS NULL 
      OR ft.description = ''
      OR ft.description = 'Comissão Legada'
    )
    AND ft.related_entity_type = 'legacy_transaction';
  
  RETURN COALESCE(v_count, 0);
END;
$$;