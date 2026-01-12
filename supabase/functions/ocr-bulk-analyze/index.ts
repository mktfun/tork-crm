import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OCR_SPACE_KEY = 'K82045193188957';

// Keywords EXPANDIDAS para não perder NADA relevante - v3.2 "SNIPER PLUS"
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

// ======== v3.2 - HEURÍSTICA DE QUALIDADE DO TEXTO ========
function evaluateTextQuality(text: string): { score: number; keywordHits: number; digitRatio: number; printableRatio: number } {
  const upperText = text.toUpperCase();
  
  // 1. Contar keywords encontradas
  const keywordHits = KEYWORDS.filter(kw => upperText.includes(kw)).length;
  
  // 2. Proporção de dígitos e valores monetários
  const digitMatches = text.match(/\d/g) || [];
  const monetaryMatches = text.match(/R\$\s*[\d.,]+|\d{1,3}[.]\d{3}[,]\d{2}/g) || [];
  const digitRatio = (digitMatches.length + monetaryMatches.length * 10) / Math.max(text.length, 1);
  
  // 3. Proporção de caracteres imprimíveis legíveis
  const printableChars = text.match(/[A-Za-zÀ-ÿ0-9\s.,\-:;/()@]/g) || [];
  const printableRatio = printableChars.length / Math.max(text.length, 1);
  
  // Score composto: keywords têm peso maior
  const score = (keywordHits * 5) + (digitRatio * 100) + (printableRatio * 20);
  
  return { score, keywordHits, digitRatio, printableRatio };
}

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

// ======== v3.2 - GERADOR DE TÍTULO INTELIGENTE NO BACKEND ========
function generateSmartTitle(policy: any): string {
  // Extrair primeiro nome do cliente
  const clientName = policy.nome_cliente || 'Cliente';
  const firstName = clientName.split(' ')[0].replace(/NÃO|IDENTIFICADO|TEXTO|SEGURO/gi, '').trim() || 'Cliente';
  
  // Ramo
  const ramo = policy.ramo_seguro || 'Seguro';
  
  // Objeto resumido
  let objeto = '';
  if (policy.objeto_segurado) {
    // Para auto: pegar marca/modelo
    const objParts = policy.objeto_segurado.split(' ').slice(0, 2);
    objeto = objParts.join(' ').substring(0, 20);
  } else if (policy.descricao_bem) {
    objeto = policy.descricao_bem.substring(0, 20);
  }
  
  // Identificação (placa, CEP, etc)
  const identificacao = policy.identificacao_adicional || '';
  
  // Seguradora
  const seguradora = policy.nome_seguradora || 'Seguradora';
  
  // Tipo de documento (só adiciona se não for apólice normal)
  const tipo = policy.tipo_documento && policy.tipo_documento !== 'APOLICE' ? ` - ${policy.tipo_documento}` : '';
  
  // Montar título
  let titulo = `${firstName} - ${ramo}`;
  if (objeto) titulo += ` (${objeto})`;
  if (identificacao) titulo += ` - ${identificacao}`;
  titulo += ` - ${seguradora}`;
  titulo += tipo;
  
  return titulo.substring(0, 100); // Limitar tamanho
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const totalStartTime = performance.now();
  console.log("🚀 [BULK-OCR v3.2] Iniciando processamento com heurística de qualidade...");

  try {
    const { files } = await req.json();
    
    if (!files || files.length === 0) {
      throw new Error("Nenhum arquivo recebido.");
    }

    console.log(`📁 [BULK-OCR] Recebidos ${files.length} arquivos`);

    const allTexts: { fileName: string; text: string; source: 'LOCAL' | 'OCR' }[] = [];
    const ocrErrors: string[] = [];

    for (const [index, file] of files.entries()) {
      const fileStart = performance.now();
      let extractedText = "";
      let textSource: 'LOCAL' | 'OCR' = 'LOCAL';

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
        const localText = extractTextFromPdfBuffer(binaryData);
        
        // ======== v3.2 - AVALIAR QUALIDADE DO TEXTO LOCAL ========
        const quality = evaluateTextQuality(localText);
        console.log(`🔍 [QUALIDADE] ${file.fileName}: score=${quality.score.toFixed(1)}, keywords=${quality.keywordHits}, digits=${(quality.digitRatio * 100).toFixed(1)}%, printable=${(quality.printableRatio * 100).toFixed(1)}%`);
        
        // REGRA: aceitar LOCAL apenas se tiver boa qualidade
        // Mínimo: 3 keywords encontradas E score > 30 E printable > 60%
        const isLocalGoodEnough = quality.keywordHits >= 3 && quality.score > 30 && quality.printableRatio > 0.6;
        
        if (localText.length > 100 && isLocalGoodEnough) {
          extractedText = localText;
          textSource = 'LOCAL';
          console.log(`✅ [LOCAL] Texto ACEITO! ${file.fileName}: ${extractedText.length} chars, score=${quality.score.toFixed(1)} em ${Math.round(performance.now() - fileStart)}ms`);
        } else {
          // Texto local é lixo ou insuficiente - forçar OCR
          const reason = localText.length <= 100 
            ? `texto curto (${localText.length} chars)` 
            : `baixa qualidade (score=${quality.score.toFixed(1)}, keywords=${quality.keywordHits})`;
          console.log(`⚠️ [LOCAL] REJEITADO: ${reason}, forçando OCR...`);
          
          // --- TENTATIVA 2: OCR.SPACE ---
          if (binaryData.length > 1024 * 1024) {
            console.error(`❌ [OCR] ${file.fileName} é muito grande (${fileSizeKB}KB > 1024KB) para OCR gratuito`);
            ocrErrors.push(`${file.fileName}: arquivo muito grande para OCR (${fileSizeKB}KB)`);
            // Usar texto local mesmo ruim como fallback
            if (localText.length > 50) {
              extractedText = localText;
              textSource = 'LOCAL';
              console.log(`⚠️ [FALLBACK] Usando texto local ruim como último recurso`);
            }
          } else {
            console.log(`🔍 [OCR] Chamando OCR.space para ${file.fileName}...`);
            
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
              textSource = 'OCR';
              
              // Avaliar qualidade do OCR também
              const ocrQuality = evaluateTextQuality(extractedText);
              console.log(`✅ [OCR] Sucesso! ${file.fileName}: ${extractedText.length} chars, score=${ocrQuality.score.toFixed(1)}, keywords=${ocrQuality.keywordHits} em ${Math.round(performance.now() - fileStart)}ms`);
            } else {
              console.error(`❌ [OCR] Falha em ${file.fileName}:`, ocrData.ErrorMessage?.[0] || 'Erro desconhecido');
              ocrErrors.push(`${file.fileName}: ${ocrData.ErrorMessage?.[0] || 'Falha no OCR'}`);
              
              // Usar texto local como último recurso
              if (localText.length > 50) {
                extractedText = localText;
                textSource = 'LOCAL';
                console.log(`⚠️ [FALLBACK] OCR falhou, usando texto local como último recurso`);
              }
            }
          }
        }

        // Adiciona texto filtrado se suficiente
        if (extractedText && extractedText.trim().length > 10) {
          // Filtra apenas linhas essenciais para economizar tokens da IA
          const filteredText = filterEssentialText(extractedText);
          console.log(`🔎 [FILTRO] ${file.fileName}: ${extractedText.length} → ${filteredText.length} chars (${Math.round(100 * filteredText.length / extractedText.length)}%)`);
          
          // Log preview do texto para debug
          console.log(`📝 [PREVIEW] ${file.fileName} (primeiros 500 chars):\n${filteredText.substring(0, 500)}...`);
          
          allTexts.push({ fileName: file.fileName, text: filteredText, source: textSource });
        }

      } catch (err: any) {
        console.error(`💥 Erro crítico no arquivo ${file.fileName}:`, err.message);
        ocrErrors.push(`${file.fileName}: ${err.message}`);
      }
    }

    const ocrDuration = ((performance.now() - totalStartTime) / 1000).toFixed(2);
    console.log(`📊 [EXTRAÇÃO] Fase concluída em ${ocrDuration}s - ${allTexts.length}/${files.length} arquivos (LOCAL: ${allTexts.filter(t => t.source === 'LOCAL').length}, OCR: ${allTexts.filter(t => t.source === 'OCR').length})`);

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
6. Se não encontrar um campo, use null (NÃO use 0 para valores não encontrados!)
7. arquivo_origem deve conter EXATAMENTE o nome do arquivo fonte

## EXTRAÇÃO DE CLIENTE (COMPLETA!)
- nome_completo: Nome do SEGURADO/ESTIPULANTE/TITULAR (nome completo)
- cpf_cnpj: CPF ou CNPJ (com ou sem formatação)
- email: E-mail de contato (procure em todo o documento)
- telefone: Telefone/Celular (procure em todo o documento)
- endereco_completo: Endereço COMPLETO incluindo CEP, cidade e estado
- cep: CEP do endereço (formato XXXXX-XXX ou XXXXXXXX)

## EXTRAÇÃO DO OBJETO SEGURADO (CRÍTICO!)
- AUTO: "Marca Modelo Versão Ano" (Ex: "VW Golf GTI 2024")
- RESIDENCIAL: "Tipo - Cidade/Bairro" (Ex: "Apartamento - São Paulo/Pinheiros")
- VIDA: "Tipo de Plano" (Ex: "Vida Individual", "AP Coletivo")
- EMPRESARIAL: "Tipo - Atividade" (Ex: "Comércio - Padaria")

## IDENTIFICAÇÃO ADICIONAL
- AUTO: PLACA do veículo (formato ABC1D23 ou ABC-1234) - CAMPO OBRIGATÓRIO PARA AUTO!
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
- SE NÃO ENCONTRAR O VALOR, RETORNE null, NÃO RETORNE 0!

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
                  cep: { type: 'string', nullable: true, description: 'CEP do endereço' },
                  
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
                  identificacao_adicional: { type: 'string', nullable: true, description: 'PLACA do veículo, CEP ou outro identificador' },
                  placa: { type: 'string', nullable: true, description: 'Placa do veículo (formato ABC1D23 ou ABC-1234)' },
                  modelo_veiculo: { type: 'string', nullable: true, description: 'Marca e modelo do veículo' },
                  
                  // Valores (NUMBERS puros! null se não encontrar)
                  premio_liquido: { type: 'number', nullable: true, description: 'Valor ANTES do IOF, sem R$. null se não encontrar!' },
                  premio_total: { type: 'number', nullable: true, description: 'Valor TOTAL com IOF, sem R$. null se não encontrar!' },
                  
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

IMPORTANTE: 
- Para valores monetários (premio_liquido, premio_total), retorne NUMBER ou null. NUNCA retorne 0 se não encontrar!
- Para placa de veículo, procure padrões ABC1D23 ou ABC-1234
- O arquivo_origem deve ser EXATAMENTE igual ao nome após "=== DOCUMENTO: ... ==="

Retorne um array JSON com os campos especificados.`
          }
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'extract_policies' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ [IA] Erro na resposta:', aiResponse.status, errorText);
      throw new Error(`Erro na IA: ${aiResponse.status} - ${errorText.substring(0, 200)}`);
    }

    const aiData = await aiResponse.json();
    const aiDuration = ((performance.now() - aiStartTime) / 1000).toFixed(2);
    console.log(`⏱️ [IA] Resposta recebida em ${aiDuration}s`);

    // Extrair dados do function call
    let extractedPolicies: any[] = [];
    
    if (aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      try {
        const args = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);
        extractedPolicies = args.policies || [];
        
        // ======== v3.2 - PÓS-PROCESSAMENTO: GERAR TÍTULOS INTELIGENTES NO BACKEND ========
        extractedPolicies = extractedPolicies.map(policy => {
          // Recalcular título para garantir consistência
          const smartTitle = generateSmartTitle(policy);
          
          // Se a IA retornou placa, usar como identificacao_adicional
          if (policy.placa && !policy.identificacao_adicional) {
            policy.identificacao_adicional = policy.placa;
          }
          
          return {
            ...policy,
            titulo_sugerido: smartTitle
          };
        });
        
        console.log(`✅ [IA] Extraídas ${extractedPolicies.length} apólices com títulos recalculados`);
      } catch (parseError) {
        console.error('❌ [IA] Erro ao parsear resposta:', parseError);
        throw new Error('Falha ao processar resposta da IA');
      }
    } else {
      console.error('❌ [IA] Formato de resposta inesperado:', JSON.stringify(aiData).substring(0, 500));
      throw new Error('Resposta da IA em formato inesperado');
    }

    const totalDuration = ((performance.now() - totalStartTime) / 1000).toFixed(2);
    console.log(`🏁 [BULK-OCR v3.2] Concluído em ${totalDuration}s - ${extractedPolicies.length} apólices extraídas`);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedPolicies,
        processed_files: allTexts.map(t => `${t.fileName} (${t.source})`),
        errors: ocrErrors.length > 0 ? ocrErrors : undefined,
        metrics: {
          ocr_duration_seconds: parseFloat(ocrDuration),
          ai_duration_seconds: parseFloat(aiDuration),
          total_duration_seconds: parseFloat(totalDuration)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 [BULK-OCR] Erro fatal:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro desconhecido',
        data: []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
