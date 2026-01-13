-- =====================================================
-- FASE 1: RPC para KPIs Financeiros do Dashboard
-- Lê do financial_ledger (fonte única de verdade)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_financial_kpis(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_total_commission NUMERIC;
  v_pending_commission NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Não autenticado');
  END IF;

  -- Comissão EFETIVADA no período (status = completed)
  SELECT COALESCE(SUM(ABS(fl.amount)), 0) INTO v_total_commission
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = v_user_id
    AND (ft.is_void = false OR ft.is_void IS NULL)
    AND COALESCE(ft.status, 'pending') = 'completed'
    AND fa.type = 'revenue'
    AND fl.amount < 0
    AND (p_start_date IS NULL OR ft.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ft.transaction_date <= p_end_date);

  -- Comissão PENDENTE no período
  SELECT COALESCE(SUM(ABS(fl.amount)), 0) INTO v_pending_commission
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = v_user_id
    AND (ft.is_void = false OR ft.is_void IS NULL)
    AND COALESCE(ft.status, 'pending') = 'pending'
    AND fa.type = 'revenue'
    AND fl.amount < 0
    AND (p_start_date IS NULL OR ft.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ft.transaction_date <= p_end_date);

  RETURN json_build_object(
    'totalCommission', v_total_commission,
    'pendingCommission', v_pending_commission,
    'netCommission', v_total_commission
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_financial_kpis(DATE, DATE) TO authenticated;

-- =====================================================
-- FASE 2: RPC para Gráfico Mensal de Comissões
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_monthly_commission_chart(
  p_months INT DEFAULT 6
)
RETURNS TABLE (
  month_label TEXT,
  month_date DATE,
  confirmed_amount NUMERIC,
  pending_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH months AS (
    SELECT 
      date_trunc('month', CURRENT_DATE - (n || ' months')::INTERVAL)::DATE as month_start
    FROM generate_series(0, p_months - 1) n
  ),
  ledger_data AS (
    SELECT 
      date_trunc('month', ft.transaction_date)::DATE as tx_month,
      COALESCE(ft.status, 'pending') as tx_status,
      ABS(fl.amount) as tx_amount
    FROM financial_transactions ft
    JOIN financial_ledger fl ON fl.transaction_id = ft.id
    JOIN financial_accounts fa ON fa.id = fl.account_id
    WHERE ft.user_id = v_user_id
      AND (ft.is_void = false OR ft.is_void IS NULL)
      AND fa.type = 'revenue'
      AND fl.amount < 0
  )
  SELECT
    to_char(m.month_start, 'Mon/YY')::TEXT as month_label,
    m.month_start as month_date,
    COALESCE(SUM(CASE WHEN ld.tx_status = 'completed' THEN ld.tx_amount ELSE 0 END), 0)::NUMERIC as confirmed_amount,
    COALESCE(SUM(CASE WHEN ld.tx_status = 'pending' THEN ld.tx_amount ELSE 0 END), 0)::NUMERIC as pending_amount
  FROM months m
  LEFT JOIN ledger_data ld ON date_trunc('month', ld.tx_month) = m.month_start
  GROUP BY m.month_start
  ORDER BY m.month_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_commission_chart(INT) TO authenticated;

-- =====================================================
-- FASE 4: RPC de Auditoria de Divergências
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_financial_divergence()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_ledger_total NUMERIC;
  v_legacy_total NUMERIC;
  v_orphan_legacy INT;
  v_orphan_ledger INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Não autenticado');
  END IF;
  
  -- Total no Ledger (ERP)
  SELECT COALESCE(SUM(ABS(fl.amount)), 0) INTO v_ledger_total
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE ft.user_id = v_user_id
    AND (ft.is_void = false OR ft.is_void IS NULL)
    AND fa.type = 'revenue'
    AND fl.amount < 0;

  -- Total no Legado (transactions)
  SELECT COALESCE(SUM(amount), 0) INTO v_legacy_total
  FROM transactions
  WHERE user_id = v_user_id
    AND nature = 'RECEITA'
    AND status IN ('REALIZADO', 'PAGO');

  -- Transações legadas sem equivalente no ERP
  SELECT COUNT(*) INTO v_orphan_legacy
  FROM transactions t
  WHERE t.user_id = v_user_id
    AND t.nature = 'RECEITA'
    AND t.status IN ('REALIZADO', 'PAGO')
    AND NOT EXISTS (
      SELECT 1 FROM financial_transactions ft
      WHERE ft.related_entity_id = t.policy_id::TEXT
        AND ft.user_id = v_user_id
    );

  -- Transações ERP sem equivalente no legado
  SELECT COUNT(*) INTO v_orphan_ledger
  FROM financial_transactions ft
  WHERE ft.user_id = v_user_id
    AND ft.related_entity_type = 'policy'
    AND NOT EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.policy_id::TEXT = ft.related_entity_id
        AND t.user_id = v_user_id
    );

  RETURN json_build_object(
    'ledger_total', v_ledger_total,
    'legacy_total', v_legacy_total,
    'difference', v_legacy_total - v_ledger_total,
    'orphan_in_legacy', v_orphan_legacy,
    'orphan_in_ledger', v_orphan_ledger,
    'is_synchronized', ABS(v_legacy_total - v_ledger_total) < 0.01
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_financial_divergence() TO authenticated;