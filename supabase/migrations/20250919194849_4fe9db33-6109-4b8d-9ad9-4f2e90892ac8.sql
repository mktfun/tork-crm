-- FASE 1: Adicionar nova coluna para estratégia personalizada de parcelas
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS commission_settlement_installments INTEGER DEFAULT 1;

-- Garante que os valores não sejam nulos
UPDATE public.profiles 
SET commission_settlement_installments = 1 
WHERE commission_settlement_installments IS NULL;

-- Define a coluna como NOT NULL após preencher valores padrão
ALTER TABLE public.profiles
ALTER COLUMN commission_settlement_installments SET NOT NULL;

-- Atualiza estratégia padrão para 'all' conforme especificação
UPDATE public.profiles 
SET commission_settlement_strategy = 'all' 
WHERE commission_settlement_strategy = 'first';

-- FASE 2: Função de automação de baixa de comissões REFATORADA
CREATE OR REPLACE FUNCTION public.settle_due_commissions_v2()
RETURNS text AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH target_users AS (
    -- Seleciona os usuários com a automação ativa
    SELECT 
      id, 
      commission_settlement_days, 
      commission_settlement_strategy, 
      commission_settlement_installments 
    FROM public.profiles 
    WHERE settle_commissions_automatically = true
  ),
  transactions_with_rank AS (
    -- Enumera as parcelas de cada apólice para cada usuário
    SELECT 
      t.id,
      t.user_id,
      ROW_NUMBER() OVER(PARTITION BY t.user_id, t.policy_id ORDER BY t.due_date ASC) as installment_rank
    FROM public.transactions t
    JOIN target_users u ON t.user_id = u.id
    JOIN public.apolices a ON t.policy_id = a.id
    WHERE t.nature = 'RECEITA'
      AND t.status = 'PENDENTE'
      AND a.status = 'Ativa'
      -- GATILHO CORRIGIDO: usa created_at da transação, não due_date
      AND t.created_at <= (CURRENT_DATE - (u.commission_settlement_days || ' days')::interval)
  ),
  transactions_to_update AS (
    -- Filtra as transações com base na estratégia de cada usuário
    SELECT t.id FROM transactions_with_rank t
    JOIN target_users u ON t.user_id = u.id
    WHERE 
      (u.commission_settlement_strategy = 'all') OR
      (u.commission_settlement_strategy = 'first' AND t.installment_rank = 1) OR
      (u.commission_settlement_strategy = 'custom' AND t.installment_rank <= u.commission_settlement_installments)
  )
  -- Finalmente, atualiza as transações selecionadas
  UPDATE public.transactions
  SET 
    status = 'PAGO',
    transaction_date = CURRENT_DATE
  WHERE id IN (SELECT id FROM transactions_to_update);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Log da operação para auditoria
  INSERT INTO public.notifications (user_id, message)
  SELECT DISTINCT 
    t.user_id,
    'Automação V2: ' || COUNT(*) || ' comissão(ões) marcada(s) como paga(s) automaticamente'
  FROM public.transactions t
  JOIN target_users u ON t.user_id = u.id
  WHERE t.status = 'PAGO' 
    AND t.transaction_date = CURRENT_DATE
    AND t.nature = 'RECEITA'
  GROUP BY t.user_id
  HAVING COUNT(*) > 0;
  
  RETURN 'Baixa automática V2 concluída. Transações atualizadas: ' || updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FASE 3: Cancelar job antigo e agendar novo
SELECT cron.unschedule('daily-commission-settlement');

-- Agendar a NOVA função
SELECT cron.schedule(
  'daily-commission-settlement-v2',
  '0 3 * * *',
  $$ SELECT public.settle_due_commissions_v2(); $$
);