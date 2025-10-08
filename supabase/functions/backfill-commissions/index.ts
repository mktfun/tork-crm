import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { corsHeaders } from "../_shared/cors.ts";

interface Policy {
  id: string;
  user_id: string;
  client_id: string;
  policy_number: string;
  insurance_company: string;
  premium_value: number;
  commission_rate: number;
  expiration_date: string;
  start_date: string;
  producer_id?: string;
  brokerage_id?: number;
  ramo_id?: string;
}

// 🔧 Função robusta para obter o ID do tipo de transação "Comissão"
async function getCommissionTypeId(supabaseClient: any, userId: string): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from('transaction_types')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Comissão')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error(`❌ Erro ao buscar tipo 'Comissão':`, error.message);
    throw new Error(`Erro ao buscar tipo 'Comissão': ${error.message}`);
  }
  
  if (data && data.length > 0) {
    console.log(`✅ Tipo "Comissão" encontrado:`, data[0].id);
    return data[0].id;
  }
  
  console.warn(`⚠️ Tipo "Comissão" não encontrado para o usuário ${userId}`);
  return null;
}

// 💰 Função para gerar transação de comissão
async function generateCommissionTransaction(supabaseClient: any, policy: Policy, commissionTypeId: string) {
  console.log(`🔍 Verificando apólice ${policy.policy_number}...`);
  
  // 1. Verificar se já existe uma transação para esta apólice
  const { data: existingTransaction, error: checkError } = await supabaseClient
    .from('transactions')
    .select('id')
    .eq('policy_id', policy.id)
    .in('nature', ['RECEITA', 'GANHO']) // Verifica ambos os padrões
    .limit(1)
    .maybeSingle();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error(`❌ Erro ao verificar transação para apólice ${policy.id}:`, checkError.message);
    return { status: 'error', message: checkError.message };
  }

  if (existingTransaction) {
    console.log(`⏭️ Transação já existe para apólice ${policy.policy_number}`);
    return { status: 'skipped', message: 'Transação já existe' };
  }

  // 2. Calcular comissão
  const commissionPercentage = (policy.commission_rate || 0) / 100;
  const commissionAmount = (policy.premium_value || 0) * commissionPercentage;

  if (commissionAmount <= 0) {
    console.log(`⚠️ Comissão zero para apólice ${policy.policy_number}`);
    return { status: 'skipped', message: 'Comissão zero' };
  }

  // 3. Inserir a nova transação (respeitando o CHECK constraint - RECEITA)
  const { error: insertError } = await supabaseClient
    .from('transactions')
    .insert({
      user_id: policy.user_id,
      policy_id: policy.id,
      client_id: policy.client_id,
      company_id: policy.insurance_company,
      producer_id: policy.producer_id || null,
      brokerage_id: policy.brokerage_id || null,
      ramo_id: policy.ramo_id || null,
      amount: commissionAmount,
      date: policy.start_date || new Date().toISOString().split('T')[0],
      transaction_date: policy.start_date || new Date().toISOString().split('T')[0],
      due_date: policy.expiration_date,
      description: `Comissão - Apólice ${policy.policy_number}`,
      type_id: commissionTypeId,
      nature: 'RECEITA', // 🔧 CORRIGIDO: usar RECEITA para respeitar o CHECK constraint
      status: 'PENDENTE',
    });

  if (insertError) {
    console.error(`❌ Erro ao criar transação para apólice ${policy.id}:`, insertError.message);
    return { status: 'error', message: insertError.message };
  }

  console.log(`✅ Comissão criada para apólice ${policy.policy_number}: R$ ${commissionAmount.toFixed(2)}`);
  return { status: 'success', amount: commissionAmount };
}

// 🚀 Handler principal
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando backfill de comissões...');
    
    // Ler userId do body
    const body = await req.json();
    const userId = body?.userId;

    if (!userId) {
      throw new Error("userId é obrigatório no corpo da requisição.");
    }

    console.log(`👤 Executando backfill para usuário: ${userId}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Obter o tipo de comissão
    const commissionTypeId = await getCommissionTypeId(supabaseAdmin, userId);
    
    if (!commissionTypeId) {
      throw new Error("O tipo de transação 'Comissão' não foi encontrado para este usuário. Crie-o manualmente antes de rodar o backfill.");
    }

    console.log(`✅ Usando tipo de comissão: ${commissionTypeId}`);

    // 2. Buscar todas as apólices ativas do usuário
    const { data: policies, error: policiesError } = await supabaseAdmin
      .from('apolices')
      .select('*, ramo_id')
      .eq('user_id', userId)
      .eq('status', 'Ativa')
      .order('created_at', { ascending: false });

    if (policiesError) {
      console.error('❌ Erro ao buscar apólices:', policiesError);
      throw policiesError;
    }

    if (!policies || policies.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "Nenhuma apólice ativa encontrada para este usuário.",
          summary: { total: 0, success: 0, skipped: 0, errors: 0 }
        }), 
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    console.log(`📋 Encontradas ${policies.length} apólices ativas`);

    // 3. Processar cada apólice
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const details: any[] = [];

    for (const policy of policies) {
      const result = await generateCommissionTransaction(supabaseAdmin, policy as Policy, commissionTypeId);
      
      details.push({
        policyId: policy.id,
        policyNumber: policy.policy_number,
        ...result
      });

      if (result.status === 'success') {
        successCount++;
      } else if (result.status === 'skipped') {
        skippedCount++;
      } else {
        errorCount++;
      }
    }

    const summary = {
      total: policies.length,
      success: successCount,
      skipped: skippedCount,
      errors: errorCount
    };

    console.log('📊 Resumo do backfill:', summary);

    return new Response(
      JSON.stringify({ 
        message: 'Backfill de comissões concluído com sucesso!',
        summary,
        details
      }), 
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error: any) {
    console.error("💥 Erro fatal no backfill:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Verifique os logs para mais informações'
      }), 
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
