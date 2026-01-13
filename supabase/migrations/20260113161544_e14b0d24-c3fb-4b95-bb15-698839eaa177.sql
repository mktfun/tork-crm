-- =====================================================
-- FASE 1: ATUALIZAR RPC get_financial_summary COM cashBalance
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_financial_summary(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  -- Definir período padrão (mês atual) se não informado
  v_effective_start := COALESCE(p_start_date, date_trunc('month', CURRENT_DATE)::date);
  v_effective_end := COALESCE(p_end_date, (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date);

  -- RECEITA DO PERÍODO: Soma de CRÉDITOS em contas de REVENUE (valores negativos no ledger)
  -- Apenas transações confirmadas (status = 'completed') e não anuladas
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

  -- DESPESA DO PERÍODO: Soma de DÉBITOS em contas de EXPENSE (valores positivos no ledger)
  -- Apenas transações confirmadas e não anuladas
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

  -- SALDO EM CAIXA: Acumulado histórico de todas as contas de ATIVO
  -- Soma de todos os movimentos (débitos - créditos) nas contas de ativo
  SELECT COALESCE(SUM(fl.amount), 0) INTO v_cash_balance
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = v_user_id
    AND fa.type = 'asset'
    AND fa.status = 'active'
    AND (ft.is_void = false OR ft.is_void IS NULL);

  -- RECEITA PENDENTE: Transações de receita com status 'pending'
  SELECT COALESCE(ABS(SUM(fl.amount)), 0) INTO v_pending_income
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = v_user_id
    AND fa.type = 'revenue'
    AND (ft.is_void = false OR ft.is_void IS NULL)
    AND ft.status = 'pending'
    AND ft.transaction_date >= v_effective_start
    AND ft.transaction_date <= v_effective_end;

  -- DESPESA PENDENTE: Transações de despesa com status 'pending'
  SELECT COALESCE(SUM(fl.amount), 0) INTO v_pending_expense
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = v_user_id
    AND fa.type = 'expense'
    AND (ft.is_void = false OR ft.is_void IS NULL)
    AND ft.status = 'pending'
    AND ft.transaction_date >= v_effective_start
    AND ft.transaction_date <= v_effective_end;

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

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.get_financial_summary(date, date) TO authenticated;

-- =====================================================
-- FASE 2: REDEFINIR VIEW financial_account_balances
-- Otimizada para filtrar transações anuladas corretamente
-- =====================================================

DROP VIEW IF EXISTS public.financial_account_balances;

CREATE VIEW public.financial_account_balances AS
SELECT 
  fa.id,
  fa.user_id,
  fa.name,
  fa.code,
  fa.description,
  fa.type,
  fa.parent_id,
  fa.is_system,
  fa.status,
  fa.created_at,
  fa.updated_at,
  COALESCE(
    SUM(fl.amount) FILTER (WHERE ft.is_void = false OR ft.is_void IS NULL), 
    0
  ) AS balance,
  COUNT(fl.id) FILTER (WHERE ft.is_void = false OR ft.is_void IS NULL) AS entry_count
FROM financial_accounts fa
LEFT JOIN financial_ledger fl ON fl.account_id = fa.id
LEFT JOIN financial_transactions ft ON ft.id = fl.transaction_id
WHERE fa.status = 'active'
GROUP BY fa.id, fa.user_id, fa.name, fa.code, fa.description, fa.type, 
         fa.parent_id, fa.is_system, fa.status, fa.created_at, fa.updated_at;

-- Comentário explicativo
COMMENT ON VIEW public.financial_account_balances IS 
'View que calcula o saldo de cada conta financeira baseado no ledger, excluindo transações anuladas (is_void = true)';

-- =====================================================
-- FASE 3: SCRIPT DE SANEAMENTO CONTÁBIL
-- Identifica e anula transações desbalanceadas
-- =====================================================

-- Função para sanitizar transações órfãs (sem entries no ledger)
CREATE OR REPLACE FUNCTION public.sanitize_orphan_transactions()
RETURNS TABLE(
  transaction_id uuid,
  description text,
  action_taken text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH orphans AS (
    SELECT ft.id, ft.description
    FROM financial_transactions ft
    LEFT JOIN financial_ledger fl ON fl.transaction_id = ft.id
    WHERE ft.user_id = auth.uid()
      AND ft.is_void = false
      AND fl.id IS NULL
  )
  UPDATE financial_transactions ft
  SET 
    is_void = true,
    void_reason = 'Transação órfã - sem lançamentos no ledger',
    voided_at = NOW(),
    voided_by = auth.uid()::text
  FROM orphans o
  WHERE ft.id = o.id
  RETURNING ft.id, ft.description, 'VOIDED - Orphan transaction'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sanitize_orphan_transactions() TO authenticated;

-- Função para identificar transações desbalanceadas (sem anular automaticamente)
CREATE OR REPLACE FUNCTION public.find_unbalanced_transactions()
RETURNS TABLE(
  transaction_id uuid,
  description text,
  transaction_date date,
  total_amount numeric,
  entry_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ft.id,
    ft.description,
    ft.transaction_date,
    SUM(fl.amount) as total_amount,
    COUNT(fl.id) as entry_count
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  WHERE ft.user_id = auth.uid()
    AND ft.is_void = false
  GROUP BY ft.id, ft.description, ft.transaction_date
  HAVING SUM(fl.amount) != 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_unbalanced_transactions() TO authenticated;