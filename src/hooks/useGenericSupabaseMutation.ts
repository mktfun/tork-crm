import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface MutationConfig {
  tableName: 'clientes' | 'apolices' | 'transactions' | 'appointments';
  queryKey: string;
  onSuccessMessage?: {
    add?: string;
    update?: string;
    delete?: string;
  };
}

export function useGenericSupabaseMutation(config: MutationConfig) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tableName, queryKey, onSuccessMessage } = config;

  // ADD mutation
  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: result, error } = await supabase
        .from(tableName)
        .insert([{ ...data, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [queryKey] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData([queryKey]);

      // Optimistically update
      queryClient.setQueryData([queryKey], (old: any) => {
        if (!old) return old;
        
        // Handle paginated data structure
        if (old.clients && Array.isArray(old.clients)) {
          return {
            ...old,
            clients: [{ ...newData, id: `temp-${Date.now()}` }, ...old.clients],
            totalCount: (old.totalCount || 0) + 1
          };
        }
        
        // Handle simple array
        if (Array.isArray(old)) {
          return [{ ...newData, id: `temp-${Date.now()}` }, ...old];
        }
        
        return old;
      });

      return { previousData };
    },
    onError: (err, newData, context) => {
      // Rollback optimistic update
      if (context?.previousData) {
        queryClient.setQueryData([queryKey], context.previousData);
      }
      console.error('Erro ao adicionar item:', err);
      toast.error('Erro ao adicionar item');
    },
    onSuccess: () => {
      toast.success(onSuccessMessage?.add || 'Item adicionado com sucesso');
    },
    onSettled: () => {
      // Always refetch to ensure data consistency
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  // UPDATE mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: result, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onMutate: async (updatedData) => {
      await queryClient.cancelQueries({ queryKey: [queryKey] });
      const previousData = queryClient.getQueryData([queryKey]);

      // Optimistically update
      queryClient.setQueryData([queryKey], (old: any) => {
        if (!old) return old;
        
        // Handle paginated data structure
        if (old.clients && Array.isArray(old.clients)) {
          return {
            ...old,
            clients: old.clients.map((item: any) =>
              item.id === updatedData.id ? { ...item, ...updatedData } : item
            )
          };
        }
        
        // Handle simple array
        if (Array.isArray(old)) {
          return old.map((item: any) =>
            item.id === updatedData.id ? { ...item, ...updatedData } : item
          );
        }
        
        return old;
      });

      return { previousData };
    },
    onError: (err, updatedData, context) => {
      if (context?.previousData) {
        queryClient.setQueryData([queryKey], context.previousData);
      }
      console.error('Erro ao atualizar item:', err);
      toast.error('Erro ao atualizar item');
    },
    onSuccess: () => {
      toast.success(onSuccessMessage?.update || 'Item atualizado com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  // DELETE mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return id;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: [queryKey] });
      const previousData = queryClient.getQueryData([queryKey]);

      // Optimistically update
      queryClient.setQueryData([queryKey], (old: any) => {
        if (!old) return old;
        
        // Handle paginated data structure
        if (old.clients && Array.isArray(old.clients)) {
          return {
            ...old,
            clients: old.clients.filter((item: any) => item.id !== deletedId),
            totalCount: Math.max((old.totalCount || 0) - 1, 0)
          };
        }
        
        // Handle simple array
        if (Array.isArray(old)) {
          return old.filter((item: any) => item.id !== deletedId);
        }
        
        return old;
      });

      return { previousData };
    },
    onError: (err, deletedId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData([queryKey], context.previousData);
      }
      console.error('Erro ao deletar item:', err);
      toast.error('Erro ao deletar item');
    },
    onSuccess: () => {
      toast.success(onSuccessMessage?.delete || 'Item removido com sucesso');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  return {
    // Functions
    addItem: addMutation.mutate,
    updateItem: updateMutation.mutate,
    deleteItem: deleteMutation.mutate,
    
    // Loading states
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    
    // General loading state
    isLoading: addMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    
    // Error states
    addError: addMutation.error,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
  };
}