// File: supabase/functions/create-next-appointment/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { RRule } from "https://esm.sh/rrule@2.8.1";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { appointmentId } = await req.json();
    if (!appointmentId) {
      throw new Error("O ID do agendamento (appointmentId) é obrigatório.");
    }

    // Use a Service Role Key para operações de backend seguras
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Busca o agendamento que acabou de ser concluído
    const { data: completedAppointment, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !completedAppointment) {
      console.error(`[ERRO] Agendamento ${appointmentId} não encontrado.`, fetchError);
      return new Response(JSON.stringify({ message: `Agendamento com ID ${appointmentId} não encontrado.` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[INFO] Processando agendamento concluído: ${completedAppointment.id}`);

    // 2. Se não há regra de recorrência, o trabalho acaba aqui.
    if (!completedAppointment.recurrence_rule) {
      console.log(`[INFO] Agendamento ${completedAppointment.id} não é recorrente. Finalizando.`);
      return new Response(JSON.stringify({ message: 'Agendamento não é recorrente.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    console.log(`[INFO] Regra de recorrência encontrada: ${completedAppointment.recurrence_rule}`);

    // 3. LÓGICA CORRIGIDA: Calcula a próxima data a partir da data do agendamento ATUAL.
    // Usar 'Z' para garantir que a data seja tratada como UTC, evitando bugs de timezone.
    const completedDateTime = new Date(`${completedAppointment.date}T${completedAppointment.time}Z`);
    console.log(`[DEBUG] Data/hora base para cálculo (UTC): ${completedDateTime.toISOString()}`);
    
    const rule = RRule.fromString(completedAppointment.recurrence_rule);
    // O parâmetro 'false' (inclusive) é CRÍTICO. Garante que ele pegue a próxima ocorrência ESTRITAMENTE DEPOIS da data base.
    const nextDate = rule.after(completedDateTime, false); 

    if (!nextDate) {
      console.log(`[INFO] Fim da série de recorrência para ${completedAppointment.id}. Nenhuma nova data encontrada.`);
      return new Response(JSON.stringify({ message: 'Fim da série de recorrência. Nenhum próximo agendamento a ser criado.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[SUCCESS] Próxima data calculada (UTC): ${nextDate.toISOString()}`);

    // 4. Prepara os dados do novo agendamento, herdando do anterior
    const newAppointmentData = {
      user_id: completedAppointment.user_id,
      client_id: completedAppointment.client_id,
      policy_id: completedAppointment.policy_id,
      title: completedAppointment.title,
      date: nextDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
      time: nextDate.toTimeString().split(' ')[0], // Formato HH:MM:SS
      status: 'Pendente',
      notes: completedAppointment.notes,
      priority: completedAppointment.priority,
      recurrence_rule: completedAppointment.recurrence_rule, // A regra é passada para o próximo da corrente
      parent_appointment_id: completedAppointment.parent_appointment_id || completedAppointment.id,
    };
    
    // 5. Insere o próximo agendamento da "corrente" no banco
    const { data: newAppointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert(newAppointmentData)
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log(`[SUCCESS] Novo agendamento criado com ID: ${newAppointment.id}`);

    return new Response(JSON.stringify({ message: 'Próximo agendamento criado com sucesso.', newAppointmentId: newAppointment.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[FATAL] Erro inesperado na função:', error);
    return new Response(JSON.stringify({ message: 'Erro interno do servidor.', details: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
