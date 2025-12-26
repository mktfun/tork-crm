-- ============================================================
-- FASE 7: Safe Delete e funções auxiliares
-- ============================================================

-- 1. Função para contar lançamentos de uma conta no ledger
CREATE OR REPLACE FUNCTION count_ledger_entries_by_account(p_account_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM financial_ledger fl
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fl.account_id = p_account_id 
    AND ft.user_id = auth.uid()
    AND (ft.is_void IS NULL OR ft.is_void = false);
$$;

-- 2. Função de exclusão segura com migração de lançamentos
CREATE OR REPLACE FUNCTION delete_financial_account_safe(
  p_target_account_id uuid,
  p_migrate_to_account_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_count integer;
  v_user_id uuid;
  v_target_type text;
  v_migrate_type text;
  v_is_system boolean;
BEGIN
  v_user_id := auth.uid();
  
  -- Verificar se a conta existe e pertence ao usuário
  SELECT type, is_system INTO v_target_type, v_is_system
  FROM financial_accounts
  WHERE id = p_target_account_id 
    AND user_id = v_user_id;
    
  IF v_target_type IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Conta não encontrada'
    );
  END IF;
  
  -- Não permitir excluir contas do sistema
  IF v_is_system = true THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Contas do sistema não podem ser excluídas'
    );
  END IF;
  
  -- Contar lançamentos no ledger
  SELECT COUNT(*) INTO v_entry_count
  FROM financial_ledger fl
  JOIN financial_transactions ft ON ft.id = fl.transaction_id
  WHERE fl.account_id = p_target_account_id 
    AND ft.user_id = v_user_id
    AND (ft.is_void IS NULL OR ft.is_void = false);
  
  -- Se há lançamentos e nenhuma conta destino foi fornecida
  IF v_entry_count > 0 AND p_migrate_to_account_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Conta possui movimentações. Escolha uma conta de destino para migrar os lançamentos.',
      'entry_count', v_entry_count,
      'requires_migration', true
    );
  END IF;
  
  -- Se há conta destino, validar compatibilidade
  IF p_migrate_to_account_id IS NOT NULL THEN
    SELECT type INTO v_migrate_type
    FROM financial_accounts
    WHERE id = p_migrate_to_account_id 
      AND user_id = v_user_id 
      AND status = 'active';
      
    IF v_migrate_type IS NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Conta destino inválida ou inativa'
      );
    END IF;
    
    -- Verificar compatibilidade de tipos
    IF v_target_type != v_migrate_type THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Tipos de conta incompatíveis. Origem: ' || v_target_type || ', Destino: ' || v_migrate_type
      );
    END IF;
    
    -- Migrar todos os lançamentos para a conta destino
    UPDATE financial_ledger
    SET account_id = p_migrate_to_account_id
    WHERE account_id = p_target_account_id;
  END IF;
  
  -- Arquivar a conta (soft delete)
  UPDATE financial_accounts
  SET status = 'archived', updated_at = now()
  WHERE id = p_target_account_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'migrated_entries', COALESCE(v_entry_count, 0),
    'message', CASE 
      WHEN v_entry_count > 0 THEN v_entry_count || ' lançamentos migrados com sucesso'
      ELSE 'Conta arquivada com sucesso'
    END
  );
END;
$$;

-- 3. Função para buscar transações de receita com filtro de data
CREATE OR REPLACE FUNCTION get_revenue_transactions(
  p_start_date date,
  p_end_date date,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  description text,
  transaction_date date,
  reference_number text,
  created_at timestamptz,
  is_void boolean,
  total_amount numeric,
  account_names text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ft.id,
    ft.description,
    ft.transaction_date,
    ft.reference_number,
    ft.created_at,
    COALESCE(ft.is_void, false) as is_void,
    -- Soma dos débitos (entradas positivas = receita no ativo)
    SUM(CASE WHEN fl.amount > 0 THEN fl.amount ELSE 0 END) as total_amount,
    STRING_AGG(DISTINCT fa.name, ', ') as account_names
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = auth.uid()
    AND (ft.is_void IS NULL OR ft.is_void = false)
    AND ft.transaction_date BETWEEN p_start_date AND p_end_date
    -- Filtrar apenas transações que têm lançamento em conta de receita
    AND EXISTS (
      SELECT 1 FROM financial_ledger fl2
      JOIN financial_accounts fa2 ON fa2.id = fl2.account_id
      WHERE fl2.transaction_id = ft.id AND fa2.type = 'revenue'
    )
  GROUP BY ft.id, ft.description, ft.transaction_date, ft.reference_number, ft.created_at, ft.is_void
  ORDER BY ft.transaction_date DESC, ft.created_at DESC
  LIMIT p_limit;
$$;

-- 4. Função para somar receitas do período (para comparação legado vs financeiro)
CREATE OR REPLACE FUNCTION get_revenue_totals(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  financial_total numeric,
  legacy_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH financial_sum AS (
    SELECT COALESCE(SUM(ABS(fl.amount)), 0) as total
    FROM financial_ledger fl
    JOIN financial_transactions ft ON ft.id = fl.transaction_id
    JOIN financial_accounts fa ON fa.id = fl.account_id
    WHERE ft.user_id = auth.uid()
      AND (ft.is_void IS NULL OR ft.is_void = false)
      AND ft.transaction_date BETWEEN p_start_date AND p_end_date
      AND fa.type = 'revenue'
  ),
  legacy_sum AS (
    SELECT COALESCE(SUM(t.amount), 0) as total
    FROM transactions t
    WHERE t.user_id = auth.uid()
      AND t.nature = 'RECEITA'
      AND t.status = 'PAGO'
      AND t.transaction_date BETWEEN p_start_date AND p_end_date
  )
  SELECT 
    (SELECT total FROM financial_sum) as financial_total,
    (SELECT total FROM legacy_sum) as legacy_total;
$$;