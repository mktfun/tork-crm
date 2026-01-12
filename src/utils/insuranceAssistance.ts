/**
 * Utilitário para mapeamento de telefones de Assistência 24h das seguradoras
 * Faz matching fuzzy com fallback para as top 10 seguradoras brasileiras
 */

interface AssistanceInfo {
  phone: string;
  companyName: string;
}

// Mapa de telefones de assistência 24h das principais seguradoras brasileiras
const ASSISTANCE_MAP: Record<string, AssistanceInfo> = {
  porto: { phone: '0800 727 2810', companyName: 'Porto Seguro' },
  bradesco: { phone: '0800 701 2778', companyName: 'Bradesco Seguros' },
  sulamerica: { phone: '0800 725 4545', companyName: 'SulAmérica' },
  tokio: { phone: '0800 703 2038', companyName: 'Tokio Marine' },
  liberty: { phone: '0800 709 4440', companyName: 'Liberty Seguros' },
  mapfre: { phone: '0800 775 4545', companyName: 'Mapfre' },
  hdi: { phone: '0800 770 1608', companyName: 'HDI Seguros' },
  allianz: { phone: '0800 130 000', companyName: 'Allianz' },
  azul: { phone: '0800 703 0203', companyName: 'Azul Seguros' },
  itau: { phone: '0800 723 9090', companyName: 'Itaú Seguros' },
  zurich: { phone: '0800 284 4848', companyName: 'Zurich Seguros' },
  sompo: { phone: '0800 775 0700', companyName: 'Sompo Seguros' },
  chubb: { phone: '0800 722 2492', companyName: 'Chubb Seguros' },
  axa: { phone: '0800 881 1292', companyName: 'AXA Seguros' },
  suhai: { phone: '0800 001 0001', companyName: 'Suhai Seguradora' },
};

/**
 * Normaliza o nome da seguradora removendo acentos e palavras comuns
 */
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/seguros?|seguradora|cia\.?|companhia|s\.?a\.?|ltda\.?/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Tenta fazer match do nome da seguradora com o mapa de assistência
 */
function matchCompany(name: string): AssistanceInfo | null {
  const normalized = normalizeCompanyName(name);

  // Match por palavra-chave
  const keywords: [string, string][] = [
    ['porto', 'porto'],
    ['bradesco', 'bradesco'],
    ['sulamerica', 'sulamerica'],
    ['tokio', 'tokio'],
    ['tokyomarine', 'tokio'],
    ['liberty', 'liberty'],
    ['mapfre', 'mapfre'],
    ['hdi', 'hdi'],
    ['allianz', 'allianz'],
    ['azul', 'azul'],
    ['itau', 'itau'],
    ['zurich', 'zurich'],
    ['sompo', 'sompo'],
    ['chubb', 'chubb'],
    ['axa', 'axa'],
    ['suhai', 'suhai'],
  ];

  for (const [keyword, mapKey] of keywords) {
    if (normalized.includes(keyword)) {
      return ASSISTANCE_MAP[mapKey];
    }
  }

  return null;
}

/**
 * Obtém o telefone de assistência 24h para uma seguradora
 * @param companyName - Nome da seguradora
 * @param customPhone - Telefone customizado (cadastrado pelo corretor)
 * @returns Telefone de assistência formatado ou null
 */
export function getCompanyAssistance(
  companyName: string | null | undefined,
  customPhone?: string | null
): string | null {
  // Se há um telefone customizado cadastrado, usa ele
  if (customPhone && customPhone.trim()) {
    return customPhone.trim();
  }

  // Se não tem nome de empresa, retorna null
  if (!companyName) {
    return null;
  }

  // Tenta fazer match com o mapa de assistência
  const match = matchCompany(companyName);
  return match?.phone || null;
}

/**
 * Obtém informações completas de assistência
 */
export function getCompanyAssistanceInfo(
  companyName: string | null | undefined,
  customPhone?: string | null
): { phone: string | null; isCustom: boolean; matchedCompany: string | null } {
  // Se há um telefone customizado cadastrado, usa ele
  if (customPhone && customPhone.trim()) {
    return {
      phone: customPhone.trim(),
      isCustom: true,
      matchedCompany: null,
    };
  }

  // Se não tem nome de empresa, retorna null
  if (!companyName) {
    return { phone: null, isCustom: false, matchedCompany: null };
  }

  // Tenta fazer match com o mapa de assistência
  const match = matchCompany(companyName);
  
  return {
    phone: match?.phone || null,
    isCustom: false,
    matchedCompany: match?.companyName || null,
  };
}

/**
 * Formata número de telefone para link tel:
 */
export function formatPhoneForTel(phone: string): string {
  // Remove tudo que não é número
  return phone.replace(/\D/g, '');
}

/**
 * Lista todas as seguradoras com assistência cadastrada (para referência)
 */
export function getAllKnownAssistancePhones(): AssistanceInfo[] {
  return Object.values(ASSISTANCE_MAP);
}
