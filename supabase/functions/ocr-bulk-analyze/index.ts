import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OCR_SPACE_KEY = 'K82045193188957';

// Função para extrair texto de PDF digital usando regex patterns
// (fallback rápido antes do OCR)
function extractTextFromPdfBuffer(buffer: Uint8Array): string {
  try {
    // Converte buffer para string (funciona para PDFs com texto embutido)
    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(buffer);
    
    // Extrai streams de texto do PDF
    const textMatches: string[] = [];
    
    // Pattern para BT...ET blocks (text objects)
    const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
    let match;
    
    while ((match = btEtRegex.exec(pdfString)) !== null) {
      const textBlock = match[1];
      // Extrai strings entre parênteses (texto literal)
      const stringRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = stringRegex.exec(textBlock)) !== null) {
        if (strMatch[1].trim()) {
          textMatches.push(strMatch[1]);
        }
      }
    }
    
    // Também tenta extrair de streams descomprimidos
    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    while ((match = streamRegex.exec(pdfString)) !== null) {
      const streamContent = match[1];
      // Procura por texto legível no stream
      const readableText = streamContent.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ');
      if (readableText.length > 50) {
        // Extrai palavras legíveis
        const words = readableText.match(/[A-Za-zÀ-ÿ0-9.,\-/]{2,}/g);
        if (words && words.length > 10) {
          textMatches.push(words.join(' '));
        }
      }
    }
    
    return textMatches.join(' ').replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.warn('Erro na extração local:', e);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const totalStartTime = performance.now();
  console.log("🚀 [BULK-OCR] Iniciando processamento híbrido...");

  try {
    const { files } = await req.json();
    
    if (!files || files.length === 0) {
      throw new Error("Nenhum arquivo recebido.");
    }

    console.log(`📁 [BULK-OCR] Recebidos ${files.length} arquivos`);

    const allTexts: { fileName: string; text: string }[] = [];
    const ocrErrors: string[] = [];

    for (const [index, file] of files.entries()) {
      const fileStart = performance.now();
      let extractedText = "";

      try {
        // Limpeza robusta do base64
        const base64Clean = file.base64.includes(',') 
          ? file.base64.split(',')[1] 
          : file.base64;
        
        // Converte base64 para Uint8Array
        const binaryString = atob(base64Clean);
        const binaryData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          binaryData[i] = binaryString.charCodeAt(i);
        }

        const fileSizeKB = Math.round(binaryData.length / 1024);
        console.log(`📄 [${index + 1}/${files.length}] ${file.fileName}: ${fileSizeKB}KB`);

        // --- TENTATIVA 1: EXTRAÇÃO LOCAL RÁPIDA (regex-based) ---
        console.log(`📖 [LOCAL] Tentando extração direta: ${file.fileName}`);
        extractedText = extractTextFromPdfBuffer(binaryData);
        
        if (extractedText.length > 100) {
          console.log(`✅ [LOCAL] Sucesso! ${file.fileName}: ${extractedText.length} chars em ${Math.round(performance.now() - fileStart)}ms`);
        } else {
          console.log(`⚠️ [LOCAL] Texto insuficiente (${extractedText.length} chars), tentando OCR...`);
          
          // --- TENTATIVA 2: OCR.SPACE ---
          if (binaryData.length > 1024 * 1024) {
            console.error(`❌ [OCR] ${file.fileName} é muito grande (${fileSizeKB}KB > 1024KB) para OCR gratuito`);
            ocrErrors.push(`${file.fileName}: arquivo muito grande para OCR (${fileSizeKB}KB)`);
          } else {
            console.log(`🔍 [OCR] Tentando OCR.space para ${file.fileName}...`);
            
            const formData = new FormData();
            formData.append('apikey', OCR_SPACE_KEY);
            formData.append('language', 'por');
            formData.append('OCREngine', '2');
            formData.append('isTable', 'true');
            formData.append('filetype', 'PDF');
            formData.append('base64Image', `data:application/pdf;base64,${base64Clean}`);

            const ocrRes = await fetch('https://api.ocr.space/parse/image', {
              method: 'POST',
              body: formData,
            });

            const ocrData = await ocrRes.json();
            
            if (!ocrData.IsErroredOnProcessing && ocrData.ParsedResults?.[0]?.ParsedText) {
              extractedText = ocrData.ParsedResults[0].ParsedText;
              console.log(`✅ [OCR] Sucesso! ${file.fileName}: ${extractedText.length} chars em ${Math.round(performance.now() - fileStart)}ms`);
            } else {
              console.error(`❌ [OCR] Falha em ${file.fileName}:`, ocrData.ErrorMessage?.[0] || 'Erro desconhecido');
              ocrErrors.push(`${file.fileName}: ${ocrData.ErrorMessage?.[0] || 'Falha no OCR'}`);
            }
          }
        }

        // Adiciona texto se suficiente
        if (extractedText && extractedText.trim().length > 10) {
          allTexts.push({ fileName: file.fileName, text: extractedText });
        }

      } catch (err: any) {
        console.error(`💥 Erro crítico no arquivo ${file.fileName}:`, err.message);
        ocrErrors.push(`${file.fileName}: ${err.message}`);
      }
    }

    const ocrDuration = ((performance.now() - totalStartTime) / 1000).toFixed(2);
    console.log(`📊 [EXTRAÇÃO] Fase concluída em ${ocrDuration}s - ${allTexts.length}/${files.length} arquivos extraídos`);

    if (allTexts.length === 0) {
      throw new Error(`Nenhum texto pôde ser extraído. Erros: ${ocrErrors.join('; ')}`);
    }

    // --- CHAMADA ÚNICA IA (LOVABLE AI GATEWAY) ---
    console.log(`🧠 [IA] Iniciando mapeamento de ${allTexts.length} documentos...`);
    const aiStartTime = performance.now();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const aggregatedText = allTexts
      .map(t => `\n\n=== DOCUMENTO: ${t.fileName} ===\n${t.text}\n`)
      .join('');

    const systemPrompt = `Você é um especialista em extração de dados de apólices de seguro brasileiras.
Analise o texto extraído de múltiplos documentos de seguro.

REGRAS IMPORTANTES:
1. Para cada documento separado por "=== DOCUMENTO: ... ===" extraia os dados
2. Retorne SEMPRE um array JSON, mesmo para um único documento
3. CPF: formato XXX.XXX.XXX-XX, CNPJ: formato XX.XXX.XXX/XXXX-XX
4. Datas: formato YYYY-MM-DD
5. Valores numéricos: sem R$, pontos de milhar. Use ponto como decimal
6. Se não encontrar um campo, use null
7. Para ramo_seguro, normalize para: "Auto", "Residencial", "Vida", "Empresarial", "Saúde", "Viagem", "Transporte", etc.
8. arquivo_origem deve conter o nome do arquivo do documento de onde os dados foram extraídos`;

    const tool = {
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
    };

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `Extraia os dados dos ${allTexts.length} documento(s) abaixo.

TEXTO EXTRAÍDO:
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
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'extract_policies' } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`❌ [IA] Erro na API:`, aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit da IA atingido. Aguarde alguns segundos.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Créditos insuficientes. Adicione créditos na sua conta Lovable.');
      }
      
      throw new Error(`Erro na IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiDuration = ((performance.now() - aiStartTime) / 1000).toFixed(2);
    
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error('AI response:', JSON.stringify(aiData, null, 2));
      throw new Error('IA não retornou dados estruturados');
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    const finalData = extractedData.policies || [];

    const totalDuration = ((performance.now() - totalStartTime) / 1000).toFixed(2);
    console.log(`✅ [SUCESSO] ${finalData.length} apólices extraídas em ${totalDuration}s (Extração: ${ocrDuration}s, IA: ${aiDuration}s)`);

    return new Response(JSON.stringify({
      success: true,
      data: finalData,
      processedFiles: allTexts.map(t => t.fileName),
      errors: ocrErrors,
      stats: {
        total: files.length,
        success: allTexts.length,
        failed: ocrErrors.length
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
      metrics: { totalDurationSec: totalDuration }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
