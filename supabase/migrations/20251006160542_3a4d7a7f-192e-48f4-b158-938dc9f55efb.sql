-- Função para buscar transações órfãs (pendentes sem ramo)
CREATE OR REPLACE FUNCTION public.get_orphan_transactions(p_user_id uuid)
RETURNS jsonb AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
        FROM (
            SELECT 
                id, 
                description, 
                date, 
                amount,
                company_id,
                nature
            FROM public.transactions
            WHERE user_id = p_user_id
              AND status = 'PENDENTE'
              AND ramo_id IS NULL
            ORDER BY date DESC
            LIMIT 50
        ) t
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Função para atualizar transações em lote
CREATE OR REPLACE FUNCTION public.batch_update_transactions(
    p_user_id uuid, 
    updates jsonb
)
RETURNS text AS $$
DECLARE
    updated_count integer := 0;
    upd jsonb;
BEGIN
    FOR upd IN SELECT * FROM jsonb_array_elements(updates)
    LOOP
        UPDATE public.transactions
        SET 
            ramo_id = (upd->>'ramo_id')::uuid,
            company_id = CASE 
                WHEN upd->>'company_id' IS NOT NULL AND upd->>'company_id' != '' 
                THEN upd->>'company_id' 
                ELSE company_id 
            END,
            status = 'PAGO'
        WHERE id = (upd->>'id')::uuid 
          AND user_id = p_user_id
          AND ramo_id IS NULL;
        
        IF FOUND THEN
            updated_count := updated_count + 1;
        END IF;
    END LOOP;

    RETURN updated_count || ' transações foram vinculadas e marcadas como PAGO.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;