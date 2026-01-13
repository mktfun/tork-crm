-- =====================================================
-- FASE 2-3: Unificação de KPIs e Limpeza de Inconsistências
-- =====================================================

-- 1. DROP existing functions
DROP FUNCTION IF EXISTS public.audit_ledger_integrity();

-- 2. Criar RPC de auditoria de integridade contábil
CREATE OR REPLACE FUNCTION public.audit_ledger_integrity()
RETURNS TABLE (
  issue_type TEXT,
  transaction_id UUID,
  account_id UUID,
  description TEXT,
  amount NUMERIC
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

  -- 1. Transações desbalanceadas (soma != 0)
  RETURN QUERY
  SELECT 
    'UNBALANCED_TRANSACTION'::TEXT,
    ft.id,
    NULL::UUID,
    ft.description,
    SUM(fl.amount) as total
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  WHERE ft.user_id = v_user_id
    AND (ft.is_void = false OR ft.is_void IS NULL)
  GROUP BY ft.id, ft.description
  HAVING ABS(SUM(fl.amount)) > 0.01;

  -- 2. Contas de ativo com saldo negativo (problema contábil)
  RETURN QUERY
  SELECT 
    'NEGATIVE_ASSET_BALANCE'::TEXT,
    NULL::UUID,
    fa.id,
    fa.name,
    SUM(fl.amount) as balance
  FROM financial_accounts fa
  LEFT JOIN financial_ledger fl ON fl.account_id = fa.id
  LEFT JOIN financial_transactions ft ON ft.id = fl.transaction_id AND (ft.is_void = false OR ft.is_void IS NULL)
  WHERE fa.user_id = v_user_id
    AND fa.type = 'asset'
    AND fa.status = 'active'
  GROUP BY fa.id, fa.name
  HAVING SUM(fl.amount) < 0;

  -- 3. Transações órfãs (sem entries no ledger)
  RETURN QUERY
  SELECT 
    'ORPHAN_TRANSACTION'::TEXT,
    ft.id,
    NULL::UUID,
    ft.description,
    0::NUMERIC
  FROM financial_transactions ft
  LEFT JOIN financial_ledger fl ON fl.transaction_id = ft.id
  WHERE ft.user_id = v_user_id
    AND (ft.is_void = false OR ft.is_void IS NULL)
    AND fl.id IS NULL;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION public.audit_ledger_integrity() TO authenticated;