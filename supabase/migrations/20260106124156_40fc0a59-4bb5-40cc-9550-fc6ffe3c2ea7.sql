-- 1. Create update_portal_profile RPC (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.update_portal_profile(
  p_client_id uuid,
  p_verify_password text,
  p_new_password text DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client record;
BEGIN
  -- 1. Fetch and verify identity
  SELECT id, portal_password, portal_first_access 
  INTO v_client 
  FROM clientes 
  WHERE id = p_client_id;
  
  IF v_client IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  -- Allow "123456" if first access, or exact password match
  IF v_client.portal_first_access = true AND p_verify_password = '123456' THEN
    -- OK, first access with default password
  ELSIF v_client.portal_password IS DISTINCT FROM p_verify_password THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha atual incorreta');
  END IF;

  -- 2. Update Password (if provided)
  IF p_new_password IS NOT NULL AND p_new_password != '' THEN
    UPDATE clientes SET 
      portal_password = p_new_password,
      portal_first_access = false,
      updated_at = now()
    WHERE id = p_client_id;
  END IF;

  -- 3. Update Personal Data (if provided)
  IF p_new_data IS NOT NULL THEN
    UPDATE clientes SET
      phone = COALESCE(p_new_data->>'phone', phone),
      email = COALESCE(p_new_data->>'email', email),
      address = COALESCE(p_new_data->>'address', address),
      city = COALESCE(p_new_data->>'city', city),
      state = COALESCE(p_new_data->>'state', state),
      cep = COALESCE(p_new_data->>'cep', cep),
      cpf_cnpj = COALESCE(p_new_data->>'cpf_cnpj', cpf_cnpj),
      birth_date = CASE 
        WHEN p_new_data->>'birth_date' IS NOT NULL AND p_new_data->>'birth_date' != '' 
        THEN (p_new_data->>'birth_date')::date 
        ELSE birth_date 
      END,
      updated_at = now()
    WHERE id = p_client_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Update verify_portal_login to return portal_password in the client object
CREATE OR REPLACE FUNCTION public.verify_portal_login(
  p_identifier text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client clientes%ROWTYPE;
  v_normalized_identifier text;
BEGIN
  -- Normalize identifier (remove non-digits for CPF check)
  v_normalized_identifier := regexp_replace(p_identifier, '\D', '', 'g');
  
  -- Try to find by CPF first (if identifier looks like CPF)
  IF length(v_normalized_identifier) >= 11 THEN
    SELECT * INTO v_client 
    FROM clientes 
    WHERE cpf_cnpj = v_normalized_identifier
    LIMIT 1;
  END IF;
  
  -- If not found by CPF, try by name (case insensitive partial match)
  IF v_client.id IS NULL THEN
    SELECT * INTO v_client 
    FROM clientes 
    WHERE lower(name) LIKE lower('%' || p_identifier || '%')
    LIMIT 1;
  END IF;
  
  -- Client not found
  IF v_client.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Cliente não encontrado'
    );
  END IF;
  
  -- Verify password
  -- First access: default password is "123456"
  IF v_client.portal_first_access = true OR v_client.portal_first_access IS NULL THEN
    IF p_password != '123456' THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'Senha incorreta. Use 123456 para primeiro acesso.'
      );
    END IF;
    
    -- First access success
    RETURN jsonb_build_object(
      'success', true,
      'first_access', true,
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
    -- Regular login: check stored password
    IF v_client.portal_password IS DISTINCT FROM p_password THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'Senha incorreta'
      );
    END IF;
    
    -- Login success
    RETURN jsonb_build_object(
      'success', true,
      'first_access', false,
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