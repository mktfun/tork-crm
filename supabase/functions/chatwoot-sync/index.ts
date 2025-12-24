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

// Função helper para formatar telefone para E.164 (padrão internacional)
function formatPhoneToE164(phone: string | null): string | undefined {
  if (!phone) return undefined;
  
  // Remove tudo que não é número
  const digits = phone.replace(/\D/g, '');
  
  // Se já começa com +, assume que está formatado
  if (phone.startsWith('+')) {
    return '+' + digits;
  }
  
  // Se tem 10-11 dígitos, assume Brasil (+55)
  if (digits.length >= 10 && digits.length <= 11) {
    return `+55${digits}`;
  }
  
  // Se tem 12-13 dígitos, assume que já tem DDI
  if (digits.length >= 12) {
    return `+${digits}`;
  }
  
  // Retorna undefined se não conseguir formatar corretamente
  console.log('Could not format phone to E.164:', phone, '-> digits:', digits.length);
  return undefined;
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
  
  console.log(`Chatwoot ${method} ${endpoint}`);
  
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

  // DELETE retorna 204 No Content (sem body JSON)
  if (response.status === 204 || method === 'DELETE') {
    return { success: true };
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
      // ========== VALIDATE CONNECTION ==========
      case 'validate': {
        console.log('Validating Chatwoot connection...');
        
        try {
          // GET para listar inboxes (endpoint leve que valida autenticação)
          const inboxes = await chatwootRequest(config, '/inboxes');
          
          const inboxCount = inboxes?.payload?.length || inboxes?.length || 0;
          console.log('Connection valid, found inboxes:', inboxCount);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Chatwoot conectado! ${inboxCount} inbox(es) encontrados.`,
              inboxes: inboxCount
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: any) {
          console.error('Connection validation failed:', error);
          
          let message = 'Erro desconhecido';
          if (error.message?.includes('401')) {
            message = 'Token de API inválido';
          } else if (error.message?.includes('404')) {
            message = 'URL ou Account ID incorretos';
          } else if (error.message?.includes('fetch') || error.message?.includes('Failed')) {
            message = 'Não foi possível conectar à URL informada';
          } else {
            message = error.message;
          }
          
          return new Response(
            JSON.stringify({ success: false, message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // ========== UPDATE DEAL STAGE ==========
      case 'update_deal_stage': {
        const { deal_id, new_stage_id, sync_token } = body;

        // 1. Buscar o deal para pegar chatwoot_conversation_id
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

        // 2. Se não tem conversa vinculada, sucesso silencioso
        if (!deal.chatwoot_conversation_id) {
          console.log('No Chatwoot conversation linked to deal:', deal_id);
          return new Response(
            JSON.stringify({ success: true, message: 'No Chatwoot conversation to sync' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 3. Buscar TODAS as etapas do usuário para ter a lista completa de labels
        const { data: allStages } = await supabase
          .from('crm_stages')
          .select('id, name, chatwoot_label')
          .eq('user_id', user.id);

        const allStageLabels = (allStages || [])
          .map(s => (s.chatwoot_label || s.name.toLowerCase().replace(/\s+/g, '_')).toLowerCase())
          .filter(Boolean);

        // 4. Buscar a nova etapa pelo ID recebido
        const newStage = allStages?.find(s => s.id === new_stage_id);
        const newLabel = newStage?.chatwoot_label || newStage?.name?.toLowerCase().replace(/\s+/g, '_');

        if (!newLabel) {
          console.log('New stage label not found for:', new_stage_id);
          return new Response(
            JSON.stringify({ success: false, message: 'New stage label not found' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // 5. Buscar etiquetas atuais da conversa no Chatwoot
          const conversation = await chatwootRequest(
            config,
            `/conversations/${deal.chatwoot_conversation_id}`
          );
          const currentLabels: string[] = conversation.labels || [];

          console.log('📋 Current labels on conversation:', currentLabels);
          console.log('🏷️ All CRM stage labels (blacklist):', allStageLabels);
          console.log('🆕 New stage label to apply:', newLabel);

          // 6. ESTRATÉGIA ATÔMICA: Matemática de Conjuntos
          // Preservar labels que NÃO são etapas do CRM (ex: "vip", "urgente")
          const preservedLabels = currentLabels.filter(
            label => !allStageLabels.includes(label.toLowerCase())
          );

          // Lista final = Labels preservadas + Nova etapa
          const finalLabels = [...preservedLabels];
          if (!finalLabels.some(l => l.toLowerCase() === newLabel.toLowerCase())) {
            finalLabels.push(newLabel);
          }

          console.log('🧮 Math: Current', currentLabels, '- CRM stages =', preservedLabels, '+ new =', finalLabels);

          // 7. ATUALIZAÇÃO ATÔMICA: Único POST que substitui todas as labels
          try {
            await chatwootRequest(
              config,
              `/conversations/${deal.chatwoot_conversation_id}/labels`,
              'POST',
              { labels: finalLabels }
            );
            console.log('✅ Atomic POST successful with labels:', finalLabels);
          } catch (postError: any) {
            console.warn('⚠️ Atomic POST failed, trying fallback with parallel DELETE:', postError.message);
            
            // FALLBACK: DELETE paralelo das labels antigas + POST da nova
            const labelsToRemove = currentLabels.filter(
              label => allStageLabels.includes(label.toLowerCase()) && 
                       label.toLowerCase() !== newLabel.toLowerCase()
            );
            
            // DELETE em paralelo com silenciador de erro individual
            await Promise.all(
              labelsToRemove.map(label =>
                chatwootRequest(
                  config,
                  `/conversations/${deal.chatwoot_conversation_id}/labels/${encodeURIComponent(label)}`,
                  'DELETE'
                ).catch(err => console.warn(`Ignored delete error for "${label}":`, err.message))
              )
            );
            
            // Adiciona a nova
            await chatwootRequest(
              config,
              `/conversations/${deal.chatwoot_conversation_id}/labels`,
              'POST',
              { labels: [newLabel] }
            );
            console.log('✅ Fallback completed: removed', labelsToRemove, 'added', newLabel);
          }

          // 8. Verificação: Buscar labels finais para confirmar
          const updatedConversation = await chatwootRequest(
            config,
            `/conversations/${deal.chatwoot_conversation_id}`
          );
          const confirmedLabels = updatedConversation.labels || [];

          console.log('🏁 Final labels after update:', confirmedLabels);

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Stage label updated in Chatwoot (atomic)',
              previous_labels: currentLabels,
              preserved_labels: preservedLabels,
              new_label: newLabel,
              final_labels: confirmedLabels
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: any) {
          console.error('Failed to update labels:', error);
          return new Response(
            JSON.stringify({ success: false, message: error.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // ========== UPSERT CONTACT ==========
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
            // Create new contact with E.164 formatted phone
            const formattedPhone = formatPhoneToE164(client.phone);
            const newContact = await chatwootRequest(
              config,
              '/contacts',
              'POST',
              {
                name: client.name,
                email: client.email || undefined,
                phone_number: formattedPhone,
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

      // ========== SYNC STAGES (LABELS) ==========
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
        let updated = 0;
        const errors: string[] = [];

        console.log(`Syncing ${stages?.length || 0} stages to Chatwoot labels...`);

        // Buscar todas as etiquetas existentes no Chatwoot
        let existingLabels: any[] = [];
        try {
          const allLabels = await chatwootRequest(config, '/labels');
          existingLabels = allLabels.payload || allLabels || [];
          console.log('Found existing labels in Chatwoot:', existingLabels.length);
        } catch (e) {
          console.log('Could not fetch existing labels, will create all');
        }

        for (const stage of stages || []) {
          const labelTitle = stage.chatwoot_label || stage.name.toLowerCase().replace(/\s+/g, '_');
          const labelColor = (stage.color?.replace('#', '') || '3B82F6').toUpperCase();
          
          console.log('Processing label:', labelTitle, 'color:', labelColor);
          
          // Verificar se a etiqueta já existe
          const existingLabel = existingLabels.find(
            (l: any) => l.title?.toLowerCase() === labelTitle.toLowerCase()
          );
          
          if (existingLabel) {
            // ATUALIZAR a cor da etiqueta existente via PATCH
            try {
              await chatwootRequest(config, `/labels/${existingLabel.id}`, 'PATCH', {
                color: labelColor,
                description: `Etapa CRM: ${stage.name}`
              });
              updated++;
              console.log(`Updated label color: ${labelTitle} -> #${labelColor}`);
            } catch (updateError: any) {
              console.warn(`Could not update label ${labelTitle}:`, updateError.message);
              errors.push(`${stage.name}: ${updateError.message}`);
            }
          } else {
            // Criar nova etiqueta
            try {
              const response = await chatwootRequest(
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
              console.log(`Created label: ${stage.name} -> ${labelTitle}`, 'Response:', JSON.stringify(response));
            } catch (error: any) {
              // Tratar erro 422 (já existe) fazendo update
              if (error.message?.includes('422')) {
                try {
                  // Buscar novamente para pegar o ID
                  const refreshLabels = await chatwootRequest(config, '/labels');
                  const foundLabel = (refreshLabels.payload || refreshLabels || []).find(
                    (l: any) => l.title?.toLowerCase() === labelTitle.toLowerCase()
                  );
                  if (foundLabel) {
                    await chatwootRequest(config, `/labels/${foundLabel.id}`, 'PATCH', {
                      color: labelColor,
                      description: `Etapa CRM: ${stage.name}`
                    });
                    updated++;
                    console.log(`Updated existing label after 422: ${labelTitle}`);
                  }
                } catch (retryError: any) {
                  console.warn(`Could not update label after 422:`, retryError.message);
                }
              } else {
                errors.push(`${stage.name}: ${error.message}`);
                console.error(`Failed to create label ${stage.name}:`, error.message);
              }
            }
          }
        }

        console.log(`Sync completed: ${synced} created, ${updated} updated, ${errors.length} errors`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            synced,
            updated,
            total: stages?.length || 0,
            errors: errors.length > 0 ? errors : undefined,
            message: `Sincronização concluída! ${synced} criadas, ${updated} atualizadas no Chatwoot.`
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ========== SYNC DEAL ATTRIBUTES ==========
      case 'sync_deal_attributes': {
        const { deal_id } = body;

        if (!deal_id) {
          return new Response(
            JSON.stringify({ error: 'deal_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Syncing deal attributes to Chatwoot for deal:', deal_id);

        // Fetch deal with client and stage info
        const { data: deal, error: dealError } = await supabase
          .from('crm_deals')
          .select('*, client:clientes(*), stage:crm_stages(name, chatwoot_label)')
          .eq('id', deal_id)
          .eq('user_id', user.id)
          .single();

        if (dealError || !deal) {
          console.error('Deal not found:', dealError);
          return new Response(
            JSON.stringify({ error: 'Deal not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If no client linked, nothing to sync
        if (!deal.client_id || !deal.client) {
          console.log('No client linked to deal, skipping sync');
          return new Response(
            JSON.stringify({ success: true, message: 'No client to sync' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const client = deal.client;
        let chatwootContactId = client.chatwoot_contact_id;

        // If client doesn't have Chatwoot ID, try to find or create contact
        if (!chatwootContactId) {
          console.log('Creating/finding Chatwoot contact for client:', client.id);
          
          try {
            // 1. Buscar por EMAIL primeiro
            if (client.email) {
              try {
                const searchByEmail = await chatwootRequest(
                  config,
                  `/contacts/search?q=${encodeURIComponent(client.email)}`
                );
                if (searchByEmail.payload?.length > 0) {
                  chatwootContactId = searchByEmail.payload[0].id;
                  console.log('Found contact by email:', chatwootContactId);
                }
              } catch (e) {
                console.log('Email search failed, trying phone');
              }
            }

            // 2. Buscar por TELEFONE se não achou por email
            if (!chatwootContactId && client.phone) {
              const cleanPhone = client.phone.replace(/\D/g, '');
              try {
                const searchByPhone = await chatwootRequest(
                  config,
                  `/contacts/search?q=${encodeURIComponent(cleanPhone)}`
                );
                if (searchByPhone.payload?.length > 0) {
                  chatwootContactId = searchByPhone.payload[0].id;
                  console.log('Found contact by phone:', chatwootContactId);
                }
              } catch (e) {
                console.log('Phone search failed, will create new');
              }
            }

            // 3. Criar novo contato apenas se não encontrou
            if (!chatwootContactId) {
              const formattedPhone = formatPhoneToE164(client.phone);
              console.log('Creating contact with phone:', formattedPhone);
              
              try {
                const newContact = await chatwootRequest(
                  config,
                  '/contacts',
                  'POST',
                  {
                    name: client.name,
                    email: client.email || undefined,
                    phone_number: formattedPhone,
                    custom_attributes: {
                      source: 'crm_sync',
                      synced_at: new Date().toISOString()
                    }
                  }
                );
                chatwootContactId = newContact.payload?.contact?.id;
                console.log('Created new Chatwoot contact:', chatwootContactId);
              } catch (createError: any) {
                // Se der erro 422 (duplicata), tentar busca genérica por nome
                if (createError.message?.includes('422')) {
                  console.log('Contact exists (422), searching by name...');
                  try {
                    const searchByName = await chatwootRequest(
                      config,
                      `/contacts/search?q=${encodeURIComponent(client.name)}`
                    );
                    if (searchByName.payload?.length > 0) {
                      chatwootContactId = searchByName.payload[0].id;
                      console.log('Found contact by name after 422:', chatwootContactId);
                    }
                  } catch (e) {
                    console.log('Name search also failed');
                  }
                } else {
                  throw createError;
                }
              }
            }

            // Save Chatwoot ID back to client
            if (chatwootContactId) {
              await supabase
                .from('clientes')
                .update({
                  chatwoot_contact_id: chatwootContactId,
                  chatwoot_synced_at: new Date().toISOString()
                })
                .eq('id', client.id);
              console.log('Saved chatwoot_contact_id to client:', chatwootContactId);
            }
          } catch (contactError: any) {
            console.error('Failed to create/find Chatwoot contact:', contactError);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Failed to sync contact',
                details: contactError.message 
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Buscar/criar conversa para aplicar etiqueta
        let conversationId = null;
        
        if (chatwootContactId && deal.stage?.chatwoot_label) {
          // Buscar conversas do contato
          try {
            const conversations = await chatwootRequest(
              config,
              `/contacts/${chatwootContactId}/conversations`
            );
            
            if (conversations.payload?.length > 0) {
              // Usar a primeira conversa aberta ou a mais recente
              conversationId = conversations.payload[0].id;
              console.log('Found existing conversation:', conversationId);
            }
          } catch (convError) {
            console.log('No conversations found for contact');
          }

          // Se não tem conversa, criar uma nova
          if (!conversationId) {
            try {
              // Buscar o primeiro inbox disponível
              const inboxes = await chatwootRequest(config, '/inboxes');
              const inboxId = inboxes.payload?.[0]?.id || inboxes?.[0]?.id;
              
              if (inboxId) {
                console.log('Creating new conversation with inbox:', inboxId);
                const newConversation = await chatwootRequest(
                  config,
                  '/conversations',
                  'POST',
                  {
                    inbox_id: inboxId,
                    contact_id: chatwootContactId,
                    status: 'open'
                  }
                );
                conversationId = newConversation.id;
                console.log('Created new conversation:', conversationId);
              } else {
                console.warn('No inbox available to create conversation');
              }
            } catch (createConvError: any) {
              console.warn('Could not create conversation:', createConvError.message);
            }
          }

          // Aplicar etiqueta da etapa na conversa
          if (conversationId && deal.stage?.chatwoot_label) {
            try {
              await chatwootRequest(
                config,
                `/conversations/${conversationId}/labels`,
                'POST',
                { labels: [deal.stage.chatwoot_label] }
              );
              console.log('Applied stage label to conversation:', deal.stage.chatwoot_label);
            } catch (labelError: any) {
              console.warn('Could not apply label:', labelError.message);
            }
          }
        }

        // Update contact custom attributes with deal info
        if (chatwootContactId) {
          try {
            await chatwootRequest(
              config,
              `/contacts/${chatwootContactId}`,
              'PUT',
              {
                custom_attributes: {
                  deal_value: deal.value || 0,
                  expected_close_date: deal.expected_close_date || null,
                  crm_stage: deal.stage?.name || 'Desconhecido',
                  deal_title: deal.title,
                  last_sync: new Date().toISOString()
                }
              }
            );
            console.log('Updated Chatwoot contact attributes for:', chatwootContactId);
          } catch (updateError: any) {
            console.error('Failed to update contact attributes:', updateError);
            // Non-fatal, contact was created/found
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            chatwoot_contact_id: chatwootContactId,
            conversation_id: conversationId,
            message: 'Deal attributes synced to Chatwoot' 
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
