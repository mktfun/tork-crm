-- FIX: Corrigir erro de escopo da CTE "filtered" na função get_faturamento_data
-- Problema: A CTE 'filtered' só existe dentro do escopo do WITH statement
-- Solução: Calcular transações E métricas dentro do MESMO WITH

DROP FUNCTION IF EXISTS public.get_faturamento_data(uuid, text, text, text, uuid, integer, integer, text);

CREATE OR REPLACE FUNCTION public.get_faturamento_data(
  p_user_id uuid,
  p_start_date text,
  p_end_date text,
  p_company_id text DEFAULT 'all',
  p_client_id uuid DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_timezone text DEFAULT 'America/Sao_Paulo'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
  v_offset integer;
  v_result json;
BEGIN
  -- INTERPRETAR DATAS NO FUSO CORRETO
  v_start := ((p_start_date || ' 00:00:00')::timestamp AT TIME ZONE p_timezone);
  v_end   := ((p_end_date   || ' 23:59:59.999')::timestamp AT TIME ZONE p_timezone);

  v_offset := (p_page - 1) * p_page_size;

  -- 🎯 SOLUÇÃO: Tudo calculado dentro de UM ÚNICO WITH statement
  WITH filtered AS (
    SELECT *
    FROM public.transactions
    WHERE user_id = p_user_id
      AND date >= v_start
      AND date <= v_end
      AND (p_company_id = 'all' OR company_id = p_company_id)
      AND (p_client_id IS NULL OR client_id = p_client_id)
  ),
  page_data AS (
    SELECT *
    FROM filtered
    ORDER BY date DESC
    LIMIT p_page_size OFFSET v_offset
  ),
  metrics_calc AS (
    SELECT 
      COALESCE(SUM(amount) FILTER (WHERE nature = 'RECEITA' OR nature = 'GANHO'), 0) as total_ganhos,
      COALESCE(SUM(amount) FILTER (WHERE nature = 'DESPESA' OR nature = 'PERDA'), 0) as total_perdas,
      COALESCE(SUM(amount), 0) as saldo_liquido,
      COALESCE(SUM(amount) FILTER (WHERE status = 'PREVISTO'), 0) as total_previsto
    FROM filtered
  ),
  count_calc AS (
    SELECT COUNT(*) as total
    FROM filtered
  )
  SELECT json_build_object(
    'transactions', COALESCE((SELECT json_agg(p ORDER BY p.date DESC) FROM page_data p), '[]'::json),
    'totalCount', (SELECT total FROM count_calc),
    'metrics', (
      SELECT json_build_object(
        'totalGanhos', total_ganhos,
        'totalPerdas', total_perdas,
        'saldoLiquido', saldo_liquido,
        'totalPrevisto', total_previsto
      ) FROM metrics_calc
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;