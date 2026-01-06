-- ===========================================
-- FASE 29: Sincronização de Retroativos + RPC Pendentes
-- ===========================================

-- 1. Sincronizar comissões legadas que ainda não estão no ERP Financeiro
DO $$
DECLARE
  v_user_id UUID;
  v_transaction RECORD;
  v_new_ft_id UUID;
  v_receivable_account_id UUID;
  v_revenue_account_id UUID;
  v_count INT := 0;
BEGIN
  -- Iterar sobre cada transação legada de RECEITA que não foi sincronizada
  FOR v_transaction IN 
    SELECT t.* 
    FROM transactions t
    LEFT JOIN financial_transactions ft 
      ON ft.related_entity_id = t.id 
      AND ft.related_entity_type = 'legacy_transaction'
    WHERE t.nature = 'RECEITA' 
      AND ft.id IS NULL
  LOOP
    -- Buscar contas do usuário
    SELECT id INTO v_receivable_account_id
    FROM financial_accounts 
    WHERE user_id = v_transaction.user_id 
      AND code = '1.1.2' 
      AND is_system = true
    LIMIT 1;
    
    SELECT id INTO v_revenue_account_id
    FROM financial_accounts 
    WHERE user_id = v_transaction.user_id 
      AND code = '4.1.1' 
      AND is_system = true
    LIMIT 1;
    
    -- Se contas existem, criar a transação financeira
    IF v_receivable_account_id IS NOT NULL AND v_revenue_account_id IS NOT NULL THEN
      -- Criar financial_transaction
      INSERT INTO financial_transactions (
        user_id,
        created_by,
        description,
        transaction_date,
        reference_number,
        related_entity_type,
        related_entity_id
      ) VALUES (
        v_transaction.user_id,
        v_transaction.user_id,
        v_transaction.description,
        COALESCE(v_transaction.due_date, v_transaction.transaction_date),
        'LEGACY-' || v_transaction.id::text,
        'legacy_transaction',
        v_transaction.id
      )
      RETURNING id INTO v_new_ft_id;
      
      -- Criar ledger entries (double-entry)
      -- Débito em Comissões a Receber (Ativo)
      INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
      VALUES (v_new_ft_id, v_receivable_account_id, v_transaction.amount, 'Comissão a receber - Provisão');
      
      -- Crédito em Receita de Comissões (Receita)
      INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
      VALUES (v_new_ft_id, v_revenue_account_id, -v_transaction.amount, 'Receita de comissão reconhecida');
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Sincronizadas % transações legadas para o ERP Financeiro', v_count;
END $$;

-- 2. Criar RPC para buscar totais pendentes (A Receber e A Pagar)
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
  -- Pegar usuário autenticado
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
  -- Uma receita está pendente quando:
  -- 1. A transação legada associada tem status != 'PAGO'
  SELECT 
    COALESCE(SUM(ABS(fl.amount)), 0),
    COUNT(DISTINCT ft.id)
  INTO v_total_a_receber, v_count_a_receber
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  LEFT JOIN transactions t ON t.id = ft.related_entity_id AND ft.related_entity_type = 'legacy_transaction'
  WHERE ft.user_id = v_user_id
    AND ft.is_void = false
    AND fa.type = 'asset'  -- Conta de ativo (Comissões a Receber)
    AND fa.code = '1.1.2'
    AND fl.amount > 0  -- Débito em ativo = a receber
    AND (t.status IS NULL OR t.status != 'PAGO')
    AND (p_start_date IS NULL OR ft.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ft.transaction_date <= p_end_date);

  -- Calcular total A PAGAR (Despesas pendentes)
  -- Uma despesa está pendente quando:
  -- 1. Não tem transação legada associada E
  -- 2. A conta é de passivo ou despesa
  SELECT 
    COALESCE(SUM(ABS(fl.amount)), 0),
    COUNT(DISTINCT ft.id)
  INTO v_total_a_pagar, v_count_a_pagar
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = v_user_id
    AND ft.is_void = false
    AND fa.type = 'expense'  -- Conta de despesa
    AND fl.amount > 0  -- Débito em despesa = saída
    AND ft.related_entity_type IS NULL  -- Despesa manual (não sincronizada de legacy)
    AND (p_start_date IS NULL OR ft.transaction_date >= p_start_date)
    AND (p_end_date IS NULL OR ft.transaction_date <= p_end_date);

  RETURN json_build_object(
    'total_a_receber', v_total_a_receber,
    'total_a_pagar', v_total_a_pagar,
    'count_a_receber', v_count_a_receber,
    'count_a_pagar', v_count_a_pagar
  );
END;
$$;

-- 3. Criar RPC para cash flow com projeção futura
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
  -- Transações realizadas (legacy com status PAGO)
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
    LEFT JOIN transactions t ON t.id = ft.related_entity_id 
      AND ft.related_entity_type = 'legacy_transaction'
    WHERE ft.user_id = v_user_id
      AND ft.is_void = false
      AND (fa.type IN ('revenue', 'expense'))
      AND (
        ft.related_entity_type IS NULL  -- Despesas manuais
        OR t.status = 'PAGO'  -- Comissões realizadas
      )
      AND ft.transaction_date >= p_start_date
      AND ft.transaction_date <= p_end_date
    GROUP BY ft.transaction_date::date
  ),
  -- Transações pendentes (projeção)
  pending AS (
    SELECT 
      ft.transaction_date::date as tx_date,
      SUM(CASE 
        WHEN fa.type = 'revenue' OR fa.code = '1.1.2' THEN ABS(fl.amount)
        ELSE 0 
      END) as pending_income,
      SUM(CASE 
        WHEN fa.type = 'expense' THEN ABS(fl.amount)
        ELSE 0 
      END) as pending_expense
    FROM financial_transactions ft
    JOIN financial_ledger fl ON fl.transaction_id = ft.id
    JOIN financial_accounts fa ON fa.id = fl.account_id
    LEFT JOIN transactions t ON t.id = ft.related_entity_id 
      AND ft.related_entity_type = 'legacy_transaction'
    WHERE ft.user_id = v_user_id
      AND ft.is_void = false
      AND fa.code = '1.1.2'  -- Comissões a Receber
      AND fl.amount > 0
      AND (t.status IS NULL OR t.status != 'PAGO')
      AND ft.transaction_date >= p_start_date
      AND ft.transaction_date <= p_end_date
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

-- 4. Grants
GRANT EXECUTE ON FUNCTION get_pending_totals TO authenticated;
GRANT EXECUTE ON FUNCTION get_cash_flow_with_projection TO authenticated;