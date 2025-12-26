-- ============= FASE 3: Trigger de Sincronização e RPCs de Fluxo de Caixa =============

-- 1. Função helper para obter ou criar contas padrão do ledger
CREATE OR REPLACE FUNCTION get_or_create_ledger_sync_accounts(p_user_id uuid)
RETURNS TABLE(bank_account_id uuid, revenue_account_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bank_id uuid;
  v_revenue_id uuid;
BEGIN
  -- Buscar ou criar conta "Banco Principal" (Asset)
  SELECT id INTO v_bank_id
  FROM financial_accounts
  WHERE user_id = p_user_id 
    AND type = 'asset' 
    AND name = 'Banco Principal'
    AND status = 'active'
  LIMIT 1;
  
  IF v_bank_id IS NULL THEN
    INSERT INTO financial_accounts (user_id, name, type, code, description, is_system)
    VALUES (p_user_id, 'Banco Principal', 'asset', '1.1.01', 'Conta bancária principal para recebimentos', true)
    RETURNING id INTO v_bank_id;
  END IF;
  
  -- Buscar ou criar conta "Receita de Comissões" (Revenue)
  SELECT id INTO v_revenue_id
  FROM financial_accounts
  WHERE user_id = p_user_id 
    AND type = 'revenue' 
    AND name = 'Receita de Comissões'
    AND status = 'active'
  LIMIT 1;
  
  IF v_revenue_id IS NULL THEN
    INSERT INTO financial_accounts (user_id, name, type, code, description, is_system)
    VALUES (p_user_id, 'Receita de Comissões', 'revenue', '4.1.01', 'Receitas de comissões de apólices', true)
    RETURNING id INTO v_revenue_id;
  END IF;
  
  RETURN QUERY SELECT v_bank_id, v_revenue_id;
END;
$$;

-- 2. Função trigger para sincronizar transactions -> financial_ledger
CREATE OR REPLACE FUNCTION sync_transaction_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_accounts RECORD;
  v_transaction_id uuid;
  v_description text;
BEGIN
  -- Só processa se:
  -- 1. Status mudou para 'PAGO'
  -- 2. É uma receita (nature = 'RECEITA' ou 'GANHO')
  -- 3. Ainda não foi sincronizado (não existe related_entity_id)
  IF NEW.status = 'PAGO' 
     AND (OLD.status IS NULL OR OLD.status != 'PAGO')
     AND NEW.nature IN ('RECEITA', 'GANHO') THEN
    
    -- Verificar se já existe um lançamento para esta transaction
    IF EXISTS (
      SELECT 1 FROM financial_transactions
      WHERE related_entity_type = 'transaction'
        AND related_entity_id = NEW.id::text
        AND user_id = NEW.user_id
    ) THEN
      -- Já sincronizado, não duplicar
      RETURN NEW;
    END IF;
    
    -- Obter contas padrão
    SELECT * INTO v_accounts
    FROM get_or_create_ledger_sync_accounts(NEW.user_id);
    
    -- Montar descrição
    v_description := COALESCE(NEW.description, 'Comissão recebida');
    
    -- Criar transação financeira
    INSERT INTO financial_transactions (
      user_id,
      description,
      transaction_date,
      reference_number,
      related_entity_type,
      related_entity_id,
      created_by
    ) VALUES (
      NEW.user_id,
      v_description,
      COALESCE(NEW.paid_date, NEW.transaction_date, now())::date,
      NEW.id::text,
      'transaction',
      NEW.id::text,
      NEW.user_id
    )
    RETURNING id INTO v_transaction_id;
    
    -- Inserir movimentos no ledger (partidas dobradas)
    -- Débito (+) no Banco (aumenta ativo)
    INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
    VALUES (v_transaction_id, v_accounts.bank_account_id, NEW.amount, 'Entrada de comissão');
    
    -- Crédito (-) na Receita (aumenta receita)
    INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
    VALUES (v_transaction_id, v_accounts.revenue_account_id, -NEW.amount, 'Comissão de apólice');
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Criar o trigger na tabela transactions
DROP TRIGGER IF EXISTS trigger_sync_transaction_to_ledger ON transactions;

CREATE TRIGGER trigger_sync_transaction_to_ledger
AFTER UPDATE ON transactions
FOR EACH ROW
WHEN (NEW.status = 'PAGO' AND (OLD.status IS DISTINCT FROM 'PAGO'))
EXECUTE FUNCTION sync_transaction_to_ledger();

-- 4. RPC para buscar dados de fluxo de caixa (para gráfico)
CREATE OR REPLACE FUNCTION get_cash_flow_data(
  p_start_date date,
  p_end_date date,
  p_granularity text DEFAULT 'day'
)
RETURNS TABLE (
  period text,
  income numeric,
  expense numeric,
  balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH ledger_data AS (
    SELECT 
      CASE 
        WHEN p_granularity = 'month' THEN to_char(ft.transaction_date, 'YYYY-MM')
        ELSE to_char(ft.transaction_date, 'YYYY-MM-DD')
      END as period_key,
      fa.type as account_type,
      fl.amount
    FROM financial_ledger fl
    JOIN financial_transactions ft ON ft.id = fl.transaction_id
    JOIN financial_accounts fa ON fa.id = fl.account_id
    WHERE ft.user_id = auth.uid()
      AND ft.is_void = false
      AND ft.transaction_date >= p_start_date
      AND ft.transaction_date <= p_end_date
  ),
  aggregated AS (
    SELECT 
      period_key,
      -- Receita: créditos (negativos) em contas revenue = valor absoluto
      COALESCE(SUM(CASE WHEN account_type = 'revenue' THEN ABS(amount) ELSE 0 END), 0) as income,
      -- Despesa: débitos (positivos) em contas expense
      COALESCE(SUM(CASE WHEN account_type = 'expense' THEN amount ELSE 0 END), 0) as expense
    FROM ledger_data
    GROUP BY period_key
  )
  SELECT 
    a.period_key as period,
    a.income,
    a.expense,
    (a.income - a.expense) as balance
  FROM aggregated a
  ORDER BY a.period_key;
END;
$$;

-- 5. RPC para buscar resumo financeiro (para KPIs)
CREATE OR REPLACE FUNCTION get_financial_summary(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  total_income numeric,
  total_expense numeric,
  net_result numeric,
  transaction_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Receita: soma absoluta de créditos em contas revenue
    COALESCE(SUM(CASE WHEN fa.type = 'revenue' THEN ABS(fl.amount) ELSE 0 END), 0)::numeric as total_income,
    -- Despesa: soma de débitos em contas expense
    COALESCE(SUM(CASE WHEN fa.type = 'expense' THEN fl.amount ELSE 0 END), 0)::numeric as total_expense,
    -- Resultado líquido
    (COALESCE(SUM(CASE WHEN fa.type = 'revenue' THEN ABS(fl.amount) ELSE 0 END), 0) -
     COALESCE(SUM(CASE WHEN fa.type = 'expense' THEN fl.amount ELSE 0 END), 0))::numeric as net_result,
    -- Contagem de transações únicas
    COUNT(DISTINCT ft.id)::integer as transaction_count
  FROM financial_ledger fl
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = auth.uid()
    AND ft.is_void = false
    AND ft.transaction_date >= p_start_date
    AND ft.transaction_date <= p_end_date;
END;
$$;