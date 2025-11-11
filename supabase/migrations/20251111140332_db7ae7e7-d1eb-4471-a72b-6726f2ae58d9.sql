-- Criar função RPC para agregar produção por ramo
-- Esta função faz JOIN direto entre apólices e ramos, agrupando por nome do ramo
-- Usa start_date (data de vigência) para filtrar, não created_at

CREATE OR REPLACE FUNCTION get_producao_por_ramo(
  p_user_id uuid,
  start_range timestamptz,
  end_range timestamptz
)
RETURNS TABLE(
  ramo_nome text,
  total_apolices bigint,
  total_premio numeric,
  total_comissao numeric,
  taxa_media_comissao numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(r.nome, 'Não Informado') AS ramo_nome,
    COUNT(a.id) AS total_apolices,
    COALESCE(SUM(a.premium_value), 0) AS total_premio,
    COALESCE(SUM((a.premium_value * a.commission_rate) / 100), 0) AS total_comissao,
    CASE 
      WHEN COALESCE(SUM(a.premium_value), 0) > 0 
      THEN (COALESCE(SUM((a.premium_value * a.commission_rate) / 100), 0) / COALESCE(SUM(a.premium_value), 1)) * 100
      ELSE 0
    END AS taxa_media_comissao
  FROM
    public.apolices a
  LEFT JOIN
    public.ramos r ON a.ramo_id = r.id AND r.user_id = p_user_id
  WHERE
    a.user_id = p_user_id
    AND a.user_id = auth.uid() -- Security: ensure user can only access their own data
    AND a.start_date >= start_range::date
    AND a.start_date <= end_range::date
    AND a.status = 'Ativa' -- Apenas apólices ativas
  GROUP BY
    r.nome
  ORDER BY
    total_premio DESC;
END;
$$;