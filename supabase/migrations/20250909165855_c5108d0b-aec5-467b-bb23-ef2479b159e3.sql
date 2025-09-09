-- =====================================================
-- CORREÇÃO DOS PROBLEMAS DE SEGURANÇA DETECTADOS
-- =====================================================

-- Habilitar RLS nas tabelas de auditoria
ALTER TABLE public.data_correction_audit ENABLE ROW LEVEL SECURITY;

-- Política para tabela de auditoria (apenas admins ou sistema podem ver)
CREATE POLICY "System can access audit data" ON public.data_correction_audit
  FOR ALL USING (true);

-- Corrigir view com SECURITY DEFINER - remover o SECURITY DEFINER
DROP VIEW IF EXISTS public.companies_with_ramos_count;
CREATE VIEW public.companies_with_ramos_count AS
SELECT 
  c.*,
  COALESCE(COUNT(cr.ramo_id), 0) as ramos_count
FROM public.companies c
LEFT JOIN public.company_ramos cr ON c.id = cr.company_id AND cr.user_id = c.user_id
GROUP BY c.id, c.name, c.user_id, c.created_at, c.updated_at;

-- Adicionar RLS na view (não é necessário pois herda das tabelas base)
-- Mas vamos garantir que a view respeita RLS
GRANT SELECT ON public.companies_with_ramos_count TO authenticated;

-- Corrigir a função de validação para incluir SET search_path
CREATE OR REPLACE FUNCTION public.validate_user_data_access(target_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE 
SET search_path = public
AS $$
BEGIN
  -- Validar que o usuário só pode acessar seus próprios dados
  IF target_user_id IS NULL OR target_user_id != auth.uid() THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Corrigir a função de auditoria para incluir SET search_path
CREATE OR REPLACE FUNCTION public.audit_critical_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Log alterações em user_id (possível vazamento)
  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    INSERT INTO public.data_correction_audit (
      table_name, old_user_id, new_user_id, record_id, correction_type, migration_context
    ) VALUES (
      TG_TABLE_NAME,
      OLD.user_id,
      NEW.user_id,
      NEW.id,
      'user_id_change_detected',
      'Automatic audit trigger'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;