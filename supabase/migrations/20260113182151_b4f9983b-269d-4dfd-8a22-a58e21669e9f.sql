-- ============================================================
-- Sincronizar transações legadas órfãs para o ERP
-- ============================================================

INSERT INTO financial_transactions (
  user_id,
  description,
  transaction_date,
  status,
  related_entity_type,
  related_entity_id,
  created_by
)
SELECT 
  t.user_id,
  t.description,
  COALESCE(t.due_date, t.date)::date,
  CASE WHEN t.status = 'PENDENTE' THEN 'pending' ELSE 'completed' END,
  'legacy_transaction',
  t.id,
  t.user_id
FROM transactions t
WHERE t.status = 'PENDENTE'
AND NOT EXISTS (
  SELECT 1 FROM financial_transactions ft 
  WHERE ft.related_entity_id = t.id 
  AND ft.related_entity_type = 'legacy_transaction'
);

-- ============================================================
-- Verificação final: garantir que todas as transações com legado 
-- PENDENTE estejam como pending no ERP
-- ============================================================

ALTER TABLE financial_transactions DISABLE TRIGGER prevent_financial_transaction_modification;

UPDATE financial_transactions ft
SET status = 'pending'
WHERE ft.related_entity_type = 'legacy_transaction'
  AND ft.status = 'completed'
  AND EXISTS (
    SELECT 1 FROM transactions t 
    WHERE t.id = ft.related_entity_id 
      AND t.status = 'PENDENTE'
  );

ALTER TABLE financial_transactions ENABLE TRIGGER prevent_financial_transaction_modification;