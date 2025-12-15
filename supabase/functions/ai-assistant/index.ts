import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Redis } from "https://esm.sh/@upstash/redis@1.31.5";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@1.1.3";

// --- Configuração do Rate Limiter ---
const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!,
});

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "15 s"), // 10 requisições a cada 15 segundos
  analytics: true,
  prefix: "@upstash/ratelimit",
});
// ------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um assistente virtual especializado em ajudar corretores de seguros a gerenciar sua carteira de clientes e apólices. 

Você tem acesso às seguintes ferramentas:
- search_clients: Buscar clientes por nome, CPF/CNPJ, email ou telefone
- search_policies: Buscar apólices por número, cliente, seguradora ou status
- get_financial_summary: Obter resumo financeiro de transações
- analyze_renewals: Analisar apólices próximas ao vencimento
- create_appointment: Criar agendamentos com clientes
- search_claims: Buscar sinistros registrados
- generate_report: Gerar relatórios estruturados

Você deve:
1. Responder em português brasileiro de forma clara e profissional
2. Usar as ferramentas disponíveis para buscar informações atualizadas
3. Fornecer insights relevantes baseados nos dados
4. Sugerir ações quando apropriado
5. Ser proativo em identificar oportunidades e riscos

Sempre que o usuário fizer uma pergunta, analise se precisa usar alguma ferramenta para obter dados atualizados antes de responder.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_clients",
      description: "Busca clientes no banco de dados por nome, CPF, email ou qualquer outro termo de identificação.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca para encontrar o cliente. Pode ser nome, parte do nome, email, etc." },
          status: { type: "string", enum: ["Ativo", "Inativo"], description: "Filtra clientes pelo status." },
          limit: { type: "number", default: 5, description: "Número máximo de resultados a retornar." }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_policies",
      description: "Busca apólices de seguro por número, nome do cliente, seguradora ou status.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Nome do cliente para filtrar as apólices." },
          status: { type: "string", enum: ["Ativa", "Vencida", "Cancelada"], description: "Status da apólice." },
          limit: { type: "number", default: 5, description: "Número máximo de resultados a retornar." }
        },
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_financial_summary",
      description: "Retorna um resumo financeiro das comissões (receitas) dentro de um período específico.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["current-month", "last-30-days", "current-year"], default: "current-month", description: "Período para o resumo financeiro." },
        },
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_renewals",
      description: "Analisa e retorna uma lista de apólices que estão próximas do vencimento, priorizando as mais críticas.",
      parameters: {
        type: "object",
        properties: {
          days_ahead: { type: "number", default: 30, description: "Número de dias no futuro para verificar os vencimentos. Padrão 30 dias." }
        },
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Agenda um novo compromisso, reunião ou tarefa com um cliente em uma data e hora específicas.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Nome exato do cliente para o qual o agendamento será criado." },
          title: { type: "string", description: "O título ou motivo do agendamento. Ex: 'Reunião de Renovação'." },
          date: { type: "string", description: "A data do agendamento no formato AAAA-MM-DD." },
          time: { type: "string", description: "A hora do agendamento no formato HH:MM." },
          notes: { type: "string", description: "Notas ou comentários adicionais sobre o agendamento." }
        },
        required: ["client_name", "title", "date", "time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_claims",
      description: "Busca sinistros (claims) registrados no sistema, com opção de filtrar por cliente ou status.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Nome do cliente para filtrar os sinistros." },
          status: { type: "string", enum: ["Aberto", "Em Análise", "Aprovado", "Negado", "Fechado"], description: "Status atual do sinistro." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_report",
      description: "Coleta e estrutura dados para gerar um relatório. Retorna os dados em formato JSON ou um resumo em texto.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["financial", "renewals", "clients", "commissions"], description: "O tipo de relatório a ser gerado." },
          period: { type: "string", enum: ["current-month", "last-month", "current-year"], description: "Período de tempo para o relatório." },
          format: { type: "string", enum: ["json", "summary"], default: "summary", description: "Formato da saída: 'json' para dados brutos, 'summary' para um resumo em texto." }
        },
        required: ["type", "period"]
      }
    }
  }
];

async function executeToolCall(toolCall: any, supabase: any, userId: string) {
  const { name, arguments: argsStr } = toolCall.function;
  const args = JSON.parse(argsStr);
  console.log(`Executing tool: ${name}`, args);

  switch (name) {
    // --- FERRAMENTAS FASE 2 ---
    case 'search_clients': {
      let query = supabase
        .from('clientes')
        .select('id, name, email, phone, status')
        .eq('user_id', userId)
        .ilike('name', `%${args.query}%`)
        .limit(args.limit || 5);

      if (args.status) {
        query = query.eq('status', args.status);
      }
      
      const { data, error } = await query;
      if (error) return { tool_call_id: toolCall.id, output: JSON.stringify({ error: error.message }) };
      return { tool_call_id: toolCall.id, output: JSON.stringify(data) };
    }

    case 'search_policies': {
      let query = supabase
        .from('apolices')
        .select('policy_number, status, expiration_date, clientes(name)')
        .eq('user_id', userId)
        .limit(args.limit || 5);

      if (args.status) {
        query = query.eq('status', args.status);
      }
      if (args.client_name) {
        const { data: clientData } = await supabase
          .from('clientes')
          .select('id')
          .ilike('name', `%${args.client_name}%`)
          .eq('user_id', userId)
          .single();
        if (clientData) {
          query = query.eq('client_id', clientData.id);
        }
      }

      const { data, error } = await query;
      if (error) return { tool_call_id: toolCall.id, output: JSON.stringify({ error: error.message }) };
      return { tool_call_id: toolCall.id, output: JSON.stringify(data) };
    }

    case 'get_financial_summary': {
      const today = new Date();
      let startDate;

      if (args.period === 'last-30-days') {
        startDate = new Date(today.setDate(today.getDate() - 30));
      } else if (args.period === 'current-year') {
        startDate = new Date(today.getFullYear(), 0, 1);
      } else { // current-month
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, status')
        .eq('user_id', userId)
        .eq('nature', 'RECEITA')
        .gte('transaction_date', startDate.toISOString());

      if (error) return { tool_call_id: toolCall.id, output: JSON.stringify({ error: error.message }) };
      
      const summary = data.reduce((acc: { realizadas: number; pendentes: number; total: number }, t: { status: string; amount: number }) => {
        if (t.status === 'PAGO') acc.realizadas += Number(t.amount);
        if (t.status === 'PENDENTE') acc.pendentes += Number(t.amount);
        acc.total += Number(t.amount);
        return acc;
      }, { realizadas: 0, pendentes: 0, total: 0 });

      return { tool_call_id: toolCall.id, output: JSON.stringify(summary) };
    }

    case 'analyze_renewals': {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + (args.days_ahead || 30));

      const { data, error } = await supabase
        .from('apolices')
        .select('policy_number, expiration_date, status, clientes(name)')
        .eq('user_id', userId)
        .eq('status', 'Ativa')
        .gte('expiration_date', today.toISOString())
        .lte('expiration_date', futureDate.toISOString())
        .order('expiration_date', { ascending: true });

      if (error) return { tool_call_id: toolCall.id, output: JSON.stringify({ error: error.message }) };
      return { tool_call_id: toolCall.id, output: JSON.stringify(data) };
    }

    // --- NOVAS FERRAMENTAS FASE 3 ---
    case 'create_appointment': {
      // Passo 1: Encontrar o ID do cliente a partir do nome
      const { data: clientData, error: clientError } = await supabase
        .from('clientes')
        .select('id')
        .ilike('name', `%${args.client_name}%`)
        .eq('user_id', userId)
        .single();

      if (clientError || !clientData) {
        return { tool_call_id: toolCall.id, output: JSON.stringify({ error: `Cliente '${args.client_name}' não encontrado.` }) };
      }

      // Passo 2: Inserir o agendamento
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          client_id: clientData.id,
          user_id: userId,
          title: args.title,
          date: args.date,
          time: args.time,
          notes: args.notes || '',
          status: 'Pendente'
        })
        .select()
        .single();
      
      if (error) return { tool_call_id: toolCall.id, output: JSON.stringify({ error: error.message }) };
      return { tool_call_id: toolCall.id, output: JSON.stringify({ success: true, appointment_id: data.id, title: data.title, date: data.date, time: data.time }) };
    }
      
    case 'search_claims': {
      let query = supabase
        .from('sinistros')
        .select('id, claim_number, status, occurrence_date, claim_type, apolices(policy_number), clientes(name)')
        .eq('user_id', userId);
      
      if (args.status) {
        query = query.eq('status', args.status);
      }
      if (args.client_name) {
        const { data: clientData } = await supabase
          .from('clientes')
          .select('id')
          .ilike('name', `%${args.client_name}%`)
          .eq('user_id', userId)
          .single();
        if (clientData) {
          query = query.eq('client_id', clientData.id);
        }
      }

      const { data, error } = await query;
      if (error) return { tool_call_id: toolCall.id, output: JSON.stringify({ error: error.message }) };
      return { tool_call_id: toolCall.id, output: JSON.stringify(data) };
    }

    case 'generate_report': {
      if (args.type === 'renewals') {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 30);

        const { data, error } = await supabase
          .from('apolices')
          .select('policy_number, expiration_date, premium_value, status, clientes(name, phone)')
          .eq('user_id', userId)
          .eq('status', 'Ativa')
          .gte('expiration_date', today.toISOString())
          .lte('expiration_date', futureDate.toISOString())
          .order('expiration_date', { ascending: true });

        if (error) return { tool_call_id: toolCall.id, output: JSON.stringify({ error: error.message }) };
        
        if (args.format === 'summary') {
          const totalPremium = data.reduce((sum: number, p: { premium_value?: number }) => sum + Number(p.premium_value || 0), 0);
          const summaryText = `Relatório de Renovações (${args.period}): Encontradas ${data.length} apólices vencendo nos próximos 30 dias. Prêmio total: R$ ${totalPremium.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ${data.length > 0 ? `A mais próxima é a apólice ${data[0]?.policy_number} do cliente ${data[0]?.clientes.name} em ${new Date(data[0]?.expiration_date).toLocaleDateString('pt-BR')}.` : ''}`;
          return { tool_call_id: toolCall.id, output: JSON.stringify({ summary: summaryText }) };
        }
        return { tool_call_id: toolCall.id, output: JSON.stringify(data) };
      }

      if (args.type === 'financial' || args.type === 'commissions') {
        const today = new Date();
        let startDate;

        if (args.period === 'last-month') {
          startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        } else if (args.period === 'current-year') {
          startDate = new Date(today.getFullYear(), 0, 1);
        } else { // current-month
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        }

        const { data, error } = await supabase
          .from('transactions')
          .select('amount, status, nature, description, transaction_date')
          .eq('user_id', userId)
          .gte('transaction_date', startDate.toISOString());

        if (error) return { tool_call_id: toolCall.id, output: JSON.stringify({ error: error.message }) };

        if (args.format === 'summary') {
          const summary = data.reduce((acc: { totalReceitas: number; receitasRecebidas: number; totalDespesas: number; despesasPagas: number }, t: { nature: string; amount: number; status: string }) => {
            if (t.nature === 'RECEITA') {
              acc.totalReceitas += Number(t.amount);
              if (t.status === 'PAGO') acc.receitasRecebidas += Number(t.amount);
            } else {
              acc.totalDespesas += Number(t.amount);
              if (t.status === 'PAGO') acc.despesasPagas += Number(t.amount);
            }
            return acc;
          }, { totalReceitas: 0, receitasRecebidas: 0, totalDespesas: 0, despesasPagas: 0 });

          const summaryText = `Relatório Financeiro (${args.period}): Receitas totais: R$ ${summary.totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Recebidas: R$ ${summary.receitasRecebidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Despesas totais: R$ ${summary.totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Pagas: R$ ${summary.despesasPagas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Saldo: R$ ${(summary.receitasRecebidas - summary.despesasPagas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
          return { tool_call_id: toolCall.id, output: JSON.stringify({ summary: summaryText }) };
        }
        return { tool_call_id: toolCall.id, output: JSON.stringify(data) };
      }

      if (args.type === 'clients') {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, name, email, phone, status, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) return { tool_call_id: toolCall.id, output: JSON.stringify({ error: error.message }) };

        if (args.format === 'summary') {
          const totalAtivos = data.filter((c: { status: string }) => c.status === 'Ativo').length;
          const summaryText = `Relatório de Clientes: Total de ${data.length} clientes cadastrados. Ativos: ${totalAtivos}. Inativos: ${data.length - totalAtivos}.`;
          return { tool_call_id: toolCall.id, output: JSON.stringify({ summary: summaryText }) };
        }
        return { tool_call_id: toolCall.id, output: JSON.stringify(data) };
      }

      return { tool_call_id: toolCall.id, output: JSON.stringify({ error: `Tipo de relatório '${args.type}' ainda não implementado.` }) };
    }

    default:
      return { tool_call_id: toolCall.id, output: JSON.stringify({ error: 'Tool não encontrada' }) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();

    // --- LÓGICA DE RATE LIMITING ---
    const identifier = userId || req.headers.get("x-forwarded-for") || 'anon';
    const { success } = await ratelimit.limit(identifier);

    if (!success) {
      console.log(`Rate limit exceeded for: ${identifier}`);
      return new Response(JSON.stringify({ 
        error: "Limite de requisições excedido. Tente novamente em alguns segundos." 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log(`Rate limit OK for: ${identifier}`);
    // ---------------------------------

    if (!userId) {
      throw new Error('userId é obrigatório');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('Processing request for user:', userId);
    console.log('Messages:', messages.length);

    // Primeira chamada para a IA
    let aiMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages
    ];

    let response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp',
        messages: aiMessages,
        tools: TOOLS,
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    let result = await response.json();
    console.log('AI Response:', JSON.stringify(result, null, 2));

    // Se a IA solicitou tool calls, executar
    while (result.choices[0].message.tool_calls) {
      const toolCalls = result.choices[0].message.tool_calls;
      console.log('Tool calls requested:', toolCalls.length);

      // Adicionar a mensagem da IA com tool calls ao histórico
      aiMessages.push(result.choices[0].message);

      // Criar cliente Supabase com service role
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Executar todas as tool calls
      for (const toolCall of toolCalls) {
        const toolResult = await executeToolCall(toolCall, supabase, userId);

        // Adicionar resultado da tool ao histórico
        aiMessages.push({
          role: 'tool',
          tool_call_id: toolResult.tool_call_id,
          content: toolResult.output
        });
      }

      // Chamar a IA novamente com os resultados das tools
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp',
          messages: aiMessages,
          tools: TOOLS,
          tool_choice: 'auto',
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      result = await response.json();
    }

    const assistantMessage = result.choices[0].message.content;

    return new Response(
      JSON.stringify({ message: assistantMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in ai-assistant:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
