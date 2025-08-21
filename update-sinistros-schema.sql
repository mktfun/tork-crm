-- =====================================================
-- SCRIPT DE ATUALIZAÇÃO - ADICIONAR COMPANY_ID
-- Execute apenas se as tabelas já existem
-- =====================================================

-- Adicionar coluna company_id à tabela sinistros
ALTER TABLE public.sinistros 
ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Criar índice para a nova coluna
CREATE INDEX idx_sinistros_company_id ON public.sinistros(company_id);

-- Atualizar a view sinistros_complete para incluir company_name
DROP VIEW IF EXISTS public.sinistros_complete;

CREATE VIEW public.sinistros_complete AS
SELECT 
  s.*,
  c.name as client_name,
  c.phone as client_phone,
  a.policy_number,
  a.insurance_company,
  p.name as producer_name,
  b.name as brokerage_name,
  co.name as company_name
FROM public.sinistros s
LEFT JOIN public.clientes c ON s.client_id = c.id
LEFT JOIN public.apolices a ON s.policy_id = a.id
LEFT JOIN public.producers p ON s.producer_id = p.id
LEFT JOIN public.brokerages b ON s.brokerage_id = b.id
LEFT JOIN public.companies co ON s.company_id = co.id;

-- =====================================================
-- COMENTÁRIOS PARA A NOVA COLUNA
-- =====================================================

COMMENT ON COLUMN public.sinistros.company_id IS 'Referência direta à seguradora responsável pelo sinistro';

-- =====================================================
-- FIM DO SCRIPT DE ATUALIZAÇÃO
-- =====================================================

-- INSTRUÇÕES:
-- 1. Execute este script apenas se as tabelas já foram criadas
-- 2. Se ainda não criou as tabelas, use o schema-sinistros-supabase.sql completo
-- 3. Após a execução, regenere os types TypeScript
