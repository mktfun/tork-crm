-- Função RPC para login seguro no portal (bypassa RLS de forma controlada)
CREATE OR REPLACE FUNCTION public.verify_portal_login(p_identifier text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_cpf text;
  v_client record;
  v_count int;
BEGIN
  -- Limpa input para ver se é CPF
  v_clean_cpf := regexp_replace(p_identifier, '\D', '', 'g');
  
  -- Busca hierárquica: CPF primeiro, depois Nome
  IF length(v_clean_cpf) >= 6 THEN
    -- Busca por CPF (limpo ou com pontuação)
    SELECT * INTO v_client
    FROM clientes
    WHERE 
      regexp_replace(cpf_cnpj, '\D', '', 'g') = v_clean_cpf
      OR cpf_cnpj ILIKE '%' || v_clean_cpf || '%'
    LIMIT 1;
  END IF;
  
  -- Se não achou por CPF, tenta por Nome
  IF v_client IS NULL THEN
    -- Conta quantos clientes têm esse nome
    SELECT count(*) INTO v_count
    FROM clientes
    WHERE name ILIKE '%' || trim(p_identifier) || '%';
    
    -- Se múltiplos, não permite (segurança)
    IF v_count > 1 THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'Nome duplicado. Use seu CPF para entrar.'
      );
    END IF;
    
    SELECT * INTO v_client
    FROM clientes
    WHERE name ILIKE '%' || trim(p_identifier) || '%'
    LIMIT 1;
  END IF;

  -- Cliente não encontrado
  IF v_client IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cliente não encontrado');
  END IF;

  -- Verifica primeiro acesso (senha padrão 123456)
  IF v_client.portal_first_access = true AND p_password = '123456' THEN
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
        'portal_first_access', v_client.portal_first_access
      )
    );
  END IF;

  -- Verifica senha
  IF v_client.portal_password IS NULL OR v_client.portal_password != p_password THEN
    RETURN jsonb_build_object('success', false, 'message', 'Senha incorreta');
  END IF;

  -- Sucesso
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
      'portal_first_access', v_client.portal_first_access
    )
  );
END;
$$;