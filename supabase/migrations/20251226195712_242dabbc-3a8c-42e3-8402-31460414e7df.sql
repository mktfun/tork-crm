-- ============================================================
-- FASE 6: RPCs para Backfill e Gestão de Contas Financeiras
-- ============================================================

-- RPC 1: Backfill de transações legadas
-- Migra transações pagas do sistema antigo para o novo Ledger
CREATE OR REPLACE FUNCTION public.backfill_legacy_transactions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_transaction RECORD;
  v_bank_account_id uuid;
  v_revenue_account_id uuid;
  v_ft_id uuid;
  v_count int := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  -- Obter user_id da sessão
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Buscar conta bancária padrão (primeiro Asset ativo do usuário)
  SELECT id INTO v_bank_account_id 
  FROM financial_accounts 
  WHERE user_id = v_user_id 
    AND type = 'asset' 
    AND status = 'active'
  ORDER BY is_system DESC, created_at ASC
  LIMIT 1;

  -- Buscar categoria de receita padrão (primeiro Revenue ativo do usuário)
  SELECT id INTO v_revenue_account_id 
  FROM financial_accounts 
  WHERE user_id = v_user_id 
    AND type = 'revenue' 
    AND status = 'active'
  ORDER BY is_system DESC, created_at ASC
  LIMIT 1;

  -- Validar que encontramos as contas necessárias
  IF v_bank_account_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma conta bancária encontrada. Configure uma conta de Ativo primeiro.';
  END IF;
  
  IF v_revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma categoria de receita encontrada. Configure uma categoria de Receita primeiro.';
  END IF;

  -- Iterar sobre transações pagas que ainda não foram migradas
  FOR v_transaction IN
    SELECT t.* FROM transactions t
    WHERE t.user_id = v_user_id
      AND UPPER(t.status) = 'PAGO'
      AND NOT EXISTS (
        SELECT 1 FROM financial_transactions ft 
        WHERE ft.related_entity_id = t.id
          AND ft.related_entity_type = 'legacy_transaction'
      )
  LOOP
    BEGIN
      -- Criar transação financeira
      INSERT INTO financial_transactions (
        user_id, 
        description, 
        transaction_date,
        related_entity_type, 
        related_entity_id, 
        created_by
      ) VALUES (
        v_user_id,
        COALESCE(v_transaction.description, 'Comissão Legada #' || LEFT(v_transaction.id::text, 8)),
        COALESCE(v_transaction.paid_date::date, v_transaction.date),
        'legacy_transaction',
        v_transaction.id,
        v_user_id
      ) RETURNING id INTO v_ft_id;

      -- Criar movimentos no ledger (partidas dobradas)
      -- DÉBITO no banco (entrada de dinheiro) - valor positivo
      INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
      VALUES (v_ft_id, v_bank_account_id, v_transaction.amount, 'Migração automática do legado');

      -- CRÉDITO na receita - valor negativo (para soma = 0)
      INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
      VALUES (v_ft_id, v_revenue_account_id, -v_transaction.amount, 'Migração automática do legado');

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Captura erro mas continua processando
      v_errors := v_errors || jsonb_build_object(
        'transaction_id', v_transaction.id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success_count', v_count,
    'error_count', jsonb_array_length(v_errors),
    'errors', v_errors
  );
END;
$$;

-- RPC 2: Atualizar conta financeira
-- Permite editar nome, código e descrição de contas não-sistema
CREATE OR REPLACE FUNCTION public.update_financial_account(
  p_account_id uuid,
  p_name text,
  p_code text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS financial_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result financial_accounts;
BEGIN
  UPDATE financial_accounts 
  SET 
    name = p_name,
    code = COALESCE(p_code, code),
    description = COALESCE(p_description, description),
    updated_at = now()
  WHERE id = p_account_id 
    AND user_id = auth.uid()
    AND is_system = false  -- Não permite editar contas do sistema
  RETURNING * INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada ou não pode ser editada (conta do sistema)';
  END IF;
  
  RETURN v_result;
END;
$$;

-- RPC 3: Arquivar conta financeira (soft delete)
-- Muda status para 'archived', não deleta de verdade
CREATE OR REPLACE FUNCTION public.archive_financial_account(p_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_entries boolean;
BEGIN
  -- Verificar se a conta tem movimentos
  SELECT EXISTS(
    SELECT 1 FROM financial_ledger fl
    JOIN financial_transactions ft ON ft.id = fl.transaction_id
    WHERE fl.account_id = p_account_id
      AND ft.is_void = false
  ) INTO v_has_entries;
  
  -- Atualizar status para archived
  UPDATE financial_accounts 
  SET status = 'archived', updated_at = now()
  WHERE id = p_account_id 
    AND user_id = auth.uid()
    AND is_system = false;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada ou não pode ser arquivada (conta do sistema)';
  END IF;
  
  RETURN true;
END;
$$;

-- RPC 4: Contar transações legadas pendentes de migração
CREATE OR REPLACE FUNCTION public.count_pending_legacy_transactions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM transactions t
  WHERE t.user_id = auth.uid()
    AND UPPER(t.status) = 'PAGO'
    AND NOT EXISTS (
      SELECT 1 FROM financial_transactions ft 
      WHERE ft.related_entity_id = t.id
        AND ft.related_entity_type = 'legacy_transaction'
    );
  
  RETURN v_count;
END;
$$;