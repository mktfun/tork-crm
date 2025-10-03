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
- search_tasks: Buscar tarefas pendentes ou concluídas
- get_upcoming_appointments: Ver próximos agendamentos
- get_client_portfolio: Análise completa de um cliente específico
- search_transactions: Buscar transações específicas

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
    name: "search_clients",
    description: "Busca clientes no banco de dados por nome, CPF/CNPJ, email ou telefone. Retorna lista com dados básicos dos clientes encontrados.",
    parameters: {
      type: "object",
      properties: {
        search_term: {
          type: "string",
          description: "Termo de busca (nome, CPF/CNPJ, email ou telefone)"
        }
      },
      required: ["search_term"]
    }
  },
  {
    type: "function",
    name: "search_policies",
    description: "Busca apólices no banco de dados. Pode filtrar por número da apólice, cliente, seguradora ou status.",
    parameters: {
      type: "object",
      properties: {
        policy_number: {
          type: "string",
          description: "Número da apólice (opcional)"
        },
        client_name: {
          type: "string",
          description: "Nome do cliente (opcional)"
        },
        status: {
          type: "string",
          description: "Status da apólice: 'Ativa', 'Vencida', 'Cancelada', 'Aguardando Apólice' (opcional)"
        }
      }
    }
  },
  {
    type: "function",
    name: "get_financial_summary",
    description: "Retorna resumo financeiro com receitas, despesas e comissões em um período específico",
    parameters: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Data inicial no formato YYYY-MM-DD"
        },
        end_date: {
          type: "string",
          description: "Data final no formato YYYY-MM-DD"
        }
      },
      required: ["start_date", "end_date"]
    }
  },
  {
    type: "function",
    name: "analyze_renewals",
    description: "Analisa apólices que estão próximas ao vencimento para identificar oportunidades de renovação",
    parameters: {
      type: "object",
      properties: {
        days_ahead: {
          type: "number",
          description: "Número de dias à frente para analisar (padrão: 30)"
        }
      }
    }
  },
  {
    type: "function",
    name: "search_tasks",
    description: "Busca tarefas (pendentes, concluídas ou todas). Pode filtrar por prioridade e tipo.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Status da tarefa: 'Pendente', 'Concluída' (opcional)"
        },
        priority: {
          type: "string",
          description: "Prioridade: 'Baixa', 'Média', 'Alta' (opcional)"
        }
      }
    }
  },
  {
    type: "function",
    name: "get_upcoming_appointments",
    description: "Lista próximos agendamentos em ordem cronológica",
    parameters: {
      type: "object",
      properties: {
        days_ahead: {
          type: "number",
          description: "Número de dias à frente (padrão: 7)"
        }
      }
    }
  },
  {
    type: "function",
    name: "get_client_portfolio",
    description: "Análise completa de um cliente: apólices, transações, agendamentos e histórico",
    parameters: {
      type: "object",
      properties: {
        client_id: {
          type: "string",
          description: "ID do cliente (UUID)"
        }
      },
      required: ["client_id"]
    }
  },
  {
    type: "function",
    name: "search_transactions",
    description: "Busca transações por período, tipo, status ou descrição",
    parameters: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Data inicial (YYYY-MM-DD, opcional)"
        },
        end_date: {
          type: "string",
          description: "Data final (YYYY-MM-DD, opcional)"
        },
        status: {
          type: "string",
          description: "'PAGO', 'PENDENTE', 'VENCIDO' (opcional)"
        },
        nature: {
          type: "string",
          description: "'RECEITA' ou 'DESPESA' (opcional)"
        }
      }
    }
  }
];

async function executeToolCall(toolName: string, args: any, userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`Executing tool: ${toolName}`, args);

  try {
    switch (toolName) {
      case 'search_clients': {
        const { search_term } = args;
        const { data, error } = await supabase
          .from('clientes')
          .select('id, name, email, phone, cpf_cnpj, status')
          .eq('user_id', userId)
          .or(`name.ilike.%${search_term}%,email.ilike.%${search_term}%,phone.ilike.%${search_term}%,cpf_cnpj.ilike.%${search_term}%`)
          .limit(10);

        if (error) throw error;
        return {
          success: true,
          data: data || [],
          message: `Encontrados ${data?.length || 0} clientes`
        };
      }

      case 'search_policies': {
        let query = supabase
          .from('apolices')
          .select(`
            id,
            policy_number,
            status,
            expiration_date,
            premium_value,
            commission_rate,
            clientes!inner(name)
          `)
          .eq('user_id', userId);

        if (args.policy_number) {
          query = query.ilike('policy_number', `%${args.policy_number}%`);
        }
        if (args.client_name) {
          query = query.ilike('clientes.name', `%${args.client_name}%`);
        }
        if (args.status) {
          query = query.eq('status', args.status);
        }

        const { data, error } = await query.limit(10);
        if (error) throw error;

        return {
          success: true,
          data: data || [],
          message: `Encontradas ${data?.length || 0} apólices`
        };
      }

      case 'get_financial_summary': {
        const { start_date, end_date } = args;
        const { data, error } = await supabase
          .from('transactions')
          .select('nature, amount, status')
          .eq('user_id', userId)
          .gte('transaction_date', start_date)
          .lte('transaction_date', end_date);

        if (error) throw error;

        const summary = (data || []).reduce((acc, t) => {
          if (t.nature === 'RECEITA') {
            acc.revenue += Number(t.amount);
            if (t.status === 'PAGO') acc.received += Number(t.amount);
          } else {
            acc.expenses += Number(t.amount);
            if (t.status === 'PAGO') acc.paid += Number(t.amount);
          }
          return acc;
        }, { revenue: 0, received: 0, expenses: 0, paid: 0 });

        return {
          success: true,
          data: summary,
          message: `Resumo financeiro de ${start_date} a ${end_date}`
        };
      }

      case 'analyze_renewals': {
        const daysAhead = args.days_ahead || 30;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        const { data, error } = await supabase
          .from('apolices')
          .select(`
            id,
            policy_number,
            expiration_date,
            premium_value,
            status,
            clientes!inner(name, phone, email)
          `)
          .eq('user_id', userId)
          .eq('status', 'Ativa')
          .lte('expiration_date', futureDate.toISOString().split('T')[0])
          .order('expiration_date', { ascending: true });

        if (error) throw error;

        return {
          success: true,
          data: data || [],
          message: `${data?.length || 0} apólices vencem nos próximos ${daysAhead} dias`
        };
      }

      case 'search_tasks': {
        let query = supabase
          .from('tasks')
          .select('id, title, description, status, priority, due_date, task_type')
          .eq('user_id', userId)
          .order('due_date', { ascending: true });

        if (args.status) {
          query = query.eq('status', args.status);
        }
        if (args.priority) {
          query = query.eq('priority', args.priority);
        }

        const { data, error } = await query.limit(20);
        if (error) throw error;

        return {
          success: true,
          data: data || [],
          message: `Encontradas ${data?.length || 0} tarefas`
        };
      }

      case 'get_upcoming_appointments': {
        const daysAhead = args.days_ahead || 7;
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        const { data, error } = await supabase
          .from('appointments')
          .select(`
            id,
            title,
            date,
            time,
            status,
            notes,
            clientes!inner(name, phone)
          `)
          .eq('user_id', userId)
          .gte('date', today.toISOString().split('T')[0])
          .lte('date', futureDate.toISOString().split('T')[0])
          .order('date', { ascending: true })
          .order('time', { ascending: true });

        if (error) throw error;

        return {
          success: true,
          data: data || [],
          message: `${data?.length || 0} agendamentos nos próximos ${daysAhead} dias`
        };
      }

      case 'get_client_portfolio': {
        const { client_id } = args;

        // Buscar dados do cliente
        const { data: client, error: clientError } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', client_id)
          .eq('user_id', userId)
          .single();

        if (clientError) throw clientError;

        // Buscar apólices do cliente
        const { data: policies } = await supabase
          .from('apolices')
          .select('id, policy_number, status, expiration_date, premium_value, type')
          .eq('client_id', client_id)
          .eq('user_id', userId);

        // Buscar transações relacionadas
        const { data: transactions } = await supabase
          .from('transactions')
          .select('id, description, amount, status, nature, transaction_date')
          .eq('client_id', client_id)
          .eq('user_id', userId)
          .order('transaction_date', { ascending: false })
          .limit(10);

        // Buscar agendamentos
        const { data: appointments } = await supabase
          .from('appointments')
          .select('id, title, date, time, status')
          .eq('client_id', client_id)
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(5);

        return {
          success: true,
          data: {
            client,
            policies: policies || [],
            transactions: transactions || [],
            appointments: appointments || [],
            summary: {
              total_policies: policies?.length || 0,
              active_policies: policies?.filter(p => p.status === 'Ativa').length || 0,
              total_premium: policies?.reduce((sum, p) => sum + Number(p.premium_value || 0), 0) || 0
            }
          },
          message: `Portfólio completo do cliente ${client.name}`
        };
      }

      case 'search_transactions': {
        let query = supabase
          .from('transactions')
          .select('id, description, amount, status, nature, transaction_date, due_date')
          .eq('user_id', userId)
          .order('transaction_date', { ascending: false });

        if (args.start_date) {
          query = query.gte('transaction_date', args.start_date);
        }
        if (args.end_date) {
          query = query.lte('transaction_date', args.end_date);
        }
        if (args.status) {
          query = query.eq('status', args.status);
        }
        if (args.nature) {
          query = query.eq('nature', args.nature);
        }

        const { data, error } = await query.limit(20);
        if (error) throw error;

        const summary = (data || []).reduce((acc, t) => {
          acc.total += Number(t.amount);
          if (t.nature === 'RECEITA') acc.revenue += Number(t.amount);
          else acc.expenses += Number(t.amount);
          return acc;
        }, { total: 0, revenue: 0, expenses: 0 });

        return {
          success: true,
          data: data || [],
          summary,
          message: `Encontradas ${data?.length || 0} transações`
        };
      }

      default:
        return {
          success: false,
          error: `Ferramenta desconhecida: ${toolName}`
        };
    }
  } catch (error) {
    console.error(`Error in ${toolName}:`, error);
    return {
      success: false,
      error: error.message
    };
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

      // Executar todas as tool calls
      for (const toolCall of toolCalls) {
        const toolResult = await executeToolCall(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          userId
        );

        // Adicionar resultado da tool ao histórico
        aiMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
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
