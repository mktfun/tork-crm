import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedQuoteData {
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

    // 2️⃣ CHAMAR GEMINI PARA EXTRAÇÃO ESTRUTURADA
    const extractedData = await extractDataWithAI(pdfText);

    console.log('✅ Dados extraídos com sucesso:', extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        metadata: {
          textLength: pdfText.length
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
 * Usa Gemini via Lovable AI Gateway para extrair dados estruturados
 */
async function extractDataWithAI(pdfText: string): Promise<ExtractedQuoteData> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  const systemPrompt = `Você é um assistente especialista em processamento de documentos para corretoras de seguro.
Sua única função é extrair informações específicas de textos de orçamento de seguro e retorná-las em formato estruturado.

CONTEXTO: O texto fornecido foi extraído de um PDF de orçamento. O layout original foi perdido.

IMPORTANTE:
- Seja preciso e conservador. Se não tiver certeza, retorne null.
- Para "shouldGenerateRenewal": retorne true APENAS se encontrar "Seguro Novo" ou "Renovação". Para "Endosso" ou qualquer outra coisa, retorne false.
- Para "insuranceLine": deduza o ramo genérico (Automóvel, Residencial, Vida, Empresarial, etc.)
- Para valores monetários: extraia apenas números, sem símbolos.`;

  const userPrompt = `Analise o texto abaixo e extraia os campos solicitados:

TEXTO DO ORÇAMENTO:
${pdfText.substring(0, 8000)}

${pdfText.length > 8000 ? '\n[TEXTO TRUNCADO - PDF MUITO LONGO]' : ''}`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_quote_fields',
              description: 'Extrai campos estruturados de um orçamento de seguro',
              parameters: {
                type: 'object',
                properties: {
                  insuredItem: {
                    type: 'string',
                    description: 'O bem principal sendo segurado (ex: Honda Civic, Residência)',
                    nullable: true
                  },
                  insurerName: {
                    type: 'string',
                    description: 'Nome da seguradora (ex: Porto Seguro, Allianz)',
                    nullable: true
                  },
                  insuranceLine: {
                    type: 'string',
                    description: 'Ramo do seguro (ex: Automóvel, Residencial, Vida)',
                    nullable: true
                  },
                  policyNumber: {
                    type: 'string',
                    description: 'Número do orçamento ou proposta',
                    nullable: true
                  },
                  premiumValue: {
                    type: 'number',
                    description: 'Valor total do prêmio em reais (apenas número)',
                    nullable: true
                  },
                  commissionPercentage: {
                    type: 'number',
                    description: 'Comissão em porcentagem (apenas número)',
                    nullable: true
                  },
                  shouldGenerateRenewal: {
                    type: 'boolean',
                    description: 'true se for Seguro Novo ou Renovação, false caso contrário'
                  },
                  startDate: {
                    type: 'string',
                    description: 'Data de início de vigência no formato YYYY-MM-DD',
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
