-- =============================================
-- CORREÇÃO: Busca de Apólices por CPF Normalizado
-- =============================================

-- Dropar função antiga com parâmetros diferentes
DROP FUNCTION IF EXISTS public.verify_portal_login_scoped(text, text, text);

-- Recriar verify_portal_login_scoped para comparar CPFs normalizados
CREATE OR REPLACE FUNCTION public.verify_portal_login_scoped(
  p_brokerage_slug text,
  p_identifier text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brokerage record;
  v_client record;
  v_is_first_access boolean;
  v_normalized_identifier text;
BEGIN
  -- Normaliza o identificador (remove formatação de CPF/CNPJ)
  v_normalized_identifier := regexp_replace(p_identifier, '\D', '', 'g');

  -- Busca a corretora pelo slug
  SELECT * INTO v_brokerage
  FROM brokerages
  WHERE slug = p_brokerage_slug
    AND portal_enabled = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Portal não encontrado ou desabilitado'
    );
  END IF;

  -- Busca o cliente pelo CPF/CNPJ NORMALIZADO (ambos os lados)
  -- Prioriza o cliente que tem mais apólices vinculadas
  SELECT * INTO v_client
  FROM clientes
  WHERE regexp_replace(cpf_cnpj, '\D', '', 'g') = v_normalized_identifier
    AND user_id = v_brokerage.user_id
  ORDER BY (SELECT COUNT(*) FROM apolices WHERE client_id = clientes.id) DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cliente não encontrado'
    );
  END IF;

  -- Verifica primeiro acesso
  v_is_first_access := v_client.portal_first_access IS NULL OR v_client.portal_first_access = true;

  -- Se primeiro acesso, senha deve ser o CPF
  IF v_is_first_access THEN
    IF v_normalized_identifier != regexp_replace(p_password, '\D', '', 'g') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Senha inválida. No primeiro acesso, use seu CPF como senha.'
      );
    END IF;
  ELSE
    -- Verifica senha normal
    IF v_client.portal_password IS NULL OR v_client.portal_password != p_password THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Senha incorreta'
      );
    END IF;
  END IF;

  -- Login bem-sucedido
  RETURN jsonb_build_object(
    'success', true,
    'client', jsonb_build_object(
      'id', v_client.id,
      'name', v_client.name,
      'email', v_client.email,
      'phone', v_client.phone,
      'cpf_cnpj', v_client.cpf_cnpj,
      'user_id', v_client.user_id
    ),
    'brokerage', jsonb_build_object(
      'id', v_brokerage.id,
      'name', v_brokerage.name,
      'slug', v_brokerage.slug,
      'logo_url', v_brokerage.logo_url
    ),
    'is_first_access', v_is_first_access
  );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.verify_portal_login_scoped(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_portal_login_scoped(text, text, text) TO authenticated;