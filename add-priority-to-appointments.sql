-- Script para adicionar campo de prioridade na tabela appointments
-- Execute no Supabase SQL Editor

-- Verificar se a coluna priority já existe
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'priority'
        AND table_schema = 'public'
    ) THEN 
        -- Adicionar a coluna priority se não existir
        ALTER TABLE public.appointments 
        ADD COLUMN priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Baixa', 'Normal', 'Alta', 'Urgente'));
        
        RAISE NOTICE 'Coluna priority adicionada com sucesso à tabela appointments';
    ELSE 
        RAISE NOTICE 'Coluna priority já existe na tabela appointments';
    END IF;
END $$;

-- Criar índice para melhorar performance em consultas por prioridade
CREATE INDEX IF NOT EXISTS idx_appointments_priority ON public.appointments(priority);

-- Comentário na coluna
COMMENT ON COLUMN public.appointments.priority IS 'Prioridade do agendamento: Baixa, Normal, Alta, Urgente';

-- Verificação final
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments' 
    AND table_schema = 'public'
    AND column_name = 'priority';
