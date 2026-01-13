-- =====================================================
-- FASE 1: LOGIN HÍBRIDO (CPF, Email ou Nome)
-- =====================================================

DROP FUNCTION IF EXISTS public.verify_portal_login_scoped(text, text, text);

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
  v_normalized_cpf text;
  v_normalized_input_password text;
BEGIN
  -- Normaliza CPF/CNPJ (remove tudo que não é número)
  v_normalized_cpf := regexp_replace(COALESCE(p_identifier, ''), '\D', '', 'g');

  -- Busca corretora pelo slug
  SELECT * INTO v_brokerage FROM brokerages 
  WHERE slug = p_brokerage_slug AND portal_enabled = true LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portal não encontrado ou desativado');
  END IF;

  -- TENTATIVA 1: Buscar por CPF normalizado (11+ dígitos)
  IF length(v_normalized_cpf) >= 11 THEN
    SELECT * INTO v_client FROM clientes
    WHERE regexp_replace(COALESCE(cpf_cnpj, ''), '\D', '', 'g') = v_normalized_cpf
      AND user_id = v_brokerage.user_id
    ORDER BY (SELECT COUNT(*) FROM apolices WHERE client_id = clientes.id) DESC
    LIMIT 1;
  END IF;

  -- TENTATIVA 2: Buscar por Email (exato, case-insensitive)
  IF NOT FOUND THEN
    SELECT * INTO v_client FROM clientes
    WHERE lower(trim(email)) = lower(trim(p_identifier))
      AND user_id = v_brokerage.user_id
    ORDER BY (SELECT COUNT(*) FROM apolices WHERE client_id = clientes.id) DESC
    LIMIT 1;
  END IF;

  -- TENTATIVA 3: Buscar por Nome (apenas se ÚNICO - sem duplicatas)
  IF NOT FOUND THEN
    SELECT * INTO v_client FROM clientes
    WHERE lower(trim(name)) = lower(trim(p_identifier))
      AND user_id = v_brokerage.user_id
      AND (SELECT COUNT(*) FROM clientes c2 
           WHERE lower(trim(c2.name)) = lower(trim(p_identifier)) 
           AND c2.user_id = v_brokerage.user_id) = 1
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado. Verifique seu CPF, e-mail ou nome.');
  END IF;

  -- Verificar se é primeiro acesso
  v_is_first_access := v_client.portal_first_access IS NULL OR v_client.portal_first_access = true;

  IF v_is_first_access THEN
    -- Senha padrão para primeiro acesso:
    -- Se cliente tem CPF: senha = CPF (só números)
    -- Se cliente NÃO tem CPF: senha = "123456"
    v_normalized_input_password := regexp_replace(COALESCE(p_password, ''), '\D', '', 'g');
    
    IF v_client.cpf_cnpj IS NOT NULL AND length(regexp_replace(v_client.cpf_cnpj, '\D', '', 'g')) >= 11 THEN
      IF regexp_replace(v_client.cpf_cnpj, '\D', '', 'g') != v_normalized_input_password THEN
        RETURN jsonb_build_object('success', false, 'error', 'Primeiro acesso: use seu CPF como senha.');
      END IF;
    ELSE
      IF p_password != '123456' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Primeiro acesso: use a senha 123456.');
      END IF;
    END IF;
  ELSE
    -- Verificar senha cadastrada
    IF v_client.portal_password IS NULL OR v_client.portal_password != p_password THEN
      RETURN jsonb_build_object('success', false, 'error', 'Senha incorreta.');
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

GRANT EXECUTE ON FUNCTION public.verify_portal_login_scoped(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_portal_login_scoped(text, text, text) TO authenticated;

-- =====================================================
-- FASE 2: BUSCA HÍBRIDA DE APÓLICES (client_id + CPF + Email)
-- =====================================================

DROP FUNCTION IF EXISTS public.get_portal_policies_hybrid(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_portal_policies_hybrid(
  p_user_id uuid,
  p_client_id uuid,
  p_cpf text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  insured_asset text,
  expiration_date date,
  start_date date,
  policy_number text,
  insurance_company uuid,
  type text,
  status text,
  premium_value numeric,
  pdf_url text,
  pdf_attached_data text,
  pdf_attached_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_cpf text;
BEGIN
  v_normalized_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');

  RETURN QUERY
  SELECT DISTINCT 
    a.id,
    a.insured_asset,
    a.expiration_date,
    a.start_date,
    a.policy_number,
    a.insurance_company,
    a.type,
    a.status,
    a.premium_value,
    a.pdf_url,
    a.pdf_attached_data,
    a.pdf_attached_name
  FROM apolices a
  INNER JOIN clientes c ON a.client_id = c.id
  WHERE c.user_id = p_user_id
    AND (
      -- Busca por client_id direto
      a.client_id = p_client_id
      -- OU por CPF normalizado (clientes duplicados)
      OR (
        v_normalized_cpf != '' 
        AND length(v_normalized_cpf) >= 11
        AND regexp_replace(COALESCE(c.cpf_cnpj, ''), '\D', '', 'g') = v_normalized_cpf
      )
      -- OU por email (último recurso)
      OR (
        p_email IS NOT NULL 
        AND p_email != ''
        AND lower(trim(c.email)) = lower(trim(p_email))
      )
    )
  ORDER BY a.expiration_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_policies_hybrid(uuid, uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_portal_policies_hybrid(uuid, uuid, text, text) TO authenticated;

-- =====================================================
-- FASE 2B: BUSCA HÍBRIDA PARA CARTEIRINHAS (apenas ativas)
-- =====================================================

DROP FUNCTION IF EXISTS public.get_portal_cards_hybrid(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_portal_cards_hybrid(
  p_user_id uuid,
  p_client_id uuid,
  p_cpf text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  insured_asset text,
  expiration_date date,
  start_date date,
  policy_number text,
  insurance_company uuid,
  type text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_cpf text;
BEGIN
  v_normalized_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');

  RETURN QUERY
  SELECT DISTINCT 
    a.id,
    a.insured_asset,
    a.expiration_date,
    a.start_date,
    a.policy_number,
    a.insurance_company,
    a.type,
    a.status
  FROM apolices a
  INNER JOIN clientes c ON a.client_id = c.id
  WHERE c.user_id = p_user_id
    AND a.status = 'Ativa'
    AND a.expiration_date >= CURRENT_DATE
    AND (
      a.client_id = p_client_id
      OR (
        v_normalized_cpf != '' 
        AND length(v_normalized_cpf) >= 11
        AND regexp_replace(COALESCE(c.cpf_cnpj, ''), '\D', '', 'g') = v_normalized_cpf
      )
      OR (
        p_email IS NOT NULL 
        AND p_email != ''
        AND lower(trim(c.email)) = lower(trim(p_email))
      )
    )
  ORDER BY a.expiration_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_cards_hybrid(uuid, uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_portal_cards_hybrid(uuid, uuid, text, text) TO authenticated;