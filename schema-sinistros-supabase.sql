-- =====================================================
-- SCHEMA SQL PARA MÓDULO DE SINISTROS - APENAS NOVAS TABELAS
-- Sistema: SGC Pro - Supabase
-- Executar manualmente no Supabase SQL Editor
-- =====================================================

-- Criar tabela principal de sinistros
CREATE TABLE public.sinistros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  policy_id UUID NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  
  -- Dados básicos do sinistro
  claim_number TEXT UNIQUE, -- Protocolo único do sinistro
  occurrence_date DATE NOT NULL, -- Data da ocorrência
  report_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Data do registro
  
  -- Classificação e status
  claim_type TEXT NOT NULL CHECK (claim_type IN (
    'Colisão', 'Roubo', 'Furto', 'Incêndio', 'Danos Elétricos', 
    'Enchente', 'Granizo', 'Vandalismo', 'Quebra de Vidros', 
    'Assistência 24h', 'Outros'
  )),
  status TEXT NOT NULL DEFAULT 'Aberto' CHECK (status IN (
    'Aberto', 'Em Análise', 'Documentação Pendente', 'Aprovado', 
    'Negado', 'Cancelado', 'Finalizado'
  )),
  priority TEXT DEFAULT 'Média' CHECK (priority IN ('Baixa', 'Média', 'Alta', 'Urgente')),
  
  -- Valores monetários
  claim_amount DECIMAL(12,2), -- Valor solicitado
  approved_amount DECIMAL(12,2), -- Valor aprovado
  deductible_amount DECIMAL(12,2) DEFAULT 0, -- Franquia
  
  -- Descrições e observações
  description TEXT NOT NULL, -- Descrição da ocorrência
  location_occurrence TEXT, -- Local da ocorrência
  circumstances TEXT, -- Circunstâncias detalhadas
  
  -- Anexos e documentos
  police_report_number TEXT, -- Número do B.O.
  evidence_urls TEXT[], -- Array de URLs de anexos
  documents_checklist JSONB DEFAULT '{}', -- Checklist de documentos
  
  -- Responsáveis e atribuições
  assigned_to UUID REFERENCES auth.users(id), -- Analista responsável
  producer_id UUID REFERENCES public.producers(id), -- Produtor vinculado (UUID)
  brokerage_id INTEGER REFERENCES public.brokerages(id), -- Corretora (INTEGER)
  
  -- Datas de controle
  analysis_deadline DATE, -- Prazo para análise
  resolution_date DATE, -- Data de resolução
  payment_date DATE, -- Data do pagamento
  
  -- Campos de auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- TABELA PARA HISTÓRICO DE ATIVIDADES DO SINISTRO
-- =====================================================
CREATE TABLE public.sinistro_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sinistro_id UUID NOT NULL REFERENCES public.sinistros(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'Criação', 'Atualização', 'Mudança de Status', 'Anexo Adicionado',
    'Comentário', 'Atribuição', 'Aprovação', 'Negativa', 'Pagamento'
  )),
  
  description TEXT NOT NULL,
  old_values JSONB, -- Valores anteriores (para mudanças)
  new_values JSONB, -- Novos valores
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- TABELA PARA DOCUMENTOS ANEXADOS
-- =====================================================
CREATE TABLE public.sinistro_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sinistro_id UUID NOT NULL REFERENCES public.sinistros(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  document_type TEXT NOT NULL CHECK (document_type IN (
    'Boletim de Ocorrência', 'Laudo Pericial', 'Orçamento', 
    'Nota Fiscal', 'Foto do Sinistro', 'CNH', 'Documento do Veículo',
    'Comprovante de Propriedade', 'Outros'
  )),
  
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  is_required BOOLEAN DEFAULT false,
  is_validated BOOLEAN DEFAULT false,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =====================================================
-- HABILITAR ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE public.sinistros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistro_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistro_documents ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS PARA SINISTROS
-- =====================================================

-- Políticas para sinistros
CREATE POLICY "Usuários podem ver seus próprios sinistros"
  ON public.sinistros
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios sinistros"
  ON public.sinistros
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios sinistros"
  ON public.sinistros
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir seus próprios sinistros"
  ON public.sinistros
  FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para atividades
CREATE POLICY "Usuários podem ver atividades de seus sinistros"
  ON public.sinistro_activities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sinistros 
      WHERE sinistros.id = sinistro_activities.sinistro_id 
      AND sinistros.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar atividades em seus sinistros"
  ON public.sinistro_activities
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.sinistros 
      WHERE sinistros.id = sinistro_activities.sinistro_id 
      AND sinistros.user_id = auth.uid()
    )
  );

-- Políticas para documentos
CREATE POLICY "Usuários podem ver documentos de seus sinistros"
  ON public.sinistro_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sinistros 
      WHERE sinistros.id = sinistro_documents.sinistro_id 
      AND sinistros.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem inserir documentos em seus sinistros"
  ON public.sinistro_documents
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.sinistros 
      WHERE sinistros.id = sinistro_documents.sinistro_id 
      AND sinistros.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar documentos de seus sinistros"
  ON public.sinistro_documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sinistros 
      WHERE sinistros.id = sinistro_documents.sinistro_id 
      AND sinistros.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem excluir documentos de seus sinistros"
  ON public.sinistro_documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sinistros 
      WHERE sinistros.id = sinistro_documents.sinistro_id 
      AND sinistros.user_id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================

-- Trigger para sinistros
CREATE OR REPLACE FUNCTION public.handle_updated_at_sinistros()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sinistros_updated_at
  BEFORE UPDATE ON public.sinistros
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at_sinistros();

-- =====================================================
-- TRIGGER PARA AUDITORIA (ATIVIDADES AUTOMÁTICAS)
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_sinistro_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log de criação
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sinistro_activities (
      sinistro_id, user_id, activity_type, description, new_values
    ) VALUES (
      NEW.id, 
      NEW.user_id, 
      'Criação', 
      'Sinistro criado',
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
  
  -- Log de atualização
  IF TG_OP = 'UPDATE' THEN
    -- Log mudança de status
    IF OLD.status != NEW.status THEN
      INSERT INTO public.sinistro_activities (
        sinistro_id, user_id, activity_type, description, old_values, new_values
      ) VALUES (
        NEW.id, 
        NEW.user_id, 
        'Mudança de Status', 
        'Status alterado de "' || OLD.status || '" para "' || NEW.status || '"',
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status)
      );
    END IF;
    
    -- Log outras mudanças importantes
    IF OLD.claim_amount IS DISTINCT FROM NEW.claim_amount OR 
       OLD.approved_amount IS DISTINCT FROM NEW.approved_amount THEN
      INSERT INTO public.sinistro_activities (
        sinistro_id, user_id, activity_type, description, old_values, new_values
      ) VALUES (
        NEW.id, 
        NEW.user_id, 
        'Atualização', 
        'Valores monetários atualizados',
        jsonb_build_object('claim_amount', OLD.claim_amount, 'approved_amount', OLD.approved_amount),
        jsonb_build_object('claim_amount', NEW.claim_amount, 'approved_amount', NEW.approved_amount)
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER sinistro_changes_audit
  AFTER INSERT OR UPDATE ON public.sinistros
  FOR EACH ROW
  EXECUTE PROCEDURE public.log_sinistro_changes();

-- =====================================================
-- FUNÇÃO PARA GERAR NÚMERO DE PROTOCOLO AUTOMÁTICO
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.claim_number IS NULL THEN
    NEW.claim_number := 'SIN-' || TO_CHAR(now(), 'YYYY') || '-' || 
                       LPAD(COALESCE(
                         (SELECT MAX(CAST(SUBSTRING(claim_number FROM 'SIN-\d{4}-(\d+)') AS INTEGER)) 
                          FROM public.sinistros 
                          WHERE claim_number LIKE 'SIN-' || TO_CHAR(now(), 'YYYY') || '-%'), 0) + 1, 
                       4, '0');
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER generate_claim_number_trigger
  BEFORE INSERT ON public.sinistros
  FOR EACH ROW
  EXECUTE PROCEDURE public.generate_claim_number();

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices principais
CREATE INDEX idx_sinistros_user_id ON public.sinistros(user_id);
CREATE INDEX idx_sinistros_policy_id ON public.sinistros(policy_id);
CREATE INDEX idx_sinistros_client_id ON public.sinistros(client_id);
CREATE INDEX idx_sinistros_status ON public.sinistros(status);
CREATE INDEX idx_sinistros_claim_type ON public.sinistros(claim_type);
CREATE INDEX idx_sinistros_occurrence_date ON public.sinistros(occurrence_date);
CREATE INDEX idx_sinistros_claim_number ON public.sinistros(claim_number);
CREATE INDEX idx_sinistros_assigned_to ON public.sinistros(assigned_to);

-- Índices para tabelas relacionadas
CREATE INDEX idx_sinistro_activities_sinistro_id ON public.sinistro_activities(sinistro_id);
CREATE INDEX idx_sinistro_activities_created_at ON public.sinistro_activities(created_at);
CREATE INDEX idx_sinistro_documents_sinistro_id ON public.sinistro_documents(sinistro_id);
CREATE INDEX idx_sinistro_documents_type ON public.sinistro_documents(document_type);

-- =====================================================
-- VIEW ��TIL PARA CONSULTAS
-- =====================================================

-- View para sinistros com dados relacionados
CREATE VIEW public.sinistros_complete AS
SELECT 
  s.*,
  c.name as client_name,
  c.phone as client_phone,
  a.policy_number,
  a.insurance_company,
  p.name as producer_name,
  b.name as brokerage_name
FROM public.sinistros s
LEFT JOIN public.clientes c ON s.client_id = c.id
LEFT JOIN public.apolices a ON s.policy_id = a.id
LEFT JOIN public.producers p ON s.producer_id = p.id
LEFT JOIN public.brokerages b ON s.brokerage_id = b.id;

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE public.sinistros IS 'Gestão de sinistros/ocorrências - vinculado às tabelas existentes';
COMMENT ON TABLE public.sinistro_activities IS 'Histórico de atividades e mudanças nos sinistros';
COMMENT ON TABLE public.sinistro_documents IS 'Documentos anexados aos sinistros';

-- =====================================================
-- FIM DO SCHEMA CORRIGIDO
-- =====================================================

-- INSTRUÇÕES:
-- 1. Execute este SQL no Supabase SQL Editor
-- 2. Após execução, regenere os types:
--    npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
