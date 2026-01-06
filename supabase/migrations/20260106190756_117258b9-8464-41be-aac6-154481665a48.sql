-- Recriar a função sync_new_commission_to_erp removendo user_id do financial_ledger
CREATE OR REPLACE FUNCTION public.sync_new_commission_to_erp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_ft_id UUID;
  v_receivable_account_id UUID;
  v_revenue_account_id UUID;
  v_client_name TEXT;
  v_ramo_name TEXT;
  v_description TEXT;
BEGIN
  -- Apenas processar receitas (comissões)
  IF NEW.nature != 'RECEITA' THEN
    RETURN NEW;
  END IF;

  -- Buscar conta Comissões a Receber
  SELECT id INTO v_receivable_account_id
  FROM financial_accounts 
  WHERE user_id = NEW.user_id 
    AND name = 'Comissões a Receber'
    AND type = 'asset'
  LIMIT 1;

  -- Buscar conta Receita de Comissões
  SELECT id INTO v_revenue_account_id
  FROM financial_accounts 
  WHERE user_id = NEW.user_id 
    AND name = 'Receita de Comissões'
    AND type = 'revenue'
  LIMIT 1;

  -- Se não encontrar contas, sair silenciosamente
  IF v_receivable_account_id IS NULL OR v_revenue_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar nome do cliente
  SELECT name INTO v_client_name
  FROM clientes WHERE id = NEW.client_id;

  -- Buscar nome do ramo
  SELECT r.nome INTO v_ramo_name
  FROM apolices a
  JOIN ramos r ON r.id = a.ramo_id
  WHERE a.id = NEW.policy_id;

  -- Montar descrição
  v_description := 'Comissão: ' || COALESCE(v_client_name, 'Cliente') || 
                   COALESCE(' - ' || v_ramo_name, '');

  -- Criar transação financeira
  INSERT INTO financial_transactions (
    user_id, created_by, description, transaction_date,
    reference_number, related_entity_type, related_entity_id
  ) VALUES (
    NEW.user_id, NEW.user_id, v_description,
    COALESCE(NEW.transaction_date, NEW.date, CURRENT_DATE),
    'COMMISSION-' || NEW.id::text,
    'legacy_transaction',
    NEW.id
  )
  RETURNING id INTO v_ft_id;

  -- ✅ CORREÇÃO: Remover user_id das inserções do ledger (coluna não existe)
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_ft_id, v_receivable_account_id, NEW.amount, 'Comissão a receber');

  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_ft_id, v_revenue_account_id, -NEW.amount, 'Receita de comissão');

  RETURN NEW;
END;
$$;