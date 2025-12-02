CREATE OR REPLACE FUNCTION get_producao_por_ramo(
  p_user_id UUID,
  start_range TIMESTAMP WITH TIME ZONE,
  end_range TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  ramo_nome TEXT,
  total_apolices BIGINT,
  total_premio NUMERIC,
  total_comissao NUMERIC,
  taxa_media_comissao NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.nome as ramo_nome,
    COUNT(p.id) as total_apolices,
    COALESCE(SUM(p.premium_value), 0) as total_premio,
    COALESCE(SUM(p.premium_value * (p.commission_rate / 100)), 0) as total_comissao,
    CASE
      WHEN SUM(p.premium_value) > 0 THEN (SUM(p.premium_value * (p.commission_rate / 100)) / SUM(p.premium_value)) * 100
      ELSE 0
    END as taxa_media_comissao
  FROM
    apolices p
    JOIN ramos r ON p.ramo_id = r.id
  WHERE
    p.user_id = p_user_id
    AND p.start_date >= start_range::date
    AND p.start_date <= end_range::date
    AND p.status = 'Ativa'
  GROUP BY
    r.nome
  ORDER BY
    total_premio DESC;
END;
$$;
