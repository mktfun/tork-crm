import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedQuoteData {
  clientName: string | null;
  clientId: string | null;
  insuredItem: string | null;
  insurerName: string | null;
  insurerId: string | null;
  insuranceLine: string | null;
  insuranceLineId: string | null;
  policyNumber: string | null;
  premiumValue: number | null;
  commissionPercentage: number | null;
  shouldGenerateRenewal: boolean;
  startDate: string | null;
  matchingDetails: {
    clientMatch: 'exact' | 'partial' | 'none';
    insurerMatch: 'exact' | 'partial' | 'none';
    ramoMatch: 'exact' | 'partial' | 'none';
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl } = await req.json();

    if (!fileUrl) {
      throw new Error('URL do arquivo é obrigatória');
    }

    console.log('📄 Processando arquivo da URL:', fileUrl);

    const pdfText = await extractTextFromPDF(fileUrl);
    
    console.log(`📊 Texto extraído: ${pdfText.length} caracteres`);
    
    if (!pdfText || pdfText.trim().length < 100) {
      throw new Error('Não foi possível extrair texto suficiente do PDF (mínimo: 100 caracteres). Verifique se o arquivo não está corrompido ou protegido.');
    }

    console.log('✅ Texto extraído do PDF (primeiros 500 chars):', pdfText.substring(0, 500) + '...');

    const dbContext = await fetchDatabaseContext();
    const extractedData = await extractDataWithAI(pdfText, dbContext);
    const matchedData = await performIntelligentMatching(extractedData, dbContext);

    console.log('✅ Dados extraídos e vinculados com sucesso:', matchedData);

    return new Response(
      JSON.stringify({
        success: true,
        data: matchedData,
        metadata: {
          textLength: pdfText.length,
          availableRamos: dbContext.ramos.length,
          availableCompanies: dbContext.companies.length,
          availableClients: dbContext.clients.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Erro na extração:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function extractTextFromPDF(fileUrl: string): Promise<string> {
  const PDF_PARSER_API_KEY = Deno.env.get('PDF_PARSER_API_KEY');
  
  if (!PDF_PARSER_API_KEY) {
    throw new Error('PDF_PARSER_API_KEY não configurada. Configure a secret no Supabase.');
  }

  console.log('🔄 Chamando PDF.co API com OCR habilitado...');

  try {
    const response = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PDF_PARSER_API_KEY
      },
      body: JSON.stringify({
        url: fileUrl,
        inline: true,
        profiles: "{ 'ocrMode': 'auto' }"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API PDF.co:', response.status, errorText);
      throw new Error(`PDF.co API falhou (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    
    if (result.error) {
      console.error('❌ Erro retornado pela PDF.co:', result.message);
      throw new Error(`Erro no serviço PDF.co: ${result.message}`);
    }

    const extractedText = result.body || '';
    console.log(`✅ PDF.co extraiu ${extractedText.length} caracteres com sucesso`);
    
    return extractedText;

  } catch (error) {
    console.error('❌ Erro ao extrair texto do PDF:', error);
    throw new Error('Falha ao processar PDF: ' + (error instanceof Error ? error.message : 'erro desconhecido'));
  }
}

async function fetchDatabaseContext() {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  console.log('🔍 Buscando contexto completo do banco de dados...');

  const [ramosResult, companiesResult, clientsResult] = await Promise.all([
    supabaseAdmin.from('ramos').select('id, nome'),
    supabaseAdmin.from('companies').select('id, name'),
    supabaseAdmin.from('clientes').select('id, name, cpf_cnpj, phone, email')
  ]);

  if (ramosResult.error) {
    console.error('❌ Erro ao buscar ramos:', ramosResult.error);
    throw new Error('Falha ao buscar ramos do banco de dados');
  }

  if (companiesResult.error) {
    console.error('❌ Erro ao buscar seguradoras:', companiesResult.error);
    throw new Error('Falha ao buscar seguradoras do banco de dados');
  }

  if (clientsResult.error) {
    console.error('❌ Erro ao buscar clientes:', clientsResult.error);
    throw new Error('Falha ao buscar clientes do banco de dados');
  }

  console.log(`✅ Contexto carregado: ${ramosResult.data.length} ramos, ${companiesResult.data.length} seguradoras, ${clientsResult.data.length} clientes`);

  return {
    ramos: ramosResult.data || [],
    companies: companiesResult.data || [],
    clients: clientsResult.data || []
  };
}

function buildRAGPrompt(pdfText: string, ramos: any[], companies: any[], clients: any[]): string {
  const ramosList = ramos.map(r => r.nome).join('", "');
  const companiesList = companies.map(c => c.name).join('", "');
  const clientsList = clients.slice(0, 50).map(c => `${c.name} (${c.cpf_cnpj || 'sem documento'})`).join('", "');

  return `# PERSONA
Aja como um assistente de IA sênior, especialista em conciliar documentos de seguros com sistemas de gestão de corretoras.

# CONTEXTO
Você recebeu um texto extraído de um orçamento de seguro (PDF) e três listas de referência: "Clientes Cadastrados", "Ramos Cadastrados" e "Seguradoras Cadastradas". Essas listas são a **FONTE DA VERDADE**. O texto do PDF é apenas uma pista.

Sua tarefa principal é analisar o texto do PDF e, para os campos 'clientName', 'insurerName' e 'insuranceLine', encontrar a correspondência **MAIS PRÓXIMA** dentro das listas fornecidas e retornar o valor **EXATO** da lista.

# LISTAS DO SISTEMA (FONTE DA VERDADE)

**Clientes Cadastrados (primeiros 50):**
["${clientsList}"]

**Ramos Cadastrados:**
["${ramosList}"]

**Seguradoras Cadastradas:**
["${companiesList}"]

# REGRAS DE MATCHING (CRÍTICO)

Ao analisar 'clientName', 'insurerName' e 'insuranceLine', você DEVE seguir estas regras para encontrar o valor correto na lista:

1. **PRIORIDADE MÁXIMA:** A sua resposta para esses campos DEVE ser um dos valores EXATOS das listas acima.
2. **MATCHING DE CLIENTE:** 
   - Se o PDF diz "João Silva" e a lista tem "João da Silva", sua resposta DEVE ser "João da Silva".
   - Se o PDF diz "Empresa ABC LTDA" e a lista tem "ABC Comércio LTDA", sua resposta DEVE ser "ABC Comércio LTDA".
   - Considere também documentos (CPF/CNPJ) se mencionados no PDF.
3. **ABREVIAÇÕES:** Se o PDF diz "Responsabilidade Civil Profissional" e a lista tem "RC Profissional", sua resposta DEVE ser "RC Profissional".
4. **NOMES PARCIAIS:** Se o PDF diz "Porto Seguro Companhia de Seguros Gerais" e a lista tem "Porto Seguro", sua resposta DEVE ser "Porto Seguro".
5. **IGNORAR CAPITALIZAÇÃO:** O match deve ser feito ignorando se as letras são maiúsculas ou minúsculas.

⚠️ Se, e somente se, NENHUMA correspondência razoável for encontrada nas listas, retorne \`null\`.

# CAMPOS PARA EXTRAIR

1. **clientName**: Nome completo do Segurado (pessoa ou empresa).
   - ⚠️ **CRÍTICO:** Procure especificamente por:
     * "Proponente / Segurado(a):" seguido do nome completo
     * "Segurado:" ou "Proponente:" seguido do nome
     * "Cliente:" seguido do nome
   - Extraia APENAS o nome completo da pessoa/empresa, SEM incluir:
     * CPF, CNPJ ou outros documentos
     * Profissão, endereço ou outros dados
   - Exemplo: Se o PDF diz "LUCIANA GIMENES BAYSZAR", extraia "LUCIANA GIMENES BAYSZAR"
   - Depois de extrair, encontre a correspondência MAIS PRÓXIMA na lista "Clientes Cadastrados"
   - Se não encontrar o campo no PDF, retorne \`null\`

2. **insuredItem**: O bem segurado com DETALHES.
   - Para Automóvel: "Honda Civic LXR 2023 - Placa ABC1234"
   - Para Residencial: "Residência - Rua X, 123, Bairro Y"
   - Para RC Profissional: "Médico Cardiologista" ou "Advogado Tributarista"

3. **insurerName**: Nome da seguradora EXATO da lista "Seguradoras Cadastradas".

4. **insuranceLine**: Ramo do seguro EXATO da lista "Ramos Cadastrados".

5. **policyNumber**: Número completo do orçamento ou proposta.

6. **premiumValue**: Valor do **prêmio líquido** (apenas número, sem "R$").

7. **commissionPercentage**: Taxa de comissão em porcentagem (apenas número).

8. **shouldGenerateRenewal**: 
   - \`true\` se o documento indicar "Seguro Novo" ou "Renovação".
   - \`false\` se indicar "Endosso" ou não especificar.

9. **startDate**: Data de **INÍCIO DE VIGÊNCIA** do seguro.
   - ⚠️ **CRÍTICO:** Procure especificamente por:
     * "Vigência:" ou "Início de Vigência:"
     * "Das 24 horas do dia" seguido de uma data
     * "Válido a partir de"
   - **NÃO** use "Data de Emissão", "Data de Proposta" ou "Data do Orçamento"
   - A vigência é quando o seguro começa a valer (geralmente uma data futura)
   - Formato: YYYY-MM-DD

# FORMATO DE SAÍDA
Retorne APENAS um objeto JSON válido. Não inclua explicações. Se um campo não for encontrado, use \`null\`.

# TEXTO EXTRAÍDO DO ORÇAMENTO:
${pdfText.substring(0, 8000)}

${pdfText.length > 8000 ? '\n[TEXTO TRUNCADO - PDF MUITO LONGO]' : ''}`;
}

async function extractDataWithAI(
  pdfText: string, 
  dbContext: { ramos: any[], companies: any[], clients: any[] }
): Promise<Partial<ExtractedQuoteData>> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  const ragPrompt = buildRAGPrompt(pdfText, dbContext.ramos, dbContext.companies, dbContext.clients);

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: ragPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_quote_fields',
              description: 'Extrai campos estruturados de um orçamento de seguro usando dados do sistema',
              parameters: {
                type: 'object',
                properties: {
                  clientName: {
                    type: 'string',
                    description: 'Nome EXATO do cliente da lista fornecida',
                    nullable: true
                  },
                  insuredItem: {
                    type: 'string',
                    description: 'Bem ou objeto segurado com detalhes',
                    nullable: true
                  },
                  insurerName: {
                    type: 'string',
                    description: 'Nome EXATO da seguradora da lista fornecida',
                    nullable: true
                  },
                  insuranceLine: {
                    type: 'string',
                    description: 'Nome EXATO do ramo da lista fornecida',
                    nullable: true
                  },
                  policyNumber: {
                    type: 'string',
                    description: 'Número do orçamento/proposta',
                    nullable: true
                  },
                  premiumValue: {
                    type: 'number',
                    description: 'Valor do prêmio líquido (apenas número)',
                    nullable: true
                  },
                  commissionPercentage: {
                    type: 'number',
                    description: 'Comissão em porcentagem',
                    nullable: true
                  },
                  shouldGenerateRenewal: {
                    type: 'boolean',
                    description: 'true para Seguro Novo/Renovação'
                  },
                  startDate: {
                    type: 'string',
                    description: 'Data de início (YYYY-MM-DD)',
                    nullable: true
                  }
                },
                required: ['shouldGenerateRenewal'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_quote_fields' } }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API Lovable AI:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições excedido. Aguarde alguns instantes.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes no Lovable AI. Adicione créditos no workspace.');
      }
      
      throw new Error(`Erro na API Lovable AI: ${response.status}`);
    }

    const result = await response.json();
    console.log('🤖 Resposta do Gemini:', JSON.stringify(result, null, 2));

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== 'extract_quote_fields') {
      throw new Error('Gemini não retornou os dados esperados');
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    
    return {
      clientName: extractedData.clientName || null,
      insuredItem: extractedData.insuredItem || null,
      insurerName: extractedData.insurerName || null,
      insuranceLine: extractedData.insuranceLine || null,
      policyNumber: extractedData.policyNumber || null,
      premiumValue: extractedData.premiumValue || null,
      commissionPercentage: extractedData.commissionPercentage || null,
      shouldGenerateRenewal: extractedData.shouldGenerateRenewal || false,
      startDate: extractedData.startDate || null
    };

  } catch (error) {
    console.error('❌ Erro ao chamar Gemini:', error);
    throw error;
  }
}

async function performIntelligentMatching(
  extractedData: Partial<ExtractedQuoteData>, 
  dbContext: { ramos: any[], companies: any[], clients: any[] }
): Promise<ExtractedQuoteData> {
  console.log('🔍 Iniciando matching inteligente...');

  let clientId = null;
  let clientMatch: 'exact' | 'partial' | 'none' = 'none';
  let insurerId = null;
  let insurerMatch: 'exact' | 'partial' | 'none' = 'none';
  let insuranceLineId = null;
  let ramoMatch: 'exact' | 'partial' | 'none' = 'none';

  if (extractedData.clientName) {
    const exactClient = dbContext.clients.find(c => 
      c.name.toLowerCase() === extractedData.clientName!.toLowerCase()
    );
    
    if (exactClient) {
      clientId = exactClient.id;
      clientMatch = 'exact';
      console.log('✅ Cliente encontrado (exact):', exactClient.name);
    } else {
      const partialClient = dbContext.clients.find(c => 
        c.name.toLowerCase().includes(extractedData.clientName!.toLowerCase()) ||
        extractedData.clientName!.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (partialClient) {
        clientId = partialClient.id;
        clientMatch = 'partial';
        console.log('⚠️ Cliente encontrado (partial):', partialClient.name);
      } else {
        console.log('❌ Cliente não encontrado:', extractedData.clientName);
      }
    }
  }

  if (extractedData.insurerName) {
    const exactInsurer = dbContext.companies.find(c => 
      c.name.toLowerCase() === extractedData.insurerName!.toLowerCase()
    );
    
    if (exactInsurer) {
      insurerId = exactInsurer.id;
      insurerMatch = 'exact';
      console.log('✅ Seguradora encontrada (exact):', exactInsurer.name);
    } else {
      const partialInsurer = dbContext.companies.find(c => 
        c.name.toLowerCase().includes(extractedData.insurerName!.toLowerCase()) ||
        extractedData.insurerName!.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (partialInsurer) {
        insurerId = partialInsurer.id;
        insurerMatch = 'partial';
        console.log('⚠️ Seguradora encontrada (partial):', partialInsurer.name);
      } else {
        console.log('❌ Seguradora não encontrada:', extractedData.insurerName);
      }
    }
  }

  if (extractedData.insuranceLine) {
    const exactRamo = dbContext.ramos.find(r => 
      r.nome.toLowerCase() === extractedData.insuranceLine!.toLowerCase()
    );
    
    if (exactRamo) {
      insuranceLineId = exactRamo.id;
      ramoMatch = 'exact';
      console.log('✅ Ramo encontrado (exact):', exactRamo.nome);
    } else {
      const partialRamo = dbContext.ramos.find(r => 
        r.nome.toLowerCase().includes(extractedData.insuranceLine!.toLowerCase()) ||
        extractedData.insuranceLine!.toLowerCase().includes(r.nome.toLowerCase())
      );
      
      if (partialRamo) {
        insuranceLineId = partialRamo.id;
        ramoMatch = 'partial';
        console.log('⚠️ Ramo encontrado (partial):', partialRamo.nome);
      } else {
        console.log('❌ Ramo não encontrado:', extractedData.insuranceLine);
      }
    }
  }

  return {
    clientName: extractedData.clientName || null,
    clientId,
    insuredItem: extractedData.insuredItem || null,
    insurerName: extractedData.insurerName || null,
    insurerId,
    insuranceLine: extractedData.insuranceLine || null,
    insuranceLineId,
    policyNumber: extractedData.policyNumber || null,
    premiumValue: extractedData.premiumValue || null,
    commissionPercentage: extractedData.commissionPercentage || null,
    shouldGenerateRenewal: extractedData.shouldGenerateRenewal || false,
    startDate: extractedData.startDate || null,
    matchingDetails: {
      clientMatch,
      insurerMatch,
      ramoMatch
    }
  };
}
