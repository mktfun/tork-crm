import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Prompt para apólices
const POLICY_PROMPT = `Você é um extrator de dados especialista em apólices de seguro brasileiras.
Analise este documento PDF/imagem de apólice e extraia as seguintes informações com MÁXIMA PRECISÃO:

**CLIENTE (Segurado/Proponente):**
- nome_completo (string) - Nome completo do segurado
- cpf_cnpj (string | null) - CPF ou CNPJ do segurado (VITAL para identificação). Formate como: 000.000.000-00 ou 00.000.000/0000-00
- email (string | null) - Email do segurado
- telefone (string | null) - Telefone do segurado
- endereco_completo (string | null) - Endereço completo

**APÓLICE:**
- numero_apolice (string) - Número da apólice/proposta
- nome_seguradora (string) - Nome da seguradora (Ex: Porto Seguro, Bradesco Seguros, etc.)
- data_inicio (string) - Data de início da vigência no formato YYYY-MM-DD
- data_fim (string) - Data de fim da vigência no formato YYYY-MM-DD
- ramo_seguro (string) - Tipo/Ramo do seguro (Ex: Auto, Residencial, Vida, Empresarial, Saúde, etc.)

**OBJETO SEGURADO:**
- descricao_bem (string) - Descrição detalhada do objeto segurado (Ex: "Toyota Corolla XEi 2.0 2024 Placa ABC-1234" ou "Residencial - Rua X, 123")

**VALORES:**
- premio_liquido (number) - Valor do prêmio líquido (base para cálculo de comissão). Se não encontrar separado, use o prêmio total.
- premio_total (number) - Valor total do prêmio a ser pago

REGRAS IMPORTANTES:
1. Se não encontrar um campo, retorne null (exceto para campos obrigatórios como nome e número da apólice)
2. Datas DEVEM estar no formato YYYY-MM-DD
3. Valores monetários devem ser números (sem R$, pontos de milhar, etc.). Use ponto como separador decimal.
4. CPF/CNPJ: Extraia mesmo que esteja parcialmente visível
5. Para ramo_seguro, normalize para: "Auto", "Residencial", "Vida", "Empresarial", "Saúde", "Viagem", "Responsabilidade Civil", "Transporte", ou "Outros"

Retorne APENAS um objeto JSON válido, sem texto adicional.`;

// Prompt para carteirinhas
const CARD_PROMPT = `Você é um extrator de dados especialista em carteirinhas de seguro brasileiras.
Analise esta imagem de carteirinha de seguro e extraia as seguintes informações:

**DADOS DA CARTEIRINHA:**
- nome_segurado (string) - Nome completo do titular/segurado
- numero_carteirinha (string | null) - Número da carteirinha ou apólice
- seguradora (string) - Nome da seguradora
- tipo_seguro (string) - Tipo do seguro (Auto, Saúde, Vida, Residencial, etc.)
- vigencia_inicio (string | null) - Data início da vigência no formato YYYY-MM-DD
- vigencia_fim (string | null) - Data fim da vigência no formato YYYY-MM-DD
- telefone_assistencia (string | null) - Telefone de assistência 24h
- placa (string | null) - Placa do veículo (se for seguro auto)
- chassi (string | null) - Número do chassi (se houver)
- cpf_cnpj (string | null) - CPF ou CNPJ do segurado

REGRAS:
1. Se não encontrar um campo, retorne null
2. Datas DEVEM estar no formato YYYY-MM-DD
3. Telefones: mantenha a formatação original
4. Para tipo_seguro, normalize para: "Auto", "Residencial", "Vida", "Empresarial", "Saúde", "Viagem", ou "Outros"

Retorne APENAS um objeto JSON válido, sem texto adicional.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!GOOGLE_AI_API_KEY) {
      console.error('GOOGLE_AI_API_KEY not configured');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { fileBase64, mimeType, documentType = 'policy' } = await req.json();

    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'fileBase64 and mimeType are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Selecionar prompt baseado no tipo de documento
    const selectedPrompt = documentType === 'card' ? CARD_PROMPT : POLICY_PROMPT;
    console.log('Processing document, type:', documentType, 'mimeType:', mimeType);

    // Schema para carteirinha
    const cardSchema = {
      type: 'object',
      properties: {
        nome_segurado: { type: 'string' },
        numero_carteirinha: { type: 'string', nullable: true },
        seguradora: { type: 'string' },
        tipo_seguro: { type: 'string' },
        vigencia_inicio: { type: 'string', nullable: true },
        vigencia_fim: { type: 'string', nullable: true },
        telefone_assistencia: { type: 'string', nullable: true },
        placa: { type: 'string', nullable: true },
        chassi: { type: 'string', nullable: true },
        cpf_cnpj: { type: 'string', nullable: true },
      },
      required: ['nome_segurado', 'seguradora', 'tipo_seguro'],
    };

    // Schema para apólice
    const policySchema = {
      type: 'object',
      properties: {
        cliente: {
          type: 'object',
          properties: {
            nome_completo: { type: 'string' },
            cpf_cnpj: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            telefone: { type: 'string', nullable: true },
            endereco_completo: { type: 'string', nullable: true },
          },
          required: ['nome_completo'],
        },
        apolice: {
          type: 'object',
          properties: {
            numero_apolice: { type: 'string' },
            nome_seguradora: { type: 'string' },
            data_inicio: { type: 'string' },
            data_fim: { type: 'string' },
            ramo_seguro: { type: 'string' },
          },
          required: ['numero_apolice', 'nome_seguradora', 'data_inicio', 'data_fim', 'ramo_seguro'],
        },
        objeto_segurado: {
          type: 'object',
          properties: {
            descricao_bem: { type: 'string' },
          },
          required: ['descricao_bem'],
        },
        valores: {
          type: 'object',
          properties: {
            premio_liquido: { type: 'number' },
            premio_total: { type: 'number' },
          },
          required: ['premio_liquido', 'premio_total'],
        },
      },
      required: ['cliente', 'apolice', 'objeto_segurado', 'valores'],
    };

    const selectedSchema = documentType === 'card' ? cardSchema : policySchema;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: selectedPrompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: fileBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: selectedSchema,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Gemini API error: ${response.status}` 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    console.log('Gemini response:', JSON.stringify(result, null, 2));

    const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!extractedText) {
      console.error('No text in Gemini response');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No data extracted from document' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let extractedData;
    try {
      // Limpa blocos de código markdown que o Gemini 2.0 pode adicionar
      let cleanedText = extractedText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      extractedData = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON:', extractedText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to parse extracted data' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully extracted data:', JSON.stringify(extractedData, null, 2));

    return new Response(JSON.stringify({ 
      success: true, 
      data: extractedData,
      documentType: documentType,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-policy function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});