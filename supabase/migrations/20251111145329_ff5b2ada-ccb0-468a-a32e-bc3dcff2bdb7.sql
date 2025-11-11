-- Corrigir a função get_faturamento_data para usar timestamptz com fuso horário correto
CREATE OR REPLACE FUNCTION public.get_faturamento_data(
  p_user_id UUID,
  p_start_date TEXT,
  p_end_date TEXT,
  p_company_id TEXT DEFAULT 'all',
  p_client_id UUID DEFAULT NULL,
  p_nature TEXT DEFAULT NULL,
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
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
BEGIN
  -- Validação de segurança: usuário só pode ver seus próprios dados
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: você só pode visualizar seus próprios dados';
  END IF;
  
  -- 1. Converter strings para TIMESTAMPTZ no fuso horário de São Paulo
  -- Isso garante que '2025-10-01' seja interpretado como '2025-10-01 00:00:00-03' (BRT)
  -- e não como '2025-10-01 00:00:00+00' (UTC)
  v_start_date := (p_start_date::DATE) AT TIME ZONE 'America/Sao_Paulo';
  
  -- Para o fim do dia, adiciona 1 dia e subtrai 1 segundo para pegar até 23:59:59
  v_end_date := (p_end_date::DATE + INTERVAL '1 day' - INTERVAL '1 second') AT TIME ZONE 'America/Sao_Paulo';
  
  -- 2. Calcular offset para paginação
  v_offset := (p_page - 1) * p_page_size;
  
  -- 3. Buscar transações paginadas
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
    json_agg(t ORDER BY t.date DESC) FILTER (WHERE t.id IS NOT NULL),
    COUNT(*)
  INTO v_transactions, v_total_count
  FROM (
    SELECT * FROM filtered_transactions
    ORDER BY date DESC
    LIMIT p_page_size OFFSET v_offset
  ) t;
  
  -- 4. Calcular métricas (sem paginação)
  WITH filtered_metrics AS (
    SELECT amount, status, nature
    FROM public.transactions
    WHERE user_id = p_user_id
      AND date >= v_start_date
      AND date <= v_end_date
      AND (p_company_id = 'all' OR company_id = p_company_id)
      AND (p_client_id IS NULL OR client_id = p_client_id)
  )
  SELECT json_build_object(
    'totalGanhos', COALESCE(SUM(amount) FILTER (
      WHERE status IN ('REALIZADO', 'PAGO') 
      AND nature IN ('GANHO', 'RECEITA')
    ), 0),
    'totalPerdas', COALESCE(SUM(amount) FILTER (
      WHERE status IN ('REALIZADO', 'PAGO') 
      AND nature IN ('PERDA', 'DESPESA')
    ), 0),
    'totalPrevisto', COALESCE(
      SUM(amount) FILTER (
        WHERE status IN ('PREVISTO', 'PENDENTE', 'PARCIALMENTE_PAGO') 
        AND nature IN ('GANHO', 'RECEITA')
      ) - 
      SUM(amount) FILTER (
        WHERE status IN ('PREVISTO', 'PENDENTE', 'PARCIALMENTE_PAGO') 
        AND nature IN ('PERDA', 'DESPESA')
      ), 0
    )
  ) INTO v_metrics
  FROM filtered_metrics;
  
  -- 5. Calcular saldoLiquido
  v_metrics := jsonb_set(
    v_metrics::jsonb,
    '{saldoLiquido}',
    ((v_metrics->>'totalGanhos')::NUMERIC - (v_metrics->>'totalPerdas')::NUMERIC)::TEXT::jsonb
  )::JSON;
  
  -- 6. Retornar tudo em um único JSON
  RETURN json_build_object(
    'transactions', COALESCE(v_transactions, '[]'::json),
    'totalCount', v_total_count,
    'metrics', v_metrics
  );
END;
$$;