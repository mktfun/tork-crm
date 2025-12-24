import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatwootConfig {
  chatwoot_url: string;
  chatwoot_api_key: string;
  chatwoot_account_id: string;
}

async function getChatwootConfig(supabase: any, userId: string): Promise<ChatwootConfig | null> {
  const { data, error } = await supabase
    .from('crm_settings')
    .select('chatwoot_url, chatwoot_api_key, chatwoot_account_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    console.log('No Chatwoot config found for user:', userId);
    return null;
  }

  if (!data.chatwoot_url || !data.chatwoot_api_key || !data.chatwoot_account_id) {
    console.log('Incomplete Chatwoot config for user:', userId);
    return null;
  }

  return data as ChatwootConfig;
}

async function chatwootRequest(
  config: ChatwootConfig,
  endpoint: string,
  method: string = 'GET',
  body?: any
) {
  const url = `${config.chatwoot_url}/api/v1/accounts/${config.chatwoot_account_id}${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'api_access_token': config.chatwoot_api_key,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chatwoot API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function updateConversationLabels(
  config: ChatwootConfig,
  conversationId: number,
  newLabel: string,
  oldLabel?: string
) {
  // Read current labels
  const conversation = await chatwootRequest(
    config,
    `/conversations/${conversationId}`
  );

  let currentLabels: string[] = conversation.labels || [];
  
  // Modify: Remove old stage label, add new one
  if (oldLabel) {
    currentLabels = currentLabels.filter(l => l !== oldLabel);
  }
  
  if (!currentLabels.includes(newLabel)) {
    currentLabels.push(newLabel);
  }

  // Write back
  await chatwootRequest(
    config,
    `/conversations/${conversationId}/labels`,
    'POST',
    { labels: currentLabels }
  );

  return currentLabels;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header for user context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    console.log('CRM Sync action:', action, 'for user:', user.id);

    // Get Chatwoot config
    const config = await getChatwootConfig(supabase, user.id);
    
    if (!config) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Chatwoot not configured. Please add your credentials in Settings.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'update_deal_stage': {
        const { deal_id, new_stage_id, sync_token } = body;

        // Get deal with conversation ID
        const { data: deal, error: dealError } = await supabase
          .from('crm_deals')
          .select('*, client:clientes(*)')
          .eq('id', deal_id)
          .single();

        if (dealError || !deal) {
          return new Response(
            JSON.stringify({ error: 'Deal not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If no Chatwoot conversation linked, skip sync
        if (!deal.chatwoot_conversation_id) {
          console.log('No Chatwoot conversation linked to deal:', deal_id);
          return new Response(
            JSON.stringify({ success: true, message: 'No Chatwoot conversation to sync' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get old and new stage labels
        const { data: stages } = await supabase
          .from('crm_stages')
          .select('id, chatwoot_label')
          .eq('user_id', user.id);

        const newStage = stages?.find(s => s.id === new_stage_id);
        const oldStage = stages?.find(s => s.id === deal.stage_id);

        if (newStage?.chatwoot_label) {
          await updateConversationLabels(
            config,
            deal.chatwoot_conversation_id,
            newStage.chatwoot_label,
            oldStage?.chatwoot_label
          );
          console.log('Updated Chatwoot labels for conversation:', deal.chatwoot_conversation_id);
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Chatwoot sync completed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'upsert_contact': {
        const { client_id } = body;

        // Get client
        const { data: client, error: clientError } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', client_id)
          .eq('user_id', user.id)
          .single();

        if (clientError || !client) {
          return new Response(
            JSON.stringify({ error: 'Client not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Already synced?
        if (client.chatwoot_contact_id) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              chatwoot_contact_id: client.chatwoot_contact_id,
              message: 'Contact already synced' 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Search for existing contact in Chatwoot
        const searchParams = new URLSearchParams();
        if (client.email) searchParams.set('q', client.email);
        
        try {
          const searchResult = await chatwootRequest(
            config,
            `/contacts/search?${searchParams.toString()}`
          );

          let chatwootContactId: number;

          if (searchResult.payload?.length > 0) {
            // Found existing contact
            chatwootContactId = searchResult.payload[0].id;
            console.log('Found existing Chatwoot contact:', chatwootContactId);
          } else {
            // Create new contact
            const newContact = await chatwootRequest(
              config,
              '/contacts',
              'POST',
              {
                name: client.name,
                email: client.email,
                phone_number: client.phone?.replace(/\D/g, ''),
              }
            );
            chatwootContactId = newContact.payload.contact.id;
            console.log('Created new Chatwoot contact:', chatwootContactId);
          }

          // Update client with Chatwoot ID
          await supabase
            .from('clientes')
            .update({
              chatwoot_contact_id: chatwootContactId,
              chatwoot_synced_at: new Date().toISOString()
            })
            .eq('id', client_id);

          return new Response(
            JSON.stringify({ 
              success: true, 
              chatwoot_contact_id: chatwootContactId 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: any) {
          console.error('Chatwoot API error:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'sync_stages': {
        // Buscar todas as etapas do usuário
        const { data: stages, error: stagesError } = await supabase
          .from('crm_stages')
          .select('*')
          .eq('user_id', user.id)
          .order('position', { ascending: true });

        if (stagesError) {
          console.error('Failed to fetch stages:', stagesError);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch stages' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let synced = 0;
        let skipped = 0;
        const errors: string[] = [];

        console.log(`Syncing ${stages?.length || 0} stages to Chatwoot labels...`);

        for (const stage of stages || []) {
          const labelTitle = stage.chatwoot_label || stage.name.toLowerCase().replace(/\s+/g, '_');
          const labelColor = stage.color?.replace('#', '') || '3B82F6';
          
          try {
            await chatwootRequest(
              config,
              '/labels',
              'POST',
              {
                title: labelTitle,
                description: `Etapa CRM: ${stage.name}`,
                color: labelColor
              }
            );
            synced++;
            console.log(`Created label: ${stage.name} -> ${labelTitle}`);
          } catch (error: any) {
            // Ignorar erro 422 (label já existe)
            if (error.message?.includes('422')) {
              skipped++;
              console.log(`Label already exists: ${stage.name}`);
            } else {
              errors.push(`${stage.name}: ${error.message}`);
              console.error(`Failed to create label ${stage.name}:`, error.message);
            }
          }
        }

        console.log(`Sync completed: ${synced} created, ${skipped} skipped, ${errors.length} errors`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            synced,
            skipped,
            total: stages?.length || 0,
            errors: errors.length > 0 ? errors : undefined,
            message: `Sincronizado! ${synced} etiquetas criadas, ${skipped} já existiam.`
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in chatwoot-sync:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
