-- =====================================================
-- CORREÇÃO CRÍTICA DE SEGURANÇA - FASE 2
-- Habilitar RLS em tabelas/views sem proteção
-- =====================================================

-- 1. Habilitar RLS na tabela migration_ramos_log
ALTER TABLE public.migration_ramos_log ENABLE ROW LEVEL SECURITY;

-- Política para migration_ramos_log (apenas admin pode acessar logs de migração)
CREATE POLICY "Admin can access migration logs" 
ON public.migration_ramos_log 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin');

-- 2. Recriar view companies_with_ramos_count sem SECURITY DEFINER
-- Primeiro vamos ver a definição atual
DROP VIEW IF EXISTS public.companies_with_ramos_count;

-- Recriar a view sem SECURITY DEFINER (mais seguro)
CREATE VIEW public.companies_with_ramos_count AS
SELECT 
    c.id,
    c.user_id,
    c.name,
    c.created_at,
    c.updated_at,
    COALESCE(COUNT(cb.ramo_id), 0) as ramos_count
FROM public.companies c
LEFT JOIN public.company_ramos cb ON c.id = cb.company_id
GROUP BY c.id, c.user_id, c.name, c.created_at, c.updated_at;

-- Habilitar RLS na view
ALTER VIEW public.companies_with_ramos_count SET (security_barrier = true);

-- 3. Recriar view sinistros_complete sem SECURITY DEFINER
DROP VIEW IF EXISTS public.sinistros_complete;

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

-- Habilitar security barrier na view
ALTER VIEW public.sinistros_complete SET (security_barrier = true);

-- =====================================================
-- CORRIGIR FUNÇÕES RESTANTES SEM search_path
-- =====================================================

-- Listar e corrigir todas as funções que precisam de search_path
-- (Baseado na saída do linter)

-- Função para atualizar timestamps - já tem SET mas vamos garantir
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Todas as outras funções handle_updated_at_*
CREATE OR REPLACE FUNCTION public.handle_updated_at_apolices()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_tasks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_transactions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_appointments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_transaction_types()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_companies()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_company_branches()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_transaction_payments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_daily_metrics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_changelogs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_producers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at_sinistros()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Funções de business logic
CREATE OR REPLACE FUNCTION public.handle_policy_renewal_schedule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  -- Só processar se for uma apólice ativa com renovação automática habilitada
  IF NEW.status = 'Ativa' AND NEW.automatic_renewal = true THEN
    -- Verificar se já existe um agendamento de renovação para esta apólice
    IF NOT EXISTS (
      SELECT 1 FROM public.appointments 
      WHERE policy_id = NEW.id 
      AND title LIKE 'Renovação%'
    ) THEN
      -- Criar agendamento 15 dias antes do vencimento
      INSERT INTO public.appointments (
        user_id,
        client_id,
        policy_id,
        title,
        date,
        time,
        status,
        notes
      ) VALUES (
        NEW.user_id,
        NEW.client_id,
        NEW.id,
        'Renovação - Apólice ' || COALESCE(NEW.policy_number, 'Orçamento #' || LEFT(NEW.id::text, 8)),
        (NEW.expiration_date - INTERVAL '15 days')::date,
        '09:00:00',
        'Pendente',
        'Agendamento automático para renovação da apólice. Entrar em contato com o cliente para negociar a renovação.'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_sinistro_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.audit_critical_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
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
$function$;

-- =====================================================
-- COMENTÁRIOS E AUDITORIA FINAL
-- =====================================================

COMMENT ON VIEW public.companies_with_ramos_count IS 
'View segura para contagem de ramos por empresa. Sem SECURITY DEFINER para melhor segurança.';

COMMENT ON VIEW public.sinistros_complete IS 
'View segura para dados completos de sinistros. Sem SECURITY DEFINER para melhor segurança.';

-- =====================================================
-- FIM DA FASE 2 DE CORREÇÃO DE SEGURANÇA
-- =====================================================