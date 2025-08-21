-- =====================================================
-- FIX PARA TORNAR policy_id OPCIONAL NA TABELA SINISTROS
-- Sistema: SGC Pro - Supabase
-- Executar no Supabase SQL Editor
-- =====================================================

-- Remover a constraint NOT NULL do campo policy_id
ALTER TABLE public.sinistros 
ALTER COLUMN policy_id DROP NOT NULL;

-- Comentário sobre a mudança
COMMENT ON COLUMN public.sinistros.policy_id IS 'ID da apólice relacionada (opcional) - permite sinistros sem vinculação inicial';

-- =====================================================
-- EXPLICAÇÃO:
-- O formulário permite criar sinistros sem vincular uma apólice
-- específica, tornando necessário que o campo seja opcional no banco.
-- A vinculação pode ser feita posteriormente.
-- =====================================================
