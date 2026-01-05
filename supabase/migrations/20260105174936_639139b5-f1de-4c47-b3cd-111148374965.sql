-- =====================================================
-- FASE 21: Portal do Cliente + Merge Duplicates RPC
-- =====================================================

-- 1. Adicionar campos de portal ao cliente
ALTER TABLE public.clientes 
  ADD COLUMN IF NOT EXISTS portal_password TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS portal_first_access BOOLEAN DEFAULT TRUE;

-- Comentários
COMMENT ON COLUMN public.clientes.portal_password IS 'Senha do cliente para acesso ao portal';
COMMENT ON COLUMN public.clientes.portal_first_access IS 'Flag indicando primeiro acesso (senha padrão 123456)';

-- 2. Adicionar configurações de portal às corretoras
ALTER TABLE public.brokerages 
  ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portal_show_cards BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS portal_show_policies BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS portal_allow_profile_edit BOOLEAN DEFAULT TRUE;

-- Comentários
COMMENT ON COLUMN public.brokerages.portal_enabled IS 'Habilita o portal do cliente para esta corretora';
COMMENT ON COLUMN public.brokerages.portal_show_cards IS 'Exibe carteirinhas no portal';
COMMENT ON COLUMN public.brokerages.portal_show_policies IS 'Exibe apólices no portal';
COMMENT ON COLUMN public.brokerages.portal_allow_profile_edit IS 'Permite edição de perfil no portal';

-- 3. Criar RPC para fusão de clientes duplicados
CREATE OR REPLACE FUNCTION public.merge_duplicate_clients(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merged_count INT := 0;
  v_transferred_apolices INT := 0;
  v_transferred_sinistros INT := 0;
  v_transferred_appointments INT := 0;
  v_transferred_transactions INT := 0;
  v_group RECORD;
  v_primary_id UUID;
  v_secondary_ids UUID[];
  v_secondary_id UUID;
  v_row_count INT;
BEGIN
  -- Identificar grupos de duplicatas por CPF/CNPJ (normalizado, sem pontuação)
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
    -- O primeiro (mais recente) é o principal
    v_primary_id := v_group.client_ids[1];
    v_secondary_ids := v_group.client_ids[2:array_length(v_group.client_ids, 1)];
    
    FOREACH v_secondary_id IN ARRAY v_secondary_ids LOOP
      -- Transferir apólices
      UPDATE apolices 
      SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_apolices := v_transferred_apolices + v_row_count;
      
      -- Transferir sinistros
      UPDATE sinistros 
      SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_sinistros := v_transferred_sinistros + v_row_count;
      
      -- Transferir agendamentos
      UPDATE appointments 
      SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_appointments := v_transferred_appointments + v_row_count;
      
      -- Transferir transações financeiras
      UPDATE transactions 
      SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_transferred_transactions := v_transferred_transactions + v_row_count;
      
      -- Transferir deals do CRM
      UPDATE crm_deals 
      SET client_id = v_primary_id, updated_at = NOW()
      WHERE client_id = v_secondary_id AND user_id = p_user_id;
      
      -- Transferir birthday greetings
      DELETE FROM birthday_greetings WHERE client_id = v_secondary_id AND user_id = p_user_id;
      
      -- Deletar cliente secundário
      DELETE FROM clientes WHERE id = v_secondary_id AND user_id = p_user_id;
      v_merged_count := v_merged_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'merged_clients', v_merged_count,
    'transferred_apolices', v_transferred_apolices,
    'transferred_sinistros', v_transferred_sinistros,
    'transferred_appointments', v_transferred_appointments,
    'transferred_transactions', v_transferred_transactions
  );
END;
$$;

-- Índice para busca por CPF no portal
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj_normalized 
ON public.clientes (REGEXP_REPLACE(cpf_cnpj, '[^0-9]', '', 'g'));

-- =====================================================
-- FIM DA MIGRAÇÃO FASE 21
-- =====================================================