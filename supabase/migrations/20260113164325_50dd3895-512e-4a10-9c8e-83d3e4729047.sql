CREATE OR REPLACE FUNCTION get_financial_summary(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  -- RECEITA DO PERÍODO (mantém filtro de data)
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

  -- DESPESA DO PERÍODO (mantém filtro de data)
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

  -- SALDO EM CAIXA (total histórico)
  SELECT COALESCE(SUM(fl.amount), 0) INTO v_cash_balance
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = v_user_id
    AND fa.type = 'asset'
    AND fa.status = 'active'
    AND (ft.is_void = false OR ft.is_void IS NULL);

  -- RECEITA PENDENTE: TOTAL HISTÓRICO (sem filtro de data)
  SELECT COALESCE(ABS(SUM(fl.amount)), 0) INTO v_pending_income
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = v_user_id
    AND fa.type = 'revenue'
    AND (ft.is_void = false OR ft.is_void IS NULL)
    AND ft.status = 'pending';

  -- DESPESA PENDENTE: TOTAL HISTÓRICO (sem filtro de data)
  SELECT COALESCE(SUM(fl.amount), 0) INTO v_pending_expense
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = v_user_id
    AND fa.type = 'expense'
    AND (ft.is_void = false OR ft.is_void IS NULL)
    AND ft.status = 'pending';

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
$$;