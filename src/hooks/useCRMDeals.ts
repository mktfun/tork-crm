import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface CRMStage {
  id: string;
  user_id: string;
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

export function useCRMStages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const stagesQuery = useQuery({
    queryKey: ['crm-stages', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_stages')
        .select('*')
        .eq('user_id', user!.id)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as CRMStage[];
    },
    enabled: !!user
  });

  const initializeStages = useMutation({
    mutationFn: async () => {
      const stagesToInsert = DEFAULT_STAGES.map(stage => ({
        ...stage,
        user_id: user!.id
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

  return {
    stages: stagesQuery.data || [],
    isLoading: stagesQuery.isLoading,
    initializeStages
  };
}

export function useCRMDeals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const dealsQuery = useQuery({
    queryKey: ['crm-deals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select(`
          *,
          client:clientes(id, name, phone, email)
        `)
        .eq('user_id', user!.id)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as CRMDeal[];
    },
    enabled: !!user
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
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      
      // Sync com Chatwoot se a etapa mudou
      if (stageChanged) {
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
            success: 'Etapa atualizada no Chatwoot!',
            error: 'Erro ao sincronizar etapa'
          }
        );
      }
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar negócio');
      console.error(error);
    }
  });

  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_deals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Negócio removido');
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
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      
      // Sync com Chatwoot com feedback visual
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
          success: 'Etapa atualizada no Chatwoot!',
          error: 'Erro ao sincronizar etapa'
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
