
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Brokerage } from '@/types';

export function useSupabaseBrokerages() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 🚀 **REACT QUERY COM OTIMIZAÇÃO**
  const { data: brokerages = [], isLoading: loading, error } = useQuery({
    queryKey: ['brokerages', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('brokerages')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching brokerages:', error);
        throw error;
      }

      const formattedBrokerages: Brokerage[] = data?.map((brokerage: any) => ({
        id: brokerage.id,
        name: brokerage.name,
        cnpj: brokerage.cnpj,
        susep_code: brokerage.susep_code,
        logo_url: brokerage.logo_url,
        financial_settings: brokerage.financial_settings,
        createdAt: brokerage.created_at,
      })) || [];

      return formattedBrokerages;
    },
    enabled: !!user,
    // 🚀 **OTIMIZAÇÃO DE PERFORMANCE**
    staleTime: 10 * 60 * 1000, // 10 minutos
  });

  // 🎯 **MUTATIONS COM INVALIDAÇÃO AUTOMÁTICA**
  const addBrokerageMutation = useMutation({
    mutationFn: async (brokerageData: Omit<Brokerage, 'id' | 'createdAt'>) => {
      if (!user) throw new Error('User not authenticated');

      // Generate slug from name
      const generatedSlug = brokerageData.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-');
      
      const { data, error } = await supabase
        .from('brokerages')
        .insert({
          user_id: user.id,
          name: brokerageData.name,
          cnpj: brokerageData.cnpj || null,
          susep_code: brokerageData.susep_code || null,
          logo_url: brokerageData.logo_url || null,
          slug: generatedSlug,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating brokerage:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brokerages'] });
    },
  });

  const updateBrokerageMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Brokerage> }) => {
      if (!user) throw new Error('User not authenticated');

      // 🔧 FIX: Construir objeto apenas com campos definidos para não sobrescrever com undefined
      const updateData: Record<string, any> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.cnpj !== undefined) updateData.cnpj = updates.cnpj;
      if (updates.susep_code !== undefined) updateData.susep_code = updates.susep_code;
      if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url;
      if (updates.financial_settings !== undefined) updateData.financial_settings = updates.financial_settings;

      if (Object.keys(updateData).length === 0) {
        throw new Error('No valid fields to update');
      }

      const { data, error } = await supabase
        .from('brokerages')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating brokerage:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brokerages'] });
    },
  });

  const deleteBrokerageMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('brokerages')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting brokerage:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brokerages'] });
    },
  });

  return {
    brokerages,
    loading,
    error,
    addBrokerage: addBrokerageMutation.mutateAsync,
    updateBrokerage: (id: number, updates: Partial<Brokerage>) => 
      updateBrokerageMutation.mutateAsync({ id, updates }),
    deleteBrokerage: deleteBrokerageMutation.mutateAsync,
    isAdding: addBrokerageMutation.isPending,
    isUpdating: updateBrokerageMutation.isPending,
    isDeleting: deleteBrokerageMutation.isPending,
  };
}
