import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  RecurringConfig, 
  RecurringConfigPayload, 
  ProjectedCashFlowPoint 
} from '@/types/recurring';

/**
 * Hook para buscar configurações recorrentes do usuário
 */
export function useRecurringConfigs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recurring-configs', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('financial_recurring_configs')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as RecurringConfig[];
    },
    enabled: !!user,
  });
}

/**
 * Hook para criar configuração recorrente
 */
export function useCreateRecurringConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RecurringConfigPayload) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('financial_recurring_configs')
        .insert({
          ...payload,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-configs'] });
      queryClient.invalidateQueries({ queryKey: ['projected-cashflow'] });
      toast.success('Configuração recorrente criada!');
    },
    onError: (error) => {
      console.error('Erro ao criar configuração:', error);
      toast.error('Erro ao criar configuração recorrente');
    },
  });
}

/**
 * Hook para atualizar configuração recorrente
 */
export function useUpdateRecurringConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<RecurringConfigPayload> & { id: string }) => {
      const { data, error } = await supabase
        .from('financial_recurring_configs')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-configs'] });
      queryClient.invalidateQueries({ queryKey: ['projected-cashflow'] });
      toast.success('Configuração atualizada!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar configuração:', error);
      toast.error('Erro ao atualizar configuração');
    },
  });
}

/**
 * Hook para deletar configuração recorrente
 */
export function useDeleteRecurringConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financial_recurring_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-configs'] });
      queryClient.invalidateQueries({ queryKey: ['projected-cashflow'] });
      toast.success('Configuração removida!');
    },
    onError: (error) => {
      console.error('Erro ao deletar configuração:', error);
      toast.error('Erro ao remover configuração');
    },
  });
}

/**
 * Hook para buscar projeção de fluxo de caixa
 */
export function useProjectedCashFlow(
  startDate: string, 
  endDate: string, 
  granularity: 'day' | 'week' | 'month' = 'day'
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['projected-cashflow', startDate, endDate, granularity, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_projected_cashflow' as any, {
        p_start_date: startDate,
        p_end_date: endDate,
        p_granularity: granularity,
      });

      if (error) {
        console.error('Erro ao buscar projeção:', error);
        throw error;
      }

      return (data || []) as ProjectedCashFlowPoint[];
    },
    enabled: !!user && !!startDate && !!endDate,
  });
}

/**
 * Hook para marcar uma ocorrência recorrente como realizada
 * (atualiza last_generated_date)
 */
export function useMarkRecurringAsRealized() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      configId, 
      realizationDate 
    }: { 
      configId: string; 
      realizationDate: string;
    }) => {
      const { error } = await supabase
        .from('financial_recurring_configs')
        .update({ last_generated_date: realizationDate })
        .eq('id', configId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-configs'] });
      queryClient.invalidateQueries({ queryKey: ['projected-cashflow'] });
    },
  });
}
