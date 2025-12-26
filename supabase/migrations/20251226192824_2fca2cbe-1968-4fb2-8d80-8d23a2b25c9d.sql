-- ============================================================
-- FASE 5: RPC para Importação em Massa de Transações Financeiras
-- ============================================================

-- Função para criar múltiplas transações financeiras de forma atômica
-- Segue o princípio das Partidas Dobradas (Double-Entry Bookkeeping)
CREATE OR REPLACE FUNCTION public.bulk_create_financial_movements(
  p_transactions JSONB
  -- Espera um array de objetos:
  -- {
  --   description: string,
  --   transaction_date: string (YYYY-MM-DD),
  --   amount: number (positivo = entrada/receita, negativo = saída/despesa),
  --   asset_account_id: uuid (conta bancária/ativo),
  --   category_account_id: uuid (receita ou despesa),
  --   reference_number?: string,
  --   memo?: string
  -- }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tx JSONB;
  v_tx_id UUID;
  v_amount NUMERIC;
  v_success_count INT := 0;
  v_error_count INT := 0;
  v_errors JSONB := '[]'::JSONB;
  v_index INT := 0;
BEGIN
  -- Validar usuário autenticado
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Iterar sobre cada transação do array
  FOR v_tx IN SELECT * FROM jsonb_array_elements(p_transactions)
  LOOP
    BEGIN
      v_amount := (v_tx->>'amount')::NUMERIC;
      
      -- Criar o cabeçalho da transação
      INSERT INTO public.financial_transactions (
        user_id,
        created_by,
        description,
        transaction_date,
        reference_number
      ) VALUES (
        v_user_id,
        v_user_id,
        v_tx->>'description',
        (v_tx->>'transaction_date')::DATE,
        v_tx->>'reference_number'
      )
      RETURNING id INTO v_tx_id;

      -- Lógica de Partidas Dobradas baseada no sinal do valor
      IF v_amount > 0 THEN
        -- ENTRADA (Receita): 
        -- Débito (+) na conta Asset (banco recebe dinheiro)
        -- Crédito (-) na conta Revenue (origem da receita)
        
        INSERT INTO public.financial_ledger (transaction_id, account_id, amount, memo)
        VALUES (v_tx_id, (v_tx->>'asset_account_id')::UUID, ABS(v_amount), v_tx->>'memo');
        
        INSERT INTO public.financial_ledger (transaction_id, account_id, amount, memo)
        VALUES (v_tx_id, (v_tx->>'category_account_id')::UUID, -ABS(v_amount), v_tx->>'memo');
        
      ELSE
        -- SAÍDA (Despesa):
        -- Crédito (-) na conta Asset (banco perde dinheiro)
        -- Débito (+) na conta Expense (destino da despesa)
        
        INSERT INTO public.financial_ledger (transaction_id, account_id, amount, memo)
        VALUES (v_tx_id, (v_tx->>'asset_account_id')::UUID, -ABS(v_amount), v_tx->>'memo');
        
        INSERT INTO public.financial_ledger (transaction_id, account_id, amount, memo)
        VALUES (v_tx_id, (v_tx->>'category_account_id')::UUID, ABS(v_amount), v_tx->>'memo');
        
      END IF;

      v_success_count := v_success_count + 1;

    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_errors := v_errors || jsonb_build_object(
        'index', v_index,
        'message', SQLERRM,
        'description', v_tx->>'description'
      );
    END;
    
    v_index := v_index + 1;
  END LOOP;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success_count', v_success_count,
    'error_count', v_error_count,
    'errors', v_errors,
    'total_processed', v_index
  );
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION public.bulk_create_financial_movements IS 
'Importa múltiplas transações financeiras de forma atômica, respeitando partidas dobradas.
Valores positivos são tratados como receitas (entrada), negativos como despesas (saída).';