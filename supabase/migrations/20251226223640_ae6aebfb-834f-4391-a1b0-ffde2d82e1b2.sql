-- =====================================================
-- FASE 11: REPARO DE INTEGRIDADE TEMPORAL
-- Corrige RPCs, Trigger e Filtros de Data
-- =====================================================

-- 1. Recriar count_wrong_backfill_dates com JOIN CORRETO
DROP FUNCTION IF EXISTS count_wrong_backfill_dates();
CREATE OR REPLACE FUNCTION count_wrong_backfill_dates()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int
  FROM financial_transactions ft
  JOIN transactions t ON ft.related_entity_id = t.id  -- uuid = uuid (correto!)
  WHERE ft.user_id = auth.uid()
    AND ft.related_entity_type = 'legacy_transaction'
    AND ft.is_void = false
    AND ft.transaction_date::date IS DISTINCT FROM t.date::date;
$$;

-- 2. Recriar fix_backfill_dates com JOIN CORRETO
DROP FUNCTION IF EXISTS fix_backfill_dates();
CREATE OR REPLACE FUNCTION fix_backfill_dates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count int;
BEGIN
  UPDATE financial_transactions ft
  SET transaction_date = t.date::date
  FROM transactions t
  WHERE ft.related_entity_id = t.id  -- uuid = uuid (correto!)
    AND ft.user_id = auth.uid()
    AND ft.related_entity_type = 'legacy_transaction'
    AND ft.is_void = false
    AND ft.transaction_date::date IS DISTINCT FROM t.date::date;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated_count', v_count);
END;
$$;

-- 3. Recriar trigger sync_transaction_to_ledger SEM usar NOW()
CREATE OR REPLACE FUNCTION sync_transaction_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transaction_id uuid;
  v_revenue_account_id uuid;
  v_asset_account_id uuid;
  v_amount numeric;
  v_description text;
  -- CORREÇÃO: Usar a data da transação original, NUNCA now()
  v_transaction_date date := COALESCE(NEW.paid_date, NEW.date, NEW.created_at)::date;
BEGIN
  -- Só sincroniza quando status muda para PAGO
  IF NEW.status = 'PAGO' AND (OLD.status IS NULL OR OLD.status != 'PAGO') THEN
    
    -- Buscar conta de receita (Comissões)
    SELECT id INTO v_revenue_account_id
    FROM financial_accounts
    WHERE user_id = NEW.user_id
      AND type = 'revenue'
      AND name ILIKE '%comiss%'
      AND status = 'active'
    LIMIT 1;
    
    -- Buscar conta de ativo (Caixa/Banco)
    SELECT id INTO v_asset_account_id
    FROM financial_accounts
    WHERE user_id = NEW.user_id
      AND type = 'asset'
      AND status = 'active'
    ORDER BY 
      CASE WHEN name ILIKE '%caixa%' THEN 1
           WHEN name ILIKE '%banco%' THEN 2
           ELSE 3 END
    LIMIT 1;
    
    -- Se não encontrou as contas, não faz nada
    IF v_revenue_account_id IS NULL OR v_asset_account_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Verificar se já existe transação financeira para este registro
    SELECT id INTO v_transaction_id
    FROM financial_transactions
    WHERE related_entity_id = NEW.id
      AND related_entity_type = 'legacy_transaction'
      AND user_id = NEW.user_id;
    
    -- Se já existe, não duplica
    IF v_transaction_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    v_amount := NEW.amount;
    v_description := COALESCE(NEW.description, 'Comissão');
    
    -- Criar transação financeira com a DATA CORRETA
    INSERT INTO financial_transactions (
      user_id,
      created_by,
      description,
      transaction_date,  -- USA A DATA DA TRANSAÇÃO ORIGINAL!
      related_entity_id,
      related_entity_type
    ) VALUES (
      NEW.user_id,
      NEW.user_id,
      v_description,
      v_transaction_date,  -- NUNCA usa now()!
      NEW.id,
      'legacy_transaction'
    ) RETURNING id INTO v_transaction_id;
    
    -- Criar lançamentos no ledger
    -- Débito no ativo (entrada de dinheiro)
    INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
    VALUES (v_transaction_id, v_asset_account_id, v_amount, v_description);
    
    -- Crédito na receita
    INSERT INTO financial_ledger (transaction_id, account_id, amount, memo)
    VALUES (v_transaction_id, v_revenue_account_id, -v_amount, v_description);
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Recriar RPC get_revenue_transactions com JOINs e filtros corretos
DROP FUNCTION IF EXISTS get_revenue_transactions(date, date, integer);
CREATE OR REPLACE FUNCTION get_revenue_transactions(
  p_start_date date,
  p_end_date date,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  description text,
  transaction_date date,
  amount numeric,
  account_name text,
  is_confirmed boolean,
  legacy_status text,
  client_name text,
  policy_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ft.id,
    ft.description,
    ft.transaction_date::date,
    ABS(fl.amount) as amount,
    fa.name as account_name,
    NOT COALESCE(ft.is_void, false) as is_confirmed,
    -- Buscar status do legado com JOIN correto
    (
      SELECT t.status 
      FROM transactions t 
      WHERE t.id = ft.related_entity_id  -- uuid = uuid (correto!)
      LIMIT 1
    ) as legacy_status,
    -- Buscar nome do cliente
    (
      SELECT c.name 
      FROM transactions t 
      JOIN clientes c ON c.id = t.client_id
      WHERE t.id = ft.related_entity_id
      LIMIT 1
    ) as client_name,
    -- Buscar número da apólice
    (
      SELECT a.policy_number 
      FROM transactions t 
      JOIN apolices a ON a.id = t.policy_id
      WHERE t.id = ft.related_entity_id
      LIMIT 1
    ) as policy_number
  FROM financial_transactions ft
  JOIN financial_ledger fl ON fl.transaction_id = ft.id
  JOIN financial_accounts fa ON fa.id = fl.account_id
  WHERE ft.user_id = auth.uid()
    AND fa.type = 'revenue'
    AND ft.is_void = false
    AND ft.transaction_date::date BETWEEN p_start_date::date AND p_end_date::date  -- Filtro com ::date
  ORDER BY ft.transaction_date DESC
  LIMIT p_limit;
END;
$$;

-- 5. Garantir que o trigger está ativo na tabela transactions
DROP TRIGGER IF EXISTS trigger_sync_transaction_to_ledger ON transactions;
CREATE TRIGGER trigger_sync_transaction_to_ledger
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_transaction_to_ledger();