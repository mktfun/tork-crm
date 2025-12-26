-- =====================================================
-- FASE 4: Trigger de Estorno + View DRE + RPC
-- =====================================================

-- 1. ATUALIZAR TRIGGER para incluir lógica de ESTORNO
CREATE OR REPLACE FUNCTION sync_transaction_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_account_id UUID;
  v_revenue_account_id UUID;
  v_transaction_id UUID;
  v_description TEXT;
BEGIN
  -- Buscar ou criar contas padrão
  SELECT bank_account_id, revenue_account_id 
  INTO v_bank_account_id, v_revenue_account_id
  FROM get_or_create_ledger_sync_accounts(NEW.user_id);
  
  -- Descrição base
  v_description := COALESCE(NEW.description, 'Comissão recebida');

  -- ========================================
  -- CASO 1: IDA (Pagamento) - status muda para PAGO
  -- ========================================
  IF NEW.status = 'PAGO' 
     AND (OLD.status IS NULL OR OLD.status != 'PAGO')
     AND NEW.nature IN ('RECEITA', 'GANHO') THEN
    
    -- Verificar se já existe lançamento para evitar duplicação
    IF EXISTS (
      SELECT 1 FROM financial_transactions
      WHERE related_entity_type = 'transaction'
        AND related_entity_id = NEW.id::text
        AND user_id = NEW.user_id
    ) THEN
      RETURN NEW;
    END IF;
    
    -- Criar transação financeira
    INSERT INTO financial_transactions (
      user_id, description, transaction_date, 
      related_entity_type, related_entity_id, created_by
    ) VALUES (
      NEW.user_id,
      v_description,
      COALESCE(NEW.paid_date, NOW())::date,
      'transaction',
      NEW.id::text,
      NEW.user_id
    ) RETURNING id INTO v_transaction_id;
    
    -- Débito no Banco (ativo aumenta = valor positivo)
    INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
    VALUES (v_transaction_id, v_bank_account_id, NEW.amount, 'Entrada de caixa');
    
    -- Crédito na Receita (receita aumenta = valor negativo no ledger)
    INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
    VALUES (v_transaction_id, v_revenue_account_id, -NEW.amount, 'Receita de comissão');

  -- ========================================
  -- CASO 2: VOLTA (Estorno) - status sai de PAGO
  -- ========================================
  ELSIF OLD.status = 'PAGO' 
     AND NEW.status IS DISTINCT FROM 'PAGO'
     AND OLD.nature IN ('RECEITA', 'GANHO') THEN
    
    -- Verificar se já existe um estorno para esta transação
    IF EXISTS (
      SELECT 1 FROM financial_transactions
      WHERE related_entity_type = 'transaction_reversal'
        AND related_entity_id = NEW.id::text
        AND user_id = NEW.user_id
    ) THEN
      RETURN NEW;
    END IF;
    
    -- Criar transação de estorno
    INSERT INTO financial_transactions (
      user_id, description, transaction_date, 
      related_entity_type, related_entity_id, created_by
    ) VALUES (
      NEW.user_id,
      'ESTORNO: ' || v_description,
      NOW()::date,
      'transaction_reversal',
      NEW.id::text,
      NEW.user_id
    ) RETURNING id INTO v_transaction_id;
    
    -- Crédito no Banco (ativo diminui = valor negativo)
    INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
    VALUES (v_transaction_id, v_bank_account_id, -OLD.amount, 'Estorno - saída de caixa');
    
    -- Débito na Receita (receita diminui = valor positivo no ledger)
    INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
    VALUES (v_transaction_id, v_revenue_account_id, OLD.amount, 'Estorno - reversão de receita');

  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. CRIAR VIEW DRE (Demonstrativo de Resultado do Exercício)
CREATE OR REPLACE VIEW financial_dre_view AS
SELECT
  ft.user_id,
  TO_CHAR(ft.transaction_date, 'YYYY-MM') AS period,
  EXTRACT(YEAR FROM ft.transaction_date)::integer AS year,
  EXTRACT(MONTH FROM ft.transaction_date)::integer AS month,
  fa.name AS category,
  fa.type AS account_type,
  -- Para receitas, o valor é negativo no ledger, então invertemos
  -- Para despesas, o valor é positivo no ledger
  CASE 
    WHEN fa.type = 'revenue' THEN ABS(SUM(fl.amount))
    WHEN fa.type = 'expense' THEN ABS(SUM(fl.amount))
    ELSE SUM(fl.amount)
  END AS total_amount
FROM financial_ledger fl
JOIN financial_transactions ft ON fl.transaction_id = ft.id
JOIN financial_accounts fa ON fl.account_id = fa.id
WHERE 
  fa.type IN ('revenue', 'expense')
  AND (ft.is_void IS NULL OR ft.is_void = false)
GROUP BY 
  ft.user_id,
  TO_CHAR(ft.transaction_date, 'YYYY-MM'),
  EXTRACT(YEAR FROM ft.transaction_date),
  EXTRACT(MONTH FROM ft.transaction_date),
  fa.name,
  fa.type
ORDER BY period DESC, account_type, category;

-- 3. RLS para a View (herda das tabelas base, mas criamos função segura)
CREATE OR REPLACE FUNCTION get_user_dre_data()
RETURNS SETOF financial_dre_view
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM financial_dre_view WHERE user_id = auth.uid();
$$;

-- 4. RPC get_dre_data - Retorna dados pivotados para a tabela DRE
CREATE OR REPLACE FUNCTION get_dre_data(p_year integer DEFAULT NULL)
RETURNS TABLE (
  category text,
  account_type text,
  jan numeric,
  fev numeric,
  mar numeric,
  abr numeric,
  mai numeric,
  jun numeric,
  jul numeric,
  ago numeric,
  "set" numeric,
  "out" numeric,
  nov numeric,
  dez numeric,
  total numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM NOW())::integer);
  
  RETURN QUERY
  WITH monthly_data AS (
    SELECT 
      dv.category,
      dv.account_type::text,
      dv.month,
      dv.total_amount
    FROM financial_dre_view dv
    WHERE dv.user_id = auth.uid()
      AND dv.year = v_year
  ),
  pivoted AS (
    SELECT
      md.category,
      md.account_type,
      COALESCE(SUM(CASE WHEN md.month = 1 THEN md.total_amount END), 0) AS jan,
      COALESCE(SUM(CASE WHEN md.month = 2 THEN md.total_amount END), 0) AS fev,
      COALESCE(SUM(CASE WHEN md.month = 3 THEN md.total_amount END), 0) AS mar,
      COALESCE(SUM(CASE WHEN md.month = 4 THEN md.total_amount END), 0) AS abr,
      COALESCE(SUM(CASE WHEN md.month = 5 THEN md.total_amount END), 0) AS mai,
      COALESCE(SUM(CASE WHEN md.month = 6 THEN md.total_amount END), 0) AS jun,
      COALESCE(SUM(CASE WHEN md.month = 7 THEN md.total_amount END), 0) AS jul,
      COALESCE(SUM(CASE WHEN md.month = 8 THEN md.total_amount END), 0) AS ago,
      COALESCE(SUM(CASE WHEN md.month = 9 THEN md.total_amount END), 0) AS "set",
      COALESCE(SUM(CASE WHEN md.month = 10 THEN md.total_amount END), 0) AS "out",
      COALESCE(SUM(CASE WHEN md.month = 11 THEN md.total_amount END), 0) AS nov,
      COALESCE(SUM(CASE WHEN md.month = 12 THEN md.total_amount END), 0) AS dez
    FROM monthly_data md
    GROUP BY md.category, md.account_type
  )
  SELECT
    p.category,
    p.account_type,
    p.jan,
    p.fev,
    p.mar,
    p.abr,
    p.mai,
    p.jun,
    p.jul,
    p.ago,
    p."set",
    p."out",
    p.nov,
    p.dez,
    (p.jan + p.fev + p.mar + p.abr + p.mai + p.jun + 
     p.jul + p.ago + p."set" + p."out" + p.nov + p.dez) AS total
  FROM pivoted p
  ORDER BY p.account_type DESC, p.category;  -- revenue first, then expense
END;
$$;

-- 5. Criar índice para performance na view DRE
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date_user 
ON financial_transactions(user_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_financial_ledger_account 
ON financial_ledger(account_id);