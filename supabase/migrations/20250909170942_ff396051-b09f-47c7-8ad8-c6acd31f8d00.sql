-- =====================================================
-- CORREÇÃO CRÍTICA DE SEGURANÇA - PRIORIDADE 1
-- Fix funções SECURITY DEFINER sem search_path seguro
-- =====================================================

-- 1. Corrigir função check_upcoming_appointments
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

-- =====================================================
-- PRIORIDADE 2 - Fortalecer políticas RLS inseguras
-- =====================================================

-- Remover políticas com USING(true) perigosas e substituir por controle baseado em role

-- 1. Corrigir política de auditoria
DROP POLICY IF EXISTS "System can access audit data" ON public.data_correction_audit;
CREATE POLICY "Admin can access audit data" 
ON public.data_correction_audit 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin');

-- 2. Corrigir políticas de daily_metrics
DROP POLICY IF EXISTS "System can update daily metrics" ON public.daily_metrics;
CREATE POLICY "System can update daily metrics" 
ON public.daily_metrics 
FOR UPDATE 
USING (auth.uid() = user_id OR get_user_role(auth.uid()) = 'admin');

-- 3. Manter políticas de sistema para operações críticas mas adicionar validação
-- (notifications e sheets_sync_logs precisam de acesso de sistema para funcionamento)
-- Mas adicionar política adicional para acesso de usuários
CREATE POLICY "Users can view their own notifications only" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admin can view sync logs" 
ON public.sheets_sync_logs 
FOR SELECT 
USING (get_user_role(auth.uid()) = 'admin');

-- =====================================================
-- PRIORIDADE 3 - Criar função segura para role admin
-- =====================================================

-- Função para verificar se usuário é admin (usada nas políticas)
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = user_id),
    false
  );
$$;

-- =====================================================
-- ATUALIZAR ROLE DE UM USUÁRIO ESPECÍFICO PARA ADMIN
-- (Substitua pelo email do usuário que deve ser admin)
-- =====================================================

-- Função para promover usuário a admin
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_exists boolean;
BEGIN
  -- Verificar se usuário existe e promover
  UPDATE public.profiles 
  SET role = 'admin'
  WHERE email = user_email;
  
  GET DIAGNOSTICS user_exists = ROW_COUNT;
  
  IF user_exists THEN
    -- Log da promoção para auditoria
    INSERT INTO public.data_correction_audit (
      table_name, 
      old_user_id, 
      new_user_id, 
      record_id, 
      correction_type, 
      migration_context
    ) VALUES (
      'profiles',
      (SELECT id FROM public.profiles WHERE email = user_email),
      (SELECT id FROM public.profiles WHERE email = user_email),
      (SELECT id FROM public.profiles WHERE email = user_email),
      'role_promotion_to_admin',
      'Security fix migration - Admin user creation'
    );
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- =====================================================
-- COMENTÁRIOS DE SEGURANÇA
-- =====================================================

COMMENT ON FUNCTION public.promote_user_to_admin(text) IS 
'Função segura para promover usuários a admin. Deve ser usada apenas uma vez para criar o primeiro admin.';

COMMENT ON FUNCTION public.is_admin(uuid) IS 
'Função segura para verificação de role admin. Usada nas políticas RLS para controle de acesso.';

-- =====================================================
-- FIM DA CORREÇÃO DE SEGURANÇA CRÍTICA
-- =====================================================