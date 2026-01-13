
-- =============================================================================
-- FIX: Resolver conflito de overload e tornar settle_commission_transaction resiliente
-- Problema: Existem 2 versões da função causando conflito
-- Solução: Remover versão (text) e atualizar versão (uuid,uuid,date) para resolver ambos IDs
-- =============================================================================

-- FASE 1: REMOVER VERSÃO INCORRETA
DROP FUNCTION IF EXISTS public.settle_commission_transaction(text);

-- FASE 2: REMOVER VERSÃO ATUAL PARA RECRIAR
DROP FUNCTION IF EXISTS public.settle_commission_transaction(uuid, uuid, date);
DROP FUNCTION IF EXISTS public.settle_commission_transaction(uuid, uuid);

-- =============================================================================
-- FASE 3: CRIAR VERSÃO ÚNICA E RESILIENTE
-- Esta versão aceita tanto ID legado (transactions) quanto ID moderno (financial_transactions)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.settle_commission_transaction(
  p_transaction_id UUID,
  p_bank_account_id UUID,
  p_settlement_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_legacy_id UUID;
  v_transaction RECORD;
  v_commission_amount NUMERIC;
  v_new_financial_tx_id UUID;
  v_accounts_receivable_id UUID;
  v_id_source TEXT := 'unknown';
BEGIN
  -- Obter user_id do contexto de auth
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'AUTH_REQUIRED',
      'error', 'Usuário não autenticado'
    );
  END IF;

  -- ==========================================================================
  -- RESOLUÇÃO INTELIGENTE DO ID
  -- Tenta primeiro como ID legado (transactions), depois como ID moderno (financial_transactions)
  -- ==========================================================================
  
  -- Tentativa 1: Buscar diretamente na tabela transactions (ID legado)
  SELECT t.id, t.amount, t.status, t.user_id, t.description
  INTO v_transaction
  FROM transactions t
  WHERE t.id = p_transaction_id AND t.user_id = v_user_id;
  
  IF FOUND THEN
    v_legacy_id := p_transaction_id;
    v_id_source := 'legacy_direct';
  ELSE
    -- Tentativa 2: Buscar em financial_transactions e extrair related_entity_id
    SELECT ft.related_entity_id, ft.related_entity_type
    INTO v_legacy_id, v_id_source
    FROM financial_transactions ft
    WHERE ft.id = p_transaction_id 
      AND ft.user_id = v_user_id
      AND ft.related_entity_type = 'legacy_transaction'
      AND ft.related_entity_id IS NOT NULL;
    
    IF FOUND AND v_legacy_id IS NOT NULL THEN
      v_id_source := 'resolved_from_modern';
      
      -- Agora buscar a transação legada usando o ID extraído
      SELECT t.id, t.amount, t.status, t.user_id, t.description
      INTO v_transaction
      FROM transactions t
      WHERE t.id = v_legacy_id AND t.user_id = v_user_id;
      
      IF NOT FOUND THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'LEGACY_NOT_FOUND',
          'error', 'Transação legada referenciada não encontrada',
          'details', jsonb_build_object(
            'modern_id', p_transaction_id,
            'legacy_id_expected', v_legacy_id
          )
        );
      END IF;
    ELSE
      -- Nenhuma das duas tentativas funcionou
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'TRANSACTION_NOT_FOUND',
        'error', 'Transação não encontrada',
        'details', jsonb_build_object(
          'provided_id', p_transaction_id,
          'searched_in', ARRAY['transactions', 'financial_transactions.related_entity_id']
        )
      );
    END IF;
  END IF;

  -- Usar v_legacy_id a partir daqui (garantido que existe)
  v_commission_amount := v_transaction.amount;

  -- Validar status atual
  IF v_transaction.status = 'pago' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_SETTLED',
      'error', 'Esta comissão já foi baixada anteriormente'
    );
  END IF;

  -- Validar conta bancária
  IF NOT EXISTS (
    SELECT 1 FROM financial_accounts 
    WHERE id = p_bank_account_id 
      AND user_id = v_user_id 
      AND type = 'asset'
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_BANK_ACCOUNT',
      'error', 'Conta bancária inválida ou não encontrada'
    );
  END IF;

  -- Buscar conta de contas a receber
  SELECT id INTO v_accounts_receivable_id
  FROM financial_accounts
  WHERE user_id = v_user_id 
    AND type = 'asset' 
    AND name ILIKE '%receber%'
  LIMIT 1;

  IF v_accounts_receivable_id IS NULL THEN
    -- Criar conta padrão se não existir
    INSERT INTO financial_accounts (user_id, name, type, code, description)
    VALUES (v_user_id, 'Contas a Receber', 'asset', '1.1.3', 'Comissões a receber de seguradoras')
    RETURNING id INTO v_accounts_receivable_id;
  END IF;

  -- ==========================================================================
  -- EXECUTAR BAIXA COM PARTIDAS DOBRADAS
  -- ==========================================================================

  -- 1. Atualizar status na tabela transactions (legada)
  UPDATE transactions
  SET status = 'pago',
      paid_date = p_settlement_date,
      updated_at = NOW()
  WHERE id = v_legacy_id;

  -- 2. Criar transação de liquidação no financeiro moderno
  INSERT INTO financial_transactions (
    user_id,
    created_by,
    description,
    transaction_date,
    status,
    related_entity_type,
    related_entity_id
  )
  VALUES (
    v_user_id,
    v_user_id,
    'Liquidação: ' || COALESCE(v_transaction.description, 'Comissão'),
    p_settlement_date,
    'completed',
    'settlement',
    v_legacy_id
  )
  RETURNING id INTO v_new_financial_tx_id;

  -- 3. Criar lançamentos no ledger (partidas dobradas)
  -- Débito no banco (entrada de dinheiro)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_new_financial_tx_id, p_bank_account_id, v_commission_amount, 'Recebimento de comissão');

  -- Crédito em contas a receber (baixa do direito)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_new_financial_tx_id, v_accounts_receivable_id, -v_commission_amount, 'Baixa de comissão a receber');

  -- 4. Atualizar status na financial_transactions original (se existir)
  UPDATE financial_transactions
  SET status = 'completed'
  WHERE related_entity_id = v_legacy_id
    AND related_entity_type = 'legacy_transaction'
    AND user_id = v_user_id;

  -- Retornar sucesso com detalhes
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Comissão baixada com sucesso',
    'amount', v_commission_amount,
    'settlement_transaction_id', v_new_financial_tx_id,
    'legacy_transaction_id', v_legacy_id,
    'id_resolution', v_id_source
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error_code', 'UNEXPECTED_ERROR',
    'error', SQLERRM,
    'details', jsonb_build_object('sqlstate', SQLSTATE)
  );
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.settle_commission_transaction(UUID, UUID, DATE) TO authenticated;

-- Comentário para documentação
COMMENT ON FUNCTION public.settle_commission_transaction(UUID, UUID, DATE) IS 
'Baixa de comissão resiliente: aceita tanto ID legado (transactions.id) quanto ID moderno (financial_transactions.id). 
Resolve automaticamente o ID correto e executa a baixa com partidas dobradas.';
