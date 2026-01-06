-- =====================================================
-- FASE 26: URL SCOPED PORTAL
-- Adicionar slug às corretoras e criar RPCs scoped
-- =====================================================

-- 1. Adicionar coluna slug (inicialmente nullable para migração)
ALTER TABLE public.brokerages 
ADD COLUMN IF NOT EXISTS slug text;

-- 2. Gerar slugs para registros existentes baseado no nome
UPDATE public.brokerages 
SET slug = lower(
  regexp_replace(
    regexp_replace(name, '[^a-zA-Z0-9\s]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- 3. Garantir unicidade adicionando ID se houver duplicatas
UPDATE public.brokerages b1
SET slug = b1.slug || '-' || b1.id
WHERE EXISTS (
  SELECT 1 FROM public.brokerages b2 
  WHERE b2.slug = b1.slug AND b2.id < b1.id
);

-- 4. Tornar NOT NULL
ALTER TABLE public.brokerages 
ALTER COLUMN slug SET NOT NULL;

-- 5. Criar índice único
CREATE UNIQUE INDEX IF NOT EXISTS brokerages_slug_unique ON public.brokerages(slug);

-- =====================================================
-- RPC: get_brokerage_by_slug
-- Buscar dados da corretora pelo slug
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_brokerage_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brokerage record;
BEGIN
  SELECT id, name, logo_url, portal_enabled, 
         portal_show_policies, portal_show_cards, portal_allow_profile_edit, slug
  INTO v_brokerage 
  FROM brokerages 
  WHERE slug = lower(p_slug);
  
  IF v_brokerage.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Corretora não encontrada');
  END IF;
  
  IF v_brokerage.portal_enabled = false THEN
    RETURN jsonb_build_object('success', false, 'message', 'Portal desativado para esta corretora');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'brokerage', jsonb_build_object(
      'id', v_brokerage.id,
      'name', v_brokerage.name,
      'logo_url', v_brokerage.logo_url,
      'slug', v_brokerage.slug,
      'show_policies', COALESCE(v_brokerage.portal_show_policies, true),
      'show_cards', COALESCE(v_brokerage.portal_show_cards, true),
      'allow_profile_edit', COALESCE(v_brokerage.portal_allow_profile_edit, true)
    )
  );
END;
$$;

-- =====================================================
-- RPC: verify_portal_login_scoped
-- Login scoped por slug da corretora
-- =====================================================
CREATE OR REPLACE FUNCTION public.verify_portal_login_scoped(
  p_slug text,
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
  v_client clientes%ROWTYPE;
  v_normalized_identifier text;
BEGIN
  -- 1. Find brokerage by slug
  SELECT id, user_id, name, logo_url, slug INTO v_brokerage 
  FROM brokerages 
  WHERE slug = lower(p_slug);
  
  IF v_brokerage.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Corretora não encontrada'
    );
  END IF;
  
  -- 2. Normalize identifier (remove non-digits for CPF)
  v_normalized_identifier := regexp_replace(p_identifier, '\D', '', 'g');
  
  -- 3. Find client by CPF within this brokerage's user_id
  IF length(v_normalized_identifier) >= 11 THEN
    SELECT * INTO v_client 
    FROM clientes 
    WHERE cpf_cnpj = v_normalized_identifier
      AND user_id = v_brokerage.user_id
    LIMIT 1;
  END IF;
  
  -- 4. If not found by CPF, try by name
  IF v_client.id IS NULL THEN
    SELECT * INTO v_client 
    FROM clientes 
    WHERE lower(name) LIKE lower('%' || p_identifier || '%')
      AND user_id = v_brokerage.user_id
    LIMIT 1;
  END IF;
  
  -- 5. Client not found in this brokerage
  IF v_client.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Cliente não encontrado nesta corretora'
    );
  END IF;
  
  -- 6. Verify password
  IF v_client.portal_first_access = true OR v_client.portal_first_access IS NULL THEN
    IF p_password != '123456' THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'Senha incorreta. Use 123456 para primeiro acesso.'
      );
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'first_access', true,
      'brokerage', jsonb_build_object(
        'id', v_brokerage.id,
        'name', v_brokerage.name,
        'logo_url', v_brokerage.logo_url,
        'slug', v_brokerage.slug
      ),
      'client', jsonb_build_object(
        'id', v_client.id,
        'name', v_client.name,
        'cpf_cnpj', v_client.cpf_cnpj,
        'email', v_client.email,
        'phone', v_client.phone,
        'user_id', v_client.user_id,
        'portal_first_access', true,
        'portal_password', COALESCE(v_client.portal_password, '123456')
      )
    );
  ELSE
    IF v_client.portal_password IS DISTINCT FROM p_password THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'Senha incorreta'
      );
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'first_access', false,
      'brokerage', jsonb_build_object(
        'id', v_brokerage.id,
        'name', v_brokerage.name,
        'logo_url', v_brokerage.logo_url,
        'slug', v_brokerage.slug
      ),
      'client', jsonb_build_object(
        'id', v_client.id,
        'name', v_client.name,
        'cpf_cnpj', v_client.cpf_cnpj,
        'email', v_client.email,
        'phone', v_client.phone,
        'user_id', v_client.user_id,
        'portal_first_access', false,
        'portal_password', v_client.portal_password
      )
    );
  END IF;
END;
$$;