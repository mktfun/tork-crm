import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OCR_SPACE_KEY = 'K82045193188957';

// Keywords para filtrar texto essencial (incluindo dados de veículos e imóveis)
const KEYWORDS = [
  'NOME', 'CPF', 'CNPJ', 'APOLICE', 'SEGURADO', 'VIGENCIA', 'PREMIO', 
  'LIQUIDO', 'RAMO', 'ENDOSSO', 'RENOVACAO', 'CIA', 'SEGURADORA', 
  'EMAIL', 'INICIO', 'TERMINO', 'VALOR', 'COBERTURA',
  'PLACA', 'MARCA', 'MODELO', 'VEICULO', 'CHASSI', 'ANO', 'FABRICACAO', 'RENAVAM', // Auto
  'CASA', 'APARTAMENTO', 'CONDOMINIO', 'ENDERECO', 'LOGRADOURO', 'RESIDENCIAL', 'IMÓVEL', // Residencial
  'VIDA', 'PESSOA', 'BENEFICIARIO', 'CAPITAL', 'SEGURADA' // Vida/Pessoas
];

// Função para filtrar apenas linhas essenciais do texto (reduz tokens para IA)
function filterEssentialText(text: string, maxChars: number = 15000): string {
  const lines = text.split('\n');
  const relevantLines: string[] = [];
  let totalChars = 0;
  
  for (const line of lines) {
    const upperLine = line.toUpperCase();
    // Verifica se a linha contém alguma keyword importante
    const hasKeyword = KEYWORDS.some(kw => upperLine.includes(kw));
    // Ou se contém padrões importantes (CPF, datas, valores)
    const hasPattern = /\d{3}[.\-]\d{3}[.\-]\d{3}[.\-]\d{2}|\d{2}[.\-]\d{3}[.\-]\d{3}[\/]\d{4}[.\-]\d{2}|\d{2}\/\d{2}\/\d{4}|R\$\s*[\d.,]+|\d{1,3}[.]\d{3}[,]\d{2}/.test(line);
    // Ou se parece com placa de veículo
    const hasPlaca = /[A-Z]{3}[\-\s]?\d[A-Z0-9]\d{2}|[A-Z]{3}\d{4}/i.test(line);
    
    if (hasKeyword || hasPattern || hasPlaca) {
      if (totalChars + line.length <= maxChars) {
        relevantLines.push(line);
        totalChars += line.length;
      }
    }
  }
  
  return relevantLines.join('\n');
}

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

        // Adiciona texto filtrado se suficiente
        if (extractedText && extractedText.trim().length > 10) {
          // Filtra apenas linhas essenciais para economizar tokens da IA
          const filteredText = filterEssentialText(extractedText);
          console.log(`🔎 [FILTRO] ${file.fileName}: ${extractedText.length} → ${filteredText.length} chars (${Math.round(100 * filteredText.length / extractedText.length)}%)`);
          allTexts.push({ fileName: file.fileName, text: filteredText });
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
8. arquivo_origem deve conter o nome do arquivo do documento de onde os dados foram extraídos

EXTRAÇÃO DO OBJETO SEGURADO (MUITO IMPORTANTE):
- Para AUTO: extraia marca, modelo e PLACA do veículo (Ex: "Toyota Corolla", placa "ABC-1D23")
- Para RESIDENCIAL: extraia tipo do imóvel e endereço resumido (Ex: "Apartamento - Rua X, 123")
- Para VIDA/PESSOAS: extraia tipo de cobertura (Ex: "Vida Individual", "Vida em Grupo")

CAMPOS ADICIONAIS:
- objeto_segurado: descrição do bem (carro, casa, pessoa)
- identificacao_adicional: para AUTO = placa; para RESIDENCIAL = número/complemento do endereço; para VIDA = null
- tipo_operacao: 'RENOVACAO', 'NOVA' ou 'ENDOSSO' (inferir do texto)
- titulo_sugerido: formato "[NOME_CLIENTE] - [RAMO] ([OBJETO_SEGURADO] - [IDENTIFICACAO])" 
  Ex: "João Silva - Auto (Toyota Corolla - ABC1D23)"`;

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
                  objeto_segurado: { type: 'string', nullable: true, description: 'Ex: Toyota Corolla, Apartamento, Vida Individual' },
                  identificacao_adicional: { type: 'string', nullable: true, description: 'Placa do veículo ou endereço do imóvel' },
                  tipo_operacao: { type: 'string', enum: ['RENOVACAO', 'NOVA', 'ENDOSSO'], nullable: true },
                  titulo_sugerido: { type: 'string', description: 'Formato: NOME - RAMO (OBJETO - IDENTIFICACAO)' },
                  data_inicio: { type: 'string' },
                  data_fim: { type: 'string' },
                  premio_liquido: { type: 'number' },
                  premio_total: { type: 'number' },
                  arquivo_origem: { type: 'string' }
                },
                required: ['nome_cliente', 'numero_apolice', 'nome_seguradora', 'ramo_seguro', 'arquivo_origem', 'titulo_sugerido']
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
  "ramo_seguro": "string (normalizado: Auto, Residencial, Vida, etc)",
  "descricao_bem": "string | null",
  "objeto_segurado": "string | null (marca/modelo do carro, tipo de imóvel, etc)",
  "identificacao_adicional": "string | null (placa do veículo ou endereço resumido)",
  "tipo_operacao": "RENOVACAO | NOVA | ENDOSSO",
  "titulo_sugerido": "NOME - RAMO (OBJETO - IDENTIFICACAO)",
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
