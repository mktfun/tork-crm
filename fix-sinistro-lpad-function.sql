-- =====================================================
-- FIX PARA FUNÇÃO generate_claim_number - CORRIGE ERRO LPAD
-- Sistema: SGC Pro - Supabase
-- Executar no Supabase SQL Editor
-- =====================================================

-- Corrigir a função generate_claim_number com cast correto
CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.claim_number IS NULL THEN
    NEW.claim_number := 'SIN-' || TO_CHAR(now(), 'YYYY') || '-' || 
                       LPAD((COALESCE(
                         (SELECT MAX(CAST(SUBSTRING(claim_number FROM 'SIN-\d{4}-(\d+)') AS INTEGER)) 
                          FROM public.sinistros 
                          WHERE claim_number LIKE 'SIN-' || TO_CHAR(now(), 'YYYY') || '-%'), 0) + 1)::TEXT, 
                       4, '0');
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- COMENTÁRIO: A mudança principal é o cast ::TEXT
-- na expressão COALESCE(...) + 1)::TEXT antes do LPAD
-- =====================================================
