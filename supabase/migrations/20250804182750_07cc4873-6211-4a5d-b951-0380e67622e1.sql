
-- Primeiro, vamos dropar o trigger antigo (se existir)
DROP TRIGGER IF EXISTS on_policy_insert_or_update ON public.apolices;

-- Função para criar agendamentos automáticos de renovação
CREATE OR REPLACE FUNCTION public.handle_policy_renewal_schedule()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Criar o trigger na tabela CORRETA (apolices, não policies)
CREATE TRIGGER on_policy_insert_or_update
  AFTER INSERT OR UPDATE ON public.apolices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_policy_renewal_schedule();
