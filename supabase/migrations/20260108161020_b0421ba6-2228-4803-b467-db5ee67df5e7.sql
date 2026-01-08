-- =====================================================
-- CORREÇÃO: get_cash_flow_data - Filtrar apenas COMPLETED
-- =====================================================
DROP FUNCTION IF EXISTS public.get_cash_flow_data(date, date, text);

CREATE OR REPLACE FUNCTION public.get_cash_flow_data(
  p_start_date date, 
  p_end_date date, 
  p_granularity text DEFAULT 'day'
)
RETURNS TABLE(period text, income numeric, expense numeric, balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH ledger_data AS (
    SELECT 
      CASE 
        WHEN p_granularity = 'month' THEN to_char(ft.transaction_date, 'YYYY-MM')
        ELSE to_char(ft.transaction_date, 'YYYY-MM-DD')
      END as period_key,
      fa.type as account_type,
      fl.amount
    FROM financial_ledger fl
    JOIN financial_transactions ft ON ft.id = fl.transaction_id
    JOIN financial_accounts fa ON fa.id = fl.account_id
    WHERE ft.user_id = auth.uid()
      AND ft.is_void = false
      AND ft.transaction_date >= p_start_date
      AND ft.transaction_date <= p_end_date
      -- ✅ FILTRO CRUCIAL: Apenas transações EFETIVADAS
      AND COALESCE(ft.status, 'pending') = 'completed'
  ),
  aggregated AS (
    SELECT 
      period_key,
      COALESCE(SUM(CASE WHEN account_type = 'revenue' THEN ABS(amount) ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN account_type = 'expense' THEN amount ELSE 0 END), 0) as expense
    FROM ledger_data
    GROUP BY period_key
  )
  SELECT 
    a.period_key as period,
    a.income,
    a.expense,
    (a.income - a.expense) as balance
  FROM aggregated a
  ORDER BY a.period_key;
END;
$$;

-- =====================================================
-- CORREÇÃO: get_recent_financial_transactions - Incluir status e excluir reversals
-- =====================================================
DROP FUNCTION IF EXISTS public.get_recent_financial_transactions(integer, integer, text);

CREATE OR REPLACE FUNCTION public.get_recent_financial_transactions(
  p_limit integer DEFAULT 50, 
  p_offset integer DEFAULT 0, 
  p_type text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, 
  description text, 
  transaction_date date, 
  reference_number text, 
  created_at timestamptz, 
  is_void boolean, 
  total_amount numeric, 
  account_names text,
  status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    ft.id,
    ft.description,
    ft.transaction_date,
    ft.reference_number,
    ft.created_at,
    ft.is_void,
    COALESCE(SUM(ABS(fl.amount)) / 2, 0) as total_amount,
    STRING_AGG(DISTINCT fa.name, ', ' ORDER BY fa.name) as account_names,
    COALESCE(ft.status, 'pending') as status
  FROM public.financial_transactions ft
  LEFT JOIN public.financial_ledger fl ON fl.transaction_id = ft.id
  LEFT JOIN public.financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = auth.uid()
    AND ft.is_void = false
    -- ✅ Excluir estornos/reversals do histórico principal
    AND COALESCE(ft.related_entity_type, '') != 'reversal'
    AND (
      p_type IS NULL 
      OR EXISTS (
        SELECT 1 FROM public.financial_ledger fl2
        JOIN public.financial_accounts fa2 ON fa2.id = fl2.account_id
        WHERE fl2.transaction_id = ft.id AND fa2.type::text = p_type
      )
    )
  GROUP BY ft.id, ft.description, ft.transaction_date, ft.reference_number, 
           ft.created_at, ft.is_void, ft.status
  ORDER BY ft.transaction_date DESC, ft.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- =====================================================
-- CORREÇÃO: get_cash_flow_with_projection - Separar efetivado de pendente
-- =====================================================
DROP FUNCTION IF EXISTS public.get_cash_flow_with_projection(date, date, text);

CREATE OR REPLACE FUNCTION public.get_cash_flow_with_projection(
  p_start_date date, 
  p_end_date date, 
  p_granularity text DEFAULT 'day'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH ledger_data AS (
    SELECT 
      CASE 
        WHEN p_granularity = 'month' THEN to_char(ft.transaction_date, 'YYYY-MM')
        ELSE to_char(ft.transaction_date, 'YYYY-MM-DD')
      END as period_key,
      fa.type as account_type,
      fl.amount,
      COALESCE(ft.status, 'pending') as tx_status
    FROM financial_ledger fl
    JOIN financial_transactions ft ON ft.id = fl.transaction_id
    JOIN financial_accounts fa ON fa.id = fl.account_id
    WHERE ft.user_id = auth.uid()
      AND ft.is_void = false
      AND ft.transaction_date >= p_start_date
      AND ft.transaction_date <= p_end_date
  ),
  aggregated AS (
    SELECT 
      period_key,
      -- Efetivados (completed)
      COALESCE(SUM(CASE WHEN tx_status = 'completed' AND account_type = 'revenue' THEN ABS(amount) ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN tx_status = 'completed' AND account_type = 'expense' THEN amount ELSE 0 END), 0) as expense,
      -- Pendentes
      COALESCE(SUM(CASE WHEN tx_status = 'pending' AND account_type = 'revenue' THEN ABS(amount) ELSE 0 END), 0) as pending_income,
      COALESCE(SUM(CASE WHEN tx_status = 'pending' AND account_type = 'expense' THEN amount ELSE 0 END), 0) as pending_expense
    FROM ledger_data
    GROUP BY period_key
  )
  SELECT json_agg(
    json_build_object(
      'period', a.period_key,
      'income', a.income,
      'expense', a.expense,
      'pending_income', a.pending_income,
      'pending_expense', a.pending_expense,
      'net', (a.income - a.expense),
      'projected_net', (a.income + a.pending_income - a.expense - a.pending_expense)
    ) ORDER BY a.period_key
  ) INTO v_result
  FROM aggregated a;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;