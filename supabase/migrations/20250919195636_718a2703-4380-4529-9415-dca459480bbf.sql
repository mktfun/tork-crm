-- Correção da view clients_with_stats para calcular corretamente os valores agregados
CREATE OR REPLACE VIEW public.clients_with_stats AS
SELECT
    c.id,
    c.name,
    c.email,
    c.phone,
    c.cpf_cnpj,
    c.user_id,
    c.created_at,
    c.status,
    -- CORREÇÃO: Usar COALESCE para tratar casos onde o SUM é NULL
    COALESCE(COUNT(a.id), 0) AS total_policies,
    COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'Ativa'), 0) AS active_policies,
    COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'Orçamento'), 0) AS budget_policies,
    COALESCE(SUM(a.premium_value), 0) AS total_premium,
    COALESCE(SUM(a.premium_value * a.commission_rate / 100), 0) AS total_commission
FROM
    public.clientes c
LEFT JOIN
    public.apolices a ON c.id = a.client_id AND a.user_id = c.user_id
WHERE c.user_id = auth.uid()
GROUP BY
    c.id, c.name, c.email, c.phone, c.cpf_cnpj, c.user_id, c.created_at, c.status;