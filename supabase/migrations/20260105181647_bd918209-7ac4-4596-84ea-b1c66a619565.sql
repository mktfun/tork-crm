-- =====================================================
-- FASE 22: Merge por Nome + Refinamentos
-- =====================================================

-- Atualizar RPC para também mesclar por Nome quando CPF é nulo
CREATE OR REPLACE FUNCTION public.merge_duplicate_clients(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merged_by_cpf INT := 0;
  v_merged_by_name INT := 0;
  v_transferred_apolices INT := 0;
  v_transferred_sinistros INT := 0;
  v_transferred_appointments INT := 0;
  v_transferred_transactions INT := 0;
  v_transferred_deals INT := 0;
  v_group RECORD;
  v_primary_id UUID;
  v_secondary_ids UUID[];
  v_secondary_id UUID;
  v_row_count INT;
BEGIN
  -- ========================================
  -- FASE 1: Merge por CPF/CNPJ (normalizado)
  -- ========================================
  FOR v_group IN (
    SELECT
      REGEXP_REPLACE(cpf_cnpj, '[^0-9]', '', 'g') as cpf_normalized,
      array_agg(id ORDER BY updated_at DESC, created_at DESC) as client_ids,
      count(*) as total
    FROM clientes
    WHERE user_id = p_user_id
      AND cpf_cnpj IS NOT NULL
      AND cpf_cnpj != ''
      AND LENGTH(REGEXP_REPLACE(cpf_cnpj, '[^0-9]', '', 'g')) >= 11
    GROUP BY REGEXP_REPLACE(cpf_cnpj, '[^0-9]', '', 'g')
    HAVING count(*) > 1
  ) LOOP
    v_primary_id := v_group.client_ids[1];
    v_secondary_ids := v_group.client_ids[2:array_length(v_group.client_ids, 1)];

    FOREACH v_secondary_id IN ARRAY v_secondary_ids LOOP
      -- Transferir apólices
      UPDATE apolices SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_apolices := v_transferred_apolices + v_row_count;

      -- Transferir sinistros
      UPDATE sinistros SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_sinistros := v_transferred_sinistros + v_row_count;

      -- Transferir agendamentos
      UPDATE appointments SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_appointments := v_transferred_appointments + v_row_count;

      -- Transferir transações
      UPDATE transactions SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_transactions := v_transferred_transactions + v_row_count;

      -- Transferir deals CRM
      UPDATE crm_deals SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_deals := v_transferred_deals + v_row_count;

      -- Remover birthday greetings duplicados
      DELETE FROM birthday_greetings WHERE client_id = v_secondary_id AND user_id = p_user_id;

      -- Deletar cliente secundário
      DELETE FROM clientes WHERE id = v_secondary_id AND user_id = p_user_id;
      v_merged_by_cpf := v_merged_by_cpf + 1;
    END LOOP;
  END LOOP;

  -- ========================================
  -- FASE 2: Merge por Nome (para clientes SEM CPF válido)
  -- ========================================
  FOR v_group IN (
    SELECT
      lower(trim(name)) as name_normalized,
      array_agg(id ORDER BY updated_at DESC, created_at DESC) as client_ids,
      count(*) as total
    FROM clientes
    WHERE user_id = p_user_id
      AND (cpf_cnpj IS NULL OR cpf_cnpj = '' OR LENGTH(REGEXP_REPLACE(cpf_cnpj, '[^0-9]', '', 'g')) < 11)
      AND name IS NOT NULL 
      AND trim(name) != ''
    GROUP BY lower(trim(name))
    HAVING count(*) > 1
  ) LOOP
    v_primary_id := v_group.client_ids[1];
    v_secondary_ids := v_group.client_ids[2:array_length(v_group.client_ids, 1)];

    FOREACH v_secondary_id IN ARRAY v_secondary_ids LOOP
      -- Transferir apólices
      UPDATE apolices SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_apolices := v_transferred_apolices + v_row_count;

      -- Transferir sinistros
      UPDATE sinistros SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_sinistros := v_transferred_sinistros + v_row_count;

      -- Transferir agendamentos
      UPDATE appointments SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_appointments := v_transferred_appointments + v_row_count;

      -- Transferir transações
      UPDATE transactions SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_transactions := v_transferred_transactions + v_row_count;

      -- Transferir deals CRM
      UPDATE crm_deals SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_deals := v_transferred_deals + v_row_count;

      -- Remover birthday greetings duplicados
      DELETE FROM birthday_greetings WHERE client_id = v_secondary_id AND user_id = p_user_id;

      -- Deletar cliente secundário
      DELETE FROM clientes WHERE id = v_secondary_id AND user_id = p_user_id;
      v_merged_by_name := v_merged_by_name + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'merged_by_cpf', v_merged_by_cpf,
    'merged_by_name', v_merged_by_name,
    'merged_clients', v_merged_by_cpf + v_merged_by_name,
    'transferred_apolices', v_transferred_apolices,
    'transferred_sinistros', v_transferred_sinistros,
    'transferred_appointments', v_transferred_appointments,
    'transferred_transactions', v_transferred_transactions,
    'transferred_deals', v_transferred_deals
  );
END;
$$;

-- Índice para busca por nome normalizado
CREATE INDEX IF NOT EXISTS idx_clientes_name_lower
ON public.clientes (lower(trim(name)));

-- =====================================================
-- FIM DA MIGRAÇÃO FASE 22
-- =====================================================