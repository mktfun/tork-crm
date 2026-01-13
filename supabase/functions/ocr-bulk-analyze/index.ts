import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OCR_SPACE_KEY = 'K82045193188957';

// Keywords para validar qualidade do texto
const KEYWORDS = [
  'NOME', 'CPF', 'CNPJ', 'SEGURADO', 'TITULAR', 'ESTIPULANTE',
  'APOLICE', 'PROPOSTA', 'ORCAMENTO', 'ENDOSSO', 'RENOVACAO',
  'VIGENCIA', 'INICIO', 'TERMINO', 'FIM', 'VALIDADE',
  'PREMIO', 'LIQUIDO', 'TOTAL', 'IOF', 'VALOR', 'PARCELA',
  'RAMO', 'SEGURADORA', 'COBERTURA', 'FRANQUIA',
  'PLACA', 'MARCA', 'MODELO', 'VEICULO', 'CHASSI',
  'RESIDENCIAL', 'IMOVEL', 'VIDA', 'EMPRESA'
];

// Avalia qualidade do texto extraído
function evaluateTextQuality(text: string): { score: number; keywordHits: number } {
  const upperText = text.toUpperCase();
  const keywordHits = KEYWORDS.filter(kw => upperText.includes(kw)).length;
  const digitMatches = text.match(/\d/g) || [];
  const monetaryMatches = text.match(/R\$\s*[\d.,]+|\d{1,3}[.]\d{3}[,]\d{2}/g) || [];
  const digitRatio = (digitMatches.length + monetaryMatches.length * 10) / Math.max(text.length, 1);
  const score = (keywordHits * 5) + (digitRatio * 100);
  return { score, keywordHits };
}

// Filtra linhas essenciais do texto
function filterEssentialText(text: string, maxChars: number = 15000): string {
  const lines = text.split('\n');
  const relevantLines: Set<string> = new Set();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();
    
    const hasKeyword = KEYWORDS.some(kw => upperLine.includes(kw));
    const hasPattern = /\d{3}[.\-]\d{3}[.\-]\d{3}[.\-]\d{2}|\d{2}\/\d{2}\/\d{4}|R\$\s*[\d.,]+/.test(line);
    const hasPlaca = /[A-Z]{3}[\-\s]?\d[A-Z0-9]\d{2}|[A-Z]{3}\d{4}/i.test(line);
    
    if (hasKeyword || hasPattern || hasPlaca) {
      if (i > 0 && lines[i - 1].trim()) relevantLines.add(lines[i - 1]);
      relevantLines.add(line);
      if (i < lines.length - 1 && lines[i + 1].trim()) relevantLines.add(lines[i + 1]);
    }
  }
  
  const filtered = Array.from(relevantLines).join('\n').substring(0, maxChars);
  
  if (filtered.length < 100 && text.length > 100) {
    console.log('⚠️ [FILTRO] Muito agressivo, usando texto original');
    return text.substring(0, maxChars);
  }
  
  return filtered;
}

// Extração local de texto via regex (fallback)
function extractTextFromPdfBuffer(buffer: Uint8Array): string {
  try {
    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(buffer);
    const textMatches: string[] = [];
    
    const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
    let match;
    
    while ((match = btEtRegex.exec(pdfString)) !== null) {
      const textBlock = match[1];
      const stringRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = stringRegex.exec(textBlock)) !== null) {
        if (strMatch[1].trim()) textMatches.push(strMatch[1]);
      }
    }
    
    return textMatches.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

// 🔴 NOMENCLATURA ELITE v4.1: [Primeiro Nome] - [Ramo] ([Objeto]) - [Placa] - [Cia] - [Tipo]
function generateSmartTitle(policy: any): string {
  // Primeiro nome do cliente (limpa "NÃO IDENTIFICADO")
  const clientName = policy.nome_cliente || 'Cliente';
  const firstName = clientName.split(' ')[0].replace(/NÃO|IDENTIFICADO/gi, '').trim() || 'Cliente';
  
  // Ramo do seguro
  const ramo = policy.ramo_seguro || 'Seguro';
  
  // 🔴 LIMPAR objeto_segurado (remover código numérico no início - formato HDI)
  let objeto = '';
  if (policy.objeto_segurado) {
    // Remove "0002866 - " ou "0002866 ‑ " ou similar do início (código HDI)
    const cleanObj = policy.objeto_segurado
      .replace(/^\d+\s*[\-‑–—]\s*/, '') // Remove código numérico inicial
      .replace(/^VW\s*/i, 'VW ') // Normaliza VW
      .trim();
    objeto = cleanObj.split(' ').slice(0, 3).join(' ').substring(0, 25);
  }
  
  // 🔴 LIMPAR identificacao_adicional (remover UF - formato HDI "CNS0059 - SP")
  let identificacao = '';
  if (policy.identificacao_adicional) {
    // Extrai apenas a placa (7 caracteres antes do " - UF" ou padrão de placa)
    const placaMatch = policy.identificacao_adicional.match(/([A-Z]{3}[0-9][A-Z0-9][0-9]{2})/i);
    if (placaMatch) {
      identificacao = placaMatch[1].toUpperCase();
    } else {
      // Fallback: pega a parte antes do traço (que pode ser a UF)
      identificacao = policy.identificacao_adicional.split(/[\-‑–—]/)[0].trim();
    }
  }
  
  // Sigla da seguradora (primeira palavra, uppercase)
  const seguradora = (policy.nome_seguradora || 'CIA').split(' ')[0].toUpperCase();
  
  // Tipo de documento no formato esperado
  const tipo = policy.tipo_documento === 'ENDOSSO' 
    ? 'ENDOSSO' 
    : policy.tipo_operacao === 'RENOVACAO'
      ? 'RENOVACAO'
      : policy.tipo_documento === 'ORCAMENTO' 
        ? 'ORCAMENTO' 
        : 'NOVA';
  
  // Montar título: Luis - Auto (Golf GTI) - ABC1234 - HDI - NOVA
  let titulo = `${firstName} - ${ramo}`;
  if (objeto) titulo += ` (${objeto})`;
  if (identificacao) titulo += ` - ${identificacao}`;
  titulo += ` - ${seguradora} - ${tipo}`;
  
  return titulo.substring(0, 100);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const totalStartTime = performance.now();
  console.log("🚀 [BULK-OCR v4.0 - ELITE TRIMMER] Iniciando com corte de páginas...");

  try {
    const { files } = await req.json();
    
    if (!files || files.length === 0) {
      throw new Error("Nenhum arquivo recebido.");
    }

    console.log(`📁 [BULK-OCR] Recebidos ${files.length} arquivos`);

    const allTexts: { fileName: string; text: string; source: 'LOCAL' | 'OCR' | 'TRIMMED' }[] = [];
    const ocrErrors: string[] = [];

    for (const [index, file] of files.entries()) {
      const fileStart = performance.now();
      let extractedText = "";
      let textSource: 'LOCAL' | 'OCR' | 'TRIMMED' = 'LOCAL';

      try {
        // Limpeza do base64
        const base64Clean = file.base64.includes(',') 
          ? file.base64.split(',')[1] 
          : file.base64;
        
        const binaryString = atob(base64Clean);
        const binaryData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          binaryData[i] = binaryString.charCodeAt(i);
        }

        const fileSizeKB = Math.round(binaryData.length / 1024);
        console.log(`📄 [${index + 1}/${files.length}] ${file.fileName}: ${fileSizeKB}KB`);

        // ========== v4.0 - CORTE DE PÁGINAS COM PDF-LIB ==========
        let miniPdfBytes: Uint8Array;
        let totalPages = 1;
        let pagesToCopy: number[] = [0];
        
        try {
          const pdfDoc = await PDFDocument.load(binaryData, { ignoreEncryption: true });
          totalPages = pdfDoc.getPageCount();
          
          // Pegar só páginas 1-2 (índice 0-1) onde estão os dados importantes
          const subDoc = await PDFDocument.create();
          pagesToCopy = totalPages >= 2 ? [0, 1] : [0];
          const copiedPages = await subDoc.copyPages(pdfDoc, pagesToCopy);
          copiedPages.forEach(p => subDoc.addPage(p));
          
          miniPdfBytes = await subDoc.save();
          textSource = 'TRIMMED';
          console.log(`✂️ [TRIMMED] ${file.fileName}: ${totalPages} páginas → ${pagesToCopy.length} processadas`);
        } catch (trimError) {
          console.warn(`⚠️ [TRIM] Falha ao cortar PDF, usando original:`, trimError);
          miniPdfBytes = binaryData;
        }

        // ========== EXTRAÇÃO DE TEXTO DO MINI PDF ==========
        // Primeiro tenta extração local rápida
        const localText = extractTextFromPdfBuffer(miniPdfBytes);
        const quality = evaluateTextQuality(localText);
        
        console.log(`🔍 [QUALIDADE] ${file.fileName}: score=${quality.score.toFixed(1)}, keywords=${quality.keywordHits}`);
        
        // Se qualidade boa, usa texto local
        if (localText.length > 100 && quality.keywordHits >= 3 && quality.score > 30) {
          extractedText = localText;
          console.log(`✅ [${textSource}] Texto ACEITO! ${extractedText.length} chars em ${Math.round(performance.now() - fileStart)}ms`);
        } else {
          // Fallback: OCR.space no mini PDF
          if (miniPdfBytes.length > 1024 * 1024) {
            console.log(`⚠️ [OCR] Arquivo grande demais, usando texto local disponível`);
            if (localText.length > 50) extractedText = localText;
          } else {
            console.log(`🔍 [OCR] Chamando OCR.space para ${file.fileName}...`);
            
            // Converte miniPdfBytes para base64
            const miniBase64 = btoa(String.fromCharCode.apply(null, miniPdfBytes as unknown as number[]));
            
            const formData = new FormData();
            formData.append('apikey', OCR_SPACE_KEY);
            formData.append('language', 'por');
            formData.append('OCREngine', '2');
            formData.append('isTable', 'true');
            formData.append('filetype', 'PDF');
            formData.append('base64Image', `data:application/pdf;base64,${miniBase64}`);

            const ocrRes = await fetch('https://api.ocr.space/parse/image', {
              method: 'POST',
              body: formData,
            });

            const ocrData = await ocrRes.json();
            
            if (!ocrData.IsErroredOnProcessing && ocrData.ParsedResults?.[0]?.ParsedText) {
              extractedText = ocrData.ParsedResults[0].ParsedText;
              textSource = 'OCR';
              console.log(`✅ [OCR] Sucesso! ${extractedText.length} chars em ${Math.round(performance.now() - fileStart)}ms`);
            } else {
              console.error(`❌ [OCR] Falha:`, ocrData.ErrorMessage?.[0] || 'Erro');
              ocrErrors.push(`${file.fileName}: ${ocrData.ErrorMessage?.[0] || 'Falha OCR'}`);
              if (localText.length > 50) extractedText = localText;
            }
          }
        }

        // Adiciona texto filtrado
        if (extractedText && extractedText.trim().length > 10) {
          const filteredText = filterEssentialText(extractedText);
          console.log(`🔎 [FILTRO] ${file.fileName}: ${extractedText.length} → ${filteredText.length} chars`);
          console.log(`📝 [PREVIEW] ${file.fileName}:\n${filteredText.substring(0, 500)}...`);
          allTexts.push({ fileName: file.fileName, text: filteredText, source: textSource });
        }

      } catch (err: any) {
        console.error(`💥 Erro crítico em ${file.fileName}:`, err.message);
        ocrErrors.push(`${file.fileName}: ${err.message}`);
      }
    }

    console.log(`📊 [EXTRAÇÃO] ${allTexts.length}/${files.length} arquivos processados`);

    if (allTexts.length === 0) {
      throw new Error(`Nenhum texto extraído. Erros: ${ocrErrors.join('; ')}`);
    }

    // ========== CHAMADA IA (LOVABLE AI GATEWAY) ==========
    console.log(`🧠 [IA] Analisando ${allTexts.length} documentos...`);
    const aiStartTime = performance.now();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const aggregatedText = allTexts
      .map(t => `\n\n=== DOCUMENTO: ${t.fileName} ===\n${t.text}\n`)
      .join('');

    const systemPrompt = `Você é um ANALISTA SÊNIOR de seguros brasileiro.
Analise os documentos e extraia os dados com MÁXIMA PRECISÃO.

## REGRAS CRÍTICAS
1. Para cada documento separado por "=== DOCUMENTO: ... ===" extraia os dados
2. Retorne SEMPRE um array JSON
3. CPF: formato XXX.XXX.XXX-XX | CNPJ: formato XX.XXX.XXX/XXXX-XX
4. Datas: formato YYYY-MM-DD
5. VALORES: número puro SEM "R$", use PONTO como decimal (ex: 1234.56)
6. Se não encontrar um campo, use null (NÃO use 0!)
7. arquivo_origem = nome EXATO do arquivo fonte

## EXTRAÇÃO DO PRÊMIO LÍQUIDO (CRÍTICO!)
- Procure "Prêmio Líquido", "Premio Comercial", "Valor Base"
- NÃO confunda com "Prêmio Total" (inclui IOF!)
- Se só achar Total: premio_liquido = total / 1.0738
- Se achar parcela (ex: "4x R$ 500"): premio_liquido = parcela × qtd × 0.93

## EXTRAÇÃO DE VEÍCULOS E IMÓVEIS (AGRESSIVO!) - FORMATO HDI ESPECIAL
Para ramo AUTO/AUTOMÓVEL/VEÍCULO:
- SEMPRE procure seção "Dados do Veículo", "Veículo Segurado", "Objeto Segurado" (geralmente página 2!)
- PLACA: formato ABC-1234 ou ABC1D23 (Mercosul) - OBRIGATÓRIO extrair!
  - HDI formato: "PLACA/UF: CNS0059 - SP" → extrair APENAS "CNS0059"
- MARCA/MODELO: Ex: "VOLKSWAGEN GOLF GTI 2.0 TSI"
  - HDI formato: "0002866 ‑ Volkswagen Polo Highline" → REMOVER código, usar "Volkswagen Polo Highline"
- ANO: Geralmente ao lado do modelo
- CHASSI: 17 caracteres alfanuméricos
- objeto_segurado = MARCA + MODELO (SEM código numérico!) ex: "Volkswagen Polo Highline"
- identificacao_adicional = APENAS A PLACA (7 chars, ex: "CNS0059", SEM a UF!)

Para ramo RESIDENCIAL/EMPRESARIAL/CONDOMÍNIO:
- Procure endereço do IMÓVEL segurado (pode diferir do cliente!)
- objeto_segurado = "Imóvel Residencial" ou endereço curto
- identificacao_adicional = CEP do imóvel (ex: "01310-100")

Para ramo VIDA/SAÚDE:
- objeto_segurado = Nome do plano ou "Vida Individual"
- identificacao_adicional = null

## TIPO DE DOCUMENTO
- APOLICE: Documento emitido oficial
- PROPOSTA: Antes da emissão
- ORCAMENTO: Apenas cotação
- ENDOSSO: Alteração em apólice existente`;

    const toolSchema = {
      type: "function",
      function: {
        name: "extract_policies",
        description: "Extrai dados estruturados de documentos de seguro",
        parameters: {
          type: "object",
          properties: {
            policies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  arquivo_origem: { type: "string" },
                  tipo_documento: { type: "string", enum: ["APOLICE", "PROPOSTA", "ORCAMENTO", "ENDOSSO"] },
                  nome_cliente: { type: "string" },
                  cpf_cnpj: { type: ["string", "null"] },
                  email: { type: ["string", "null"] },
                  telefone: { type: ["string", "null"] },
                  endereco_completo: { type: ["string", "null"] },
                  numero_apolice: { type: ["string", "null"] },
                  numero_proposta: { type: ["string", "null"] },
                  nome_seguradora: { type: "string" },
                  ramo_seguro: { type: "string" },
                  objeto_segurado: { type: ["string", "null"] },
                  identificacao_adicional: { type: ["string", "null"] },
                  data_inicio: { type: ["string", "null"] },
                  data_fim: { type: ["string", "null"] },
                  premio_liquido: { type: ["number", "null"] },
                  premio_total: { type: ["number", "null"] },
                  iof: { type: ["number", "null"] },
                  parcelas: { type: ["number", "null"] },
                },
                required: ["arquivo_origem", "tipo_documento", "nome_cliente", "nome_seguradora", "ramo_seguro"]
              }
            }
          },
          required: ["policies"]
        }
      }
    };

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analise os seguintes documentos:\n${aggregatedText}` }
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "extract_policies" } }
      })
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('❌ [IA] Erro:', aiRes.status, errText);
      throw new Error(`Erro na IA: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const aiDuration = ((performance.now() - aiStartTime) / 1000).toFixed(2);
    console.log(`🧠 [IA] Resposta recebida em ${aiDuration}s`);

    // Extrair resultado do tool call
    let extractedPolicies: any[] = [];
    
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        extractedPolicies = parsed.policies || [];
      } catch (e) {
        console.error('❌ Erro ao parsear resposta da IA:', e);
      }
    }

    // Fallback: tentar extrair do content se não veio como tool call
    if (extractedPolicies.length === 0 && aiData.choices?.[0]?.message?.content) {
      try {
        const content = aiData.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          extractedPolicies = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('❌ Fallback parse também falhou:', e);
      }
    }

    console.log(`📊 [IA] ${extractedPolicies.length} apólices extraídas`);

    // Pós-processamento: gerar títulos e validar campos
    const processedPolicies = extractedPolicies.map((policy: any) => ({
      ...policy,
      titulo_sugerido: generateSmartTitle(policy),
      premio_liquido: typeof policy.premio_liquido === 'number' ? policy.premio_liquido : null,
      // Normalizar nome do cliente
      nome_cliente: policy.nome_cliente?.trim() || 'Não Identificado',
    }));

    const totalDuration = ((performance.now() - totalStartTime) / 1000).toFixed(2);
    console.log(`✅ [BULK-OCR v4.0] Concluído em ${totalDuration}s`);

    return new Response(JSON.stringify({
      success: true,
      data: processedPolicies,
      processed_files: allTexts.map(t => t.fileName),
      errors: ocrErrors,
      stats: {
        total_files: files.length,
        processed: allTexts.length,
        trimmed: allTexts.filter(t => t.source === 'TRIMMED').length,
        ocr: allTexts.filter(t => t.source === 'OCR').length,
        local: allTexts.filter(t => t.source === 'LOCAL').length,
        extraction_time: `${((performance.now() - totalStartTime - (performance.now() - aiStartTime)) / 1000).toFixed(2)}s`,
        ai_time: `${aiDuration}s`,
        total_time: `${totalDuration}s`
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('💥 [BULK-OCR] Erro fatal:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      data: [],
      processed_files: [],
      errors: [error.message]
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
