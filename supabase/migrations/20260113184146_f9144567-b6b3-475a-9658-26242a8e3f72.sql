
-- ============================================================
-- CORREÇÃO: natureza em UPPERCASE (RECEITA/DESPESA)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_financial_summary(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_total_income numeric := 0;
  v_total_expense numeric := 0;
  v_cash_balance numeric := 0;
  v_pending_income numeric := 0;
  v_pending_expense numeric := 0;
  v_effective_start date;
  v_effective_end date;
BEGIN
  v_effective_start := COALESCE(p_start_date, date_trunc('month', CURRENT_DATE)::date);
  v_effective_end := COALESCE(p_end_date, (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date);

  -- RECEITA DO PERÍODO (mantém filtro de data) - do ledger
  SELECT COALESCE(ABS(SUM(fl.amount)), 0) INTO v_total_income
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = v_user_id
    AND fa.type = 'revenue'
    AND ft.is_void = false
    AND ft.status = 'completed'
    AND ft.transaction_date >= v_effective_start
    AND ft.transaction_date <= v_effective_end;

  -- DESPESA DO PERÍODO (mantém filtro de data) - do ledger
  SELECT COALESCE(SUM(fl.amount), 0) INTO v_total_expense
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = v_user_id
    AND fa.type = 'expense'
    AND ft.is_void = false
    AND ft.status = 'completed'
    AND ft.transaction_date >= v_effective_start
    AND ft.transaction_date <= v_effective_end;

  -- SALDO EM CAIXA (total histórico) - do ledger
  SELECT COALESCE(SUM(fl.amount), 0) INTO v_cash_balance
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = v_user_id
    AND fa.type = 'asset'
    AND fa.status = 'active'
    AND ft.is_void = false;

  -- RECEITA PENDENTE (TOTAL HISTÓRICO) - da tabela transactions
  SELECT COALESCE(SUM(t.amount), 0) INTO v_pending_income
  FROM transactions t
  WHERE t.user_id = v_user_id
    AND t.status = 'PENDENTE'
    AND UPPER(t.nature) = 'RECEITA';

  -- DESPESA PENDENTE (TOTAL HISTÓRICO) - da tabela transactions
  SELECT COALESCE(SUM(t.amount), 0) INTO v_pending_expense
  FROM transactions t
  WHERE t.user_id = v_user_id
    AND t.status = 'PENDENTE'
    AND UPPER(t.nature) = 'DESPESA';

  RETURN json_build_object(
    'totalIncome', v_total_income,
    'totalExpense', v_total_expense,
    'cashBalance', v_cash_balance,
    'pendingIncome', v_pending_income,
    'pendingExpense', v_pending_expense,
    'netResult', v_total_income - v_total_expense,
    'periodStart', v_effective_start,
    'periodEnd', v_effective_end
  );
END;
$function$;

-- ============================================================
-- CORREÇÃO: get_total_pending_receivables - UPPERCASE
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_total_pending_receivables()
RETURNS TABLE(total_amount NUMERIC, pending_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(t.amount), 0)::NUMERIC AS total_amount,
    COUNT(*)::INTEGER AS pending_count
  FROM transactions t
  WHERE t.user_id = v_user_id
    AND t.status = 'PENDENTE'
    AND UPPER(t.nature) = 'RECEITA';
END;
$function$;

-- ============================================================
-- CORREÇÃO: get_pending_this_month - UPPERCASE
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pending_this_month()
RETURNS TABLE(total_amount NUMERIC, pending_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_month_start date := date_trunc('month', CURRENT_DATE)::date;
  v_month_end date := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(t.amount), 0)::NUMERIC AS total_amount,
    COUNT(*)::INTEGER AS pending_count
  FROM transactions t
  WHERE t.user_id = v_user_id
    AND t.status = 'PENDENTE'
    AND UPPER(t.nature) = 'RECEITA'
    AND t.due_date >= v_month_start
    AND t.due_date <= v_month_end;
END;
$function$;
