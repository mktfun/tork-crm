import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// Tipos para os sinistros
export interface Sinistro {
  id: string;
  user_id: string;
  policy_id: string;
  client_id?: string;
  claim_number?: string;
  occurrence_date: string;
  report_date: string;
  claim_type: string;
  status: string;
  priority?: string;
  claim_amount?: number;
  approved_amount?: number;
  deductible_amount?: number;
  description: string;
  location_occurrence?: string;
  circumstances?: string;
  police_report_number?: string;
  evidence_urls?: string[];
  documents_checklist?: Record<string, any>;
  assigned_to?: string;
  producer_id?: string;
  brokerage_id?: number;
  company_id?: string;
  analysis_deadline?: string;
  resolution_date?: string;
  payment_date?: string;
  created_at: string;
  updated_at: string;
  // Dados relacionados (joins)
  client_name?: string;
  client_phone?: string;
  policy_number?: string;
  insurance_company?: string;
  producer_name?: string;
  brokerage_name?: string;
  company_name?: string;
}

export interface CreateSinistroData {
  policy_id: string;
  client_id?: string;
  occurrence_date: string;
  claim_type: string;
  description: string;
  location_occurrence?: string;
  circumstances?: string;
  police_report_number?: string;
  claim_amount?: number;
  deductible_amount?: number;
  priority?: string;
}

export interface UpdateSinistroData extends Partial<CreateSinistroData> {
  id: string;
  status?: string;
  approved_amount?: number;
  assigned_to?: string;
  analysis_deadline?: string;
  resolution_date?: string;
  payment_date?: string;
}

// Hook para buscar sinistros
export function useSinistros() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sinistros', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('sinistros_complete')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar sinistros:', error);
        throw error;
      }

      return data as Sinistro[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

// Hook para buscar um sinistro específico
export function useSinistro(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sinistro', id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('sinistros_complete')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Erro ao buscar sinistro:', error);
        throw error;
      }

      return data as Sinistro;
    },
    enabled: !!user?.id && !!id,
  });
}

// Hook para criar sinistro
export function useCreateSinistro() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSinistroData) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data: result, error } = await supabase
        .from('sinistros')
        .insert([{
          ...data,
          user_id: user.id,
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar sinistro:', error);
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      toast.success('Sinistro criado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao criar sinistro:', error);
      toast.error('Erro ao criar sinistro. Tente novamente.');
    },
  });
}

// Hook para atualizar sinistro
export function useUpdateSinistro() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateSinistroData) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { id, ...updateData } = data;

      const { data: result, error } = await supabase
        .from('sinistros')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar sinistro:', error);
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['sinistro'] });
      toast.success('Sinistro atualizado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar sinistro:', error);
      toast.error('Erro ao atualizar sinistro. Tente novamente.');
    },
  });
}

// Hook para deletar sinistro
export function useDeleteSinistro() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('sinistros')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao deletar sinistro:', error);
        throw error;
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      toast.success('Sinistro excluído com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao excluir sinistro:', error);
      toast.error('Erro ao excluir sinistro. Tente novamente.');
    },
  });
}

// Hook para buscar atividades de um sinistro
export function useSinistroActivities(sinistroId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sinistro-activities', sinistroId],
    queryFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('sinistro_activities')
        .select('*')
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar atividades:', error);
        throw error;
      }

      return data;
    },
    enabled: !!user?.id && !!sinistroId,
  });
}

// Hook para buscar documentos de um sinistro
export function useSinistroDocuments(sinistroId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sinistro-documents', sinistroId],
    queryFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('sinistro_documents')
        .select('*')
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar documentos:', error);
        throw error;
      }

      return data;
    },
    enabled: !!user?.id && !!sinistroId,
  });
}
