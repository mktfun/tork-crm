import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedQuoteData {
  clientName: string | null;
  insuredItem: string | null;
  insurerName: string | null;
  insuranceLine: string | null;
  policyNumber: string | null;
  premiumValue: number | null;
  commissionPercentage: number | null;
  shouldGenerateRenewal: boolean;
  startDate: string | null;
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

    // 1️⃣ EXTRAIR TEXTO DO PDF
    const pdfText = await extractTextFromPDF(fileUrl);
    
    console.log(`📊 Texto extraído: ${pdfText.length} caracteres`);
    
    if (!pdfText || pdfText.trim().length < 100) {
      throw new Error('Não foi possível extrair texto suficiente do PDF (mínimo: 100 caracteres). Verifique se o arquivo não está corrompido ou protegido.');
    }

    console.log('✅ Texto extraído do PDF (primeiros 500 chars):', pdfText.substring(0, 500) + '...');

    // 2️⃣ BUSCAR CONTEXTO DO BANCO DE DADOS (RAG)
    const dbContext = await fetchDatabaseContext();

    // 3️⃣ CHAMAR GEMINI COM CONTEXTO RAG
    const extractedData = await extractDataWithAI(pdfText, dbContext);

    console.log('✅ Dados extraídos com sucesso:', extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        metadata: {
          textLength: pdfText.length,
          availableRamos: dbContext.ramos.length,
          availableCompanies: dbContext.companies.length
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

/**
 * Extrai texto do PDF usando PDF.co com OCR automático
 * Suporta PDFs complexos e escaneados
 */
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
        url: fileUrl, // ✅ URL pública do Storage
        inline: true, // Receber resposta imediata
        profiles: "{ 'ocrMode': 'auto' }" // Ativar OCR automático para PDFs escaneados
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


/**
 * Busca contexto do banco de dados (Ramos e Seguradoras)
 */
async function fetchDatabaseContext() {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  console.log('🔍 Buscando contexto do banco de dados...');

  const [ramosResult, companiesResult] = await Promise.all([
    supabaseAdmin.from('ramos').select('id, nome'),
    supabaseAdmin.from('companies').select('id, name')
  ]);

  if (ramosResult.error) {
    console.error('❌ Erro ao buscar ramos:', ramosResult.error);
    throw new Error('Falha ao buscar ramos do banco de dados');
  }

  if (companiesResult.error) {
    console.error('❌ Erro ao buscar seguradoras:', companiesResult.error);
    throw new Error('Falha ao buscar seguradoras do banco de dados');
  }

  console.log(`✅ Contexto carregado: ${ramosResult.data.length} ramos, ${companiesResult.data.length} seguradoras`);

  return {
    ramos: ramosResult.data || [],
    companies: companiesResult.data || []
  };
}

/**
 * Gera prompt RAG v3.0 com contexto do banco de dados
 */
function buildRAGPrompt(pdfText: string, ramos: any[], companies: any[]): string {
  const ramosList = ramos.map(r => r.nome).join(', ');
  const companiesList = companies.map(c => c.name).join(', ');

  return `# PERSONA
Você é um assistente de IA sênior especializado em conciliar documentos de seguros com sistemas de gestão de corretoras.

# CONTEXTO
Você recebeu um texto extraído de um orçamento de seguro em PDF, além de listas de dados que JÁ EXISTEM no sistema do usuário.

Sua principal missão é fazer o "match" inteligente entre o que está escrito no PDF e os dados cadastrados no sistema.

# LISTAS DO SISTEMA (USE ESSES VALORES EXATOS NA RESPOSTA):

**Ramos Cadastrados:**
${ramosList}

**Seguradoras Cadastradas:**
${companiesList}

# INSTRUÇÕES DE EXTRAÇÃO

Para cada campo abaixo, analise o texto do PDF e extraia os dados. Para os campos "insuranceLine" e "insurerName", você DEVE retornar o nome EXATO que consta nas listas acima.

## Campos a extrair:

1. **clientName**: Nome completo da pessoa ou empresa segurada (o cliente).
   - Exemplo: "THAIS MAIA", "João da Silva Transportes LTDA"

2. **insuredItem**: O bem ou objeto principal do seguro.
   - Para Automóvel: "Honda Civic LXR 2023"
   - Para Residencial: "Residência - Rua X, 123"
   - Para RC Profissional: "Médico" ou "Advogado" (a profissão)

3. **insurerName**: Nome da seguradora.
   - ⚠️ IMPORTANTE: Retorne o nome EXATO da lista "Seguradoras Cadastradas".
   - Se o PDF mencionar "Porto Seguro Companhia" e na lista tiver "Porto Seguro", retorne "Porto Seguro".
   - Se não encontrar correspondência, retorne null.

4. **insuranceLine**: Ramo do seguro.
   - ⚠️ IMPORTANTE: Retorne o nome EXATO da lista "Ramos Cadastrados".
   - Se o PDF mencionar "Responsabilidade Civil Profissional" e na lista tiver "RC Profissional", retorne "RC Profissional".
   - Se o PDF mencionar "Seguro de Automóvel" e na lista tiver "Auto", retorne "Auto".
   - Se não encontrar correspondência, retorne null.

5. **policyNumber**: Número completo do orçamento ou proposta.

6. **premiumValue**: Valor do **prêmio líquido**.
   - ⚠️ IGNORE o prêmio bruto. Se o documento mencionar ambos, extraia APENAS o líquido.
   - Retorne apenas o número, sem "R$".

7. **commissionPercentage**: Taxa de comissão em porcentagem.
   - Retorne apenas o número (ex: 20, não "20%").

8. **shouldGenerateRenewal**: 
   - Retorne true se o documento indicar "Seguro Novo" ou "Renovação".
   - Retorne false se indicar "Endosso" ou não especificar.

9. **startDate**: Data de início de vigência.
   - Formato: YYYY-MM-DD

# FORMATO DE SAÍDA
Retorne APENAS um objeto JSON válido. Não inclua explicações. Se um campo não for encontrado, use null.

# TEXTO EXTRAÍDO DO ORÇAMENTO:
${pdfText.substring(0, 8000)}

${pdfText.length > 8000 ? '\n[TEXTO TRUNCADO - PDF MUITO LONGO]' : ''}`;
}

/**
 * Usa Gemini via Lovable AI Gateway para extrair dados estruturados com contexto RAG
 */
async function extractDataWithAI(
  pdfText: string, 
  dbContext: { ramos: any[], companies: any[] }
): Promise<ExtractedQuoteData> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  const ragPrompt = buildRAGPrompt(pdfText, dbContext.ramos, dbContext.companies);

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
                    description: 'Nome completo do segurado/cliente',
                    nullable: true
                  },
                  insuredItem: {
                    type: 'string',
                    description: 'Bem ou objeto segurado',
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

    // Extrair dados do tool call
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
