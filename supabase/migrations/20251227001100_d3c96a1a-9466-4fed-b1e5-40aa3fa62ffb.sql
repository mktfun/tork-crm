-- Atualizar a função get_transaction_details para aceitar busca por ID legado
CREATE OR REPLACE FUNCTION public.get_transaction_details(
  p_transaction_id uuid DEFAULT NULL,
  p_legacy_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_actual_transaction_id uuid;
  v_transaction record;
  v_ledger_entries jsonb;
  v_legacy_data jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Usuário não autenticado');
  END IF;
  
  -- Se p_transaction_id não for passado, buscar pelo ID legado
  IF p_transaction_id IS NULL AND p_legacy_id IS NOT NULL THEN
    SELECT ft.id INTO v_actual_transaction_id
    FROM financial_transactions ft
    WHERE ft.related_entity_id = p_legacy_id::text
      AND ft.related_entity_type = 'legacy_transaction'
      AND ft.user_id = v_user_id
    LIMIT 1;
    
    IF v_actual_transaction_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Transação legada não encontrada');
    END IF;
  ELSE
    v_actual_transaction_id := p_transaction_id;
  END IF;
  
  -- Buscar dados principais da transação
  SELECT ft.* INTO v_transaction
  FROM financial_transactions ft
  WHERE ft.id = v_actual_transaction_id
    AND ft.user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transação não encontrada');
  END IF;
  
  -- Buscar lançamentos do ledger
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', fl.id,
      'amount', fl.amount,
      'memo', fl.memo,
      'account_id', fl.account_id,
      'account_name', fa.name,
      'account_type', fa.type
    )
  ), '[]'::jsonb)
  INTO v_ledger_entries
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fl.account_id = fa.id
  WHERE fl.transaction_id = v_actual_transaction_id;
  
  -- Se for uma transação legada, buscar dados originais da tabela transactions
  IF v_transaction.related_entity_type = 'legacy_transaction' AND v_transaction.related_entity_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'client_id', t.client_id,
      'client_name', c.name,
      'policy_id', t.policy_id,
      'policy_number', a.policy_number,
      'ramo', r.nome,
      'company', co.name,
      'original_amount', t.amount,
      'original_status', t.status
    )
    INTO v_legacy_data
    FROM transactions t
    LEFT JOIN clientes c ON t.client_id = c.id
    LEFT JOIN apolices a ON t.policy_id = a.id
    LEFT JOIN ramos r ON t.ramo_id = r.id
    LEFT JOIN companies co ON t.company_id = co.id
    WHERE t.id = v_transaction.related_entity_id::uuid;
  END IF;
  
  RETURN jsonb_build_object(
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
END;
$$;