import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

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
  }
];

async function executeToolCall(toolCall: any, supabase: any, userId: string) {
  const { name, arguments: argsStr } = toolCall.function;
  const args = JSON.parse(argsStr);
  console.log(`Executing tool: ${name}`, args);

  switch (name) {
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
        // Esta é uma busca em tabela relacionada, requer um RPC ou uma view para eficiência.
        // Simplificação por agora: Buscaremos o ID do cliente primeiro.
        const { data: clientData } = await supabase.from('clientes').select('id').ilike('name', `%${args.client_name}%`).eq('user_id', userId).single();
        if(clientData) {
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
        
        const summary = data.reduce((acc, t) => {
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
        model: 'google/gemini-2.5-flash',
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
          model: 'google/gemini-2.5-flash',
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

  } catch (error) {
    console.error('Error in ai-assistant:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
