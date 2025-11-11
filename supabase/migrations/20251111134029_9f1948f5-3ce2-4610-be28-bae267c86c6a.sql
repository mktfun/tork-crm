-- Criar função RPC para calcular KPIs de clientes de forma eficiente
CREATE OR REPLACE FUNCTION get_client_kpis(p_user_id uuid, p_search_term text DEFAULT NULL, p_status text DEFAULT 'todos')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_active_clients int;
  v_new_clients_30d int;
  v_clients_with_policies int;
  v_total_commission numeric;
BEGIN
  -- Contar clientes ativos (com filtros aplicados)
  SELECT COUNT(*)
  INTO v_total_active_clients
  FROM clientes c
  WHERE c.user_id = p_user_id 
    AND (p_status = 'todos' OR c.status = p_status)
    AND c.status = 'Ativo'
    AND (
      p_search_term IS NULL 
      OR p_search_term = '' 
      OR c.name ILIKE '%' || p_search_term || '%'
      OR c.email ILIKE '%' || p_search_term || '%'
      OR c.cpf_cnpj ILIKE '%' || p_search_term || '%'
    );

  -- Contar novos clientes (últimos 30 dias, com filtros)
  SELECT COUNT(*)
  INTO v_new_clients_30d
  FROM clientes c
  WHERE c.user_id = p_user_id 
    AND (p_status = 'todos' OR c.status = p_status)
    AND c.created_at >= (now() - interval '30 days')
    AND (
      p_search_term IS NULL 
      OR p_search_term = '' 
      OR c.name ILIKE '%' || p_search_term || '%'
      OR c.email ILIKE '%' || p_search_term || '%'
      OR c.cpf_cnpj ILIKE '%' || p_search_term || '%'
    );

  -- Contar clientes com apólices ativas e calcular comissão total
  SELECT
    COUNT(DISTINCT c.id),
    COALESCE(SUM((a.premium_value * a.commission_rate) / 100), 0)
  INTO
    v_clients_with_policies,
    v_total_commission
  FROM clientes c
  INNER JOIN apolices a ON c.id = a.client_id
  WHERE c.user_id = p_user_id 
    AND a.status = 'Ativa'
    AND (p_status = 'todos' OR c.status = p_status)
    AND (
      p_search_term IS NULL 
      OR p_search_term = '' 
      OR c.name ILIKE '%' || p_search_term || '%'
      OR c.email ILIKE '%' || p_search_term || '%'
      OR c.cpf_cnpj ILIKE '%' || p_search_term || '%'
    );

  RETURN jsonb_build_object(
    'totalActive', v_total_active_clients,
    'newClientsLast30d', v_new_clients_30d,
    'clientsWithPolicies', v_clients_with_policies,
    'totalCommission', v_total_commission
  );
END;
$$;