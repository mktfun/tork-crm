-- Primeiro dropar a função existente e recriar com novo retorno
DROP FUNCTION IF EXISTS public.get_revenue_transactions(date, date, integer);

-- Recriar com legacy_status incluído
CREATE OR REPLACE FUNCTION public.get_revenue_transactions(
  p_start_date date,
  p_end_date date,
  p_limit integer DEFAULT 50
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
  legacy_status text
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
    ft.reference_number,
    ft.created_at,
    COALESCE(ft.is_void, false) as is_void,
    COALESCE(
      (SELECT SUM(ABS(fl.amount)) / 2 
       FROM financial_ledger fl 
       WHERE fl.transaction_id = ft.id),
      0
    ) as total_amount,
    (SELECT string_agg(DISTINCT fa.name, ', ')
     FROM financial_ledger fl2
     JOIN financial_accounts fa ON fl2.account_id = fa.id
     WHERE fl2.transaction_id = ft.id
       AND fa.type = 'revenue'
    ) as account_names,
    -- Buscar status da transação legada vinculada
    (SELECT t.status 
     FROM transactions t 
     WHERE t.id::text = ft.related_entity_id 
     LIMIT 1
    ) as legacy_status
  FROM financial_transactions ft
  WHERE ft.user_id = auth.uid()
    AND ft.is_void = false
    AND ft.transaction_date BETWEEN p_start_date AND p_end_date
    -- Filtrar apenas transações de receita (têm ledger entry com conta de receita)
    AND EXISTS (
      SELECT 1 
      FROM financial_ledger fl3
      JOIN financial_accounts fa3 ON fl3.account_id = fa3.id
      WHERE fl3.transaction_id = ft.id
        AND fa3.type = 'revenue'
    )
  ORDER BY ft.transaction_date DESC, ft.created_at DESC
  LIMIT p_limit;
END;
$$;