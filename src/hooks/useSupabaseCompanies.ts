
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Company } from '@/types';

interface CompanyWithRamosCount extends Company {
  ramos_count?: number;
}

export function useSupabaseCompanies() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 🚀 **REACT QUERY COM OTIMIZAÇÃO E CONTAGEM DE RAMOS**
  const { data: companies = [], isLoading: loading, error } = useQuery({
    queryKey: ['companies', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Usar a view otimizada que já inclui a contagem de ramos
      const { data, error } = await supabase
        .from('companies_with_ramos_count')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching companies:', error);
        throw error;
      }

      const formattedCompanies: CompanyWithRamosCount[] = data?.map((company: any) => ({
        id: company.id,
        name: company.name,
        createdAt: company.created_at,
        ramos_count: company.ramos_count || 0,
      })) || [];

      return formattedCompanies;
    },
    enabled: !!user,
    // 🚀 **OTIMIZAÇÃO DE PERFORMANCE** - Seguradoras não mudam muito
    staleTime: 15 * 60 * 1000, // 15 minutos
  });

  // 🎯 **MUTATIONS COM INVALIDAÇÃO AUTOMÁTICA**
  const addCompanyMutation = useMutation({
    mutationFn: async (companyData: Omit<Company, 'id' | 'createdAt'>) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('companies')
        .insert({
          user_id: user.id,
          name: companyData.name,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating company:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Company> }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('companies')
        .update({
          name: updates.name,
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating company:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting company:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  return {
    companies,
    loading,
    error,
    addCompany: addCompanyMutation.mutateAsync,
    updateCompany: (id: string, updates: Partial<Company>) => 
      updateCompanyMutation.mutateAsync({ id, updates }),
    deleteCompany: deleteCompanyMutation.mutateAsync,
    isAdding: addCompanyMutation.isPending,
    isUpdating: updateCompanyMutation.isPending,
    isDeleting: deleteCompanyMutation.isPending,
  };
}
