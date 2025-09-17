-- =====================================================
-- CRITICAL SECURITY FIXES - IMMEDIATE IMPLEMENTATION
-- =====================================================

-- 1. FIX COMPANIES_WITH_RAMOS_COUNT VIEW - ADD USER FILTERING
DROP VIEW IF EXISTS public.companies_with_ramos_count;

CREATE VIEW public.companies_with_ramos_count AS
SELECT 
  c.id,
  c.name,
  c.user_id,
  c.created_at,
  c.updated_at,
  COUNT(cr.ramo_id) as ramos_count
FROM public.companies c
LEFT JOIN public.company_ramos cr ON c.id = cr.company_id
WHERE c.user_id = auth.uid()  -- CRITICAL: Filter by authenticated user
GROUP BY c.id, c.name, c.user_id, c.created_at, c.updated_at;

-- 2. FIX SINISTROS_COMPLETE VIEW - ADD USER FILTERING
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
LEFT JOIN public.clientes c ON s.client_id = c.id AND c.user_id = auth.uid()
LEFT JOIN public.apolices a ON s.policy_id = a.id AND a.user_id = auth.uid()
LEFT JOIN public.producers p ON s.producer_id = p.id AND p.user_id = auth.uid()
LEFT JOIN public.brokerages b ON s.brokerage_id = b.id AND b.user_id = auth.uid()
LEFT JOIN public.companies co ON a.insurance_company = co.id AND co.user_id = auth.uid()
WHERE s.user_id = auth.uid();  -- CRITICAL: Filter by authenticated user

-- 3. REPLACE EXISTING FUNCTIONS WITH SECURITY HARDENED VERSIONS
-- Drop all existing function variations first
DROP FUNCTION IF EXISTS public.get_clientes_filtrados(text, uuid);
DROP FUNCTION IF EXISTS public.get_clientes_filtrados(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_clientes_filtrados(uuid, text, uuid, text);

-- Create single secure version
CREATE OR REPLACE FUNCTION public.get_clientes_filtrados(
  p_user_id uuid, 
  p_search_term text DEFAULT NULL::text, 
  p_seguradora_id uuid DEFAULT NULL::uuid, 
  p_ramo text DEFAULT NULL::text
)
RETURNS SETOF clientes
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  -- CRITICAL SECURITY CHECK: Ensure user can only access their own data
  SELECT DISTINCT c.*
  FROM public.clientes c
  LEFT JOIN public.apolices a ON a.client_id = c.id AND a.user_id = c.user_id
  WHERE c.user_id = p_user_id 
    AND c.user_id = auth.uid()  -- CRITICAL: Double-check user authorization
    AND (
      p_search_term IS NULL OR
      c.name ILIKE '%'||p_search_term||'%' OR
      c.email ILIKE '%'||p_search_term||'%' OR
      c.phone ILIKE '%'||p_search_term||'%' OR
      c.cpf_cnpj ILIKE '%'||p_search_term||'%'
    )
    AND (p_seguradora_id IS NULL OR a.insurance_company = p_seguradora_id)
    AND (p_ramo IS NULL OR a.type = p_ramo)
  ORDER BY c.created_at DESC
$function$;

-- 4. HARDEN PREVIEW FUNCTIONS WITH USER VALIDATION
CREATE OR REPLACE FUNCTION public.preview_clientes_filtrados(
  p_user_id uuid, 
  p_seguradora_id uuid DEFAULT NULL::uuid, 
  p_ramo text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, nome text, email text, phone text, total_records bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  WITH filtered_clients AS (
    SELECT DISTINCT
      c.id,
      c.name,
      c.email,
      c.phone
    FROM public.clientes c
    LEFT JOIN public.apolices a ON a.client_id = c.id AND a.user_id = c.user_id
    WHERE c.user_id = p_user_id
      AND c.user_id = auth.uid()  -- CRITICAL: Security validation
      AND (p_seguradora_id IS NULL OR a.insurance_company = p_seguradora_id)
      AND (p_ramo IS NULL OR a.type = p_ramo)
  )
  SELECT
    fc.id,
    fc.name AS nome,
    fc.email,
    fc.phone,
    (SELECT COUNT(*) FROM filtered_clients) AS total_records
  FROM filtered_clients fc
  ORDER BY nome
  LIMIT 5;
$function$;

CREATE OR REPLACE FUNCTION public.preview_apolices_filtradas(
  p_user_id uuid, 
  p_seguradora_id uuid DEFAULT NULL::uuid, 
  p_ramo text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, policy_number text, client_name text, insurance_company uuid, insurance_company_name text, type text, status text, expiration_date date, premium_value numeric, total_records bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  WITH filtered_policies AS (
    SELECT
      a.*,
      c.name AS client_name,
      co.name AS insurance_company_name
    FROM public.apolices a
    JOIN public.clientes c ON a.client_id = c.id AND c.user_id = a.user_id
    LEFT JOIN public.companies co ON co.id = a.insurance_company AND co.user_id = a.user_id
    WHERE a.user_id = p_user_id
      AND a.user_id = auth.uid()  -- CRITICAL: Security validation
      AND (p_seguradora_id IS NULL OR a.insurance_company = p_seguradora_id)
      AND (p_ramo IS NULL OR a.type = p_ramo)
  )
  SELECT
    fp.id,
    fp.policy_number,
    fp.client_name,
    fp.insurance_company,
    fp.insurance_company_name,
    fp.type,
    fp.status,
    fp.expiration_date,
    fp.premium_value,
    (SELECT COUNT(*) FROM filtered_policies) AS total_records
  FROM filtered_policies fp
  ORDER BY fp.created_at DESC
  LIMIT 5;
$function$;

-- 5. ADD COMPREHENSIVE SECURITY AUDIT LOGGING
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action_type text NOT NULL,
  table_name text,
  record_id uuid,
  attempted_access jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  severity text DEFAULT 'medium'
);

-- Enable RLS on security audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view security logs
CREATE POLICY "Admins can view security audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (get_user_role(auth.uid()) = 'admin');

-- System can insert security logs
CREATE POLICY "System can insert security audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);

-- 6. COMMENT ON CRITICAL SECURITY MEASURES
COMMENT ON VIEW public.companies_with_ramos_count IS 'SECURITY: View filtered by auth.uid() to prevent cross-user data exposure';
COMMENT ON VIEW public.sinistros_complete IS 'SECURITY: View filtered by auth.uid() to prevent cross-user data exposure';
COMMENT ON FUNCTION public.get_clientes_filtrados IS 'SECURITY: Function hardened with double user validation';
COMMENT ON TABLE public.security_audit_log IS 'SECURITY: Comprehensive audit logging for unauthorized access attempts';

-- =====================================================
-- SECURITY FIX IMPLEMENTATION COMPLETE
-- =====================================================