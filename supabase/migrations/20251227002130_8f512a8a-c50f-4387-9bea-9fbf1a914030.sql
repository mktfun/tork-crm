CREATE OR REPLACE FUNCTION get_transaction_details(
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
    WHERE ft.related_entity_id = p_legacy_id
      AND ft.related_entity_type = 'legacy_transaction'
      AND ft.user_id = v_user_id
    LIMIT 1;
    
    IF v_actual_transaction_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Transação legada não encontrada');
    END IF;
  ELSE
    v_actual_transaction_id := p_transaction_id;
  END IF;
  
  -- Buscar dados da transação
  SELECT 
    ft.id,
    ft.description,
    ft.transaction_date,
    ft.reference_number,
    ft.created_at,
    ft.is_void,
    ft.void_reason,
    ft.voided_at,
    ft.related_entity_id,
    ft.related_entity_type
  INTO v_transaction
  FROM financial_transactions ft
  WHERE ft.id = v_actual_transaction_id
    AND ft.user_id = v_user_id;
  
  IF v_transaction IS NULL THEN
    RETURN jsonb_build_object('error', 'Transação não encontrada');
  END IF;
  
  -- Buscar entradas do ledger
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', fl.id,
      'accountId', fl.account_id,
      'accountName', fa.name,
      'accountType', fa.type,
      'amount', fl.amount,
      'memo', fl.memo
    ) ORDER BY fl.created_at
  ), '[]'::jsonb)
  INTO v_ledger_entries
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE fl.transaction_id = v_actual_transaction_id;
  
  -- Se for transação legada, buscar dados da transação original
  IF v_transaction.related_entity_type = 'legacy_transaction' AND v_transaction.related_entity_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', t.id,
      'description', t.description,
      'amount', t.amount,
      'status', t.status,
      'nature', t.nature,
      'clientId', t.client_id,
      'clientName', c.name,
      'policyId', t.policy_id,
      'policyNumber', a.policy_number
    )
    INTO v_legacy_data
    FROM transactions t
    LEFT JOIN clientes c ON c.id = t.client_id
    LEFT JOIN apolices a ON a.id = t.policy_id
    WHERE t.id = v_transaction.related_entity_id;
  END IF;
  
  RETURN jsonb_build_object(
    'id', v_transaction.id,
    'description', v_transaction.description,
    'transactionDate', v_transaction.transaction_date,
    'referenceNumber', v_transaction.reference_number,
    'createdAt', v_transaction.created_at,
    'isVoid', COALESCE(v_transaction.is_void, false),
    'voidReason', v_transaction.void_reason,
    'voidedAt', v_transaction.voided_at,
    'relatedEntityId', v_transaction.related_entity_id,
    'relatedEntityType', v_transaction.related_entity_type,
    'ledgerEntries', v_ledger_entries,
    'legacyData', v_legacy_data
  );
END;
$$;