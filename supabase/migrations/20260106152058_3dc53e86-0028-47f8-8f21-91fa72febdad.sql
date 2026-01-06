-- ===========================================
-- FASE 29 FIX: Corrigir RPC get_pending_totals e get_cash_flow_with_projection
-- Problema: usando código '1.1.2' mas o código real é '1.2.01'
-- ===========================================

-- 1. Corrigir get_pending_totals para usar código correto
CREATE OR REPLACE FUNCTION get_pending_totals(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_total_a_receber NUMERIC := 0;
  v_total_a_pagar NUMERIC := 0;
  v_count_a_receber INT := 0;
  v_count_a_pagar INT := 0;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'total_a_receber', 0,
      'total_a_pagar', 0,
      'count_a_receber', 0,
      'count_a_pagar', 0
    );
  END IF;

  -- Calcular total A RECEBER (Receitas pendentes)
  -- Usa código '1.2.01' (Comissões a Receber) - CORRIGIDO
  SELECT 
    COALESCE(SUM(ABS(fl.amount)), 0),
    COUNT(DISTINCT ft.id)
  INTO v_total_a_receber, v_count_a_receber
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  LEFT JOIN transactions t ON t.id::text = ft.related_entity_id AND ft.related_entity_type = 'legacy_transaction'
  WHERE ft.user_id = v_user_id
    AND ft.is_void = false
    AND fa.type = 'asset'
    AND fa.code = '1.2.01'  -- CORRIGIDO: código real
    AND fl.amount > 0
    AND (t.id IS NULL OR t.status != 'PAGO')
    AND (p_start_date IS NULL OR ft.transaction_date::date >= p_start_date)
    AND (p_end_date IS NULL OR ft.transaction_date::date <= p_end_date);

  -- Calcular total A PAGAR (Despesas pendentes)
  SELECT 
    COALESCE(SUM(ABS(fl.amount)), 0),
    COUNT(DISTINCT ft.id)
  INTO v_total_a_pagar, v_count_a_pagar
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = v_user_id
    AND ft.is_void = false
    AND fa.type = 'expense'
    AND fl.amount > 0
    AND ft.related_entity_type IS NULL
    AND (p_start_date IS NULL OR ft.transaction_date::date >= p_start_date)
    AND (p_end_date IS NULL OR ft.transaction_date::date <= p_end_date);

  RETURN json_build_object(
    'total_a_receber', v_total_a_receber,
    'total_a_pagar', v_total_a_pagar,
    'count_a_receber', v_count_a_receber,
    'count_a_pagar', v_count_a_pagar
  );
END;
$$;

-- 2. Corrigir get_cash_flow_with_projection
CREATE OR REPLACE FUNCTION get_cash_flow_with_projection(
  p_start_date DATE,
  p_end_date DATE,
  p_granularity TEXT DEFAULT 'day'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN '[]'::JSON;
  END IF;

  WITH date_series AS (
    SELECT generate_series(p_start_date, p_end_date, 
      CASE p_granularity 
        WHEN 'month' THEN '1 month'::interval 
        ELSE '1 day'::interval 
      END
    )::date AS period_date
  ),
  realized AS (
    SELECT 
      ft.transaction_date::date as tx_date,
      SUM(CASE 
        WHEN fa.type = 'revenue' THEN ABS(fl.amount)
        ELSE 0 
      END) as income,
      SUM(CASE 
        WHEN fa.type = 'expense' THEN ABS(fl.amount)
        ELSE 0 
      END) as expense
    FROM financial_transactions ft
    JOIN financial_ledger fl ON fl.transaction_id = ft.id
    JOIN financial_accounts fa ON fa.id = fl.account_id
    LEFT JOIN transactions t ON t.id::text = ft.related_entity_id 
      AND ft.related_entity_type = 'legacy_transaction'
    WHERE ft.user_id = v_user_id
      AND ft.is_void = false
      AND (fa.type IN ('revenue', 'expense'))
      AND (
        ft.related_entity_type IS NULL
        OR t.status = 'PAGO'
      )
      AND ft.transaction_date::date >= p_start_date
      AND ft.transaction_date::date <= p_end_date
    GROUP BY ft.transaction_date::date
  ),
  pending AS (
    SELECT 
      ft.transaction_date::date as tx_date,
      SUM(CASE 
        WHEN fa.code = '1.2.01' AND fl.amount > 0 THEN ABS(fl.amount)
        ELSE 0 
      END) as pending_income,
      0::numeric as pending_expense
    FROM financial_transactions ft
    JOIN financial_ledger fl ON fl.transaction_id = ft.id
    JOIN financial_accounts fa ON fa.id = fl.account_id
    LEFT JOIN transactions t ON t.id::text = ft.related_entity_id 
      AND ft.related_entity_type = 'legacy_transaction'
    WHERE ft.user_id = v_user_id
      AND ft.is_void = false
      AND fa.code = '1.2.01'
      AND fl.amount > 0
      AND (t.id IS NULL OR t.status != 'PAGO')
      AND ft.transaction_date::date >= p_start_date
      AND ft.transaction_date::date <= p_end_date
    GROUP BY ft.transaction_date::date
  ),
  combined AS (
    SELECT 
      ds.period_date,
      COALESCE(r.income, 0) as income,
      COALESCE(r.expense, 0) as expense,
      COALESCE(p.pending_income, 0) as pending_income,
      COALESCE(p.pending_expense, 0) as pending_expense
    FROM date_series ds
    LEFT JOIN realized r ON r.tx_date = ds.period_date
    LEFT JOIN pending p ON p.tx_date = ds.period_date
  )
  SELECT json_agg(
    json_build_object(
      'period', to_char(period_date, 
        CASE p_granularity 
          WHEN 'month' THEN 'YYYY-MM' 
          ELSE 'YYYY-MM-DD' 
        END
      ),
      'income', income,
      'expense', expense,
      'pending_income', pending_income,
      'pending_expense', pending_expense,
      'net', income - expense,
      'projected_net', (income + pending_income) - (expense + pending_expense)
    )
    ORDER BY period_date
  )
  INTO v_result
  FROM combined;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- 3. Adicionar campo financial_settings à tabela brokerages
ALTER TABLE brokerages 
ADD COLUMN IF NOT EXISTS financial_settings JSONB DEFAULT '{}'::jsonb;

-- 4. Criar trigger para sincronizar novas comissões para o ERP
CREATE OR REPLACE FUNCTION sync_new_commission_to_erp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Buscar conta Comissões a Receber do usuário
  SELECT id INTO v_receivable_account_id
  FROM financial_accounts 
  WHERE user_id = NEW.user_id 
    AND code = '1.2.01'
    AND type = 'asset'
    AND status = 'active'
  LIMIT 1;

  -- Buscar conta Receita de Comissões
  SELECT id INTO v_revenue_account_id
  FROM financial_accounts 
  WHERE user_id = NEW.user_id 
    AND code = '4.1.01'
    AND type = 'revenue'
    AND status = 'active'
  LIMIT 1;

  -- Se não encontrar contas, sair silenciosamente
  IF v_receivable_account_id IS NULL OR v_revenue_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar nome do cliente
  SELECT name INTO v_client_name
  FROM clientes
  WHERE id = NEW.client_id;

  -- Buscar nome do ramo (via apólice)
  SELECT r.nome INTO v_ramo_name
  FROM apolices a
  JOIN ramos r ON r.id = a.ramo_id
  WHERE a.id = NEW.policy_id;

  -- Montar descrição rica
  v_description := 'Comissão: ' || COALESCE(v_client_name, 'Cliente') || 
                   COALESCE(' - ' || v_ramo_name, '');

  -- Criar transação financeira
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
    v_description,
    COALESCE(NEW.transaction_date, NEW.date, CURRENT_DATE),
    'COMMISSION-' || NEW.id::text,
    'legacy_transaction',
    NEW.id::text
  )
  RETURNING id INTO v_ft_id;

  -- Criar ledger entries (partidas dobradas)
  -- Débito em Comissões a Receber
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_ft_id, v_receivable_account_id, NEW.amount, 'Comissão a receber');

  -- Crédito em Receita de Comissões
  INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
  VALUES (v_ft_id, v_revenue_account_id, -NEW.amount, 'Receita de comissão');

  RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir e criar novo
DROP TRIGGER IF EXISTS trg_sync_commission_to_erp ON transactions;
CREATE TRIGGER trg_sync_commission_to_erp
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION sync_new_commission_to_erp();

-- 5. Grant
GRANT EXECUTE ON FUNCTION sync_new_commission_to_erp TO authenticated;