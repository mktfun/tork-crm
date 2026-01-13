-- ============================================================
-- Funções para filtrar dados financeiros a partir de 2026
-- ============================================================

-- 1. Função para obter saldos de contas a partir de uma data
CREATE OR REPLACE FUNCTION public.get_account_balances_from_date(
  p_start_date date DEFAULT '2026-01-01'
)
RETURNS TABLE(
  id uuid,
  name text,
  code text,
  type text,
  balance numeric
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
    fa.id,
    fa.name,
    fa.code,
    fa.type::text,
    COALESCE(
      (SELECT SUM(fl.amount) 
       FROM financial_ledger fl
       JOIN financial_transactions ft ON ft.id = fl.transaction_id
       WHERE fl.account_id = fa.id 
         AND ft.is_void = false
         AND ft.transaction_date >= p_start_date
      ), 0
    )::numeric AS balance
  FROM financial_accounts fa
  WHERE fa.user_id = v_user_id
    AND fa.type = 'asset'
    AND fa.status = 'active'
  ORDER BY fa.code;
END;
$$;

-- 2. Função para obter pendentes a receber a partir de uma data
CREATE OR REPLACE FUNCTION public.get_pending_receivables_from_date(
  p_start_date date DEFAULT '2026-01-01'
)
RETURNS TABLE(
  total_amount numeric,
  pending_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0::bigint;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(SUM(ABS(fl.amount)), 0)::numeric AS total_amount,
    COUNT(DISTINCT ft.id)::bigint AS pending_count
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = v_user_id
    AND ft.is_void = false
    AND ft.status = 'pending'
    AND fa.type = 'revenue'
    AND ft.transaction_date >= p_start_date;
END;
$$;