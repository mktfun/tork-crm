-- Script para verificar e corrigir a estrutura da tabela apolices
-- Execute no Supabase SQL Editor

-- Verificar se a tabela existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'apolices'
);

-- Se a tabela não existir, criar uma estrutura básica
CREATE TABLE IF NOT EXISTS public.apolices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  
  -- Dados básicos da apólice
  policy_number TEXT,
  insurance_company TEXT NOT NULL,
  type TEXT NOT NULL,
  insured_asset TEXT,
  
  -- Valores
  premium_value DECIMAL(12,2),
  commission_rate DECIMAL(5,2),
  
  -- Status e datas
  status TEXT NOT NULL DEFAULT 'Orçamento' CHECK (status IN (
    'Orçamento', 'Aguardando Apólice', 'Ativa', 'Cancelada', 'Renovada'
  )),
  start_date DATE,
  expiration_date DATE,
  
  -- Renovação
  renewal_status TEXT CHECK (renewal_status IN (
    'Pendente', 'Em Contato', 'Proposta Enviada', 'Renovada', 'Não Renovada'
  )),
  automatic_renewal BOOLEAN DEFAULT true,
  
  -- Anexos
  pdf_url TEXT,
  pdf_attached_name TEXT,
  pdf_attached_data TEXT,
  
  -- Relacionamentos opcionais
  producer_id UUID,
  brokerage_id INTEGER,
  company_id UUID,
  
  -- Campos adicionais
  bonus_class TEXT,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.apolices ENABLE ROW LEVEL SECURITY;

-- Política RLS básica para usuários autenticados
CREATE POLICY IF NOT EXISTS "Usuários podem ver suas próprias apólices"
  ON public.apolices
  FOR ALL
  USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_apolices_user_id ON public.apolices(user_id);
CREATE INDEX IF NOT EXISTS idx_apolices_client_id ON public.apolices(client_id);
CREATE INDEX IF NOT EXISTS idx_apolices_status ON public.apolices(status);
CREATE INDEX IF NOT EXISTS idx_apolices_expiration_date ON public.apolices(expiration_date);

-- Comentário
COMMENT ON TABLE public.apolices IS 'Gestão de apólices de seguros';
