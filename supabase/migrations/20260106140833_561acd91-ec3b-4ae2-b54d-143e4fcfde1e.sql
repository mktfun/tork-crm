-- =====================================================
-- FASE 28: PROVISÃO DE COMISSÕES E CONTAS A RECEBER
-- =====================================================

-- 1. Trigger para sincronizar comissões (tabela transactions) com ERP Financeiro
CREATE OR REPLACE FUNCTION sync_commission_to_financial_erp()
RETURNS TRIGGER AS $$
DECLARE
  v_account_receivable_id uuid;
  v_account_revenue_id uuid;
  v_transaction_id uuid;
BEGIN
  -- Só processa se for uma receita (comissão)
  IF NEW.nature != 'RECEITA' THEN
    RETURN NEW;
  END IF;

  -- Busca as contas de sistema do usuário
  SELECT id INTO v_account_receivable_id 
  FROM financial_accounts 
  WHERE user_id = NEW.user_id 
    AND name = 'Comissões a Receber' 
    AND type = 'asset'
  LIMIT 1;

  SELECT id INTO v_account_revenue_id 
  FROM financial_accounts 
  WHERE user_id = NEW.user_id 
    AND name = 'Receita de Comissões' 
    AND type = 'revenue'
  LIMIT 1;

  -- Se não encontrar as contas, não faz nada (fallback silencioso)
  IF v_account_receivable_id IS NULL OR v_account_revenue_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cria a Transação de Provisão no ERP
  INSERT INTO financial_transactions (
    user_id,
    created_by,
    description,
    transaction_date,
    reference_number,
    related_entity_type,
    related_entity_id
  ) VALUES (
    NEW.user_id,
    NEW.user_id,
    NEW.description,
    COALESCE(NEW.due_date, NEW.transaction_date),
    'LEGACY-' || NEW.id::text,
    'legacy_transaction',
    NEW.id
  ) RETURNING id INTO v_transaction_id;

  -- Débito: Comissões a Receber (Ativo sobe)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_transaction_id, v_account_receivable_id, NEW.amount, 'Provisão de comissão');
  
  -- Crédito: Receita de Comissões (Receita sobe - valor negativo)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_transaction_id, v_account_revenue_id, -NEW.amount, 'Provisão de comissão');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger se existir e criar novamente
DROP TRIGGER IF EXISTS trigger_sync_commission_to_erp ON transactions;
CREATE TRIGGER trigger_sync_commission_to_erp
AFTER INSERT ON transactions
FOR EACH ROW 
WHEN (NEW.nature = 'RECEITA')
EXECUTE FUNCTION sync_commission_to_financial_erp();

-- 2. Função RPC para liquidação (baixa) de comissão
CREATE OR REPLACE FUNCTION settle_commission_transaction(
  p_transaction_id uuid,
  p_bank_account_id uuid,
  p_settlement_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb AS $$
DECLARE
  v_financial_tx record;
  v_account_receivable_id uuid;
  v_legacy_tx_id uuid;
  v_amount numeric;
  v_user_id uuid;
BEGIN
  -- Buscar a transação financeira
  SELECT * INTO v_financial_tx 
  FROM financial_transactions 
  WHERE id = p_transaction_id;

  IF v_financial_tx IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Transação não encontrada');
  END IF;

  v_user_id := v_financial_tx.user_id;

  -- Buscar conta "Comissões a Receber"
  SELECT id INTO v_account_receivable_id 
  FROM financial_accounts 
  WHERE user_id = v_user_id 
    AND name = 'Comissões a Receber' 
    AND type = 'asset'
  LIMIT 1;

  IF v_account_receivable_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Conta Comissões a Receber não encontrada');
  END IF;

  -- Buscar valor da provisão original (débito na conta de receber)
  SELECT amount INTO v_amount
  FROM financial_ledger
  WHERE transaction_id = p_transaction_id AND account_id = v_account_receivable_id;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Valor da provisão não encontrado ou inválido');
  END IF;

  -- Criar novos movimentos de liquidação no mesmo transaction_id
  -- Crédito: Comissões a Receber (zera a provisão)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (p_transaction_id, v_account_receivable_id, -v_amount, 'Liquidação - recebimento confirmado');

  -- Débito: Conta Bancária (dinheiro entra)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (p_transaction_id, p_bank_account_id, v_amount, 'Liquidação - recebimento confirmado');

  -- Atualizar transação legada se existir
  IF v_financial_tx.related_entity_id IS NOT NULL AND v_financial_tx.related_entity_type = 'legacy_transaction' THEN
    UPDATE transactions 
    SET status = 'PAGO', paid_date = now()
    WHERE id = v_financial_tx.related_entity_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'settledAmount', v_amount,
    'message', 'Comissão liquidada com sucesso'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;