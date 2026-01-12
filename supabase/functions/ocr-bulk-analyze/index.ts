import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OCR_SPACE_KEY = 'K82045193188957';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const totalStartTime = performance.now();
  console.log("🚀 [BULK-OCR] Iniciando processamento...");

  try {
    const { files } = await req.json();
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error('Array de arquivos é obrigatório');
    }

    console.log(`📁 [BULK-OCR] Recebidos ${files.length} arquivos`);

    const allTexts: { fileName: string; text: string }[] = [];
    const processedFiles: string[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    // ============================================
    // 1. LOOP OCR COM LOGGING INDIVIDUAL
    // Cada arquivo é processado individualmente
    // Se um falhar, os outros CONTINUAM
    // ============================================
    for (const [index, file] of files.entries()) {
      const fileStart = performance.now();
      
      try {
        const formData = new FormData();
        formData.append('apikey', OCR_SPACE_KEY);
        formData.append('language', 'por');
        formData.append('OCREngine', '2'); // Melhor para números
        formData.append('isTable', 'true'); // Melhora extração de tabelas
        
        // Limpeza do base64 se necessário
        const base64Data = file.base64.includes(',') ? file.base64.split(',')[1] : file.base64;
        
        // Determina prefixo correto baseado no mimeType
        const dataPrefix = file.mimeType?.includes('pdf') 
          ? 'data:application/pdf;base64,' 
          : `data:${file.mimeType || 'image/png'};base64,`;
          
        formData.append('base64Image', `${dataPrefix}${base64Data}`);

        const ocrRes = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          body: formData
        });

        const ocrData = await ocrRes.json();
        
        if (ocrData.IsErroredOnProcessing || ocrData.OCRExitCode !== 1) {
          throw new Error(ocrData.ErrorMessage?.[0] || 'Falha no OCR');
        }
        
        if (ocrData.ParsedResults?.[0]?.ParsedText) {
          const extractedText = ocrData.ParsedResults[0].ParsedText;
          allTexts.push({ 
            fileName: file.fileName, 
            text: extractedText 
          });
          processedFiles.push(file.fileName);
          
          const duration = (performance.now() - fileStart).toFixed(2);
          console.log(`✅ [OCR] ${index + 1}/${files.length} (${file.fileName}) extraído em ${duration}ms - ${extractedText.length} chars`);
        } else {
          throw new Error('OCR não retornou texto');
        }
        
        // Delay de 500ms entre requisições (rate limit OCR.space: 180/hora)
        if (index < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (ocrError: any) {
        const duration = (performance.now() - fileStart).toFixed(2);
        console.error(`❌ [OCR] ${index + 1}/${files.length} (${file.fileName}) FALHOU em ${duration}ms:`, ocrError.message);
        errors.push({ fileName: file.fileName, error: ocrError.message });
        // CONTINUA para o próximo arquivo - NÃO para o loop!
      }
    }

    const ocrDuration = ((performance.now() - totalStartTime) / 1000).toFixed(2);
    console.log(`📊 [OCR] Fase concluída em ${ocrDuration}s - ${allTexts.length}/${files.length} arquivos extraídos`);

    if (allTexts.length === 0) {
      throw new Error('Nenhum documento foi processado com sucesso pelo OCR. Verifique os arquivos.');
    }

    // ============================================
    // 2. MAPEAMENTO COM IA - UMA ÚNICA CHAMADA
    // Usamos LOVABLE_API_KEY (já está no ambiente)
    // Chunking inteligente se o lote for muito grande
    // ============================================
    const aiStartTime = performance.now();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    let finalData: any[] = [];

    // Função para chamar a IA com um subset de textos
    const callGemini = async (subset: typeof allTexts): Promise<any[]> => {
      console.log(`🧠 [IA] Enviando ${subset.length} textos para mapeamento...`);
      
      const aggregatedText = subset
        .map(t => `\n\n=== DOCUMENTO: ${t.fileName} ===\n${t.text}\n`)
        .join('');

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
              content: `Extraia os dados dos ${subset.length} documento(s) abaixo.

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
          throw new Error('RATE_LIMIT');
        }
        if (geminiRes.status === 402) {
          throw new Error('CREDITS_EXHAUSTED');
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
      return extractedData.policies || [];
    };

    // Tenta processar tudo de uma vez primeiro
    try {
      console.log(`🧠 [IA] Tentando processar lote completo (${allTexts.length} documentos)...`);
      finalData = await callGemini(allTexts);
      console.log(`✅ [IA] Lote completo processado! ${finalData.length} apólices extraídas`);
    } catch (aiError: any) {
      // Se falhou (token limit, etc), tenta em chunks de 5
      if (aiError.message === 'RATE_LIMIT') {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit da IA atingido. Aguarde alguns segundos e tente novamente.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (aiError.message === 'CREDITS_EXHAUSTED') {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Créditos insuficientes. Adicione créditos na sua conta Lovable.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.warn(`⚠️ [IA] Lote grande falhou (${aiError.message}), dividindo em chunks de 5...`);
      
      const CHUNK_SIZE = 5;
      for (let i = 0; i < allTexts.length; i += CHUNK_SIZE) {
        const chunk = allTexts.slice(i, i + CHUNK_SIZE);
        console.log(`🧠 [IA] Processando chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(allTexts.length/CHUNK_SIZE)}...`);
        
        try {
          const results = await callGemini(chunk);
          finalData = [...finalData, ...results];
          console.log(`✅ [IA] Chunk processado: +${results.length} apólices`);
        } catch (chunkError: any) {
          console.error(`❌ [IA] Chunk falhou:`, chunkError.message);
          // Adiciona erro para os arquivos deste chunk
          chunk.forEach(t => {
            errors.push({ fileName: t.fileName, error: `IA falhou: ${chunkError.message}` });
          });
        }
        
        // Pequeno delay entre chunks
        if (i + CHUNK_SIZE < allTexts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    const aiDuration = ((performance.now() - aiStartTime) / 1000).toFixed(2);
    const totalDuration = ((performance.now() - totalStartTime) / 1000).toFixed(2);
    
    console.log(`📊 [IA] Fase concluída em ${aiDuration}s - ${finalData.length} apólices mapeadas`);
    console.log(`🏁 [DONE] Processamento total concluído em ${totalDuration}s`);

    return new Response(JSON.stringify({ 
      success: true, 
      data: finalData,
      processedFiles,
      errors,
      stats: {
        total: files.length,
        success: processedFiles.length,
        failed: errors.length
      },
      metrics: {
        totalDurationSec: totalDuration,
        ocrDurationSec: ocrDuration,
        aiDurationSec: aiDuration,
        filesProcessed: allTexts.length,
        policiesExtracted: finalData.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const totalDuration = ((performance.now() - totalStartTime) / 1000).toFixed(2);
    console.error(`💀 [FATAL] Erro após ${totalDuration}s:`, error.message);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      metrics: {
        totalDurationSec: totalDuration
      }
    }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
