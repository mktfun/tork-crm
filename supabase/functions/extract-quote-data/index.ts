// ✅ VERSÃO FINAL: Extração com Gemini 2.5 Flash Vision + Conversão PDF→Imagem
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

    console.log('📄 Processando PDF com Gemini Vision:', fileUrl);

    // 1️⃣ CONVERTER PDF PARA IMAGEM usando PDF.co
    const imageUrl = await convertPdfToImage(fileUrl);
    console.log('✅ PDF convertido para imagem:', imageUrl);

    // 2️⃣ BUSCAR CONTEXTO DO BANCO
    const dbContext = await fetchDatabaseContext();
    console.log(`✅ Contexto: ${dbContext.ramos.length} ramos, ${dbContext.companies.length} seguradoras, ${dbContext.clients.length} clientes`);

    // 3️⃣ EXTRAIR DADOS COM GEMINI VISION
    const extractedData = await extractDataWithGeminiVision(imageUrl, dbContext);
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
// CONVERTER PDF PARA IMAGEM (PDF.co)
// ============================================
async function convertPdfToImage(pdfUrl: string): Promise<string> {
  const response = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('PDF_PARSER_API_KEY') || '',
    },
    body: JSON.stringify({
      url: pdfUrl,
      pages: '0', // Apenas primeira página
      async: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro ao converter PDF: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.urls || result.urls.length === 0) {
    throw new Error('Nenhuma imagem gerada');
  }

  return result.urls[0]; // URL da primeira página como imagem
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
    supabaseAdmin.from('clientes').select('id, name').limit(1000),
  ]);

  if (ramosResult.error) throw new Error('Erro ao buscar ramos');
  if (companiesResult.error) throw new Error('Erro ao buscar seguradoras');
  if (clientsResult.error) throw new Error('Erro ao buscar clientes');

  return {
    ramos: ramosResult.data || [],
    companies: companiesResult.data || [],
    clients: clientsResult.data || [],
  };
}

// ============================================
// EXTRAIR DADOS COM GEMINI 2.5 FLASH VISION
// ============================================
async function extractDataWithGeminiVision(imageUrl: string, dbContext: any) {
  const prompt = buildVisionPrompt(dbContext);

  console.log('🤖 Chamando Gemini 2.5 Flash Vision...');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      'HTTP-Referer': 'https://supabase.com',
      'X-Title': 'Supabase Edge Function',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl, // URL da imagem PNG
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Erro na API Lovable AI:', response.status, errorText);
    throw new Error(`Erro na API: ${response.status}`);
  }

  const result = await response.json();
  console.log('🤖 Resposta do Gemini Vision:', JSON.stringify(result, null, 2));

  const content = result.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Resposta vazia do Gemini');
  }

  // Extrair JSON da resposta
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Não foi possível extrair JSON da resposta');
  }

  const extractedData = JSON.parse(jsonMatch[0]);

  // Fazer matching com a base de dados
  return await matchWithDatabase(extractedData, dbContext);
}

// ============================================
// PROMPT PARA GEMINI VISION
// ============================================
function buildVisionPrompt(dbContext: any) {
  const ramosStr = dbContext.ramos.map((r: any) => r.nome).join(', ');
  const companiesStr = dbContext.companies.map((c: any) => c.name).join(', ');
  const clientsStr = dbContext.clients.slice(0, 100).map((c: any) => c.name).join(', ');

  return `Você é um especialista em análise de documentos de seguros. Analise esta imagem de apólice/orçamento e extraia os dados abaixo.

**CONTEXTO DA BASE DE DADOS:**

**Ramos Cadastrados:** ${ramosStr}

**Seguradoras Cadastradas:** ${companiesStr}

**Clientes Cadastrados (primeiros 100):** ${clientsStr}

**INSTRUÇÕES:**
1. Analise VISUALMENTE o documento
2. Identifique cada campo listado abaixo
3. Para seguradoras e ramos, retorne o nome EXATO da lista acima (matching fuzzy)
4. Para clientes, retorne o nome EXATO se encontrar na lista, senão retorne o nome que está no documento

**CAMPOS PARA EXTRAIR:**

1. **clientName**: Nome completo do Segurado/Proponente
   - Procure por "Proponente", "Segurado", "Cliente"
   - Extraia o nome COMPLETO, sem CPF/CNPJ

2. **insuredItem**: Bem segurado
   - Auto: "Honda Civic 2023 - Placa ABC1234"
   - Residencial: "Residência - Rua X, 123"

3. **insurerName**: Nome da seguradora
   - Retorne o nome EXATO da lista "Seguradoras Cadastradas"

4. **insuranceLine**: Ramo do seguro
   - Retorne o nome EXATO da lista "Ramos Cadastrados"

5. **policyNumber**: Número da apólice/proposta
6. **premiumValue**: Valor do prêmio líquido (número)
   - ⚠️ **CRÍTICO:** Procure por:
     * "Prêmio Líquido", "Prêmio Total", "Valor do Prêmio"
     * "Prêmio Anual", "Prêmio à Vista"
     * Valores em R$ próximos ao topo do documento
   - Ignore IOF, taxas e adicionais
   - Retorne apenas o número SEM formatação (ex: 5848.43)
   - Se não encontrar, retorne null

7. **commissionPercentage**: Taxa de comissão (número)
   - ⚠️ **CRÍTICO:** Procure por:
     * "Comissão:", "Taxa de Comissão:", "% Comissão"
     * "Comiss.:", "Com.:"
     * Valores em % próximos ao prêmio
   - Retorne apenas o número SEM o símbolo % (ex: 20)
   - Se não encontrar, retorne null
   - Retorne apenas o número (ex: 20)

8. **shouldGenerateRenewal**: true se for "Seguro Novo" ou "Renovação", false se for "Endosso"

9. **startDate**: Data de início de vigência (formato YYYY-MM-DD)
   - Procure por "Vigência:", "Das 24 horas do dia", "Início de Vigência"
   - NÃO use "Data de Emissão"

**FORMATO DE SAÍDA:**
Retorne APENAS um objeto JSON válido, sem explicações:

\`\`\`json
{
  "clientName": "string ou null",
  "insuredItem": "string ou null",
  "insurerName": "string ou null",
  "insuranceLine": "string ou null",
  "policyNumber": "string ou null",
  "premiumValue": number ou null,
  "commissionPercentage": number ou null,
  "shouldGenerateRenewal": boolean,
  "startDate": "YYYY-MM-DD ou null"
}
\`\`\``;
}

// ============================================
// MATCHING COM BASE DE DADOS
// ============================================
async function matchWithDatabase(extractedData: any, dbContext: any) {
  const result = { ...extractedData };

  // Matching de cliente
  if (extractedData.clientName) {
    const clientMatch = findBestMatch(
      extractedData.clientName,
      dbContext.clients.map((c: any) => ({ id: c.id, name: c.name }))
    );
    
    if (clientMatch) {
      result.clientId = clientMatch.id;
      result.clientName = clientMatch.name;
      result.matchingDetails = { ...result.matchingDetails, clientMatch: clientMatch.quality };
      console.log(`✅ Cliente encontrado (${clientMatch.quality}): ${clientMatch.name}`);
    } else {
      result.clientId = null;
      result.matchingDetails = { ...result.matchingDetails, clientMatch: 'none' };
      console.log('❌ Cliente não encontrado:', extractedData.clientName);
    }
  }

  // Matching de seguradora
  if (extractedData.insurerName) {
    const companyMatch = findBestMatch(
      extractedData.insurerName,
      dbContext.companies.map((c: any) => ({ id: c.id, name: c.name }))
    );
    
    if (companyMatch) {
      result.insurerId = companyMatch.id;
      result.insurerName = companyMatch.name;
      result.matchingDetails = { ...result.matchingDetails, insurerMatch: companyMatch.quality };
      console.log(`✅ Seguradora encontrada (${companyMatch.quality}): ${companyMatch.name}`);
    } else {
      result.insurerId = null;
      result.matchingDetails = { ...result.matchingDetails, insurerMatch: 'none' };
    }
  }

  // Matching de ramo
  if (extractedData.insuranceLine) {
    const ramoMatch = findBestMatch(
      extractedData.insuranceLine,
      dbContext.ramos.map((r: any) => ({ id: r.id, name: r.nome }))
    );
    
    if (ramoMatch) {
      result.insuranceLineId = ramoMatch.id;
      result.insuranceLine = ramoMatch.name;
      result.matchingDetails = { ...result.matchingDetails, ramoMatch: ramoMatch.quality };
      console.log(`✅ Ramo encontrado (${ramoMatch.quality}): ${ramoMatch.name}`);
    } else {
      result.insuranceLineId = null;
      result.matchingDetails = { ...result.matchingDetails, ramoMatch: 'none' };
    }
  }

  if (!result.matchingDetails) {
    result.matchingDetails = { clientMatch: 'none', insurerMatch: 'none', ramoMatch: 'none' };
  }

  return result;
}

// ============================================
// ALGORITMO DE MATCHING FUZZY
// ============================================
function findBestMatch(searchTerm: string, items: Array<{ id: string; name: string }>) {
  if (!searchTerm || !items || items.length === 0) return null;

  const normalized = searchTerm.toLowerCase().trim();

  // 1. Matching exato
  let match = items.find(item => item.name.toLowerCase().trim() === normalized);
  if (match) return { ...match, quality: 'exact' };

  // 2. Matching parcial (contém)
  match = items.find(item => {
    const itemName = item.name.toLowerCase().trim();
    return itemName.includes(normalized) || normalized.includes(itemName);
  });
  if (match) return { ...match, quality: 'partial' };

  // 3. Matching por palavras-chave
  const searchWords = normalized.split(' ').filter(w => w.length > 2);
  match = items.find(item => {
    const itemWords = item.name.toLowerCase().split(' ');
    const matchCount = searchWords.filter(sw =>
      itemWords.some(iw => iw.includes(sw) || sw.includes(iw))
    ).length;
    return matchCount >= Math.min(2, searchWords.length);
  });
  if (match) return { ...match, quality: 'partial' };

  return null;
}
