-- =====================================================
-- CORREÇÕES DE SEGURANÇA CRÍTICAS
-- Implementação das vulnerabilidades identificadas na auditoria
-- =====================================================

-- PASSO 1: HABILITAR RLS NA VIEW 'sinistros_complete'
ALTER VIEW public.sinistros_complete ENABLE ROW LEVEL SECURITY;

-- Criar política RLS para sinistros_complete
CREATE POLICY "Usuários podem ver apenas seus próprios dados de sinistros completos"
ON public.sinistros_complete FOR SELECT
USING (user_id = auth.uid());

-- PASSO 2: HABILITAR RLS NA VIEW 'companies_with_ramos_count'  
ALTER VIEW public.companies_with_ramos_count ENABLE ROW LEVEL SECURITY;

-- Criar política RLS para companies_with_ramos_count
CREATE POLICY "Usuários podem ver apenas suas próprias empresas com contagem de ramos"
ON public.companies_with_ramos_count FOR SELECT
USING (user_id = auth.uid());

-- PASSO 3: CORRIGIR ACESSO PÚBLICO AOS CHANGELOGS
-- Remover a política que permite acesso público aos changelogs
DROP POLICY IF EXISTS "Users can view published changelogs" ON public.changelogs;

-- =====================================================
-- COMENTÁRIOS SOBRE AS CORREÇÕES
-- =====================================================

-- 1. As views agora têm RLS habilitada e políticas que garantem isolamento de dados por usuário
-- 2. Os changelogs agora só são acessíveis para usuários autenticados via outras políticas existentes
-- 3. Essas correções eliminam as vulnerabilidades críticas identificadas na auditoria
-- 4. O acesso a dados sensíveis agora está devidamente restrito por usuário

-- =====================================================
-- VALIDAÇÃO NECESSÁRIA APÓS APLICAÇÃO
-- =====================================================

-- Teste 1: Verificar se views respeitam isolamento de usuário
-- Teste 2: Confirmar que changelogs só são acessíveis para usuários autenticados
-- Teste 3: Validar que funcionalidades continuam operacionais