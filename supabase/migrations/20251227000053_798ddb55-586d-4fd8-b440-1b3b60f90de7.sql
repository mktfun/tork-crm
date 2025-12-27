-- =====================================================
-- FASE 13: BLINDAGEM E IMUTABILIDADE DO LEDGER
-- Triggers de imutabilidade + RPC de estorno
-- =====================================================

-- 1. TRIGGER: Bloquear DELETE/UPDATE na financial_ledger
CREATE OR REPLACE FUNCTION public.prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Operação proibida: Lançamentos contábeis não podem ser deletados. Use estorno.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Operação proibida: Lançamentos contábeis são imutáveis. Use estorno.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_financial_ledger_modification ON public.financial_ledger;
CREATE TRIGGER prevent_financial_ledger_modification
  BEFORE DELETE OR UPDATE ON public.financial_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_modification();

-- 2. TRIGGER: Bloquear DELETE e UPDATE parcial na financial_transactions
CREATE OR REPLACE FUNCTION public.prevent_transaction_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Operação proibida: Transações financeiras não podem ser deletadas.';
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    -- Permite apenas atualizar para void (estorno)
    IF NEW.is_void IS TRUE AND OLD.is_void IS FALSE THEN
      -- Valida que apenas campos de void estão sendo alterados
      IF NEW.description = OLD.description 
         AND NEW.transaction_date = OLD.transaction_date 
         AND NEW.reference_number IS NOT DISTINCT FROM OLD.reference_number
         AND NEW.related_entity_type IS NOT DISTINCT FROM OLD.related_entity_type
         AND NEW.related_entity_id IS NOT DISTINCT FROM OLD.related_entity_id THEN
        RETURN NEW; -- Permitido: apenas estorno
      END IF;
    END IF;
    
    RAISE EXCEPTION 'Operação proibida: Transações são imutáveis. Apenas estorno é permitido.';
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_financial_transaction_modification ON public.financial_transactions;
CREATE TRIGGER prevent_financial_transaction_modification
  BEFORE DELETE OR UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_modification();

-- 3. RPC: Estornar transação (void_financial_transaction)
CREATE OR REPLACE FUNCTION public.void_financial_transaction(
  p_transaction_id UUID,
  p_reason TEXT DEFAULT 'Estorno solicitado pelo usuário'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reversal_id UUID;
  v_original_transaction RECORD;
  v_total_amount NUMERIC;
BEGIN
  -- 1. Validar usuário autenticado
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Usuário não autenticado'
    );
  END IF;

  -- 2. Buscar transação original
  SELECT * INTO v_original_transaction
  FROM financial_transactions
  WHERE id = p_transaction_id 
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Transação não encontrada'
    );
  END IF;

  -- 3. Verificar se já está anulada
  IF v_original_transaction.is_void THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Transação já está anulada'
    );
  END IF;

  -- 4. Calcular valor total (para retorno)
  SELECT COALESCE(SUM(ABS(amount)), 0) / 2 INTO v_total_amount
  FROM financial_ledger
  WHERE transaction_id = p_transaction_id AND amount > 0;

  -- 5. Marcar a transação original como void
  UPDATE financial_transactions
  SET 
    is_void = true, 
    void_reason = p_reason, 
    voided_at = now(), 
    voided_by = v_user_id
  WHERE id = p_transaction_id;

  -- 6. Criar transação de estorno
  INSERT INTO financial_transactions (
    user_id, 
    description, 
    transaction_date, 
    reference_number, 
    related_entity_type, 
    related_entity_id, 
    created_by
  )
  VALUES (
    v_user_id,
    '[ESTORNO] ' || v_original_transaction.description,
    CURRENT_DATE,
    p_transaction_id::text,
    'reversal',
    p_transaction_id,
    v_user_id
  )
  RETURNING id INTO v_reversal_id;

  -- 7. Copiar lançamentos com sinais invertidos
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  SELECT 
    v_reversal_id,
    account_id,
    -amount, -- Invertendo o sinal
    'Estorno de lançamento original'
  FROM financial_ledger 
  WHERE transaction_id = p_transaction_id;

  RETURN jsonb_build_object(
    'success', true, 
    'reversal_id', v_reversal_id,
    'original_id', p_transaction_id,
    'reversed_amount', v_total_amount,
    'message', 'Estorno realizado com sucesso'
  );
END;
$$;

-- 4. TRIGGER CONSTRAINT: Validar soma zero do ledger após INSERT
-- Usando DEFERRABLE para validar ao final da transação
CREATE OR REPLACE FUNCTION public.validate_ledger_zero_sum()
RETURNS TRIGGER AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  -- Calcular soma de todos os lançamentos da transação
  SELECT SUM(amount) INTO v_balance
  FROM financial_ledger 
  WHERE transaction_id = NEW.transaction_id;
  
  -- Verificar se soma a zero (com tolerância de centavos)
  IF ABS(v_balance) > 0.01 THEN
    RAISE EXCEPTION 'Transação desbalanceada! Soma dos lançamentos: %. Deveria ser 0.', v_balance;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_ledger_balance_trigger ON public.financial_ledger;
CREATE CONSTRAINT TRIGGER validate_ledger_balance_trigger
  AFTER INSERT ON public.financial_ledger
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.validate_ledger_zero_sum();

-- 5. Comentários para documentação
COMMENT ON FUNCTION public.prevent_ledger_modification() IS 
  'Impede DELETE/UPDATE no ledger financeiro - imutabilidade contábil';
COMMENT ON FUNCTION public.prevent_transaction_modification() IS 
  'Impede modificações em transações exceto para marcar como void';
COMMENT ON FUNCTION public.void_financial_transaction(UUID, TEXT) IS 
  'Estorna uma transação criando lançamentos inversos no ledger';
COMMENT ON FUNCTION public.validate_ledger_zero_sum() IS 
  'Valida que a soma dos lançamentos de uma transação é zero';