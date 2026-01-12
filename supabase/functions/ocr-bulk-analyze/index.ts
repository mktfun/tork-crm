import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OCR_SPACE_KEY = 'K82045193188957'; // Free tier key

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { files } = await req.json(); // Array de { base64, fileName, mimeType }
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error('Array de arquivos é obrigatório');
    }
    
    console.log(`Processing ${files.length} files with OCR.space + Lovable AI`);
    
    let aggregatedText = "";
    const processedFiles: string[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    // 1. EXTRAÇÃO BRUTA (OCR.space) - Loop controlado
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('apikey', OCR_SPACE_KEY);
        formData.append('language', 'por');
        formData.append('OCREngine', '2'); // Melhor para números
        formData.append('isTable', 'true'); // Melhora extração de tabelas
        
        // Determina prefixo correto baseado no mimeType
        const dataPrefix = file.mimeType?.includes('pdf') 
          ? 'data:application/pdf;base64,' 
          : `data:${file.mimeType || 'image/png'};base64,`;
          
        formData.append('base64Image', `${dataPrefix}${file.base64}`);

        console.log(`OCR processing: ${file.fileName}`);
        
        const ocrRes = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          body: formData
        });

        const ocrData = await ocrRes.json();
        
        if (ocrData.IsErroredOnProcessing || ocrData.OCRExitCode !== 1) {
          throw new Error(ocrData.ErrorMessage?.[0] || 'Falha no OCR');
        }
        
        if (ocrData.ParsedResults?.[0]?.ParsedText) {
          aggregatedText += `\n\n=== DOCUMENTO: ${file.fileName} ===\n${ocrData.ParsedResults[0].ParsedText}\n`;
          processedFiles.push(file.fileName);
          console.log(`OCR success: ${file.fileName} - ${ocrData.ParsedResults[0].ParsedText.length} chars`);
        } else {
          throw new Error('OCR não retornou texto');
        }
        
        // Delay de 500ms entre requisições (rate limit OCR.space: 180/hora)
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (ocrError: any) {
        console.error(`OCR Error for ${file.fileName}:`, ocrError);
        errors.push({ fileName: file.fileName, error: ocrError.message });
      }
    }

    if (processedFiles.length === 0) {
      throw new Error('Nenhum documento foi processado com sucesso pelo OCR');
    }

    console.log(`OCR complete. Processing ${processedFiles.length} documents with AI...`);

    // 2. MAPEAMENTO INTELIGENTE (Lovable AI - Apenas Texto)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const systemPrompt = `Você é um especialista em extração de dados de apólices de seguro brasileiras.
Analise o texto extraído via OCR de múltiplos documentos de seguro.

REGRAS IMPORTANTES:
1. Para cada documento separado por "=== DOCUMENTO: ... ===" extraia os dados
2. Retorne SEMPRE um array JSON, mesmo para um único documento
3. CPF: formato XXX.XXX.XXX-XX, CNPJ: formato XX.XXX.XXX/XXXX-XX
4. Datas: formato YYYY-MM-DD
5. Valores numéricos: sem R$, pontos de milhar. Use ponto como decimal
6. Se não encontrar um campo, use null
7. Para ramo_seguro, normalize para: "Auto", "Residencial", "Vida", "Empresarial", "Saúde", "Viagem", "Transporte", etc.
8. arquivo_origem deve conter o nome do arquivo do documento de onde os dados foram extraídos`;

    const geminiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Extraia os dados dos ${processedFiles.length} documento(s) abaixo.

TEXTO OCR EXTRAÍDO:
${aggregatedText}

Retorne um array JSON com os seguintes campos para cada documento:
{
  "nome_cliente": "string",
  "cpf_cnpj": "string | null",
  "email": "string | null",
  "telefone": "string | null",
  "numero_apolice": "string",
  "nome_seguradora": "string",
  "ramo_seguro": "string",
  "descricao_bem": "string | null",
  "data_inicio": "YYYY-MM-DD",
  "data_fim": "YYYY-MM-DD",
  "premio_liquido": number,
  "premio_total": number,
  "arquivo_origem": "nome do arquivo fonte"
}` 
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_policies',
            description: 'Extrai dados estruturados de apólices de seguro',
            parameters: {
              type: 'object',
              properties: {
                policies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nome_cliente: { type: 'string' },
                      cpf_cnpj: { type: 'string', nullable: true },
                      email: { type: 'string', nullable: true },
                      telefone: { type: 'string', nullable: true },
                      numero_apolice: { type: 'string' },
                      nome_seguradora: { type: 'string' },
                      ramo_seguro: { type: 'string' },
                      descricao_bem: { type: 'string', nullable: true },
                      data_inicio: { type: 'string' },
                      data_fim: { type: 'string' },
                      premio_liquido: { type: 'number' },
                      premio_total: { type: 'number' },
                      arquivo_origem: { type: 'string' }
                    },
                    required: ['nome_cliente', 'numero_apolice', 'nome_seguradora', 'ramo_seguro', 'arquivo_origem']
                  }
                }
              },
              required: ['policies']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_policies' } }
      })
    });

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error('AI Gateway error:', geminiRes.status, errorText);
      
      if (geminiRes.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit da IA atingido. Aguarde alguns segundos e tente novamente.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (geminiRes.status === 402) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Créditos insuficientes. Adicione créditos na sua conta Lovable.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error(`Erro na IA: ${geminiRes.status}`);
    }

    const aiResponse = await geminiRes.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error('AI response:', JSON.stringify(aiResponse, null, 2));
      throw new Error('IA não retornou dados estruturados');
    }
    
    const extractedData = JSON.parse(toolCall.function.arguments);
    
    console.log(`AI extraction complete. Found ${extractedData.policies?.length || 0} policies`);

    return new Response(JSON.stringify({ 
      success: true, 
      data: extractedData.policies || [],
      processedFiles,
      errors,
      stats: {
        total: files.length,
        success: processedFiles.length,
        failed: errors.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('ocr-bulk-analyze error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
