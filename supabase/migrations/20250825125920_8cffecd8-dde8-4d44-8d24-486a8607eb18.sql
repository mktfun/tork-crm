-- Add missing priority field to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal';