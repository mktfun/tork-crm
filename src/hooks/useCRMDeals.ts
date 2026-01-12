import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface CRMStage {
  id: string;
  user_id: string;
  pipeline_id: string | null;
  name: string;
  color: string;
  chatwoot_label: string | null;
  position: number;
  created_at: string;
}

export interface CRMDeal {
  id: string;
  user_id: string;
  client_id: string | null;
  stage_id: string;
  chatwoot_conversation_id: number | null;
  title: string;
  value: number;
  expected_close_date: string | null;
  notes: string | null;
  sync_token: string | null;
  last_sync_source: 'crm' | 'chatwoot' | null;
  position: number;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
}

const DEFAULT_STAGES = [
  { name: 'Novo Lead', color: '#3B82F6', chatwoot_label: 'lead_novo', position: 0 },
  { name: 'Em Contato', color: '#F59E0B', chatwoot_label: 'em_contato', position: 1 },
  { name: 'Proposta Enviada', color: '#8B5CF6', chatwoot_label: 'proposta_enviada', position: 2 },
  { name: 'Negociação', color: '#EC4899', chatwoot_label: 'negociacao', position: 3 },
  { name: 'Fechado Ganho', color: '#10B981', chatwoot_label: 'fechado_ganho', position: 4 },
  { name: 'Perdido', color: '#EF4444', chatwoot_label: 'perdido', position: 5 }
];

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

export { PRESET_COLORS };

export function useCRMStages(pipelineId: string | null = null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const stagesQuery = useQuery({
    queryKey: ['crm-stages', user?.id, pipelineId],
    queryFn: async () => {
      let query = supabase
        .from('crm_stages')
        .select('*')
        .eq('user_id', user!.id);

      // Se pipelineId for fornecido, filtrar por ele
      if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId);
      }

      const { data, error } = await query.order('position', { ascending: true });

      if (error) throw error;
      return data as CRMStage[];
    },
    enabled: !!user
  });

  const initializeStages = useMutation({
    mutationFn: async (targetPipelineId?: string) => {
      const pId = targetPipelineId || pipelineId;
      
      if (!pId) {
        throw new Error('Pipeline ID é obrigatório para criar etapas');
      }

      const stagesToInsert = DEFAULT_STAGES.map(stage => ({
        ...stage,
        user_id: user!.id,
        pipeline_id: pId
      }));

      const { data, error } = await supabase
        .from('crm_stages')
        .insert(stagesToInsert)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      toast.success('Etapas do funil criadas!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar etapas');
      console.error(error);
    }
  });

  const createStage = useMutation({
    mutationFn: async (stage: { name: string; color: string; pipeline_id?: string }) => {
      const pId = stage.pipeline_id || pipelineId;
      
      if (!pId) {
        throw new Error('Pipeline ID é obrigatório para criar etapa');
      }

      const currentStages = stagesQuery.data || [];
      const maxPosition = currentStages.length;

      const { data, error } = await supabase
        .from('crm_stages')
        .insert({
          user_id: user!.id,
          pipeline_id: pId,
          name: stage.name,
          color: stage.color,
          chatwoot_label: stage.name.toLowerCase().replace(/\s+/g, '_'),
          position: maxPosition
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      toast.success('Etapa criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar etapa');
      console.error(error);
    }
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMStage> & { id: string }) => {
      const updateData: any = { ...updates };
      if (updates.name) {
        updateData.chatwoot_label = updates.name.toLowerCase().replace(/\s+/g, '_');
      }

      const { data, error } = await supabase
        .from('crm_stages')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      toast.success('Etapa atualizada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar etapa');
      console.error(error);
    }
  });

  const deleteStage = useMutation({
    mutationFn: async (stageId: string) => {
      // Check if stage has deals
      const { count, error: countError } = await supabase
        .from('crm_deals')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stageId);

      if (countError) throw countError;

      if (count && count > 0) {
        throw new Error(`Existem ${count} negócio(s) nesta etapa. Mova-os para outra etapa primeiro.`);
      }

      const { error } = await supabase
        .from('crm_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      toast.success('Etapa removida!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao remover etapa');
      console.error(error);
    }
  });

  const reorderStages = useMutation({
    mutationFn: async (stageIds: string[]) => {
      const updates = stageIds.map((id, index) =>
        supabase
          .from('crm_stages')
          .update({ position: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao reordenar etapas');
      console.error(error);
    }
  });

  return {
    stages: stagesQuery.data || [],
    isLoading: stagesQuery.isLoading,
    initializeStages,
    createStage,
    updateStage,
    deleteStage,
    reorderStages
  };
}

export function useCRMDeals(pipelineId: string | null = null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Primeiro buscar as stages do pipeline para filtrar deals
  const { stages } = useCRMStages(pipelineId);
  const stageIds = stages.map(s => s.id);

  const dealsQuery = useQuery({
    queryKey: ['crm-deals', user?.id, pipelineId, stageIds],
    queryFn: async () => {
      let query = supabase
        .from('crm_deals')
        .select(`
          *,
          client:clientes(id, name, phone, email)
        `)
        .eq('user_id', user!.id);

      // Se temos stageIds, filtrar por eles
      if (pipelineId && stageIds.length > 0) {
        query = query.in('stage_id', stageIds);
      }

      const { data, error } = await query.order('position', { ascending: true });

      if (error) throw error;
      return data as CRMDeal[];
    },
    enabled: !!user && (pipelineId === null || stageIds.length > 0)
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('crm-deals-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_deals',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('CRM Deal change:', payload);
          queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const createDeal = useMutation({
    mutationFn: async (deal: Partial<CRMDeal>) => {
      const { data, error } = await supabase
        .from('crm_deals')
        .insert({
          title: deal.title!,
          stage_id: deal.stage_id!,
          client_id: deal.client_id || null,
          value: deal.value || 0,
          expected_close_date: deal.expected_close_date || null,
          notes: deal.notes || null,
          position: deal.position || 0,
          user_id: user!.id,
          sync_token: crypto.randomUUID(),
          last_sync_source: 'crm' as const
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Negócio criado!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar negócio');
      console.error(error);
    }
  });

  const updateDeal = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMDeal> & { id: string }) => {
      const newSyncToken = crypto.randomUUID();
      
      const { data, error } = await supabase
        .from('crm_deals')
        .update({
          ...updates,
          sync_token: newSyncToken,
          last_sync_source: 'crm'
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { data, newSyncToken, stageChanged: !!updates.stage_id };
    },
    onSuccess: async ({ data, newSyncToken, stageChanged }) => {
      console.log('📝 Updating Deal:', data.id, 'stage_id:', data.stage_id);
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      
      // Sync com Tork se a etapa mudou
      if (stageChanged && data.stage_id) {
        console.log('🔄 Stage changed! Syncing to Tork:', { deal_id: data.id, new_stage_id: data.stage_id });
        toast.promise(
          supabase.functions.invoke('chatwoot-sync', {
            body: {
              action: 'update_deal_stage',
              deal_id: data.id,
              new_stage_id: data.stage_id,
              sync_token: newSyncToken
            }
          }),
          {
            loading: 'Sincronizando nova etapa...',
            success: 'Etapa atualizada no Tork!',
            error: 'Erro ao sincronizar etapa'
          }
        );
      }
      
      // Always create audit note for any update (non-blocking)
      if (data.client_id) {
        supabase.functions.invoke('chatwoot-sync', {
          body: { action: 'sync_deal_attributes', deal_id: data.id }
        }).then(response => {
          console.log('📬 Tork audit note sync:', response);
        }).catch(err => {
          console.warn('Failed to sync deal update note:', err);
        });
      }
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar negócio');
      console.error(error);
    }
  });

  const deleteDeal = useMutation({
    mutationFn: async (deal: { id: string; title: string; client_id: string | null }) => {
      const { error } = await supabase
        .from('crm_deals')
        .delete()
        .eq('id', deal.id);

      if (error) throw error;
      return deal; // Return for onSuccess
    },
    onSuccess: async (deletedDeal) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Negócio removido');
      
      // Sync deletion to Tork (non-blocking)
      if (deletedDeal.client_id) {
        supabase.functions.invoke('chatwoot-sync', {
          body: {
            action: 'delete_deal',
            deal_title: deletedDeal.title,
            client_id: deletedDeal.client_id
          }
        }).then(response => {
          if (response.data?.success) {
            toast.success('Histórico atualizado no Tork', { id: 'tork-delete' });
          }
        }).catch(err => {
          console.warn('Failed to sync deletion to Tork:', err);
        });
      }
    },
    onError: (error: any) => {
      toast.error('Erro ao remover negócio');
      console.error(error);
    }
  });

  const moveDeal = useMutation({
    mutationFn: async ({ dealId, newStageId, newPosition }: { dealId: string; newStageId: string; newPosition: number }) => {
      const newSyncToken = crypto.randomUUID();
      
      const { data, error } = await supabase
        .from('crm_deals')
        .update({
          stage_id: newStageId,
          position: newPosition,
          sync_token: newSyncToken,
          last_sync_source: 'crm'
        })
        .eq('id', dealId)
        .select()
        .single();

      if (error) throw error;

      return { data, newSyncToken };
    },
    onSuccess: async ({ data, newSyncToken }) => {
      console.log('🚀 Moving Deal:', data.id, 'to Stage:', data.stage_id);
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      
      // Validar que stage_id existe antes de sincronizar
      if (!data.stage_id) {
        console.error('❌ stage_id is undefined! Cannot sync to Tork.');
        return;
      }
      
      console.log('📦 Invoking tork-sync:', { deal_id: data.id, new_stage_id: data.stage_id, sync_token: newSyncToken });
      
      // Sync com Tork com feedback visual
      toast.promise(
        supabase.functions.invoke('chatwoot-sync', {
          body: {
            action: 'update_deal_stage',
            deal_id: data.id,
            new_stage_id: data.stage_id,
            sync_token: newSyncToken
          }
        }).then(response => {
          console.log('📬 Tork sync response:', response);
          if (response.error) {
            throw new Error(response.error.message || 'Erro na sincronização');
          }
          if (response.data && !response.data.success) {
            throw new Error(response.data.message || 'Sincronização falhou');
          }
          return response;
        }),
        {
          loading: 'Sincronizando etapa...',
          success: (response) => {
            const data = response.data;
            if (data?.warnings) {
              return `Etapa atualizada com avisos: ${data.warnings}`;
            }
            return 'Etapa atualizada no Tork!';
          },
          error: (err) => `Erro: ${err.message}`
        }
      );
    }
  });

  return {
    deals: dealsQuery.data || [],
    isLoading: dealsQuery.isLoading,
    createDeal,
    updateDeal,
    deleteDeal,
    moveDeal
  };
}
