-- ============================================================
-- FASE 1: Tabela de Templates Recorrentes + RLS
-- FASE 2: RPC de Projeção de Fluxo de Caixa
-- ============================================================

-- 1. Criar tabela de configurações recorrentes
CREATE TABLE public.financial_recurring_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identificação
  name TEXT NOT NULL,
  description TEXT,
  
  -- Valores
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  nature TEXT NOT NULL CHECK (nature IN ('expense', 'revenue')),
  
  -- Conta contábil vinculada
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  
  -- Configuração de Recorrência
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  
  -- Controle
  is_active BOOLEAN DEFAULT true,
  last_generated_date DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices para performance
CREATE INDEX idx_recurring_configs_user_active ON public.financial_recurring_configs(user_id, is_active);
CREATE INDEX idx_recurring_configs_dates ON public.financial_recurring_configs(start_date, end_date);

-- 3. RLS para financial_recurring_configs
ALTER TABLE public.financial_recurring_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring configs"
ON public.financial_recurring_configs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recurring configs"
ON public.financial_recurring_configs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring configs"
ON public.financial_recurring_configs
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring configs"
ON public.financial_recurring_configs
FOR DELETE
USING (auth.uid() = user_id);

-- 4. Trigger para updated_at
CREATE TRIGGER update_financial_recurring_configs_updated_at
BEFORE UPDATE ON public.financial_recurring_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FASE 2: RPC de Projeção de Fluxo de Caixa
-- ============================================================

-- Função auxiliar para gerar datas de recorrência
CREATE OR REPLACE FUNCTION public.generate_recurring_dates(
  p_start_date DATE,
  p_end_date DATE,
  p_frequency TEXT,
  p_day_of_month INTEGER,
  p_config_start_date DATE,
  p_config_end_date DATE
)
RETURNS TABLE(occurrence_date DATE)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_current DATE;
  v_effective_start DATE;
  v_effective_end DATE;
  v_interval INTERVAL;
BEGIN
  -- Determinar intervalo baseado na frequência
  v_interval := CASE p_frequency
    WHEN 'weekly' THEN INTERVAL '1 week'
    WHEN 'monthly' THEN INTERVAL '1 month'
    WHEN 'quarterly' THEN INTERVAL '3 months'
    WHEN 'yearly' THEN INTERVAL '1 year'
    ELSE INTERVAL '1 month'
  END;
  
  -- Determinar período efetivo
  v_effective_start := GREATEST(p_start_date, p_config_start_date);
  v_effective_end := CASE 
    WHEN p_config_end_date IS NULL THEN p_end_date
    ELSE LEAST(p_end_date, p_config_end_date)
  END;
  
  -- Para frequência mensal, começar no dia correto
  IF p_frequency = 'monthly' AND p_day_of_month IS NOT NULL THEN
    v_current := make_date(
      EXTRACT(YEAR FROM v_effective_start)::int,
      EXTRACT(MONTH FROM v_effective_start)::int,
      LEAST(p_day_of_month, 
        EXTRACT(DAY FROM (date_trunc('month', v_effective_start) + INTERVAL '1 month' - INTERVAL '1 day'))::int
      )
    );
    IF v_current < v_effective_start THEN
      v_current := v_current + INTERVAL '1 month';
    END IF;
  ELSE
    v_current := v_effective_start;
  END IF;
  
  -- Gerar datas
  WHILE v_current <= v_effective_end LOOP
    occurrence_date := v_current;
    RETURN NEXT;
    v_current := v_current + v_interval;
    
    -- Ajustar dia do mês para frequências mensais
    IF p_frequency = 'monthly' AND p_day_of_month IS NOT NULL THEN
      v_current := make_date(
        EXTRACT(YEAR FROM v_current)::int,
        EXTRACT(MONTH FROM v_current)::int,
        LEAST(p_day_of_month, 
          EXTRACT(DAY FROM (date_trunc('month', v_current) + INTERVAL '1 month' - INTERVAL '1 day'))::int
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- Função principal de projeção de fluxo de caixa
CREATE OR REPLACE FUNCTION public.get_projected_cashflow(
  p_start_date DATE,
  p_end_date DATE,
  p_granularity TEXT DEFAULT 'day'
)
RETURNS TABLE(
  period TEXT,
  period_date DATE,
  realized_income NUMERIC,
  realized_expense NUMERIC,
  projected_income NUMERIC,
  projected_expense NUMERIC,
  running_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_balance NUMERIC;
  v_accumulated NUMERIC := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Obter saldo atual das contas de ativo (bancos)
  SELECT COALESCE(SUM(fl.amount), 0) INTO v_current_balance
  FROM financial_ledger fl
  JOIN financial_accounts fa ON fa.id = fl.account_id
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fa.user_id = v_user_id
    AND fa.type = 'asset'
    AND ft.is_void = false
    AND ft.transaction_date < p_start_date;
  
  v_accumulated := v_current_balance;
  
  -- CTE com todos os períodos e dados
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      CASE p_granularity
        WHEN 'day' THEN INTERVAL '1 day'
        WHEN 'week' THEN INTERVAL '1 week'
        WHEN 'month' THEN INTERVAL '1 month'
        ELSE INTERVAL '1 day'
      END
    )::date AS period_date
  ),
  
  -- Transações realizadas (não pendentes)
  realized AS (
    SELECT 
      CASE p_granularity
        WHEN 'day' THEN ft.transaction_date
        WHEN 'week' THEN date_trunc('week', ft.transaction_date)::date
        WHEN 'month' THEN date_trunc('month', ft.transaction_date)::date
      END AS period_date,
      SUM(CASE WHEN fa.type = 'revenue' THEN ABS(fl.amount) ELSE 0 END) AS income,
      SUM(CASE WHEN fa.type = 'expense' THEN ABS(fl.amount) ELSE 0 END) AS expense
    FROM financial_transactions ft
    JOIN financial_ledger fl ON fl.transaction_id = ft.id
    JOIN financial_accounts fa ON fa.id = fl.account_id
    WHERE ft.user_id = v_user_id
      AND ft.is_void = false
      AND ft.status = 'confirmed'
      AND ft.transaction_date BETWEEN p_start_date AND p_end_date
      AND fa.type IN ('revenue', 'expense')
    GROUP BY 1
  ),
  
  -- Transações pendentes (projeção real - comissões a receber)
  pending AS (
    SELECT 
      CASE p_granularity
        WHEN 'day' THEN ft.transaction_date
        WHEN 'week' THEN date_trunc('week', ft.transaction_date)::date
        WHEN 'month' THEN date_trunc('month', ft.transaction_date)::date
      END AS period_date,
      SUM(CASE WHEN fa.type = 'revenue' THEN ABS(fl.amount) ELSE 0 END) AS income,
      SUM(CASE WHEN fa.type = 'expense' THEN ABS(fl.amount) ELSE 0 END) AS expense
    FROM financial_transactions ft
    JOIN financial_ledger fl ON fl.transaction_id = ft.id
    JOIN financial_accounts fa ON fa.id = fl.account_id
    WHERE ft.user_id = v_user_id
      AND ft.is_void = false
      AND ft.status = 'pending'
      AND ft.transaction_date BETWEEN p_start_date AND p_end_date
      AND fa.type IN ('revenue', 'expense')
    GROUP BY 1
  ),
  
  -- Despesas/Receitas recorrentes projetadas
  recurring AS (
    SELECT 
      CASE p_granularity
        WHEN 'day' THEN rd.occurrence_date
        WHEN 'week' THEN date_trunc('week', rd.occurrence_date)::date
        WHEN 'month' THEN date_trunc('month', rd.occurrence_date)::date
      END AS period_date,
      SUM(CASE WHEN rc.nature = 'revenue' THEN rc.amount ELSE 0 END) AS income,
      SUM(CASE WHEN rc.nature = 'expense' THEN rc.amount ELSE 0 END) AS expense
    FROM financial_recurring_configs rc
    CROSS JOIN LATERAL generate_recurring_dates(
      p_start_date,
      p_end_date,
      rc.frequency,
      rc.day_of_month,
      rc.start_date,
      rc.end_date
    ) rd
    WHERE rc.user_id = v_user_id
      AND rc.is_active = true
      AND (rc.last_generated_date IS NULL OR rd.occurrence_date > rc.last_generated_date)
    GROUP BY 1
  ),
  
  -- Combinar todos os dados
  combined AS (
    SELECT 
      ds.period_date,
      COALESCE(r.income, 0) AS realized_income,
      COALESCE(r.expense, 0) AS realized_expense,
      COALESCE(p.income, 0) + COALESCE(rec.income, 0) AS projected_income,
      COALESCE(p.expense, 0) + COALESCE(rec.expense, 0) AS projected_expense
    FROM date_series ds
    LEFT JOIN realized r ON r.period_date = ds.period_date
    LEFT JOIN pending p ON p.period_date = ds.period_date
    LEFT JOIN recurring rec ON rec.period_date = ds.period_date
    ORDER BY ds.period_date
  )
  
  -- Calcular running balance
  SELECT 
    CASE p_granularity
      WHEN 'day' THEN to_char(c.period_date, 'DD/MM')
      WHEN 'week' THEN 'Sem ' || to_char(c.period_date, 'WW')
      WHEN 'month' THEN to_char(c.period_date, 'Mon/YY')
    END AS period,
    c.period_date,
    c.realized_income,
    c.realized_expense,
    c.projected_income,
    c.projected_expense,
    v_current_balance + SUM(
      (c.realized_income + c.projected_income) - (c.realized_expense + c.projected_expense)
    ) OVER (ORDER BY c.period_date) AS running_balance
  FROM combined c
  ORDER BY c.period_date;
END;
$$;