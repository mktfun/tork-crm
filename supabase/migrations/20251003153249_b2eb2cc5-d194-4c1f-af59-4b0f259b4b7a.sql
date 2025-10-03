-- =====================================================
-- REMOVER TRIGGER E FUNÇÃO LEGADOS DE RECORRÊNCIA
-- =====================================================
-- Esta migration remove o trigger e a função que tentavam
-- criar agendamentos recorrentes automaticamente via banco.
-- A lógica agora é toda controlada pela Edge Function
-- create-next-appointment invocada pelo frontend.

-- 1. Remover o trigger que dispara na conclusão de agendamentos
DROP TRIGGER IF EXISTS on_appointment_completed ON public.appointments;

-- 2. Remover a função que tentava criar o próximo agendamento
DROP FUNCTION IF EXISTS public.handle_completed_appointment();

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================

COMMENT ON TABLE public.appointments IS 'Tabela de agendamentos. A criação de agendamentos recorrentes é gerenciada pela Edge Function create-next-appointment.';