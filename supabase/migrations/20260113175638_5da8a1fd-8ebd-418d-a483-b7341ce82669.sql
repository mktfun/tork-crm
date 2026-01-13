-- ============================================================
-- 1. Desabilitar temporariamente todos os triggers de proteção
-- ============================================================

ALTER TABLE financial_transactions DISABLE TRIGGER prevent_financial_transaction_modification;
ALTER TABLE financial_ledger DISABLE TRIGGER prevent_financial_ledger_modification;

-- ============================================================
-- 2. Dropar função existente e recriar com ordenação correta
-- ============================================================

DROP FUNCTION IF EXISTS public.get_revenue_transactions(DATE, DATE, INTEGER);

CREATE OR REPLACE FUNCTION public.get_revenue_transactions(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  legacy_id UUID,
  description TEXT,
  amount NUMERIC,
  transaction_date DATE,
  status TEXT,
  category TEXT,
  client_name TEXT,
  policy_number TEXT,
  is_synced BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    ft.id,
    ft.related_entity_id AS legacy_id,
    COALESCE(ft.description, t.description) AS description,
    COALESCE(
      (SELECT SUM(fl.amount) FROM financial_ledger fl WHERE fl.transaction_id = ft.id AND fl.amount > 0),
      t.amount
    ) AS amount,
    COALESCE(ft.transaction_date, t.due_date::date) AS transaction_date,
    ft.status,
    COALESCE(t.category, 'Comissão') AS category,
    c.name AS client_name,
    a.numero_apolice AS policy_number,
    (t.id IS NOT NULL) AS is_synced,
    ft.created_at
  FROM financial_transactions ft
  LEFT JOIN transactions t ON t.id = ft.related_entity_id 
    AND ft.related_entity_type = 'legacy_transaction'
  LEFT JOIN apolices a ON a.id = t.policy_id
  LEFT JOIN clientes c ON c.id = a.cliente_id
  WHERE ft.user_id = v_user_id
    AND ft.related_entity_type = 'legacy_transaction'
    AND (p_start_date IS NULL OR ft.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ft.transaction_date <= p_end_date)
  ORDER BY 
    CASE WHEN ft.status = 'pending' THEN 0 ELSE 1 END,
    ft.transaction_date DESC,
    ft.id
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- 3. Reverter financial_transactions marcadas incorretamente
-- ============================================================

UPDATE financial_transactions ft
SET status = 'pending'
WHERE ft.related_entity_type = 'legacy_transaction'
  AND ft.status = 'completed'
  AND EXISTS (
    SELECT 1 FROM transactions t 
    WHERE t.id = ft.related_entity_id 
      AND t.status = 'PENDENTE'
  );

-- ============================================================
-- 4. Remover duplicatas em financial_transactions (mantendo a mais recente)
-- ============================================================

DELETE FROM financial_transactions 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY related_entity_id, related_entity_type, user_id
      ORDER BY created_at DESC
    ) as rn
    FROM financial_transactions
    WHERE related_entity_type = 'legacy_transaction'
  ) sub WHERE rn > 1
);

-- ============================================================
-- 5. Reabilitar os triggers de proteção
-- ============================================================

ALTER TABLE financial_transactions ENABLE TRIGGER prevent_financial_transaction_modification;
ALTER TABLE financial_ledger ENABLE TRIGGER prevent_financial_ledger_modification;