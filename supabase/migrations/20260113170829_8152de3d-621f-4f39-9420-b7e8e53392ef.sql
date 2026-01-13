-- Drop e recria função com novos campos no retorno
DROP FUNCTION IF EXISTS public.get_revenue_transactions(date, date, integer);

CREATE OR REPLACE FUNCTION public.get_revenue_transactions(
  p_start_date date, 
  p_end_date date, 
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
  related_entity_id text,
  related_entity_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (ft.id)
    ft.id,
    ft.description,
    ft.transaction_date::DATE as transaction_date,
    ABS(fl.amount) as amount,
    fa.name as account_name,
    (COALESCE(ft.status, 'pending') IN ('completed', 'settled')) as is_confirmed,
    COALESCE(ft.status, 'pending') as legacy_status,
    COALESCE(c.name, 'Cliente não informado') as client_name,
    a.policy_number,
    ft.related_entity_id::text as related_entity_id,
    ft.related_entity_type as related_entity_type
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  LEFT JOIN apolices a ON ft.related_entity_type = 'policy' 
    AND ft.related_entity_id::UUID = a.id
  LEFT JOIN clientes c ON a.client_id = c.id
  WHERE ft.user_id = auth.uid()
    AND ft.transaction_date BETWEEN p_start_date AND p_end_date
    AND ft.is_void = false
    AND fa.type = 'revenue'
    AND fl.amount < 0
  ORDER BY ft.id, ft.transaction_date DESC
  LIMIT p_limit;
END;
$function$;