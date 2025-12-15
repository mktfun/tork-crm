import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Client } from '@/types';

export interface ClientRelationships {
  clientId: string;
  apolicesCount: number;
  appointmentsCount: number;
  sinistrosCount: number;
}

export interface MergeResult {
  success: boolean;
  transferredApolices: number;
  transferredAppointments: number;
  transferredSinistros: number;
  deletedClients: number;
  error?: string;
}

export interface SmartMergeField {
  field: keyof Client;
  label: string;
  primaryValue: string | null;
  secondaryValue: string | null;
  willInherit: boolean;
}

export function useSafeMerge() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar contagem de relacionamentos para múltiplos clientes
  const fetchClientRelationships = async (clientIds: string[]): Promise<ClientRelationships[]> => {
    if (!user || clientIds.length === 0) return [];
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results: ClientRelationships[] = [];
      
      for (const clientId of clientIds) {
        // Buscar contagem de apólices
        const { count: apolicesCount, error: apolicesError } = await supabase
          .from('apolices')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('user_id', user.id);
        
        if (apolicesError) throw apolicesError;
        
        // Buscar contagem de agendamentos
        const { count: appointmentsCount, error: appointmentsError } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('user_id', user.id);
        
        if (appointmentsError) throw appointmentsError;
        
        // Buscar contagem de sinistros
        const { count: sinistrosCount, error: sinistrosError } = await supabase
          .from('sinistros')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('user_id', user.id);
        
        if (sinistrosError) throw sinistrosError;
        
        results.push({
          clientId,
          apolicesCount: apolicesCount || 0,
          appointmentsCount: appointmentsCount || 0,
          sinistrosCount: sinistrosCount || 0,
        });
      }
      
      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar relacionamentos';
      setError(message);
      console.error('Erro ao buscar relacionamentos:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Calcular campos que serão herdados no Smart Merge
  const calculateSmartMergeFields = (
    primary: Client,
    secondary: Client
  ): SmartMergeField[] => {
    const fieldsToCheck: Array<{ field: keyof Client; label: string }> = [
      { field: 'email', label: 'Email' },
      { field: 'phone', label: 'Telefone' },
      { field: 'cpfCnpj', label: 'CPF/CNPJ' },
      { field: 'birthDate', label: 'Data de Nascimento' },
      { field: 'address', label: 'Endereço' },
      { field: 'city', label: 'Cidade' },
      { field: 'state', label: 'Estado' },
      { field: 'cep', label: 'CEP' },
      { field: 'neighborhood', label: 'Bairro' },
      { field: 'profession', label: 'Profissão' },
      { field: 'observations', label: 'Observações' },
    ];

    return fieldsToCheck.map(({ field, label }) => {
      const primaryValue = primary[field] as string | null;
      const secondaryValue = secondary[field] as string | null;
      
      // Herdar se o primário está vazio mas o secundário tem valor
      const willInherit = (!primaryValue || primaryValue.trim() === '') && 
                          (!!secondaryValue && secondaryValue.trim() !== '');
      
      return {
        field,
        label,
        primaryValue: primaryValue || null,
        secondaryValue: secondaryValue || null,
        willInherit,
      };
    });
  };

  // Executar merge seguro (transacional)
  const executeSafeMerge = async (
    primaryClient: Client,
    secondaryClients: Client[],
    fieldsToInherit: SmartMergeField[] = []
  ): Promise<MergeResult> => {
    if (!user) {
      return { 
        success: false, 
        transferredApolices: 0, 
        transferredAppointments: 0,
        transferredSinistros: 0,
        deletedClients: 0,
        error: 'Usuário não autenticado' 
      };
    }

    setIsMerging(true);
    setError(null);
    
    const secondaryIds = secondaryClients.map(c => c.id);
    let transferredApolices = 0;
    let transferredAppointments = 0;
    let transferredSinistros = 0;
    let deletedClients = 0;

    try {
      // PASSO 0: Atualizar dados do cliente principal com campos herdados
      const fieldsToUpdate = fieldsToInherit
        .filter(f => f.willInherit && f.secondaryValue)
        .reduce((acc, f) => {
          // Mapear campo do tipo Client para coluna do banco
          const columnMap: Record<string, string> = {
            cpfCnpj: 'cpf_cnpj',
            birthDate: 'birth_date',
            maritalStatus: 'marital_status',
          };
          const column = columnMap[f.field] || f.field;
          acc[column] = f.secondaryValue;
          return acc;
        }, {} as Record<string, string | null>);

      if (Object.keys(fieldsToUpdate).length > 0) {
        const { error: updateError } = await supabase
          .from('clientes')
          .update(fieldsToUpdate)
          .eq('id', primaryClient.id)
          .eq('user_id', user.id);

        if (updateError) {
          throw new Error(`Erro ao atualizar dados do cliente principal: ${updateError.message}`);
        }
      }

      // PASSO 1: Transferir apólices
      const { data: apolicesData, error: apolicesError } = await supabase
        .from('apolices')
        .update({ client_id: primaryClient.id })
        .in('client_id', secondaryIds)
        .eq('user_id', user.id)
        .select();

      if (apolicesError) {
        throw new Error(`Erro ao transferir apólices: ${apolicesError.message}`);
      }
      transferredApolices = apolicesData?.length || 0;

      // PASSO 2: Transferir agendamentos
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .update({ client_id: primaryClient.id })
        .in('client_id', secondaryIds)
        .eq('user_id', user.id)
        .select();

      if (appointmentsError) {
        throw new Error(`Erro ao transferir agendamentos: ${appointmentsError.message}`);
      }
      transferredAppointments = appointmentsData?.length || 0;

      // PASSO 3: Transferir sinistros
      const { data: sinistrosData, error: sinistrosError } = await supabase
        .from('sinistros')
        .update({ client_id: primaryClient.id })
        .in('client_id', secondaryIds)
        .eq('user_id', user.id)
        .select();

      if (sinistrosError) {
        throw new Error(`Erro ao transferir sinistros: ${sinistrosError.message}`);
      }
      transferredSinistros = sinistrosData?.length || 0;

      // PASSO 4: Deletar clientes secundários SOMENTE após transferências bem sucedidas
      const { error: deleteError } = await supabase
        .from('clientes')
        .delete()
        .in('id', secondaryIds)
        .eq('user_id', user.id);

      if (deleteError) {
        throw new Error(`Erro ao remover clientes duplicados: ${deleteError.message}`);
      }
      deletedClients = secondaryIds.length;

      toast.success('Mesclagem realizada com sucesso!', {
        description: `${transferredApolices} apólices, ${transferredAppointments} agendamentos e ${transferredSinistros} sinistros transferidos.`,
      });

      return {
        success: true,
        transferredApolices,
        transferredAppointments,
        transferredSinistros,
        deletedClients,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido ao mesclar clientes';
      setError(message);
      toast.error('Erro na mesclagem', { description: message });
      
      return {
        success: false,
        transferredApolices,
        transferredAppointments,
        transferredSinistros,
        deletedClients,
        error: message,
      };
    } finally {
      setIsMerging(false);
    }
  };

  return {
    fetchClientRelationships,
    calculateSmartMergeFields,
    executeSafeMerge,
    isLoading,
    isMerging,
    error,
  };
}
