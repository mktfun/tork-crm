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
      console.error('[create-next-appointment] appointmentId ausente');
      throw new Error("O ID do agendamento (appointmentId) é obrigatório.");
    }

    console.log('[create-next-appointment] Processando appointmentId:', appointmentId);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Busca o agendamento concluído do banco de dados
    const { data: completedAppointment, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !completedAppointment) {
      console.error('[create-next-appointment] Erro ao buscar agendamento:', fetchError);
      return new Response(
        JSON.stringify({ message: `Agendamento com ID ${appointmentId} não encontrado.` }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-next-appointment] Agendamento encontrado:', {
      id: completedAppointment.id,
      status: completedAppointment.status,
      recurrence_rule: completedAppointment.recurrence_rule
    });

    // 2. Verifica se existe uma regra de recorrência
    if (!completedAppointment.recurrence_rule) {
      console.log('[create-next-appointment] Agendamento não é recorrente');
      return new Response(
        JSON.stringify({ message: 'Agendamento não é recorrente.' }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validação da RRULE
    let rule: RRule;
    try {
      rule = RRule.fromString(completedAppointment.recurrence_rule);
      console.log('[create-next-appointment] RRULE válida:', completedAppointment.recurrence_rule);
    } catch (rruleError) {
      console.error('[create-next-appointment] RRULE inválida:', rruleError);
      return new Response(
        JSON.stringify({ 
          message: 'Regra de recorrência inválida.', 
          details: rruleError.message 
        }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Calcula a próxima data usando rrule
    const startDateTime = new Date(`${completedAppointment.date}T${completedAppointment.time}Z`);
    console.log('[create-next-appointment] Data/hora base:', startDateTime.toISOString());
    
    const nextDate = rule.after(startDateTime, false);

    if (!nextDate) {
      console.log('[create-next-appointment] Fim da série de recorrência');
      return new Response(
        JSON.stringify({ 
          message: 'Fim da série de recorrência. Nenhum próximo agendamento a ser criado.' 
        }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-next-appointment] Próxima data calculada:', nextDate.toISOString());

    // 5. Prepara os dados do novo agendamento
    const newAppointmentData = {
      user_id: completedAppointment.user_id,
      client_id: completedAppointment.client_id,
      policy_id: completedAppointment.policy_id,
      title: completedAppointment.title,
      date: nextDate.toISOString().split('T')[0],
      time: nextDate.toTimeString().split(' ')[0].substring(0, 5),
      status: 'Pendente',
      notes: completedAppointment.notes,
      priority: completedAppointment.priority,
      recurrence_rule: completedAppointment.recurrence_rule,
      parent_appointment_id: completedAppointment.parent_appointment_id || completedAppointment.id,
      original_start_timestamptz: completedAppointment.original_start_timestamptz || 
        new Date(`${completedAppointment.date}T${completedAppointment.time}Z`).toISOString(),
    };

    console.log('[create-next-appointment] Criando novo agendamento:', {
      date: newAppointmentData.date,
      time: newAppointmentData.time,
      parent_id: newAppointmentData.parent_appointment_id
    });

    // 6. Insere o próximo agendamento no banco
    const { data: newAppointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert(newAppointmentData)
      .select('id')
      .single();

    if (insertError) {
      console.error('[create-next-appointment] Erro ao inserir:', insertError);
      throw insertError;
    }

    console.log('[create-next-appointment] Próximo agendamento criado com sucesso:', newAppointment.id);

    return new Response(
      JSON.stringify({ 
        message: 'Próximo agendamento criado com sucesso.', 
        newAppointmentId: newAppointment.id 
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[create-next-appointment] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        message: 'Erro interno do servidor.', 
        details: error.message 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
