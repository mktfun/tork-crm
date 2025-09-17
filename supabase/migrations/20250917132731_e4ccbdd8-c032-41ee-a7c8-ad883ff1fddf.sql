-- =====================================================
-- FIX REMAINING SECURITY LINTER WARNINGS
-- =====================================================

-- 1. ADD MISSING search_path TO EXISTING FUNCTIONS
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

-- 2. SECURE OTHER CRITICAL FUNCTIONS
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

CREATE OR REPLACE FUNCTION public.check_upcoming_appointments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  upcoming_appointment RECORD;
BEGIN
  -- Buscar agendamentos que começam em 15 minutos e ainda não têm notificação
  FOR upcoming_appointment IN
    SELECT 
      a.id,
      a.user_id,
      a.title,
      a.date,
      a.time,
      a.client_id
    FROM public.appointments a
    WHERE 
      a.status = 'Pendente'
      AND (a.date::timestamp + a.time::time) BETWEEN 
          (now() + interval '14 minutes') AND 
          (now() + interval '16 minutes')
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n 
        WHERE n.appointment_id = a.id 
        AND n.message LIKE '%Lembrete:%'
      )
  LOOP
    -- Criar notificação para o agendamento
    INSERT INTO public.notifications (user_id, appointment_id, message)
    VALUES (
      upcoming_appointment.user_id,
      upcoming_appointment.id,
      'Lembrete: "' || upcoming_appointment.title || '" começa em 15 minutos'
    );
  END LOOP;
END;
$function$;

-- 3. ADD SECURITY COMMENTS
COMMENT ON FUNCTION public.get_clientes_filtrados IS 'SECURITY HARDENED: Double user validation prevents cross-user data access';
COMMENT ON FUNCTION public.preview_clientes_filtrados IS 'SECURITY HARDENED: User validation with auth.uid() check';
COMMENT ON FUNCTION public.preview_apolices_filtradas IS 'SECURITY HARDENED: User validation with auth.uid() check';

-- =====================================================
-- SECURITY HARDENING COMPLETE
-- =====================================================