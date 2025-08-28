// Sistema de cálculo dinâmico de comissões baseado nos dados reais da corretora

export interface Policy {
  id: string;
  type: string;
  premiumValue: number;
  commissionRate: number;
  status: string;
  [key: string]: any;
}

export interface DynamicCommissionRate {
  /** Tipo/ramo da apólice */
  type: string;
  /** Taxa média real de comissão calculada baseada nos dados */
  averageRate: number;
  /** Número de apólices usado no cálculo */
  sampleSize: number;
  /** Valor total de prêmios considerado */
  totalPremiumValue: number;
  /** Valor total de comissões */
  totalCommissionValue: number;
}

// Taxa padrão para tipos sem dados suficientes
export const DEFAULT_COMMISSION_RATE = 10;

/**
 * Calcula as médias reais de comissão por tipo baseado nas apólices existentes
 * @param policies - Array de todas as apólices
 * @param minSampleSize - Número mínimo de apólices para considerar a média válida
 * @returns Map com as taxas médias por tipo
 */
export function calculateRealCommissionRatesByType(
  policies: Policy[],
  minSampleSize: number = 3
): Map<string, DynamicCommissionRate> {
  const typeStats = new Map<string, {
    totalPremium: number;
    totalCommission: number;
    count: number;
    policies: Policy[];
  }>();

  // Agrupar e somar por tipo
  policies
    .filter(policy => 
      policy.status === 'Ativa' && 
      policy.premiumValue > 0 && 
      policy.commissionRate > 0 &&
      policy.type
    )
    .forEach(policy => {
      const type = policy.type.trim();
      
      if (!typeStats.has(type)) {
        typeStats.set(type, {
          totalPremium: 0,
          totalCommission: 0,
          count: 0,
          policies: []
        });
      }
      
      const stats = typeStats.get(type)!;
      const commissionValue = (policy.premiumValue * policy.commissionRate) / 100;
      
      stats.totalPremium += policy.premiumValue;
      stats.totalCommission += commissionValue;
      stats.count += 1;
      stats.policies.push(policy);
    });

  // Calcular médias e criar resultado
  const result = new Map<string, DynamicCommissionRate>();
  
  typeStats.forEach((stats, type) => {
    if (stats.count >= minSampleSize && stats.totalPremium > 0) {
      const averageRate = (stats.totalCommission / stats.totalPremium) * 100;
      
      result.set(type, {
        type,
        averageRate: Math.round(averageRate * 100) / 100, // 2 casas decimais
        sampleSize: stats.count,
        totalPremiumValue: stats.totalPremium,
        totalCommissionValue: stats.totalCommission
      });
    }
  });

  return result;
}

/**
 * Obtém a taxa de comissão real para um tipo específico
 * @param policyType - Tipo da apólice
 * @param commissionRatesMap - Map com as taxas calculadas
 * @returns Taxa de comissão em percentual
 */
export function getRealCommissionRateByType(
  policyType: string,
  commissionRatesMap: Map<string, DynamicCommissionRate>
): number {
  if (!policyType) {
    return DEFAULT_COMMISSION_RATE;
  }

  // Busca exata primeiro
  const exactMatch = commissionRatesMap.get(policyType.trim());
  if (exactMatch) {
    return exactMatch.averageRate;
  }

  // Busca parcial (case insensitive)
  const normalizedType = policyType.toLowerCase().trim();
  
  for (const [type, rate] of commissionRatesMap) {
    if (type.toLowerCase().includes(normalizedType) || 
        normalizedType.includes(type.toLowerCase())) {
      return rate.averageRate;
    }
  }

  return DEFAULT_COMMISSION_RATE;
}

/**
 * Calcula o valor da comissão usando taxas reais
 * @param premiumValue - Valor do prêmio
 * @param policyType - Tipo da apólice
 * @param commissionRatesMap - Map com as taxas calculadas
 * @returns Valor da comissão em reais
 */
export function calculateRealCommissionValue(
  premiumValue: number,
  policyType: string,
  commissionRatesMap: Map<string, DynamicCommissionRate>
): number {
  if (!premiumValue || premiumValue <= 0) {
    return 0;
  }

  const rate = getRealCommissionRateByType(policyType, commissionRatesMap);
  return (premiumValue * rate) / 100;
}

/**
 * Calcula médias de comissão agrupadas (por ramo ou seguradora)
 * @param policies - Apólices filtradas
 * @param groupBy - Campo para agrupar ('type' para ramo, 'insuranceCompany' para seguradora)
 * @param commissionRatesMap - Map com as taxas calculadas
 * @returns Dados agrupados com comissões calculadas
 */
export function calculateGroupedCommissions(
  policies: Policy[],
  groupBy: 'type' | 'insuranceCompany',
  commissionRatesMap: Map<string, DynamicCommissionRate>
): Array<{
  group: string;
  count: number;
  premiumValue: number;
  commissionValue: number;
  averageCommissionRate: number;
}> {
  const groupStats = new Map<string, {
    count: number;
    premiumValue: number;
    commissionValue: number;
  }>();

  // Agrupar dados
  policies
    .filter(policy => policy.status === 'Ativa' && policy.premiumValue > 0)
    .forEach(policy => {
      const groupKey = groupBy === 'type' ? 
        (policy.type || 'Não informado') : 
        (policy.insuranceCompany || 'Não informado');
      
      if (!groupStats.has(groupKey)) {
        groupStats.set(groupKey, {
          count: 0,
          premiumValue: 0,
          commissionValue: 0
        });
      }
      
      const stats = groupStats.get(groupKey)!;
      const commissionValue = calculateRealCommissionValue(
        policy.premiumValue,
        policy.type,
        commissionRatesMap
      );
      
      stats.count += 1;
      stats.premiumValue += policy.premiumValue;
      stats.commissionValue += commissionValue;
    });

  // Converter para array e calcular médias
  return Array.from(groupStats.entries()).map(([group, stats]) => ({
    group,
    count: stats.count,
    premiumValue: stats.premiumValue,
    commissionValue: stats.commissionValue,
    averageCommissionRate: stats.premiumValue > 0 ? 
      (stats.commissionValue / stats.premiumValue) * 100 : 0
  }));
}

/**
 * Gera relatório das taxas de comissão calculadas
 * @param commissionRatesMap - Map com as taxas calculadas
 * @returns Array formatado para exibição
 */
export function generateCommissionRatesReport(
  commissionRatesMap: Map<string, DynamicCommissionRate>
): DynamicCommissionRate[] {
  return Array.from(commissionRatesMap.values())
    .sort((a, b) => b.totalPremiumValue - a.totalPremiumValue);
}

/**
 * Verifica se há dados suficientes para calcular médias confiáveis
 * @param policies - Array de apólices
 * @param minPoliciesPerType - Mínimo de apólices por tipo
 * @returns Relatório de cobertura dos dados
 */
export function validateDataCoverage(
  policies: Policy[],
  minPoliciesPerType: number = 3
): {
  totalPolicies: number;
  typesWithSufficientData: number;
  typesWithInsufficientData: string[];
  overallCoverage: number;
} {
  const activePolicies = policies.filter(p => p.status === 'Ativa' && p.premiumValue > 0);
  const typeCount = new Map<string, number>();
  
  activePolicies.forEach(policy => {
    const type = policy.type || 'Não informado';
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  });
  
  const sufficientTypes = Array.from(typeCount.entries())
    .filter(([, count]) => count >= minPoliciesPerType);
  
  const insufficientTypes = Array.from(typeCount.entries())
    .filter(([, count]) => count < minPoliciesPerType)
    .map(([type]) => type);
  
  return {
    totalPolicies: activePolicies.length,
    typesWithSufficientData: sufficientTypes.length,
    typesWithInsufficientData: insufficientTypes,
    overallCoverage: typeCount.size > 0 ? (sufficientTypes.length / typeCount.size) * 100 : 0
  };
}
