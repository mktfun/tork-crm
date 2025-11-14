// ✅ NOVA VERSÃO: Gemini 1.5 Flash com PDF Nativo
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista de modelos para tentar em ordem de prioridade
const MODELS_TO_TRY = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-001',
];
const GOOGLE_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

// Função para buscar contexto (clientes, seguradoras, ramos)
async function fetchDatabaseContext(supabaseAdmin: any) {
  const [
    { data: clients },
    { data: companies },
    { data: ramos }
  ] = await Promise.all([
    supabaseAdmin.from('clientes').select('id, name, cpf_cnpj'),
    supabaseAdmin.from('companies').select('id, name'),
    supabaseAdmin.from('ramos').select('id, nome'),
  ]);

  return {
    clients: clients || [],
    companies: companies || [],
    ramos: ramos || [],
  };
}

// Função para baixar PDF do Storage e converter para Base64
async function downloadPdfAsBase64(supabaseAdmin: any, fileUrl: string): Promise<string> {
  const urlParts = new URL(fileUrl);
  const filePath = urlParts.pathname.split('/object/public/quote-uploads/')[1];

  if (!filePath) {
    throw new Error('Caminho do arquivo inválido na URL');
  }

  console.log('📥 Baixando PDF do Storage:', filePath);

  const { data: pdfBlob, error } = await supabaseAdmin.storage
    .from('quote-uploads')
    .download(filePath);

  if (error || !pdfBlob) {
    throw new Error(`Erro ao baixar PDF: ${error?.message}`);
  }

  const arrayBuffer = await pdfBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const base64 = btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ''));
  
  console.log(`✅ PDF convertido para base64 (${Math.round(base64.length / 1024)}KB)`);
  return base64;
}

// Constrói o prompt dinâmico para o Gemini
function buildPromptForGemini(dbContext: any): string {
  return `Você é um assistente especializado em extrair dados de apólices e orçamentos de seguro em PDF.

INSTRUÇÕES CRÍTICAS:
1. Retorne APENAS um objeto JSON válido (sem markdown, sem explicações).
2. Se um campo não existir no documento, use null.
3. Para valores monetários (premiumValue), retorne apenas o número (ex: 1500.00, não "R$ 1.500,00").
4. Para comissão (commissionPercentage), retorne apenas o número (ex: 20, não "20%").
5. Para datas (startDate), use o formato YYYY-MM-DD.
6. shouldGenerateRenewal = true se for Seguro Novo ou Renovação; false se for Endosso.

CLIENTES EXISTENTES (use o nome EXATO se corresponder):
${dbContext.clients.map((c: any) => `- ${c.name} (CPF/CNPJ: ${c.cpf_cnpj || 'N/A'})`).join('\n')}

SEGURADORAS EXISTENTES (use o nome EXATO se corresponder):
${dbContext.companies.map((c: any) => `- ${c.name}`).join('\n')}

RAMOS EXISTENTES (use o nome EXATO se corresponder):
${dbContext.ramos.map((r: any) => `- ${r.nome}`).join('\n')}

RETORNE APENAS O JSON:`;
}

// Função para realizar o matching após a extração da IA
function performIntelligentMatching(extractedData: any, dbContext: any) {
  const data = { ...extractedData };
  const matchingDetails = {
    clientMatch: 'none',
    insurerMatch: 'none',
    ramoMatch: 'none',
  };

  if (data.clientName) {
    const clientFound = dbContext.clients.find(
      (c: any) => c.name.toLowerCase() === data.clientName.toLowerCase()
    );
    if (clientFound) {
      data.clientId = clientFound.id;
      matchingDetails.clientMatch = 'exact';
    }
  }

  if (data.insurerName) {
    const insurerFound = dbContext.companies.find(
      (c: any) => c.name.toLowerCase() === data.insurerName.toLowerCase()
    );
    if (insurerFound) {
      data.insurerId = insurerFound.id;
      matchingDetails.insurerMatch = 'exact';
    }
  }

  if (data.insuranceLine) {
    const ramoFound = dbContext.ramos.find(
      (r: any) => r.nome.toLowerCase() === data.insuranceLine.toLowerCase()
    );
    if (ramoFound) {
      data.insuranceLineId = ramoFound.id;
      matchingDetails.ramoMatch = 'exact';
    }
  }

  return { ...data, matchingDetails };
}

// Tenta extrair dados com UM modelo específico
async function extractWithModel(modelName: string, pdfBase64: string, prompt: string, apiKey: string) {
  const apiUrl = `${GOOGLE_API_URL_BASE}${modelName}:generateContent`;
  
  console.log(`🤖 Chamando Google Gemini: ${modelName}`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            clientName: { type: 'string', nullable: true },
            insuredItem: { type: 'string', nullable: true },
            insurerName: { type: 'string', nullable: true },
            insuranceLine: { type: 'string', nullable: true },
            policyNumber: { type: 'string', nullable: true },
            premiumValue: { type: 'number', nullable: true },
            commissionPercentage: { type: 'number', nullable: true },
            startDate: { type: 'string', nullable: true },
            shouldGenerateRenewal: { type: 'boolean' },
          },
          required: ['shouldGenerateRenewal'],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Erro da Google AI API com o modelo ${modelName}:`, errorText);
    throw new Error(`Gemini API error (${modelName}): ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!extractedText) {
    throw new Error('Gemini não retornou dados');
  }

  return JSON.parse(extractedText);
}

// Função principal com fallback
async function extractDataWithGeminiPDF(pdfBase64: string, dbContext: any) {
  const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY não configurada.');
  }

  const prompt = buildPromptForGemini(dbContext);
  let lastError: Error | null = null;

  for (const modelName of MODELS_TO_TRY) {
    try {
      console.log(`🔄 Tentando modelo: ${modelName}`);
      const extractedData = await extractWithModel(modelName, pdfBase64, prompt, GOOGLE_AI_API_KEY);
      console.log(`✅ Sucesso com: ${modelName}`);
      
      return performIntelligentMatching(extractedData, dbContext);

    } catch (error) {
      console.log(`⚠️ Falha com ${modelName}:`, error.message);
      lastError = error;
    }
  }

  console.error('❌ Todos os modelos de IA falharam.');
  throw new Error(`Falha na extração de dados após tentar ${MODELS_TO_TRY.length} modelos. Último erro: ${lastError?.message}`);
}

// Servidor Deno
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { fileUrl } = await req.json();
    if (!fileUrl) throw new Error('fileUrl é obrigatório');

    console.log('📄 Processando PDF:', fileUrl);

    const pdfBase64 = await downloadPdfAsBase64(supabaseAdmin, fileUrl);

    const dbContext = await fetchDatabaseContext(supabaseAdmin);
    console.log(`✅ Contexto: ${dbContext.ramos.length} ramos, ${dbContext.companies.length} seguradoras, ${dbContext.clients.length} clientes`);

    const extractedData = await extractDataWithGeminiPDF(pdfBase64, dbContext);
    console.log('✅ Dados extraídos e enriquecidos:', extractedData);

    const filePath = new URL(fileUrl).pathname.split('/object/public/quote-uploads/')[1];
    if (filePath) {
      await supabaseAdmin.storage.from('quote-uploads').remove([filePath]);
      console.log('🗑️ Arquivo temporário removido');
    }

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no fluxo principal:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});