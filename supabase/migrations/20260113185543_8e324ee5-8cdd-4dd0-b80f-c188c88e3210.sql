
-- ============================================================
-- CORREÇÃO: get_revenue_transactions - DROP + CREATE
-- ============================================================

DROP FUNCTION IF EXISTS public.get_revenue_transactions(date, date, integer);

CREATE OR REPLACE FUNCTION public.get_revenue_transactions(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  id uuid,
  description text,
  transaction_date date,
  amount numeric,
  account_name text,
  is_confirmed boolean,
  legacy_status text,
  client_name text,
  policy_number text,
  related_entity_id uuid,
  related_entity_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    ft.id,
    COALESCE(ft.description, t.description, 'Receita') AS description,
    COALESCE(ft.transaction_date, t.due_date::date) AS transaction_date,
    COALESCE(
      (SELECT SUM(ABS(fl.amount)) FROM financial_ledger fl 
       JOIN financial_accounts fa ON fa.id = fl.account_id 
       WHERE fl.transaction_id = ft.id AND fa.type = 'revenue'),
      t.amount,
      0
    ) AS amount,
    (SELECT fa.name FROM financial_ledger fl 
     JOIN financial_accounts fa ON fa.id = fl.account_id 
     WHERE fl.transaction_id = ft.id AND fa.type = 'revenue' 
     LIMIT 1) AS account_name,
    (ft.status = 'completed') AS is_confirmed,
    t.status AS legacy_status,
    c.name AS client_name,
    a.policy_number AS policy_number,
    ft.related_entity_id,
    ft.related_entity_type
  FROM financial_transactions ft
  LEFT JOIN transactions t ON t.id = ft.related_entity_id 
    AND ft.related_entity_type = 'legacy_transaction'
  LEFT JOIN apolices a ON a.id = t.policy_id
  LEFT JOIN clientes c ON c.id = a.client_id
  WHERE ft.user_id = v_user_id
    AND (
      ft.related_entity_type = 'legacy_transaction' 
      OR ft.related_entity_type = 'manual_revenue'
      OR ft.related_entity_type IS NULL
    )
    AND (p_start_date IS NULL OR ft.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ft.transaction_date <= p_end_date)
  ORDER BY 
    CASE WHEN ft.status = 'pending' THEN 0 ELSE 1 END,
    ft.transaction_date DESC,
    ft.id
  LIMIT p_limit;
END;
$$;
