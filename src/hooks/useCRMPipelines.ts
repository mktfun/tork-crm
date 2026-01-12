import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CRMPipeline {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface CreatePipelineData {
  name: string;
  description?: string;
  is_default?: boolean;
  createDefaultStages?: boolean;
}

const DEFAULT_STAGES = [
  { name: 'Novo Lead', color: '#3B82F6', chatwoot_label: 'lead_novo', position: 0 },
  { name: 'Em Contato', color: '#F59E0B', chatwoot_label: 'em_contato', position: 1 },
  { name: 'Proposta Enviada', color: '#8B5CF6', chatwoot_label: 'proposta_enviada', position: 2 },
  { name: 'Negociação', color: '#EC4899', chatwoot_label: 'negociacao', position: 3 },
  { name: 'Fechado Ganho', color: '#10B981', chatwoot_label: 'fechado_ganho', position: 4 },
  { name: 'Perdido', color: '#EF4444', chatwoot_label: 'perdido', position: 5 }
];

export function useCRMPipelines() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const pipelinesQuery = useQuery({
    queryKey: ['crm-pipelines', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select('*')
        .eq('user_id', user!.id)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as CRMPipeline[];
    },
    enabled: !!user
  });

  const createPipeline = useMutation({
    mutationFn: async ({ name, description, is_default = false, createDefaultStages = true }: CreatePipelineData) => {
      // Se for default, desmarcar o atual default
      if (is_default) {
        await supabase
          .from('crm_pipelines')
          .update({ is_default: false })
          .eq('user_id', user!.id)
          .eq('is_default', true);
      }

      const currentPipelines = pipelinesQuery.data || [];
      const maxPosition = currentPipelines.length;

      // Criar o pipeline
      const { data: pipeline, error } = await supabase
        .from('crm_pipelines')
        .insert({
          user_id: user!.id,
          name,
          description: description || null,
          position: maxPosition,
          is_default
        })
        .select()
        .single();

      if (error) throw error;

      // Criar etapas padrão se solicitado
      if (createDefaultStages) {
        const stagesToInsert = DEFAULT_STAGES.map(stage => ({
          ...stage,
          user_id: user!.id,
          pipeline_id: pipeline.id
        }));

        const { error: stagesError } = await supabase
          .from('crm_stages')
          .insert(stagesToInsert);

        if (stagesError) {
          console.error('Erro ao criar etapas padrão:', stagesError);
          // Não falha a criação do pipeline se as etapas falharem
        }
      }

      return pipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      toast.success('Funil criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar funil');
      console.error(error);
    }
  });

  const updatePipeline = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMPipeline> & { id: string }) => {
      // Se estiver definindo como default, desmarcar o atual
      if (updates.is_default) {
        await supabase
          .from('crm_pipelines')
          .update({ is_default: false })
          .eq('user_id', user!.id)
          .eq('is_default', true)
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('crm_pipelines')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
      toast.success('Funil atualizado!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar funil');
      console.error(error);
    }
  });

  const deletePipeline = useMutation({
    mutationFn: async (pipelineId: string) => {
      const pipeline = pipelinesQuery.data?.find(p => p.id === pipelineId);
      
      if (pipeline?.is_default) {
        throw new Error('Não é possível excluir o funil padrão. Defina outro como padrão primeiro.');
      }

      // Verificar se há deals ativos nas etapas deste pipeline
      const { data: stages } = await supabase
        .from('crm_stages')
        .select('id')
        .eq('pipeline_id', pipelineId);

      if (stages && stages.length > 0) {
        const stageIds = stages.map(s => s.id);
        const { count, error: countError } = await supabase
          .from('crm_deals')
          .select('*', { count: 'exact', head: true })
          .in('stage_id', stageIds);

        if (countError) throw countError;

        if (count && count > 0) {
          throw new Error(`Existem ${count} negócio(s) neste funil. Mova-os para outro funil primeiro.`);
        }
      }

      const { error } = await supabase
        .from('crm_pipelines')
        .delete()
        .eq('id', pipelineId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      toast.success('Funil removido!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao remover funil');
      console.error(error);
    }
  });

  const setDefaultPipeline = useMutation({
    mutationFn: async (pipelineId: string) => {
      // Desmarcar atual default
      await supabase
        .from('crm_pipelines')
        .update({ is_default: false })
        .eq('user_id', user!.id)
        .eq('is_default', true);

      // Marcar novo default
      const { data, error } = await supabase
        .from('crm_pipelines')
        .update({ is_default: true })
        .eq('id', pipelineId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
      toast.success('Funil padrão atualizado!');
    },
    onError: (error: any) => {
      toast.error('Erro ao definir funil padrão');
      console.error(error);
    }
  });

  const reorderPipelines = useMutation({
    mutationFn: async (pipelineIds: string[]) => {
      const updates = pipelineIds.map((id, index) =>
        supabase
          .from('crm_pipelines')
          .update({ position: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao reordenar funis');
      console.error(error);
    }
  });

  return {
    pipelines: pipelinesQuery.data || [],
    isLoading: pipelinesQuery.isLoading,
    createPipeline,
    updatePipeline,
    deletePipeline,
    setDefaultPipeline,
    reorderPipelines
  };
}
