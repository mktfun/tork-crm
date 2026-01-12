import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OCR_SPACE_KEY = 'K82045193188957';

// Keywords EXPANDIDAS para não perder NADA relevante - v3.1 "SNIPER"
const KEYWORDS = [
  // Dados pessoais
  'NOME', 'CPF', 'CNPJ', 'SEGURADO', 'TITULAR', 'ESTIPULANTE', 'PROPONENTE',
  'EMAIL', 'TELEFONE', 'CELULAR', 'CONTATO', 'ENDERECO', 'CEP', 'BAIRRO', 'CIDADE', 'UF',
  
  // Tipos de documento
  'APOLICE', 'PROPOSTA', 'ORCAMENTO', 'COTACAO', 'ENDOSSO', 
  'RENOVACAO', 'PROVISORIO', 'CERTIFICADO', 'BILHETE',
  
  // Vigência/Datas
  'VIGENCIA', 'INICIO', 'TERMINO', 'FIM', 'VALIDADE', 'EMISSAO',
  
  // Valores financeiros - SNIPER MODE
  'PREMIO', 'LIQUIDO', 'TOTAL', 'IOF', 'VALOR', 'PARCELA', 'COMISSAO',
  'CUSTO', 'ADICIONAL', 'DESCONTO', 'DEMONSTRATIVO', 'FINANCEIRO', 'MENSAL',
  'PAGAMENTO', 'FORMA', 'CUSTO_APOLICE', 'CUSTO APOLICE',
  'PRÊMIO LÍQUIDO', 'PREMIO LIQUIDO', 'PRÊMIO COMERCIAL', 'VALOR BASE',
  'PREMIO LIQ', 'PRÊMIO LÍQ', 'LÍQUIDO', 'LIQ',
  
  // Identificação do produto
  'RAMO', 'CIA', 'SEGURADORA', 'COBERTURA', 'FRANQUIA', 'IS', 'LMI',
  
  // Auto
  'PLACA', 'MARCA', 'MODELO', 'VEICULO', 'CHASSI', 'ANO', 
  'FABRICACAO', 'RENAVAM', 'FIPE', 'ZERO KM', 'COMBUSTIVEL',
  
  // Residencial/RE
  'CASA', 'APARTAMENTO', 'CONDOMINIO', 'LOGRADOURO', 
  'RESIDENCIAL', 'IMOVEL', 'COMERCIAL', 'INCENDIO', 'ALUGUEL',
  
  // Vida/Pessoas
  'VIDA', 'PESSOA', 'BENEFICIARIO', 'CAPITAL', 'SEGURADA', 'MORTE', 'INVALIDEZ',
  
  // Empresarial
  'EMPRESA', 'RAZAO SOCIAL', 'RC', 'RESPONSABILIDADE'
];

// Função para filtrar linhas essenciais com FALLBACK inteligente
function filterEssentialText(text: string, maxChars: number = 15000): string {
  const lines = text.split('\n');
  const relevantLines: Set<string> = new Set();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();
    
    // Verifica se a linha contém alguma keyword importante
    const hasKeyword = KEYWORDS.some(kw => upperLine.includes(kw));
    // Ou se contém padrões importantes (CPF, CNPJ, datas, valores)
    const hasPattern = /\d{3}[.\-]\d{3}[.\-]\d{3}[.\-]\d{2}|\d{2}[.\-]\d{3}[.\-]\d{3}[\/]\d{4}[.\-]\d{2}|\d{2}\/\d{2}\/\d{4}|R\$\s*[\d.,]+|\d{1,3}[.]\d{3}[,]\d{2}/.test(line);
    // Ou se parece com placa de veículo (Mercosul ou antiga)
    const hasPlaca = /[A-Z]{3}[\-\s]?\d[A-Z0-9]\d{2}|[A-Z]{3}\d{4}/i.test(line);
    
    if (hasKeyword || hasPattern || hasPlaca) {
      // Adiciona linha anterior para contexto (se houver)
      if (i > 0 && lines[i - 1].trim()) {
        relevantLines.add(lines[i - 1]);
      }
      // Adiciona a linha atual
      relevantLines.add(line);
      // Adiciona linha posterior para contexto (se houver)
      if (i < lines.length - 1 && lines[i + 1].trim()) {
        relevantLines.add(lines[i + 1]);
      }
    }
  }
  
  const filtered = Array.from(relevantLines).join('\n').substring(0, maxChars);
  
  // FALLBACK: se filtrou demais (< 100 chars), usa texto original truncado
  if (filtered.length < 100 && text.length > 100) {
    console.log('⚠️ [FILTRO] Muito agressivo, usando texto original truncado');
    return text.substring(0, maxChars);
  }
  
  return filtered;
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

    const systemPrompt = `Você é um ANALISTA SÊNIOR de seguros brasileiro ESPECIALISTA em HDI, Porto Seguro, Azul e Allianz.
Analise o texto extraído de documentos de seguro com MÁXIMA PRECISÃO.

## IDENTIFICAÇÃO DO TIPO DE DOCUMENTO
- APOLICE: Documento oficial EMITIDO após pagamento
- PROPOSTA: Documento ANTES da emissão (aguardando aprovação/pagamento)
- ORCAMENTO/COTACAO: Apenas estimativa de preço, sem compromisso
- ENDOSSO: ALTERAÇÃO em apólice já existente

## REGRAS CRÍTICAS
1. Para cada documento separado por "=== DOCUMENTO: ... ===" extraia os dados
2. Retorne SEMPRE um array JSON, mesmo para um único documento
3. CPF: formato XXX.XXX.XXX-XX | CNPJ: formato XX.XXX.XXX/XXXX-XX
4. Datas: formato YYYY-MM-DD
5. VALORES NUMÉRICOS: SEM "R$", SEM pontos de milhar. Use PONTO como decimal (ex: 1234.56)
6. Se não encontrar um campo, use null
7. arquivo_origem deve conter EXATAMENTE o nome do arquivo fonte

## EXTRAÇÃO DE CLIENTE (COMPLETA!)
- nome_completo: Nome do SEGURADO/ESTIPULANTE/TITULAR (nome completo)
- cpf_cnpj: CPF ou CNPJ (com ou sem formatação)
- email: E-mail de contato (procure em todo o documento)
- telefone: Telefone/Celular (procure em todo o documento)
- endereco_completo: Endereço COMPLETO incluindo CEP, cidade e estado

## EXTRAÇÃO DO OBJETO SEGURADO (CRÍTICO!)
- AUTO: "Marca Modelo Versão Ano" (Ex: "VW Golf GTI 2024")
- RESIDENCIAL: "Tipo - Cidade/Bairro" (Ex: "Apartamento - São Paulo/Pinheiros")
- VIDA: "Tipo de Plano" (Ex: "Vida Individual", "AP Coletivo")
- EMPRESARIAL: "Tipo - Atividade" (Ex: "Comércio - Padaria")

## IDENTIFICAÇÃO ADICIONAL
- AUTO: PLACA do veículo (formato ABC1D23 ou ABC-1234)
- RESIDENCIAL: Número + Complemento ou CEP
- VIDA/OUTROS: null

## 🎯 EXTRAÇÃO DO PRÊMIO LÍQUIDO - MÉTODO POR EXCLUSÃO (CRÍTICO!)

### PASSO 1: PROCURE PELO PRÊMIO LÍQUIDO EXPLÍCITO
Procure por: "Prêmio Líquido", "Premio Comercial", "Valor Base", "Prêmio Líq", "Premio Liq"
NÃO confunda com "Prêmio Total" ou "Total a Pagar" (isso inclui IOF!)

### PASSO 2: SE NÃO ENCONTRAR, CALCULE POR EXCLUSÃO
Se encontrar "Prêmio Total" (ou "Total a Pagar") e "IOF" separados:
→ premio_liquido = premio_total - IOF

Se encontrar apenas o Prêmio Total SEM o IOF separado:
→ premio_liquido = premio_total / 1.0738 (IOF padrão é 7.38%)

### PASSO 3: ALERTA DE PARCELA!
Se você encontrar "4x de R$ 500" ou "Parcela: R$ 500", isso é PARCELA, NÃO é líquido!
→ Para calcular líquido aproximado: parcela × número_parcelas × 0.93
→ Exemplo: 4 × 500 × 0.93 = 1860 (prêmio líquido aproximado)

### PECULIARIDADES POR SEGURADORA
- HDI: O "Demonstrativo de Prêmio" contém o líquido em linha própria. Atenção: não confundir com parcela!
- PORTO SEGURO: "Resumo do Seguro" mostra valores. "Valor da Parcela" ≠ "Prêmio Líquido"!
- AZUL: "Quadro Resumo" mostra prêmio líquido e IOF separados. Use o LÍQUIDO!
- ALLIANZ: "Síntese" ou "Resumo Financeiro". Procure "Prêmio Comercial" ou calcule.

### RETORNO OBRIGATÓRIO
- Retorne NUMBER puro! Exemplo: 1234.56 (NÃO "R$ 1.234,56")
- Se o valor vier como "1.234,56", converta para 1234.56
- NUNCA retorne o valor da parcela como prêmio líquido!

## TÍTULO SUGERIDO (formato EXATO)
"[PRIMEIRO_NOME] - [RAMO] ([OBJETO]) - [IDENTIFICACAO] - [SEGURADORA][ - TIPO]"
Exemplos:
- "João - Auto (Golf GTI) - ABC1D23 - Porto Seguro"
- "Maria - Residencial (Apto) - São Paulo - Bradesco"
- "Carlos - Vida - Mapfre"
- "Luis - Auto (Corolla) - XYZ9A88 - HDI - PROPOSTA"
- "Ana - Auto (Onix) - DEF4G56 - Azul - ENDOSSO"

Inclua o tipo (PROPOSTA, ENDOSSO) no final apenas se NÃO for apólice normal.

## TIPO DE OPERAÇÃO
- NOVA: Primeiro contrato com este cliente/bem
- RENOVACAO: Continuação de apólice anterior (procure por "Renovação", "Apólice Anterior")
- ENDOSSO: Alteração em apólice vigente (procure por "Endosso", "Alteração")

## DETECÇÃO DE ENDOSSO
Se for ENDOSSO, preencha endosso_motivo com o tipo:
- "Substituição de Veículo"
- "Alteração de Endereço"
- "Inclusão de Cobertura"
- "Alteração de Condutor"
- etc.`;

    const tool = {
      type: 'function',
      function: {
        name: 'extract_policies',
        description: 'Extrai dados estruturados de apólices de seguro brasileiras',
        parameters: {
          type: 'object',
          properties: {
            policies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  // Cliente
                  nome_cliente: { type: 'string', description: 'Nome completo do segurado/estipulante' },
                  cpf_cnpj: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  telefone: { type: 'string', nullable: true },
                  endereco_completo: { type: 'string', nullable: true, description: 'Endereço completo incluindo CEP' },
                  
                  // Documento
                  tipo_documento: { type: 'string', enum: ['APOLICE', 'PROPOSTA', 'ORCAMENTO', 'ENDOSSO'], nullable: true },
                  numero_apolice: { type: 'string', description: 'Número da apólice ou proposta' },
                  numero_proposta: { type: 'string', nullable: true, description: 'Número da proposta (se diferente)' },
                  tipo_operacao: { type: 'string', enum: ['RENOVACAO', 'NOVA', 'ENDOSSO'], nullable: true },
                  endosso_motivo: { type: 'string', nullable: true, description: 'Motivo do endosso se aplicável' },
                  
                  // Seguro
                  nome_seguradora: { type: 'string' },
                  ramo_seguro: { type: 'string', description: 'Auto, Residencial, Vida, Empresarial, etc.' },
                  data_inicio: { type: 'string', description: 'YYYY-MM-DD' },
                  data_fim: { type: 'string', description: 'YYYY-MM-DD' },
                  
                  // Objeto segurado
                  descricao_bem: { type: 'string', nullable: true },
                  objeto_segurado: { type: 'string', nullable: true, description: 'Ex: VW Golf GTI 2024' },
                  identificacao_adicional: { type: 'string', nullable: true, description: 'Placa, CEP ou outro identificador' },
                  
                  // Valores (NUMBERS puros!)
                  premio_liquido: { type: 'number', description: 'Valor ANTES do IOF, sem R$' },
                  premio_total: { type: 'number', description: 'Valor TOTAL com IOF, sem R$' },
                  
                  // Metadados
                  titulo_sugerido: { type: 'string', description: 'NOME - RAMO (OBJETO) - ID - CIA' },
                  arquivo_origem: { type: 'string' }
                },
                required: ['nome_cliente', 'numero_apolice', 'nome_seguradora', 'ramo_seguro', 'arquivo_origem', 'titulo_sugerido', 'data_inicio', 'data_fim']
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
