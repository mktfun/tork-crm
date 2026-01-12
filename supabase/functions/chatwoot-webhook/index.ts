import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chatwoot-signature',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Tork webhook received:', JSON.stringify(body, null, 2));

    const { event, account, conversation, contact } = body;

    if (!event || !account) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by account_id
    const { data: settings, error: settingsError } = await supabase
      .from('crm_settings')
      .select('user_id, chatwoot_webhook_secret')
      .eq('chatwoot_account_id', account.id.toString())
      .maybeSingle();

    if (settingsError || !settings) {
      console.log('No CRM settings found for account:', account.id);
      return new Response(
        JSON.stringify({ message: 'Account not linked' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = settings.user_id;
    console.log('Processing webhook for user:', userId);

    switch (event) {
      case 'conversation_updated': {
        if (!conversation) break;

        // Check if we have a deal linked to this conversation
        const { data: deal, error: dealError } = await supabase
          .from('crm_deals')
          .select('*, stage:crm_stages(*)')
          .eq('user_id', userId)
          .eq('chatwoot_conversation_id', conversation.id)
          .maybeSingle();

        if (!deal) {
          console.log('No deal found for conversation:', conversation.id);
          break;
        }

        // Check sync token to prevent loops
        if (body.sync_token && deal.sync_token === body.sync_token) {
          console.log('Ignoring self-triggered webhook for deal:', deal.id);
          break;
        }

        // Check for label changes
        const labels: string[] = conversation.labels || [];
        
        // Get all stages for this user
        const { data: stages } = await supabase
          .from('crm_stages')
          .select('*')
          .eq('user_id', userId);

        // Find matching stage by label
        const matchingStage = stages?.find(s => 
          s.chatwoot_label && labels.includes(s.chatwoot_label)
        );

        if (matchingStage && matchingStage.id !== deal.stage_id) {
          console.log('Updating deal stage from Tork:', deal.id, '->', matchingStage.name);
          
          await supabase
            .from('crm_deals')
            .update({
              stage_id: matchingStage.id,
              last_sync_source: 'chatwoot',
              sync_token: crypto.randomUUID()
            })
            .eq('id', deal.id);
        }
        break;
      }

      case 'contact_created': {
        if (!contact) break;

        // Check if contact already exists by email or phone
        const email = contact.email;
        const phone = contact.phone_number;

        let query = supabase
          .from('clientes')
          .select('id')
          .eq('user_id', userId);

        if (email) {
          query = query.eq('email', email);
        } else if (phone) {
          query = query.eq('phone', phone);
        } else {
          break; // Can't match without email or phone
        }

        const { data: existingClient } = await query.maybeSingle();

        if (existingClient) {
          // Link existing client
          await supabase
            .from('clientes')
            .update({
              chatwoot_contact_id: contact.id,
              chatwoot_synced_at: new Date().toISOString()
            })
            .eq('id', existingClient.id);
          console.log('Linked existing client to Tork contact:', existingClient.id);
        }
        break;
      }

      case 'conversation_created': {
        if (!conversation || !contact) break;

        // Auto-create deal from new conversation
        const { data: client } = await supabase
          .from('clientes')
          .select('id, name')
          .eq('user_id', userId)
          .eq('chatwoot_contact_id', contact.id)
          .maybeSingle();

        // Get first stage
        const { data: firstStage } = await supabase
          .from('crm_stages')
          .select('id')
          .eq('user_id', userId)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (firstStage) {
          // Check if deal already exists for this conversation
          const { data: existingDeal } = await supabase
            .from('crm_deals')
            .select('id')
            .eq('user_id', userId)
            .eq('chatwoot_conversation_id', conversation.id)
            .maybeSingle();

          if (!existingDeal) {
            const dealTitle = client?.name 
              ? `Nova conversa - ${client.name}`
              : `Conversa #${conversation.id}`;

            await supabase
              .from('crm_deals')
              .insert({
                user_id: userId,
                client_id: client?.id || null,
                stage_id: firstStage.id,
                chatwoot_conversation_id: conversation.id,
                title: dealTitle,
                position: 0,
                last_sync_source: 'chatwoot',
                sync_token: crypto.randomUUID()
              });
            console.log('Created deal from Tork conversation:', conversation.id);
          }
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in tork-webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
