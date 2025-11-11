-- Create RPC function for billing data with proper date handling
CREATE OR REPLACE FUNCTION public.get_faturamento_data(
  p_user_id UUID,
  p_start_date TEXT,
  p_end_date TEXT,
  p_company_id TEXT DEFAULT 'all',
  p_client_id UUID DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INT;
  v_transactions JSON;
  v_total_count INT;
  v_metrics JSON;
  v_start_date DATE;
  v_end_date DATE;
  v_total_ganhos NUMERIC;
  v_total_perdas NUMERIC;
  v_total_previsto NUMERIC;
BEGIN
  -- Validate user access
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: você só pode visualizar seus próprios dados';
  END IF;

  -- Convert strings to DATE (no time, no timezone)
  v_start_date := p_start_date::DATE;
  v_end_date := p_end_date::DATE;
  
  -- Calculate offset for pagination
  v_offset := (p_page - 1) * p_page_size;
  
  -- Fetch paginated transactions
  WITH filtered_transactions AS (
    SELECT *
    FROM public.transactions
    WHERE user_id = p_user_id
      AND date >= v_start_date
      AND date <= v_end_date
      AND (p_company_id = 'all' OR company_id = p_company_id)
      AND (p_client_id IS NULL OR client_id = p_client_id)
  )
  SELECT 
    COALESCE(json_agg(t ORDER BY t.date DESC), '[]'::json),
    COUNT(*)
  INTO v_transactions, v_total_count
  FROM (
    SELECT * FROM filtered_transactions
    ORDER BY date DESC
    LIMIT p_page_size OFFSET v_offset
  ) t;
  
  -- Calculate metrics (without pagination)
  WITH filtered_metrics AS (
    SELECT amount, status, nature
    FROM public.transactions
    WHERE user_id = p_user_id
      AND date >= v_start_date
      AND date <= v_end_date
      AND (p_company_id = 'all' OR company_id = p_company_id)
      AND (p_client_id IS NULL OR client_id = p_client_id)
  )
  SELECT 
    COALESCE(SUM(amount) FILTER (
      WHERE status IN ('REALIZADO', 'PAGO') 
      AND nature IN ('GANHO', 'RECEITA')
    ), 0),
    COALESCE(SUM(amount) FILTER (
      WHERE status IN ('REALIZADO', 'PAGO') 
      AND nature IN ('PERDA', 'DESPESA')
    ), 0),
    COALESCE(
      SUM(amount) FILTER (
        WHERE status IN ('PREVISTO', 'PENDENTE', 'PARCIALMENTE_PAGO') 
        AND nature IN ('GANHO', 'RECEITA')
      ), 0
    ) - COALESCE(
      SUM(amount) FILTER (
        WHERE status IN ('PREVISTO', 'PENDENTE', 'PARCIALMENTE_PAGO') 
        AND nature IN ('PERDA', 'DESPESA')
      ), 0
    )
  INTO v_total_ganhos, v_total_perdas, v_total_previsto
  FROM filtered_metrics;
  
  -- Build metrics JSON
  v_metrics := json_build_object(
    'totalGanhos', v_total_ganhos,
    'totalPerdas', v_total_perdas,
    'totalPrevisto', v_total_previsto,
    'saldoLiquido', v_total_ganhos - v_total_perdas
  );
  
  -- Return everything in a single JSON
  RETURN json_build_object(
    'transactions', v_transactions,
    'totalCount', v_total_count,
    'metrics', v_metrics
  );
END;
$$;