-- =====================================================
-- CRIAÇÃO DAS TABELAS BASE PRIMEIRO
-- =====================================================

-- 1. Criar tabela ramos (se não existir)
CREATE TABLE IF NOT EXISTS public.ramos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Habilitar RLS na tabela ramos
ALTER TABLE public.ramos ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas RLS para ramos
CREATE POLICY IF NOT EXISTS "Users can view their own ramos" ON public.ramos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create their own ramos" ON public.ramos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own ramos" ON public.ramos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own ramos" ON public.ramos
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Criar tabela company_ramos (se não existir)
CREATE TABLE IF NOT EXISTS public.company_ramos (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ramo_id UUID NOT NULL REFERENCES public.ramos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, ramo_id)
);

-- 5. Habilitar RLS na tabela company_ramos
ALTER TABLE public.company_ramos ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS para company_ramos
CREATE POLICY IF NOT EXISTS "Users can view their own company ramos" ON public.company_ramos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create their own company ramos" ON public.company_ramos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own company ramos" ON public.company_ramos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own company ramos" ON public.company_ramos
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_ramos_user_id ON public.ramos(user_id);
CREATE INDEX IF NOT EXISTS idx_ramos_nome ON public.ramos(nome);
CREATE INDEX IF NOT EXISTS idx_company_ramos_company ON public.company_ramos(company_id);
CREATE INDEX IF NOT EXISTS idx_company_ramos_ramo ON public.company_ramos(ramo_id);
CREATE INDEX IF NOT EXISTS idx_company_ramos_user ON public.company_ramos(user_id);

-- =====================================================
-- TABELAS BASE CRIADAS COM SUCESSO
-- =====================================================