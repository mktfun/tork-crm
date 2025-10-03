-- Remover colunas de recorrência da tabela appointments
-- ATENÇÃO: Esta operação é irreversível e vai apagar permanentemente os dados dessas colunas

ALTER TABLE public.appointments
DROP COLUMN IF EXISTS is_recurring,
DROP COLUMN IF EXISTS recurrence_rule,
DROP COLUMN IF EXISTS parent_appointment_id;