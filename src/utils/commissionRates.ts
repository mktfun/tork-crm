// Taxas de comissão médias por tipo de apólice/ramo
// Configurações baseadas nas médias do mercado de seguros

export interface CommissionRate {
  /** Tipo/ramo da apólice */
  type: string;
  /** Taxa de comissão em percentual (ex: 15 = 15%) */
  rate: number;
  /** Descrição do ramo */
  description: string;
}

// Configurações de taxas de comissão por ramo
export const COMMISSION_RATES_BY_TYPE: CommissionRate[] = [
  { type: 'Auto', rate: 15, description: 'Seguros de automóvel' },
  { type: 'Vida', rate: 12, description: 'Seguros de vida' },
  { type: 'Saúde', rate: 11, description: 'Planos de saúde' },
  { type: 'Residencial', rate: 18, description: 'Seguros residenciais' },
  { type: 'Empresarial', rate: 20, description: 'Seguros empresariais' },
  { type: 'Viagem', rate: 25, description: 'Seguros viagem' },
  { type: 'Equipamentos', rate: 22, description: 'Seguros de equipamentos' },
  { type: 'Responsabilidade Civil', rate: 16, description: 'RC Profissional' },
  { type: 'Acidentes Pessoais', rate: 14, description: 'Seguros de acidentes pessoais' },
  { type: 'Previdência', rate: 8, description: 'Previdência privada' },
  { type: 'Rural', rate: 17, description: 'Seguros rurais' },
  { type: 'Transportes', rate: 19, description: 'Seguros de transporte de cargas' },
  { type: 'Marítimo', rate: 21, description: 'Seguros marítimos' },
  { type: 'Aeronáutico', rate: 23, description: 'Seguros aeronáuticos' },
  { type: 'Fiança', rate: 13, description: 'Seguros fiança' },
  { type: 'Garantia', rate: 15, description: 'Seguros garantia' },
  { type: 'D&O', rate: 24, description: 'Directors & Officers' },
  { type: 'Cyber', rate: 26, description: 'Seguros de cyber riscos' }
];

// Taxa padrão para tipos não encontrados
export const DEFAULT_COMMISSION_RATE = 10;

/**
 * Obtém a taxa de comissão para um determinado tipo de apólice
 * @param policyType - Tipo da apólice
 * @returns Taxa de comissão em percentual (número decimal, ex: 15 para 15%)
 */
export function getCommissionRateByType(policyType: string): number {
  if (!policyType) {
    return DEFAULT_COMMISSION_RATE;
  }

  // Normalizar o texto para busca (remover acentos e colocar em lowercase)
  const normalizedType = policyType
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Procurar por correspondência exata primeiro
  const exactMatch = COMMISSION_RATES_BY_TYPE.find(
    rate => rate.type.toLowerCase() === policyType.toLowerCase()
  );
  
  if (exactMatch) {
    return exactMatch.rate;
  }

  // Procurar por correspondência parcial
  const partialMatch = COMMISSION_RATES_BY_TYPE.find(
    rate => {
      const normalizedRateType = rate.type
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      return normalizedRateType.includes(normalizedType) || 
             normalizedType.includes(normalizedRateType);
    }
  );

  if (partialMatch) {
    return partialMatch.rate;
  }

  // Casos especiais para mapeamento mais inteligente
  const specialCases: { [key: string]: number } = {
    'automovel': 15,
    'auto': 15,
    'carro': 15,
    'veiculo': 15,
    'saude': 11,
    'plano': 11,
    'medico': 11,
    'odonto': 11,
    'casa': 18,
    'residencia': 18,
    'lar': 18,
    'empresa': 20,
    'comercial': 20,
    'negocios': 20,
    'viagem': 25,
    'internacional': 25,
    'equipamento': 22,
    'maquina': 22,
    'celular': 22,
    'notebook': 22,
    'vida': 12,
    'morte': 12,
    'funeral': 12,
    'previdencia': 8,
    'aposentadoria': 8,
    'pensao': 8
  };

  for (const [key, rate] of Object.entries(specialCases)) {
    if (normalizedType.includes(key)) {
      return rate;
    }
  }

  return DEFAULT_COMMISSION_RATE;
}

/**
 * Obtém todas as taxas de comissão configuradas
 * @returns Array com todas as configurações de taxas
 */
export function getAllCommissionRates(): CommissionRate[] {
  return [...COMMISSION_RATES_BY_TYPE];
}

/**
 * Calcula o valor da comissão baseado no prêmio e tipo da apólice
 * @param premiumValue - Valor do prêmio
 * @param policyType - Tipo da apólice
 * @returns Valor da comissão em reais
 */
export function calculateCommissionValue(premiumValue: number, policyType: string): number {
  if (!premiumValue || premiumValue <= 0) {
    return 0;
  }

  const rate = getCommissionRateByType(policyType);
  return (premiumValue * rate) / 100;
}

/**
 * Calcula a taxa média de comissão para um conjunto de apólices
 * @param policies - Array de apólices com premiumValue e type
 * @returns Taxa média ponderada em percentual
 */
export function calculateAverageCommissionRate(
  policies: Array<{ premiumValue: number; type: string }>
): number {
  if (!policies || policies.length === 0) {
    return DEFAULT_COMMISSION_RATE;
  }

  let totalPremium = 0;
  let totalCommission = 0;

  policies.forEach(policy => {
    if (policy.premiumValue > 0) {
      const commission = calculateCommissionValue(policy.premiumValue, policy.type);
      totalPremium += policy.premiumValue;
      totalCommission += commission;
    }
  });

  if (totalPremium === 0) {
    return DEFAULT_COMMISSION_RATE;
  }

  return (totalCommission / totalPremium) * 100;
}
