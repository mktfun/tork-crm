-- ============================================================
-- FASE 10: RPCs para Correção de Datas do Backfill
-- ============================================================

-- 1. Função para CONTAR quantas transações financeiras estão com data divergente do legado
CREATE OR REPLACE FUNCTION count_wrong_backfill_dates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM financial_transactions ft
  JOIN transactions t ON ft.related_entity_id = t.id::text
  WHERE ft.user_id = auth.uid()
    AND ft.related_entity_type = 'legacy_transaction'
    AND ft.is_void = false
    AND ft.transaction_date::date IS DISTINCT FROM t.date::date;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- 2. Função para CORRIGIR as datas em massa
CREATE OR REPLACE FUNCTION fix_backfill_dates()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count integer;
BEGIN
  WITH updated_rows AS (
    UPDATE financial_transactions ft
    SET transaction_date = t.date
    FROM transactions t
    WHERE ft.related_entity_id = t.id::text
      AND ft.user_id = auth.uid()
      AND ft.related_entity_type = 'legacy_transaction'
      AND ft.is_void = false
      AND ft.transaction_date::date IS DISTINCT FROM t.date::date
    RETURNING ft.id
  )
  SELECT count(*) INTO v_updated_count FROM updated_rows;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', COALESCE(v_updated_count, 0),
    'message', 'Datas corrigidas com sucesso baseadas na origem.'
  );
END;
$$;