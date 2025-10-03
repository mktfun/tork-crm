import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RecurrenceCalculation {
  nextDate: Date;
  nextTime: string;
}

function calculateNextDate(currentDate: string, currentTime: string, rule: string): RecurrenceCalculation {
  const baseDate = new Date(`${currentDate}T${currentTime}`);
  let nextDate: Date;

  if (rule.includes('FREQ=DAILY')) {
    const interval = rule.match(/INTERVAL=(\d+)/);
    const days = interval ? parseInt(interval[1]) : 1;
    nextDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  } else if (rule.includes('FREQ=WEEKLY')) {
    const interval = rule.match(/INTERVAL=(\d+)/);
    const weeks = interval ? parseInt(interval[1]) : 1;
    nextDate = new Date(baseDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  } else if (rule.includes('FREQ=MONTHLY')) {
    const interval = rule.match(/INTERVAL=(\d+)/);
    const months = interval ? parseInt(interval[1]) : 1;
    nextDate = new Date(baseDate);
    nextDate.setMonth(nextDate.getMonth() + months);
  } else if (rule.includes('FREQ=YEARLY')) {
    const interval = rule.match(/INTERVAL=(\d+)/);
    const years = interval ? parseInt(interval[1]) : 1;
    nextDate = new Date(baseDate);
    nextDate.setFullYear(nextDate.getFullYear() + years);
  } else {
    nextDate = new Date(baseDate);
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  }

  return {
    nextDate,
    nextTime: currentTime
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { appointmentId } = await req.json()
    
    if (!appointmentId) {
      throw new Error('appointmentId é obrigatório')
    }

    console.log('Processing appointment completion:', appointmentId)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 1. Buscar o agendamento concluído
    const { data: completedAppointment, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single()

    if (fetchError) {
      console.error('Erro ao buscar agendamento:', fetchError)
      throw new Error(`Agendamento não encontrado: ${fetchError.message}`)
    }

    console.log('Agendamento encontrado:', {
      id: completedAppointment.id,
      is_recurring: completedAppointment.is_recurring,
      recurrence_rule: completedAppointment.recurrence_rule
    })

    // 2. Verificar se é recorrente
    if (!completedAppointment.recurrence_rule) {
      console.log('Agendamento não é recorrente. Nenhuma ação necessária.')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agendamento não recorrente. Nenhuma ação necessária.' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // 3. Calcular próxima data
    const { nextDate, nextTime } = calculateNextDate(
      completedAppointment.date,
      completedAppointment.time,
      completedAppointment.recurrence_rule
    )

    console.log('Próxima data calculada:', {
      date: nextDate.toISOString().split('T')[0],
      time: nextTime
    })

    // 4. Criar novo agendamento
    const newAppointmentData = {
      user_id: completedAppointment.user_id,
      client_id: completedAppointment.client_id,
      policy_id: completedAppointment.policy_id,
      title: completedAppointment.title,
      date: nextDate.toISOString().split('T')[0],
      time: nextTime,
      status: 'Pendente',
      notes: completedAppointment.notes,
      priority: completedAppointment.priority || 'Normal',
      recurrence_rule: completedAppointment.recurrence_rule,
      is_recurring: true,
      parent_appointment_id: completedAppointment.parent_appointment_id || completedAppointment.id,
    }

    const { data: newAppointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert(newAppointmentData)
      .select('id')
      .single()

    if (insertError) {
      console.error('Erro ao criar próximo agendamento:', insertError)
      throw new Error(`Erro ao criar próximo agendamento: ${insertError.message}`)
    }

    console.log('Próximo agendamento criado com sucesso:', newAppointment.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        newAppointmentId: newAppointment.id,
        nextDate: nextDate.toISOString().split('T')[0]
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro geral:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
