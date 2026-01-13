-- ============================================================
-- Nova RPC: get_total_pending_receivables
-- Retorna soma de TODAS as transações pendentes sem filtro de data
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_total_pending_receivables()
RETURNS TABLE (
  total_amount NUMERIC,
  pending_count INTEGER
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
    RETURN QUERY SELECT 0::NUMERIC, 0::INTEGER;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(SUM(
      COALESCE(
        (SELECT SUM(fl.amount) FROM financial_ledger fl WHERE fl.transaction_id = ft.id AND fl.amount > 0),
        t.amount
      )
    ), 0)::NUMERIC AS total_amount,
    COUNT(*)::INTEGER AS pending_count
  FROM financial_transactions ft
  LEFT JOIN transactions t ON t.id = ft.related_entity_id 
    AND ft.related_entity_type = 'legacy_transaction'
  WHERE ft.user_id = v_user_id
    AND ft.related_entity_type = 'legacy_transaction'
    AND ft.status = 'pending';
END;
$$;

-- ============================================================
-- Nova RPC: get_pending_this_month
-- Retorna soma de transações pendentes COM vencimento no mês atual
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pending_this_month()
RETURNS TABLE (
  total_amount NUMERIC,
  pending_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_month_start DATE;
  v_month_end DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::INTEGER;
    RETURN;
  END IF;

  v_month_start := date_trunc('month', CURRENT_DATE)::DATE;
  v_month_end := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::DATE;

  RETURN QUERY
  SELECT 
    COALESCE(SUM(
      COALESCE(
        (SELECT SUM(fl.amount) FROM financial_ledger fl WHERE fl.transaction_id = ft.id AND fl.amount > 0),
        t.amount
      )
    ), 0)::NUMERIC AS total_amount,
    COUNT(*)::INTEGER AS pending_count
  FROM financial_transactions ft
  LEFT JOIN transactions t ON t.id = ft.related_entity_id 
    AND ft.related_entity_type = 'legacy_transaction'
  WHERE ft.user_id = v_user_id
    AND ft.related_entity_type = 'legacy_transaction'
    AND ft.status = 'pending'
    AND ft.transaction_date >= v_month_start
    AND ft.transaction_date <= v_month_end;
END;
$$;