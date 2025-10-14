// ✅ VERSÃO CORRIGIDA: PDF.co (PDF → PNG) + Gemini 2.5 Flash Vision
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fileUrl } = await req.json();
    
    if (!fileUrl) {
      throw new Error('fileUrl é obrigatório');
    }

    console.log('📄 Processando PDF:', fileUrl);

    // 1️⃣ CONVERTER PDF → PNG com PDF.co
    const imageUrls = await convertPdfToImages(fileUrl);
    console.log(`✅ ${imageUrls.length} página(s) convertida(s) para PNG`);

    // 2️⃣ BUSCAR CONTEXTO DO BANCO
    const dbContext = await fetchDatabaseContext();
    console.log(`✅ Contexto: ${dbContext.ramos.length} ramos, ${dbContext.companies.length} seguradoras, ${dbContext.clients.length} clientes`);

    // 3️⃣ EXTRAIR DADOS COM GEMINI VISION
    const extractedData = await extractDataWithGeminiVision(imageUrls, dbContext);
    console.log('✅ Dados extraídos:', extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ============================================
// CONVERTER PDF → PNG com PDF.co
// ============================================
async function convertPdfToImages(pdfUrl: string): Promise<string[]> {
  const PDF_CO_API_KEY = Deno.env.get('PDF_PARSER_API_KEY');
  
  if (!PDF_CO_API_KEY) {
    throw new Error('PDF_PARSER_API_KEY não configurada');
  }

  console.log('🔄 Convertendo PDF para PNG com PDF.co...');

  // Tentar converter todas as páginas primeiro
  let pages = '-1'; // Todas as páginas
  let response = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
    method: 'POST',
    headers: {
      'x-api-key': PDF_CO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: pdfUrl,
      pages: pages,
      async: false,
    }),
  });

  let result = await response.json();

  // Se falhar com todas as páginas, tentar apenas a primeira
  if (!result.urls || result.urls.length === 0) {
    console.log('⚠️ Falha ao processar todas as páginas, tentando apenas a primeira...');
    pages = '0';
    
    response = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
      method: 'POST',
      headers: {
        'x-api-key': PDF_CO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: pdfUrl,
        pages: pages,
        async: false,
      }),
    });

    result = await response.json();
  }

  if (!result.urls || result.urls.length === 0) {
    throw new Error('PDF.co não retornou imagens');
  }

  console.log(`✅ PDF.co retornou ${result.urls.length} imagem(ns)`);
  return result.urls;
}

// ============================================
// BUSCAR CONTEXTO DO BANCO DE DADOS
// ============================================
async function fetchDatabaseContext() {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const [ramosResult, companiesResult, clientsResult] = await Promise.all([
    supabaseAdmin.from('ramos').select('id, nome').limit(1000),
    supabaseAdmin.from('companies').select('id, name').limit(1000),
    supabaseAdmin.from('clientes').select('id, name, cpf_cnpj').limit(1000)
  ]);

  return {
    ramos: ramosResult.data || [],
    companies: companiesResult.data || [],
    clients: clientsResult.data || []
  };
}

// ============================================
// EXTRAIR DADOS COM GEMINI 2.5 FLASH VISION
// ============================================
async function extractDataWithGeminiVision(imageUrls: string[], dbContext: any) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  const prompt = buildVisionPrompt(dbContext);

  console.log(`🤖 Chamando Gemini Vision com ${imageUrls.length} imagem(ns)...`);

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            ...imageUrls.map(url => ({
              type: 'image_url',
              image_url: { url }
            }))
          ]
        }
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
                clientName: {
                  type: 'string',
                  description: 'Nome EXATO do cliente da lista fornecida',
                  nullable: true
                },
                insuredItem: {
                  type: 'string',
                  description: 'Bem segurado com detalhes (modelo + placa se veículo)',
                  nullable: true
                },
                insurerName: {
                  type: 'string',
                  description: 'Nome EXATO da seguradora da lista fornecida',
                  nullable: true
                },
                insuranceLine: {
                  type: 'string',
                  description: 'Nome EXATO do ramo da lista fornecida',
                  nullable: true
                },
                policyNumber: {
                  type: 'string',
                  description: 'Número da apólice/proposta',
                  nullable: true
                },
                premiumValue: {
                  type: 'number',
                  description: 'Valor do prêmio líquido (apenas número)',
                  nullable: true
                },
                commissionPercentage: {
                  type: 'number',
                  description: 'Comissão em porcentagem',
                  nullable: true
                },
                shouldGenerateRenewal: {
                  type: 'boolean',
                  description: 'true para Seguro Novo/Renovação, false para Endosso'
                },
                startDate: {
                  type: 'string',
                  description: 'Data de início de vigência (YYYY-MM-DD)',
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
      throw new Error('Créditos insuficientes no Lovable AI.');
    }
    
    throw new Error(`Erro na API: ${response.status}`);
  }

  const result = await response.json();
  console.log('🤖 Resposta do Gemini Vision:', JSON.stringify(result, null, 2));

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function?.name !== 'extract_quote_fields') {
    throw new Error('Gemini não retornou os dados esperados');
  }

  const extractedData = JSON.parse(toolCall.function.arguments);
  
  // Log dos dados brutos extraídos
  console.log('📊 Dados brutos extraídos pelo Gemini:', {
    premiumValue: extractedData.premiumValue,
    commissionPercentage: extractedData.commissionPercentage,
    clientName: extractedData.clientName,
    insuranceLine: extractedData.insuranceLine,
    policyNumber: extractedData.policyNumber
  });
  
  // Fazer matching inteligente
  const matchedData = await performIntelligentMatching(extractedData, dbContext);
  
  return matchedData;
}

// ============================================
// CONSTRUIR PROMPT PARA GEMINI VISION
// ============================================
function buildVisionPrompt(dbContext: any): string {
  const ramosList = dbContext.ramos.map((r: any) => r.nome).join('", "');
  const companiesList = dbContext.companies.map((c: any) => c.name).join('", "');
  const clientsList = dbContext.clients.slice(0, 50).map((c: any) => 
    `${c.name}${c.cpf_cnpj ? ' (' + c.cpf_cnpj + ')' : ''}`
  ).join('", "');

  return `# PERSONA
Você é um assistente especialista em extrair dados de orçamentos e apólices de seguro.

# CONTEXTO
Você está visualizando um documento de seguro em MÚLTIPLAS PÁGINAS (imagens PNG). 
⚠️ **IMPORTANTE:** Procure os dados em TODAS as páginas fornecidas.
- Prêmio e comissão geralmente estão nas páginas 2-3
- Dados do cliente geralmente estão na página 1
- Analise todas as imagens antes de extrair os dados

# LISTAS DO SISTEMA (FONTE DA VERDADE)

**Clientes Cadastrados (primeiros 50):**
["${clientsList}"]

**Ramos Cadastrados:**
["${ramosList}"]

**Seguradoras Cadastradas:**
["${companiesList}"]

# REGRAS CRÍTICAS DE EXTRAÇÃO

## 1. **clientName** (Nome do Segurado)
- ⚠️ **PROCURE POR:**
  * "Proponente / Segurado(a):" seguido do nome
  * "Segurado:" ou "Proponente:" seguido do nome
  * "NOME DO SEGURADO" ou similar
- Extraia APENAS o nome completo da pessoa/empresa
- NÃO inclua: CPF, CNPJ, profissão, endereço
- Exemplo: Se vir "LUCIANA GIMENES BAYSZAR" → retorne "LUCIANA GIMENES BAYSZAR"
- Depois de extrair, encontre a correspondência MAIS PRÓXIMA na lista "Clientes Cadastrados"
- Se não encontrar, retorne \`null\`

## 2. **insuredItem** (Bem Segurado)
- Para veículos: "MARCA MODELO ANO - PLACA XXX1234"
- Exemplo: "VOLKSWAGEN TIGUAN ALLSPACE 2023 - PLACA FRV5D64"
- Para residencial: "Residência - Endereço completo"
- Para RC: "Profissão do segurado"

## 3. **insurerName** (Seguradora)
- Procure por logotipo ou nome da seguradora no topo do documento
- Encontre o nome EXATO da lista "Seguradoras Cadastradas"
- Exemplos comuns: "Porto Seguro", "Bradesco Seguros", "Tokio Marine"

## 4. **insuranceLine** (Ramo do Seguro)
- Identifique o tipo de seguro no documento
- Encontre o nome EXATO da lista "Ramos Cadastrados"
- Se vir "AUTOMÓVEL" ou "AUTO" → procure "Auto" ou "Automóveis" na lista
- Se vir "RESIDENCIAL" → procure "Residencial" na lista

## 5. **policyNumber** (Número da Apólice)
- Procure por "Apólice:", "Proposta:", "Número:", "Nº Apólice"
- Extraia APENAS os números (sem pontos, traços ou espaços)
- Exemplo: Se vir "Apólice: 333.523.267" → retorne "333523267"

## 6. **premiumValue** (Prêmio Líquido) ⚠️ CRÍTICO
- ⚠️ **PROCURE EM TODAS AS PÁGINAS** (geralmente está na página 2 ou 3)
- ⚠️ **PROCURE POR ESTES TERMOS EXATOS:**
  * "Prêmio Líquido" ou "Premio Liquido"
  * "Prêmio Total" ou "Premio Total"
  * "Valor do Prêmio" ou "Valor do Premio"
  * "Prêmio" (sozinho, perto de um valor em R$)
- **FORMATO:** Extraia APENAS o número decimal (sem "R$", sem pontos de milhar)
- **CONVERSÃO:** 
  * "R$ 5.848,43" → retorne 5848.43
  * "R$ 3.456,78" → retorne 3456.78
  * "R$ 1.234.567,89" → retorne 1234567.89
- **NÃO CONFUNDA COM:**
  * "Prêmio Bruto" (inclui impostos)
  * "IOF" (imposto separado)
  * "Custo Total" (pode incluir outras taxas)
  * "Prêmio com IOF"
- Se não encontrar em nenhuma página, retorne \`null\`

## 7. **commissionPercentage** (Comissão) ⚠️ CRÍTICO
- ⚠️ **PROCURE EM TODAS AS PÁGINAS** (geralmente está na página 2 ou 3)
- ⚠️ **PROCURE POR:**
  * "Comissão:" ou "Comissao:"
  * "Taxa de Comissão" ou "Taxa de Comissao"
  * "% Comissão" ou "% Comissao"
  * "Percentual de Comissão"
- **FORMATO:** Extraia APENAS o número percentual (sem símbolo %)
- **EXEMPLOS:**
  * "Comissão: 20%" → retorne 20
  * "15% de comissão" → retorne 15
  * "Comissão 12,5%" → retorne 12.5
- Se não encontrar, retorne \`null\`

## 8. **shouldGenerateRenewal** (Gerar Renovação?)
- Se vir "SEGURO NOVO" ou "RENOVAÇÃO" → retorne \`true\`
- Se vir "ENDOSSO" ou "ALTERAÇÃO" → retorne \`false\`
- Padrão: \`true\`

## 9. **startDate** (Data de Início de Vigência)
- ⚠️ **CRÍTICO:** Procure especificamente por:
  * "Vigência:", "Início de Vigência:"
  * "Das 24 horas do dia" seguido de uma data
  * "Válido a partir de"
- **NÃO** use "Data de Emissão", "Data de Proposta" ou "Data do Orçamento"
- A vigência é quando o seguro COMEÇA A VALER (geralmente uma data futura)
- Formato: YYYY-MM-DD
- Exemplo: Se vir "DAS 24 HORAS DO DIA 23/07/2025" → retorne "2025-07-23"

# INSTRUÇÕES FINAIS
- Analise visualmente o documento completo
- Extraia os dados com base nas regras acima
- Para cliente, seguradora e ramo: encontre o match EXATO da lista
- Se um campo não for encontrado, use \`null\`
- Retorne APENAS o objeto JSON estruturado (não adicione explicações)`;
}

// ============================================
// MATCHING INTELIGENTE
// ============================================
async function performIntelligentMatching(extractedData: any, dbContext: any) {
  console.log('🔍 Iniciando matching inteligente...');

  let clientId = null;
  let clientMatch: 'exact' | 'partial' | 'none' = 'none';
  let insurerId = null;
  let insurerMatch: 'exact' | 'partial' | 'none' = 'none';
  let insuranceLineId = null;
  let ramoMatch: 'exact' | 'partial' | 'none' = 'none';

  // Match de Cliente
  if (extractedData.clientName) {
    const exactClient = dbContext.clients.find((c: any) => 
      c.name.toLowerCase() === extractedData.clientName.toLowerCase()
    );
    
    if (exactClient) {
      clientId = exactClient.id;
      clientMatch = 'exact';
      console.log('✅ Cliente encontrado (exact):', exactClient.name);
    } else {
      const partialClient = dbContext.clients.find((c: any) => 
        c.name.toLowerCase().includes(extractedData.clientName.toLowerCase()) ||
        extractedData.clientName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (partialClient) {
        clientId = partialClient.id;
        clientMatch = 'partial';
        console.log('⚠️ Cliente encontrado (partial):', partialClient.name);
      } else {
        console.log('❌ Cliente não encontrado:', extractedData.clientName);
      }
    }
  }

  // Match de Seguradora
  if (extractedData.insurerName) {
    const exactInsurer = dbContext.companies.find((c: any) => 
      c.name.toLowerCase() === extractedData.insurerName.toLowerCase()
    );
    
    if (exactInsurer) {
      insurerId = exactInsurer.id;
      insurerMatch = 'exact';
      console.log('✅ Seguradora encontrada (exact):', exactInsurer.name);
    } else {
      const partialInsurer = dbContext.companies.find((c: any) => 
        c.name.toLowerCase().includes(extractedData.insurerName.toLowerCase()) ||
        extractedData.insurerName.toLowerCase().includes(c.name.toLowerCase())
      );
      
      if (partialInsurer) {
        insurerId = partialInsurer.id;
        insurerMatch = 'partial';
        console.log('⚠️ Seguradora encontrada (partial):', partialInsurer.name);
      } else {
        console.log('❌ Seguradora não encontrada:', extractedData.insurerName);
      }
    }
  }

  // Match de Ramo
  if (extractedData.insuranceLine) {
    const exactRamo = dbContext.ramos.find((r: any) => 
      r.nome.toLowerCase() === extractedData.insuranceLine.toLowerCase()
    );
    
    if (exactRamo) {
      insuranceLineId = exactRamo.id;
      ramoMatch = 'exact';
      console.log('✅ Ramo encontrado (exact):', exactRamo.nome);
    } else {
      const partialRamo = dbContext.ramos.find((r: any) => 
        r.nome.toLowerCase().includes(extractedData.insuranceLine.toLowerCase()) ||
        extractedData.insuranceLine.toLowerCase().includes(r.nome.toLowerCase())
      );
      
      if (partialRamo) {
        insuranceLineId = partialRamo.id;
        ramoMatch = 'partial';
        console.log('⚠️ Ramo encontrado (partial):', partialRamo.nome);
      } else {
        console.log('❌ Ramo não encontrado:', extractedData.insuranceLine);
      }
    }
  }

  return {
    clientName: extractedData.clientName || null,
    clientId,
    insuredItem: extractedData.insuredItem || null,
    insurerName: extractedData.insurerName || null,
    insurerId,
    insuranceLine: extractedData.insuranceLine || null,
    insuranceLineId,
    policyNumber: extractedData.policyNumber || null,
    premiumValue: extractedData.premiumValue || null,
    commissionPercentage: extractedData.commissionPercentage || null,
    shouldGenerateRenewal: extractedData.shouldGenerateRenewal || false,
    startDate: extractedData.startDate || null,
    matchingDetails: {
      clientMatch,
      insurerMatch,
      ramoMatch
    }
  };
}
