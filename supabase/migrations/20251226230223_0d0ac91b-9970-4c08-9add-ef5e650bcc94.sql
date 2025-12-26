-- =============================================
-- FASE 11 - SEGURANÇA ANTI-BAIXA DUPLA
-- =============================================

-- 1. Recriar bulk_confirm_receipts com proteção contra baixa dupla
CREATE OR REPLACE FUNCTION public.bulk_confirm_receipts(p_transaction_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_confirmed_count int := 0;
  v_skipped_count int := 0;
  v_user_id uuid;
  v_tx_id uuid;
  v_legacy_status text;
  v_already_exists boolean;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não autenticado',
      'confirmed_count', 0,
      'skipped_count', 0
    );
  END IF;
  
  -- Processar cada transação individualmente para verificar duplicidade
  FOREACH v_tx_id IN ARRAY p_transaction_ids
  LOOP
    -- Verificar se a transação financeira existe e pertence ao usuário
    IF NOT EXISTS (
      SELECT 1 FROM financial_transactions 
      WHERE id = v_tx_id 
      AND user_id = v_user_id 
      AND is_void = false
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;
    
    -- Verificar se já está marcado como pago no legado
    SELECT t.status INTO v_legacy_status
    FROM financial_transactions ft
    JOIN transactions t ON t.id = ft.related_entity_id
    WHERE ft.id = v_tx_id
    LIMIT 1;
    
    -- Se já está pago no legado, pular
    IF UPPER(COALESCE(v_legacy_status, '')) IN ('PAGO', 'REALIZADO') THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;
    
    -- Se chegou aqui, pode confirmar - mas NÃO alterar a data original!
    -- A data já foi corrigida pelo backfill, não devemos alterá-la
    -- Apenas marcamos como "processado" atualizando o legado se necessário
    
    -- Atualizar status no legado para PAGO (se existir vínculo)
    UPDATE transactions t
    SET status = 'PAGO',
        paid_date = COALESCE(t.paid_date, CURRENT_DATE)
    FROM financial_transactions ft
    WHERE ft.id = v_tx_id
      AND t.id = ft.related_entity_id
      AND t.user_id = v_user_id
      AND UPPER(COALESCE(t.status, '')) NOT IN ('PAGO', 'REALIZADO');
    
    IF FOUND THEN
      v_confirmed_count := v_confirmed_count + 1;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'confirmed_count', v_confirmed_count,
    'skipped_count', v_skipped_count,
    'message', CASE 
      WHEN v_skipped_count > 0 
      THEN v_skipped_count || ' transações já estavam pagas/confirmadas.'
      ELSE 'Todas as transações foram confirmadas.'
    END
  );
END;
$function$;

-- 2. Adicionar comentário explicativo
COMMENT ON FUNCTION public.bulk_confirm_receipts(uuid[]) IS 
'Confirma recebimento em lote de transações, ignorando as que já estão pagas/confirmadas. 
Não altera a data original da transação financeira para manter integridade temporal.';
