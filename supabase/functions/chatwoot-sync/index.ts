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

// Função helper para normalizar nomes de etiquetas (remove acentos, lowercase, trim)
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, '_'); // Espaços viram underscores
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
    console.log('No Chat Tork config found for user:', userId);
    return null;
  }

  if (!data.chatwoot_url || !data.chatwoot_api_key || !data.chatwoot_account_id) {
    console.log('Incomplete Chat Tork config for user:', userId);
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
    throw new Error(`Chat Tork API error: ${response.status} - ${errorText}`);
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
          message: 'Chat Tork not configured. Please add your credentials in Settings.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      // ========== VALIDATE CONNECTION ==========
      case 'validate': {
        console.log('Validating Chat Tork connection...');
        
        try {
          // GET para listar inboxes (endpoint leve que valida autenticação)
          const inboxes = await chatwootRequest(config, '/inboxes');
          
          const inboxCount = inboxes?.payload?.length || inboxes?.length || 0;
          console.log('Connection valid, found inboxes:', inboxCount);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Chat Tork conectado! ${inboxCount} inbox(es) encontrados.`,
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

        // 2. Verificar/recuperar conversa vinculada
        let conversationId = deal.chatwoot_conversation_id;

        if (!conversationId) {
          console.log(`🔍 Deal [${deal_id}] missing conversation ID, attempting recovery via contact...`);
          
          const clientContactId = deal.client?.chatwoot_contact_id;
          
          if (clientContactId) {
            console.log(`🔗 Buscando conversas do contato ${clientContactId}...`);
            
            try {
              const conversations = await chatwootRequest(
                config,
                `/contacts/${clientContactId}/conversations`
              );
              
              if (conversations.payload?.length > 0) {
                conversationId = conversations.payload[0].id;
                console.log(`✅ Conversa recuperada: ${conversationId}`);
                
                // AUTO-REPARO: Salvar o ID no deal para futuras sincronizações
                const { error: updateError } = await supabase
                  .from('crm_deals')
                  .update({ chatwoot_conversation_id: conversationId })
                  .eq('id', deal_id);
                
                if (updateError) {
                  console.warn(`⚠️ Erro ao salvar conversation_id no deal:`, updateError.message);
                } else {
                  console.log(`💾 Conversation ID salvo no deal (auto-reparo)`);
                }
          } else {
            console.log(`⚠️ Contato ${clientContactId} não tem conversas abertas no Chat Tork`);
          }
        } catch (convError: any) {
          console.warn(`❌ Erro ao buscar conversas do contato:`, convError.message);
        }
      } else {
        console.log(`⚠️ Cliente não tem chatwoot_contact_id, sincronize o cliente primeiro`);
          }
          
        // Se ainda não tem conversa após recuperação, retornar erro informativo
        if (!conversationId) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'Nenhuma conversa ativa encontrada para este cliente no Chat Tork',
              hint: 'Inicie uma conversa com o cliente no Chat Tork ou sincronize o negócio novamente.'
            }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        }

        // 3. Buscar TODAS as etapas do usuário para ter a lista completa de labels
        const { data: allStages } = await supabase
          .from('crm_stages')
          .select('id, name, chatwoot_label')
          .eq('user_id', user.id);

        // Criar mapa de labels normalizadas -> label original do CRM
        const stageLabelsMap = new Map<string, string>();
        (allStages || []).forEach(s => {
          const originalLabel = s.chatwoot_label || s.name.toLowerCase().replace(/\s+/g, '_');
          const normalizedLabel = normalizeLabel(originalLabel);
          stageLabelsMap.set(normalizedLabel, originalLabel);
        });
        
        const allNormalizedStageLabels = Array.from(stageLabelsMap.keys());

        console.log('🗂️ Stage labels map (normalized -> original):', Object.fromEntries(stageLabelsMap));

        // 4. Buscar a nova etapa pelo ID recebido
        const newStage = allStages?.find(s => s.id === new_stage_id);
        const newLabel = newStage?.chatwoot_label || newStage?.name?.toLowerCase().replace(/\s+/g, '_');
        const newLabelNormalized = newLabel ? normalizeLabel(newLabel) : null;

        if (!newLabel || !newLabelNormalized) {
          console.log('❌ New stage label not found for:', new_stage_id);
          return new Response(
            JSON.stringify({ success: false, message: 'New stage label not found' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // 5. Buscar etiquetas atuais da conversa no Chatwoot
          const conversation = await chatwootRequest(
            config,
            `/conversations/${conversationId}`
          );
          const currentLabels: string[] = conversation.labels || [];

          console.log('📋 Etiquetas encontradas na conversa:', currentLabels);
          console.log('🏷️ Todas etiquetas de etapas CRM (normalizadas):', allNormalizedStageLabels);
          console.log('🆕 Nova etiqueta a aplicar:', newLabel, '(normalizada:', newLabelNormalized, ')');

          // 6. IDENTIFICAR ETIQUETAS A REMOVER
          // Para cada label na conversa, verificar se sua versão normalizada está na lista de etapas
          // MAS não é a nova etapa. GUARDAR o nome EXATO que veio do Chatwoot para o DELETE.
          const labelsToRemove: string[] = [];
          const preservedLabels: string[] = [];

          for (const label of currentLabels) {
            const labelNormalized = normalizeLabel(label);
            
            if (allNormalizedStageLabels.includes(labelNormalized)) {
              // É uma etiqueta de etapa do CRM
              if (labelNormalized !== newLabelNormalized) {
                // Não é a nova etapa, então deve ser removida
                labelsToRemove.push(label); // Usa o nome EXATO do Chatwoot
                console.log(`🗑️ Marcada para remoção: "${label}" (normalizada: ${labelNormalized})`);
              } else {
                // É a nova etapa, preservar
                preservedLabels.push(label);
                console.log(`✓ Nova etapa já existe: "${label}"`);
              }
            } else {
              // Não é etiqueta de etapa (ex: "vip", "urgente"), preservar
              preservedLabels.push(label);
              console.log(`✓ Preservada (não é etapa): "${label}"`);
            }
          }

          console.log('🔴 Etiquetas marcadas para remoção:', labelsToRemove);
          console.log('🟢 Etiquetas preservadas:', preservedLabels);

          // 7. REMOVER as etiquetas antigas uma a uma (usando nome EXATO)
          for (const labelToRemove of labelsToRemove) {
            try {
              const encodedLabel = encodeURIComponent(labelToRemove);
              console.log(`🗑️ Removendo etiqueta: "${labelToRemove}" (encoded: ${encodedLabel})`);
              
              await chatwootRequest(
                config,
                `/conversations/${conversationId}/labels/${encodedLabel}`,
                'DELETE'
              );
              console.log(`✅ Etiqueta removida com sucesso: "${labelToRemove}"`);
            } catch (deleteError: any) {
              console.warn(`⚠️ Não foi possível remover "${labelToRemove}":`, deleteError.message);
              // Continua mesmo se falhar uma
            }
          }

          // 8. ADICIONAR a nova etiqueta se ainda não existe
          const alreadyHasNewLabel = currentLabels.some(
            l => normalizeLabel(l) === newLabelNormalized
          );

          if (!alreadyHasNewLabel) {
            console.log(`➕ Adicionando nova etiqueta: "${newLabel}"`);
            await chatwootRequest(
              config,
              `/conversations/${conversationId}/labels`,
              'POST',
              { labels: [newLabel] }
            );
            console.log(`✅ Etiqueta adicionada: "${newLabel}"`);
          } else {
            console.log(`ℹ️ Etiqueta "${newLabel}" já existe na conversa`);
          }

          // 9. Verificação: Buscar labels finais para confirmar
          const updatedConversation = await chatwootRequest(
            config,
            `/conversations/${conversationId}`
          );
          const confirmedLabels: string[] = updatedConversation.labels || [];

          console.log('🏁 Etiquetas finais após atualização:', confirmedLabels);

          // Verificar se a remoção funcionou
          const stillHasOldLabels = labelsToRemove.filter((old: string) => 
            confirmedLabels.some((c: string) => normalizeLabel(c) === normalizeLabel(old))
          );
          
          if (stillHasOldLabels.length > 0) {
            console.warn('⚠️ Algumas etiquetas antigas ainda estão presentes:', stillHasOldLabels);
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Etapa atualizada no Chat Tork',
              previous_labels: currentLabels,
              removed_labels: labelsToRemove,
              preserved_labels: preservedLabels,
              new_label: newLabel,
              final_labels: confirmedLabels,
              warnings: stillHasOldLabels.length > 0 ? `Etiquetas não removidas: ${stillHasOldLabels.join(', ')}` : null
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: any) {
          console.error('❌ Falha ao atualizar etiquetas:', error);
          return new Response(
            JSON.stringify({ success: false, message: `Erro no Chat Tork: ${error.message}` }),
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
          
          // Robust color handling - ensure valid hex, never use black
          let rawColor = stage.color || '#3B82F6';
          // Remove # if present
          let labelColor = rawColor.replace('#', '').toUpperCase();
          // Validate hex format (6 characters)
          if (!/^[0-9A-F]{6}$/i.test(labelColor)) {
            labelColor = '3B82F6'; // Default to blue if invalid
          }
          // Never use black as it's not visible
          if (labelColor === '000000') {
            labelColor = '3B82F6';
          }
          
          console.log('Processing label:', labelTitle, 'color:', labelColor, '(original:', rawColor, ')');
          
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

          // ✅ PERSISTIR conversation_id no deal para futuras sincronizações
          if (conversationId) {
            const { error: saveConvError } = await supabase
              .from('crm_deals')
              .update({ chatwoot_conversation_id: conversationId })
              .eq('id', deal_id);
            
            if (saveConvError) {
              console.warn('⚠️ Erro ao salvar conversation_id no deal:', saveConvError.message);
            } else {
              console.log('✅ Conversation ID linked to Deal:', conversationId);
            }
          }
        }

        // Create audit note for deal creation/update
        if (chatwootContactId) {
          try {
            // Format value as BRL currency
            const valorFormatado = new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(deal.value || 0);
            
            const noteContent = `🚀 [CRM] Negócio Atualizado\n📋 Título: ${deal.title}\n💰 Valor: ${valorFormatado}\n📊 Etapa: ${deal.stage?.name || 'Desconhecido'}`;
            
            await chatwootRequest(
              config,
              `/contacts/${chatwootContactId}/notes`,
              'POST',
              { note: { content: noteContent } }
            );
            console.log('Chat Tork: Created audit note for contact:', chatwootContactId);
          } catch (noteError: any) {
            console.warn('Failed to create audit note:', noteError.message);
            // Non-fatal, contact was created/found
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            chatwoot_contact_id: chatwootContactId,
            conversation_id: conversationId,
            message: 'Deal audit note created in Chat Tork' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ========== DELETE DEAL - Create removal audit note ==========
      case 'delete_deal': {
        const { deal_title, client_id } = body;

        if (!client_id) {
          return new Response(
            JSON.stringify({ success: false, message: 'client_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get client's chatwoot_contact_id
        const { data: client } = await supabase
          .from('clientes')
          .select('chatwoot_contact_id')
          .eq('id', client_id)
          .single();

        if (!client?.chatwoot_contact_id) {
          return new Response(
            JSON.stringify({ success: true, message: 'Client not synced to Chat Tork, no note created' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const noteContent = `🗑️ [CRM] Negócio Removido\n📋 Título: ${deal_title || 'Sem título'}`;
          
          await chatwootRequest(
            config,
            `/contacts/${client.chatwoot_contact_id}/notes`,
            'POST',
            { note: { content: noteContent } }
          );
          
          console.log('Chat Tork: Created deletion note for deal:', deal_title);
          
          return new Response(
            JSON.stringify({ success: true, message: 'Deletion note created in Chat Tork' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (noteError: any) {
          console.warn('Failed to create deletion note:', noteError.message);
          return new Response(
            JSON.stringify({ success: false, message: `Failed to create note: ${noteError.message}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
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
