import { useMemo } from 'react';
import { usePolicies } from '@/hooks/useAppData';
import { 
  calculateRealCommissionRatesByType,
  getRealCommissionRateByType,
  calculateRealCommissionValue,
  generateCommissionRatesReport,
  validateDataCoverage,
  DynamicCommissionRate,
  DEFAULT_COMMISSION_RATE
} from '@/utils/dynamicCommissionRates';

/**
 * Hook que calcula as taxas de comissão reais baseadas nos dados existentes da corretora
 * Substitui os valores fixos por médias dinâmicas calculadas das apólices
 */
export function useRealCommissionRates() {
  const { policies, loading } = usePolicies();

  // Calcular as taxas reais de comissão por tipo
  const commissionRatesMap = useMemo(() => {
    if (loading || !policies || policies.length === 0) {
      return new Map<string, DynamicCommissionRate>();
    }

    return calculateRealCommissionRatesByType(policies.filter(p => p.type) as any, 2); // Min 2 apólices por tipo
  }, [policies, loading]);

  // Relatório das taxas calculadas
  const commissionRatesReport = useMemo(() => {
    return generateCommissionRatesReport(commissionRatesMap);
  }, [commissionRatesMap]);

  // Validação da cobertura dos dados
  const dataCoverage = useMemo(() => {
    if (loading || !policies) {
      return {
        totalPolicies: 0,
        typesWithSufficientData: 0,
        typesWithInsufficientData: [],
        overallCoverage: 0
      };
    }

    return validateDataCoverage(policies.filter(p => p.type) as any, 2);
  }, [policies, loading]);

  // Função para obter taxa de comissão por tipo
  const getCommissionRate = useMemo(() => {
    return (policyType: string): number => {
      return getRealCommissionRateByType(policyType, commissionRatesMap);
    };
  }, [commissionRatesMap]);

  // Função para calcular valor da comissão
  const calculateCommissionValue = useMemo(() => {
    return (premiumValue: number, policyType: string): number => {
      return calculateRealCommissionValue(premiumValue, policyType, commissionRatesMap);
    };
  }, [commissionRatesMap]);

  // Função para obter taxa média geral
  const getOverallAverageRate = useMemo(() => {
    if (loading || !policies || policies.length === 0) {
      return DEFAULT_COMMISSION_RATE;
    }

    const activePolicies = policies.filter(p => 
      p.status === 'Ativa' && 
      p.premiumValue > 0 && 
      p.commissionRate > 0
    );

    if (activePolicies.length === 0) {
      return DEFAULT_COMMISSION_RATE;
    }

    const totalPremium = activePolicies.reduce((sum, p) => sum + p.premiumValue, 0);
    const totalCommission = activePolicies.reduce((sum, p) => 
      sum + (p.premiumValue * p.commissionRate) / 100, 0
    );

    return totalPremium > 0 ? (totalCommission / totalPremium) * 100 : DEFAULT_COMMISSION_RATE;
  }, [policies, loading]);

  // Estatísticas resumidas
  const stats = useMemo(() => {
    return {
      totalTypes: commissionRatesMap.size,
      averageRate: getOverallAverageRate,
      highestRate: commissionRatesReport.length > 0 ? 
        Math.max(...commissionRatesReport.map(r => r.averageRate)) : 0,
      lowestRate: commissionRatesReport.length > 0 ? 
        Math.min(...commissionRatesReport.map(r => r.averageRate)) : 0,
      totalPoliciesAnalyzed: dataCoverage.totalPolicies
    };
  }, [commissionRatesMap, commissionRatesReport, getOverallAverageRate, dataCoverage]);

  return {
    // Estados
    loading,
    
    // Dados principais
    commissionRatesMap,
    commissionRatesReport,
    dataCoverage,
    stats,
    
    // Funções utilitárias
    getCommissionRate,
    calculateCommissionValue,
    getOverallAverageRate,
    
    // Funções de verificação
    hasReliableData: dataCoverage.overallCoverage > 50, // 50% dos tipos têm dados suficientes
    getTotalPoliciesForType: (type: string) => {
      const rate = commissionRatesMap.get(type);
      return rate ? rate.sampleSize : 0;
    },
    
    // Debug info
    getRawCommissionData: () => Array.from(commissionRatesMap.entries())
  };
}
