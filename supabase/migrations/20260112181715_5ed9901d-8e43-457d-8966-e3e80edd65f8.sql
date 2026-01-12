-- =============================================
-- CRM Multi-Pipeline: Nova Tabela e Alterações
-- =============================================

-- 1. Criar função de updated_at se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Criar tabela de pipelines
CREATE TABLE public.crm_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices para performance
CREATE INDEX idx_crm_pipelines_user_id ON public.crm_pipelines(user_id);
CREATE INDEX idx_crm_pipelines_position ON public.crm_pipelines(user_id, position);

-- 4. Garantir apenas um pipeline default por usuário
CREATE UNIQUE INDEX idx_crm_pipelines_default 
  ON public.crm_pipelines(user_id) 
  WHERE is_default = true;

-- 5. Habilitar RLS
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para crm_pipelines
CREATE POLICY "Users can view their own pipelines"
  ON public.crm_pipelines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pipelines"
  ON public.crm_pipelines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pipelines"
  ON public.crm_pipelines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pipelines"
  ON public.crm_pipelines FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Trigger para updated_at
CREATE TRIGGER update_crm_pipelines_updated_at
  BEFORE UPDATE ON public.crm_pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Adicionar coluna pipeline_id em crm_stages (nullable inicialmente para migração)
ALTER TABLE public.crm_stages 
  ADD COLUMN pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE CASCADE;

-- 9. Índice para busca por pipeline
CREATE INDEX idx_crm_stages_pipeline_id ON public.crm_stages(pipeline_id);

-- 10. Migração de dados: criar pipeline padrão para usuários com stages existentes
INSERT INTO public.crm_pipelines (user_id, name, description, position, is_default)
SELECT DISTINCT 
  user_id,
  'Funil de Vendas',
  'Pipeline principal de vendas',
  0,
  true
FROM public.crm_stages
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 11. Vincular stages existentes ao pipeline padrão do usuário
UPDATE public.crm_stages s
SET pipeline_id = (
  SELECT p.id 
  FROM public.crm_pipelines p 
  WHERE p.user_id = s.user_id AND p.is_default = true
  LIMIT 1
)
WHERE s.pipeline_id IS NULL;