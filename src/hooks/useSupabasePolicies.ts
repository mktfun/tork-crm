import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Policy } from '@/types';
import { gerarTransacaoDeComissao, gerarTransacaoDeComissaoERP } from '@/services/commissionService';

// Helper para buscar dados de cliente e ramo para descrição rica
async function fetchPolicyContext(clientId: string, ramoId?: string) {
  const [clientResult, ramoResult] = await Promise.all([
    supabase.from('clientes').select('name').eq('id', clientId).single(),
    ramoId ? supabase.from('ramos').select('nome').eq('id', ramoId).maybeSingle() : Promise.resolve({ data: null })
  ]);
  
  return {
    clientName: clientResult.data?.name || 'Cliente',
    ramoName: ramoResult.data?.nome || 'Seguro'
  };
}

export function useSupabasePolicies() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: policies = [], isLoading: loading, error } = useQuery({
    queryKey: ['policies', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('apolices')
        .select(`
          *,
          companies:insurance_company (
            id,
            name
          ),
          ramos:ramo_id (
            id,
            nome
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar apólices:', error.message, error);
        throw new Error(`Erro ao buscar apólices: ${error.message}`);
      }

      const formattedPolicies: Policy[] = data?.map((policy: any) => ({
        id: policy.id,
        clientId: policy.client_id,
        policyNumber: policy.policy_number || undefined,
        insuranceCompany: policy.insurance_company,
        type: policy.type,
        insuredAsset: policy.insured_asset,
        premiumValue: typeof policy.premium_value === 'string' ? parseFloat(policy.premium_value) : policy.premium_value,
        commissionRate: typeof policy.commission_rate === 'string' ? parseFloat(policy.commission_rate) : policy.commission_rate,
        status: policy.status as 'Orçamento' | 'Aguardando Apólice' | 'Ativa' | 'Cancelada' | 'Renovada',
        expirationDate: policy.expiration_date,
        pdfUrl: policy.pdf_url,
        createdAt: policy.created_at,
        pdfAnexado: policy.pdf_attached_name && policy.pdf_attached_data ? {
          nome: policy.pdf_attached_name,
          dados: policy.pdf_attached_data
        } : undefined,
        renewalStatus: policy.renewal_status as 'Pendente' | 'Em Contato' | 'Proposta Enviada' | 'Renovada' | 'Não Renovada' | undefined,
        producerId: policy.producer_id,
        brokerageId: policy.brokerage_id,
        startDate: policy.start_date,
        userId: policy.user_id,
        isBudget: policy.status === 'Orçamento',
        bonus_class: policy.bonus_class,
        automaticRenewal: policy.automatic_renewal,
        companies: policy.companies || undefined,
        ramos: policy.ramos || undefined
      })) || [];

      console.log('✅ Apólices carregadas:', formattedPolicies.length);
      return formattedPolicies;
    },
    enabled: !!user,
    staleTime: 3 * 60 * 1000,
    retry: (failureCount, error) => {
      console.log(`Tentativa ${failureCount} falhada:`, error);
      return failureCount < 3;
    },
  });

  const addPolicyMutation = useMutation({
    mutationFn: async (policyData: Omit<Policy, 'id' | 'createdAt'>) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Check if type is UUID (ramo_id) for proper field mapping
      const isRamoUuid = policyData.type && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(policyData.type);
      
      const { data, error } = await supabase
        .from('apolices')
        .insert([
          {
            user_id: user.id,
            client_id: policyData.clientId,
            policy_number: policyData.policyNumber || null,
            insurance_company: policyData.insuranceCompany,
            type: policyData.type,
            ramo_id: isRamoUuid ? policyData.type : null,
            insured_asset: policyData.insuredAsset || null,
            premium_value: policyData.premiumValue,
            commission_rate: policyData.commissionRate,
            status: policyData.status || 'Orçamento',
            expiration_date: policyData.expirationDate,
            pdf_url: policyData.pdfUrl || null,
            renewal_status: policyData.renewalStatus || null,
            producer_id: policyData.producerId || null,
            brokerage_id: policyData.brokerageId || null,
            start_date: policyData.startDate || null,
            bonus_class: policyData.bonus_class || null,
            automatic_renewal: policyData.automaticRenewal ?? true
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar apólice:', error);
        throw error;
      }

      const newPolicy: Policy = {
        id: data.id,
        clientId: data.client_id,
        policyNumber: data.policy_number || undefined,
        insuranceCompany: data.insurance_company,
        type: data.type,
        insuredAsset: data.insured_asset,
        premiumValue: typeof data.premium_value === 'string' ? parseFloat(data.premium_value) : data.premium_value,
        commissionRate: typeof data.commission_rate === 'string' ? parseFloat(data.commission_rate) : data.commission_rate,
        status: data.status as 'Orçamento' | 'Aguardando Apólice' | 'Ativa',
        expirationDate: data.expiration_date,
        pdfUrl: data.pdf_url,
        createdAt: data.created_at,
        renewalStatus: data.renewal_status as 'Pendente' | 'Em Contato' | 'Proposta Enviada' | 'Renovada' | 'Não Renovada' | undefined,
        producerId: data.producer_id,
        brokerageId: data.brokerage_id,
        startDate: data.start_date,
        userId: data.user_id,
        isBudget: data.status === 'Orçamento',
        bonus_class: data.bonus_class,
        automaticRenewal: data.automatic_renewal
      };

      return newPolicy;
    },
    onSuccess: async (newPolicy) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      
      // 🎯 **LÓGICA CENTRALIZADA** - Gerar comissão APENAS para apólices ATIVAS (não orçamento, não proposta)
      if (newPolicy.status === 'Ativa') {
        try {
          console.log('💰 [CENTRAL] Criando comissão para apólice:', newPolicy.policyNumber, 'Status:', newPolicy.status);
          
          // Buscar contexto para descrição rica
          const context = await fetchPolicyContext(newPolicy.clientId, newPolicy.type);
          
          // 1. Criar na tabela legada (compatibilidade)
          await gerarTransacaoDeComissao(newPolicy);
          
          // 2. Criar no ERP moderno (partidas dobradas)
          await gerarTransacaoDeComissaoERP(newPolicy, context.clientName, context.ramoName);
          
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
          console.log('✅ [CENTRAL] Comissões criadas (legado + ERP) para:', newPolicy.policyNumber);
        } catch (commissionError) {
          console.error('❌ [CENTRAL] Erro ao criar transação de comissão:', commissionError);
        }
      } else {
        console.log('📋 [CENTRAL] Apólice não ativa (status:', newPolicy.status, '), sem geração de comissão:', newPolicy.policyNumber);
      }

      console.log('✅ Apólice criada:', newPolicy);
    },
    onError: (error) => {
      console.error('Erro ao criar apólice:', error);
    }
  });

  const updatePolicyMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Policy> }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const updateData: any = {};
      
      if (updates.clientId) updateData.client_id = updates.clientId;
      if (updates.policyNumber) updateData.policy_number = updates.policyNumber;
      if (updates.insuranceCompany) updateData.insurance_company = updates.insuranceCompany;
      if (updates.type) {
        updateData.type = updates.type;
        // If type is UUID, also update ramo_id
        if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(updates.type)) {
          updateData.ramo_id = updates.type;
        }
      }
      if (updates.insuredAsset !== undefined) updateData.insured_asset = updates.insuredAsset;
      if (updates.premiumValue !== undefined) updateData.premium_value = updates.premiumValue;
      if (updates.commissionRate !== undefined) updateData.commission_rate = updates.commissionRate;
      if (updates.status) updateData.status = updates.status;
      if (updates.expirationDate) updateData.expiration_date = updates.expirationDate;
      if (updates.pdfUrl !== undefined) updateData.pdf_url = updates.pdfUrl;
      if (updates.renewalStatus !== undefined) updateData.renewal_status = updates.renewalStatus;
      if (updates.producerId !== undefined) updateData.producer_id = updates.producerId;
      if (updates.brokerageId !== undefined) updateData.brokerage_id = updates.brokerageId;
      if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
      if (updates.bonus_class !== undefined) updateData.bonus_class = updates.bonus_class;
      if (updates.automaticRenewal !== undefined) updateData.automatic_renewal = updates.automaticRenewal;

      const { error } = await supabase
        .from('apolices')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao atualizar apólice:', error);
        throw error;
      }

      return { id, updates };
    },
    onSuccess: async ({ id, updates }) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      
      // 🎯 **VERIFICAÇÃO PARA ATIVAÇÃO** - Se mudou para Ativa, gerar comissão se não existir
      if (updates.status === 'Ativa') {
        try {
          // Buscar a apólice atualizada para gerar comissão
          const { data: updatedPolicy } = await supabase
            .from('apolices')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

          if (updatedPolicy) {
            const policy: Policy = {
              id: updatedPolicy.id,
              clientId: updatedPolicy.client_id,
              policyNumber: updatedPolicy.policy_number,
              insuranceCompany: updatedPolicy.insurance_company,
              type: updatedPolicy.type,
              insuredAsset: updatedPolicy.insured_asset,
              premiumValue: typeof updatedPolicy.premium_value === 'string' ? parseFloat(updatedPolicy.premium_value) : updatedPolicy.premium_value,
              commissionRate: typeof updatedPolicy.commission_rate === 'string' ? parseFloat(updatedPolicy.commission_rate) : updatedPolicy.commission_rate,
              status: updatedPolicy.status as 'Ativa',
              expirationDate: updatedPolicy.expiration_date,
              createdAt: updatedPolicy.created_at,
              userId: updatedPolicy.user_id,
              producerId: updatedPolicy.producer_id,
              brokerageId: updatedPolicy.brokerage_id,
              startDate: updatedPolicy.start_date,
              bonus_class: updatedPolicy.bonus_class,
              automaticRenewal: updatedPolicy.automatic_renewal
            };

            // Buscar contexto para descrição rica
            const context = await fetchPolicyContext(policy.clientId, policy.type);

            console.log('💰 [UPDATE] Gerando comissão para apólice ativada:', policy.policyNumber);
            
            // 1. Criar na tabela legada
            await gerarTransacaoDeComissao(policy);
            
            // 2. Criar no ERP moderno
            await gerarTransacaoDeComissaoERP(policy, context.clientName, context.ramoName);
            
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
            console.log('✅ [UPDATE] Comissões criadas (legado + ERP) para ativação');
          }
        } catch (commissionError) {
          console.error('❌ [UPDATE] Erro ao criar comissão na ativação:', commissionError);
        }
      }
      
      console.log('✅ Apólice atualizada com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao atualizar apólice:', error);
    }
  });

  const deletePolicyMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('apolices')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao deletar apólice:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      console.log('✅ Apólice deletada com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao deletar apólice:', error);
    }
  });

  const ativarEAnexarPdfMutation = useMutation({
    mutationFn: async ({ policyId, file }: { policyId: string; file: File }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Converter arquivo para base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const pdfBase64 = await base64Promise;

      // Buscar os dados atuais da apólice
      const { data: policyData, error: fetchError } = await supabase
        .from('apolices')
        .select('*')
        .eq('id', policyId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('Erro ao buscar dados da apólice:', fetchError);
        throw fetchError;
      }

      const currentStatus = policyData.status;
      console.log('📋 Status atual da apólice:', currentStatus);

      // Determinar novo status baseado no status atual
      let newStatus = currentStatus;
      if (currentStatus === 'Aguardando Apólice') {
        newStatus = 'Ativa';
        console.log('🔄 Mudando status de "Aguardando Apólice" para "Ativa"');
      } else {
        console.log('📎 Apenas anexando PDF, mantendo status:', currentStatus);
      }

      // 🔧 **SIMPLIFICADO** - Atualizar apenas PDF e status
      const { error } = await supabase
        .from('apolices')
        .update({
          status: newStatus,
          pdf_attached_name: file.name,
          pdf_attached_data: pdfBase64
        })
        .eq('id', policyId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erro ao anexar PDF:', error);
        throw error;
      }

      return {
        policyId,
        wasActivated: currentStatus === 'Aguardando Apólice'
      };
    },
    onSuccess: async ({ policyId, wasActivated }) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      
      // 🎯 **COMISSÃO VIA UPDATE** - Se foi ativada, a updatePolicy já cuida da comissão
      if (wasActivated) {
        console.log('✅ PDF anexado e apólice ativada - comissão será gerada via updatePolicy');
      } else {
        console.log('📎 PDF anexado a apólice já ativa');
      }

      console.log('✅ PDF anexado com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao anexar PDF:', error);
    }
  });

  const convertBudgetToPolicyMutation = useMutation({
    mutationFn: async ({ id, policyNumber }: { id: string; policyNumber: string }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('apolices')
        .update({
          policy_number: policyNumber,
          status: 'Aguardando Apólice'
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao converter orçamento:', error);
        throw error;
      }

      return data;
    },
    onSuccess: async (updatedPolicy) => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      
      // 🎯 **SEM COMISSÃO** - Conversão para "Aguardando Apólice" NÃO gera comissão
      // Comissão só é gerada quando status muda para "Ativa" (via updatePolicy ou ativarEAnexarPdf)
      console.log('📋 [CONVERT] Orçamento convertido para "Aguardando Apólice" - sem comissão até ativação:', updatedPolicy.policy_number);
    },
    onError: (error) => {
      console.error('Erro ao converter orçamento:', error);
    }
  });

  return {
    policies,
    loading,
    isLoading: addPolicyMutation.isPending,
    isUpdatingPolicy: updatePolicyMutation.isPending,
    addPolicy: addPolicyMutation.mutateAsync,
    updatePolicy: (id: string, updates: Partial<Policy>) => 
      updatePolicyMutation.mutateAsync({ id, updates }),
    deletePolicy: deletePolicyMutation.mutateAsync,
    convertBudgetToPolicy: convertBudgetToPolicyMutation.mutateAsync,
    ativarEAnexarPdf: (policyId: string, file: File) =>
      ativarEAnexarPdfMutation.mutateAsync({ policyId, file }),
    refetch: () => queryClient.invalidateQueries({ queryKey: ['policies'] }),
  };
}
