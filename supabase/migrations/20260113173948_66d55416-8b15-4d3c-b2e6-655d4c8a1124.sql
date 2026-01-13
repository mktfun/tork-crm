-- ============================================================
-- Atualizar trigger para permitir alteração de status (pending -> completed)
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_transaction_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Operação proibida: Transações financeiras não podem ser deletadas.';
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    -- Permite atualizar para void (estorno)
    IF NEW.is_void IS TRUE AND OLD.is_void IS FALSE THEN
      IF NEW.description = OLD.description 
         AND NEW.transaction_date = OLD.transaction_date 
         AND NEW.reference_number IS NOT DISTINCT FROM OLD.reference_number
         AND NEW.related_entity_type IS NOT DISTINCT FROM OLD.related_entity_type
         AND NEW.related_entity_id IS NOT DISTINCT FROM OLD.related_entity_id THEN
        RETURN NEW; -- Permitido: apenas estorno
      END IF;
    END IF;
    
    -- NOVO: Permite atualizar status de 'pending' para 'completed' (baixa de comissão)
    IF OLD.status = 'pending' AND NEW.status = 'completed' THEN
      IF NEW.description = OLD.description 
         AND NEW.transaction_date = OLD.transaction_date 
         AND NEW.reference_number IS NOT DISTINCT FROM OLD.reference_number
         AND NEW.related_entity_type IS NOT DISTINCT FROM OLD.related_entity_type
         AND NEW.related_entity_id IS NOT DISTINCT FROM OLD.related_entity_id
         AND NEW.is_void IS NOT DISTINCT FROM OLD.is_void THEN
        RETURN NEW; -- Permitido: transição de status
      END IF;
    END IF;
    
    RAISE EXCEPTION 'Operação proibida: Transações são imutáveis. Apenas estorno ou confirmação de status é permitido.';
  END IF;
  
  RETURN NULL;
END;
$function$;