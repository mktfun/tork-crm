import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { corsHeaders } from '../_shared/cors.ts';

interface RamoKeywords {
  [key: string]: string[];
}

const RAMO_KEYWORDS: RamoKeywords = {
  'auto': ['auto', 'carro', 'veículo', 'vehicle', 'automóvel', 'moto', 'motocicleta', 'caminhão', 'frota'],
  'saúde': ['saúde', 'saude', 'health', 'médico', 'medico', 'hospital', 'plano de saúde', 'odonto', 'odontológico'],
  'vida': ['vida', 'life', 'seguro de vida', 'acidentes pessoais', 'ap', 'funeral'],
  'residencial': ['residencial', 'casa', 'residência', 'residencia', 'apartamento', 'home', 'imóvel', 'imovel', 'condomínio'],
  'empresarial': ['empresarial', 'empresa', 'comercial', 'business', 'rc', 'responsabilidade civil', 'estabelecimento'],
  'consórcio': ['consórcio', 'consorcio', 'consortium'],
  'previdência': ['previdência', 'previdencia', 'vgbl', 'pgbl', 'aposentadoria', 'pension'],
  'viagem': ['viagem', 'travel', 'trip', 'turismo'],
  'rural': ['rural', 'agrícola', 'agricola', 'fazenda', 'plantação', 'colheita'],
  'transporte': ['transporte', 'carga', 'frete', 'transportadora', 'caminhão'],
  'fiança': ['fiança', 'fianca', 'aluguel', 'locação', 'locacao', 'rent'],
  'garantia': ['garantia', 'warranty', 'garantia estendida'],
  'pet': ['pet', 'animal', 'cachorro', 'gato', 'dog', 'cat'],
};

function inferRamoFromDescription(
  description: string,
  availableRamos: Array<{ id: string; nome: string }>
): string | undefined {
  if (!description || !availableRamos || availableRamos.length === 0) {
    return undefined;
  }

  const normalizedDescription = description.toLowerCase().trim();
  const ramoScores = new Map<string, number>();

  for (const ramo of availableRamos) {
    const ramoNome = ramo.nome.toLowerCase();
    let score = 0;

    if (normalizedDescription.includes(ramoNome)) {
      score += 100;
    }

    for (const [ramoKey, keywords] of Object.entries(RAMO_KEYWORDS)) {
      if (ramoNome.includes(ramoKey)) {
        for (const keyword of keywords) {
          if (normalizedDescription.includes(keyword)) {
            score += 10;
          }
        }
      }
    }

    if (normalizedDescription.startsWith(ramoNome.substring(0, 3))) {
      score += 5;
    }

    if (score > 0) {
      ramoScores.set(ramo.id, score);
    }
  }

  if (ramoScores.size === 0) {
    return undefined;
  }

  let maxScore = 0;
  let bestRamoId: string | undefined;

  for (const [ramoId, score] of ramoScores.entries()) {
    if (score > maxScore) {
      maxScore = score;
      bestRamoId = ramoId;
    }
  }

  if (maxScore >= 5) {
    return bestRamoId;
  }

  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Sem autorização');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { preview } = await req.json();

    console.log(`[Enrich] Iniciando processo para usuário ${user.id}, preview: ${preview}`);

    // Buscar transações que precisam de enriquecimento
    const { data: oldTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .or('producer_id.is.null,ramo_id.is.null');

    if (transactionsError) {
      throw transactionsError;
    }

    console.log(`[Enrich] Encontradas ${oldTransactions?.length || 0} transações para enriquecer`);

    if (!oldTransactions || oldTransactions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma transação para enriquecer',
          enriched: 0,
          preview: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar ramos disponíveis do usuário
    const { data: ramos, error: ramosError } = await supabase
      .from('ramos')
      .select('id, nome')
      .eq('user_id', user.id);

    if (ramosError) {
      throw ramosError;
    }

    const enrichmentPlan = [];
    const updates = [];

    for (const transaction of oldTransactions) {
      const enrichedData: any = {};
      let enrichmentSource = '';

      // Se tem policy_id, buscar dados da apólice
      if (transaction.policy_id) {
        const { data: policy, error: policyError } = await supabase
          .from('apolices')
          .select('producer_id, ramo_id, insurance_company, brokerage_id')
          .eq('id', transaction.policy_id)
          .eq('user_id', user.id)
          .single();

        if (!policyError && policy) {
          if (!transaction.producer_id && policy.producer_id) {
            enrichedData.producer_id = policy.producer_id;
          }
          if (!transaction.ramo_id && policy.ramo_id) {
            enrichedData.ramo_id = policy.ramo_id;
          }
          if (!transaction.company_id && policy.insurance_company) {
            enrichedData.company_id = policy.insurance_company;
          }
          if (!transaction.brokerage_id && policy.brokerage_id) {
            enrichedData.brokerage_id = policy.brokerage_id;
          }
          enrichmentSource = 'policy';
        }
      }

      // Se não tem ramo_id ainda, tentar inferir da descrição
      if (!enrichedData.ramo_id && !transaction.ramo_id && ramos && ramos.length > 0) {
        const inferredRamoId = inferRamoFromDescription(transaction.description, ramos);
        if (inferredRamoId) {
          enrichedData.ramo_id = inferredRamoId;
          enrichmentSource = enrichmentSource ? `${enrichmentSource}+inference` : 'inference';
        }
      }

      if (Object.keys(enrichedData).length > 0) {
        enrichmentPlan.push({
          id: transaction.id,
          description: transaction.description,
          current: {
            producer_id: transaction.producer_id,
            ramo_id: transaction.ramo_id,
            company_id: transaction.company_id,
            brokerage_id: transaction.brokerage_id
          },
          enriched: enrichedData,
          source: enrichmentSource
        });

        if (!preview) {
          updates.push({
            id: transaction.id,
            data: enrichedData
          });
        }
      }
    }

    // Se não for preview, executar as atualizações
    if (!preview && updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('transactions')
          .update(update.data)
          .eq('id', update.id)
          .eq('user_id', user.id);

        if (updateError) {
          console.error(`[Enrich] Erro ao atualizar transação ${update.id}:`, updateError);
        }
      }

      // Registrar auditoria
      const auditRecords = updates.map(update => ({
        table_name: 'transactions',
        old_user_id: user.id,
        new_user_id: user.id,
        record_id: update.id,
        correction_type: 'enrichment_old_transactions',
        migration_context: `Enriquecimento automático: ${JSON.stringify(update.data)}`
      }));

      await supabase
        .from('data_correction_audit')
        .insert(auditRecords);

      console.log(`[Enrich] ${updates.length} transações enriquecidas com sucesso`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: preview 
          ? `${enrichmentPlan.length} transações podem ser enriquecidas` 
          : `${updates.length} transações enriquecidas com sucesso`,
        enriched: preview ? 0 : updates.length,
        preview: enrichmentPlan.slice(0, 10) // Mostrar apenas as primeiras 10 no preview
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Enrich] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
