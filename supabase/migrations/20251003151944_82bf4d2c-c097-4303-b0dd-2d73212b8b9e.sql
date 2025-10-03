-- Adicionar colunas de recorrência à tabela appointments
-- Esta migração reconstrói a funcionalidade de recorrência com uma arquitetura melhorada

ALTER TABLE public.appointments
ADD COLUMN recurrence_rule TEXT,
ADD COLUMN parent_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
ADD COLUMN original_start_timestamptz TIMESTAMPTZ;

COMMENT ON COLUMN public.appointments.recurrence_rule IS 'Armazena a regra de recorrência no formato RRULE (RFC 5545). Ex: "FREQ=MONTHLY;INTERVAL=1"';
COMMENT ON COLUMN public.appointments.parent_appointment_id IS 'Aponta para o ID do primeiro agendamento da série recorrente';
COMMENT ON COLUMN public.appointments.original_start_timestamptz IS 'Timestamp original do início da série, para recalcular a recorrência mesmo se ocorrências individuais forem movidas';