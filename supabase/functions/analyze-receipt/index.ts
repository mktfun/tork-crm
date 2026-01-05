import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um extrator de dados financeiros especializado em recibos e notas fiscais brasileiras.

Analise a imagem/PDF fornecido e extraia as seguintes informações:

1. **date**: Data da transação no formato YYYY-MM-DD
2. **amount**: Valor total (número decimal, ex: 150.99)
3. **merchant_name**: Nome do estabelecimento/fornecedor
4. **category_guess**: Sugira uma categoria curta em português brasileiro:
   - Alimentação
   - Transporte
   - Combustível
   - Material de Escritório
   - Software/Assinatura
   - Marketing
   - Telefone/Internet
   - Energia/Água
   - Aluguel
   - Manutenção
   - Serviços Profissionais
   - Impostos
   - Outros

REGRAS:
- Retorne APENAS um objeto JSON válido
- Se não encontrar um campo, use null
- Para valores em reais, remova "R$" e vírgulas (ex: "R$ 1.234,56" → 1234.56)
- Datas: converta para YYYY-MM-DD
- Seja preciso na extração do valor total`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY não configurada');
    }

    const { fileBase64, mimeType } = await req.json();
    
    if (!fileBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: 'fileBase64 e mimeType são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📄 Analisando documento: ${mimeType} (${Math.round(fileBase64.length / 1024)}KB)`);

    // Chamar Gemini API
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GOOGLE_AI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SYSTEM_PROMPT },
            { 
              inlineData: { 
                mimeType: mimeType, 
                data: fileBase64 
              } 
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              date: { type: 'string', nullable: true },
              amount: { type: 'number', nullable: true },
              merchant_name: { type: 'string', nullable: true },
              category_guess: { type: 'string', nullable: true },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro Gemini API:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!extractedText) {
      console.error('❌ Gemini não retornou dados');
      throw new Error('Gemini não retornou dados');
    }

    // Limpa blocos de código markdown que o Gemini 2.0 pode adicionar
    let cleanedText = extractedText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    const extractedData = JSON.parse(cleanedText);
    console.log('✅ Dados extraídos:', extractedData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro analyze-receipt:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
