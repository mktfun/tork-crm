
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { transformPolicyData, transformClientData, transformTransactionData } from '@/utils/dataTransformers';

interface FiltrosGlobais {
  intervalo: DateRange | undefined;
  seguradoraIds: string[];
  ramos: string[];
  produtorIds: string[];
  statusIds: string[];
}

export function useSupabaseReports(filtros: FiltrosGlobais) {
  // Query para buscar apólices com filtros aplicados no backend
  const { data: apolicesData, isLoading: apolicesLoading } = useQuery({
    queryKey: ['reports-apolices', filtros],
    queryFn: async () => {
      console.log('🔍 Executando query otimizada para apólices:', filtros);
      
      let query = supabase
        .from('apolices')
        .select(`
          *,
          clientes!inner(*),
          producers(*),
          companies(id, name)
        `);

      // Filtro por período
      if (filtros.intervalo?.from && filtros.intervalo?.to) {
        query = query
          .gte('created_at', format(filtros.intervalo.from, 'yyyy-MM-dd'))
          .lte('created_at', format(filtros.intervalo.to, 'yyyy-MM-dd'));
      }

      // Filtros de seleção múltipla
      if (filtros.seguradoraIds.length > 0) {
        query = query.in('insurance_company', filtros.seguradoraIds);
      }

      if (filtros.ramos.length > 0) {
        query = query.in('type', filtros.ramos);
      }

      if (filtros.produtorIds.length > 0) {
        query = query.in('producer_id', filtros.produtorIds);
      }

      if (filtros.statusIds.length > 0) {
        query = query.in('status', filtros.statusIds);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Erro na query de apólices:', error);
        throw error;
      }

      console.log('✅ Apólices carregadas:', data?.length);
      return data?.map(transformPolicyData) || [];
    }
  });

  // Query para buscar transações filtradas
  const { data: transacoesData, isLoading: transacoesLoading } = useQuery({
    queryKey: ['reports-transacoes', filtros],
    queryFn: async () => {
      console.log('🔍 Executando query otimizada para transações:', filtros);
      
      let query = supabase
        .from('transactions')
        .select('*');

      // Filtro por período - usar transaction_date em vez de date
      if (filtros.intervalo?.from && filtros.intervalo?.to) {
        query = query
          .gte('transaction_date', format(filtros.intervalo.from, 'yyyy-MM-dd'))
          .lte('transaction_date', format(filtros.intervalo.to, 'yyyy-MM-dd'));
      }

      // Filtros de seleção múltipla para transações
      if (filtros.seguradoraIds.length > 0) {
        query = query.in('company_id', filtros.seguradoraIds);
      }

      if (filtros.ramos.length > 0) {
        query = query.in('ramo_id', filtros.ramos);
      }

      if (filtros.produtorIds.length > 0) {
        query = query.in('producer_id', filtros.produtorIds);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Erro na query de transações:', error);
        throw error;
      }

      console.log('✅ Transações carregadas:', data?.length);
      return data?.map(transformTransactionData) || [];
    }
  });

  // Query para metadados (seguradoras, ramos, status, produtores)
  const { data: metadados, isLoading: metadadosLoading } = useQuery({
    queryKey: ['reports-metadados'],
    queryFn: async () => {
      console.log('🔍 Carregando metadados do sistema');
      
      const [apolicesResult, produtoresResult, seguradorasResult] = await Promise.all([
        supabase.from('apolices').select('type, status'),
        supabase.from('producers').select('id, name'),
        supabase.from('companies').select('id, name')
      ]);

      if (apolicesResult.error) throw apolicesResult.error;
      if (produtoresResult.error) throw produtoresResult.error;
      if (seguradorasResult.error) throw seguradorasResult.error;

      // Garantir que seguradoras retorne array de objetos com id e name
      const seguradoras = (seguradorasResult.data || []).map(seguradora => ({
        id: seguradora.id,
        name: seguradora.name
      }));

      const ramos = [...new Set(
        apolicesResult.data?.map(p => p.type || 'Não especificado').filter(Boolean) || []
      )];

      const status = [...new Set(
        apolicesResult.data?.map(p => p.status).filter(Boolean) || []
      )];

      const produtores = (produtoresResult.data || []).map(produtor => ({
        id: produtor.id,
        name: produtor.name
      }));

      console.log('✅ Metadados carregados:', { 
        seguradoras: seguradoras.length, 
        ramos: ramos.length, 
        produtores: produtores.length 
      });

      return {
        seguradoras,
        ramosDisponiveis: ramos,
        statusDisponiveis: status,
        produtores
      };
    }
  });

  // Estados de loading combinados
  const isLoading = apolicesLoading || transacoesLoading || metadadosLoading;

  // Extrair clientes únicos das apólices carregadas
  const clientes = apolicesData?.map(apolice => apolice.clientes).filter(Boolean) || [];
  const clientesUnicos = clientes.filter((cliente, index, self) => 
    index === self.findIndex(c => c.id === cliente.id)
  ).map(transformClientData);

  // Calcular KPIs financeiros a partir das transações
  const totalGanhos = (transacoesData || [])
    .filter(t => t.nature === 'RECEITA' && (t.status === 'PAGO' || t.status === 'REALIZADO'))
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const totalPerdas = (transacoesData || [])
    .filter(t => t.nature === 'DESPESA' && (t.status === 'PAGO' || t.status === 'REALIZADO'))
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const saldoLiquido = totalGanhos - totalPerdas;

  return {
    // Dados principais
    apolices: apolicesData || [],
    clientes: clientesUnicos,
    transacoes: transacoesData || [],
    
    // Metadados
    seguradoras: metadados?.seguradoras || [],
    ramosDisponiveis: metadados?.ramosDisponiveis || [],
    statusDisponiveis: metadados?.statusDisponiveis || [],
    produtores: metadados?.produtores || [],
    
    // KPIs Financeiros
    totalGanhos,
    totalPerdas,
    saldoLiquido,
    
    // Estados
    isLoading,
    
    // Flags de controle
    temDados: (apolicesData?.length || 0) > 0,
    temFiltrosAtivos: filtros.seguradoraIds.length > 0 || 
                     filtros.ramos.length > 0 || 
                     filtros.produtorIds.length > 0 || 
                     filtros.statusIds.length > 0
  };
}
