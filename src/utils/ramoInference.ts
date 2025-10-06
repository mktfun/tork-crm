/**
 * Utilitário para inferir o ramo/produto baseado na descrição da transação
 */

interface RamoKeywords {
  [key: string]: string[];
}

// Mapeamento de palavras-chave para ramos comuns
const RAMO_KEYWORDS: RamoKeywords = {
  'auto': ['auto', 'carro', 'veículo', 'vehicle', 'automóvel', 'moto', 'motocicleta', 'caminhão', 'frota'],
  'saúde': ['saúde', 'saude', 'health', 'médico', 'medico', 'hospital', 'plano de saúde', 'odonto', 'odontológico'],
  'vida': ['vida', 'life', 'seguro de vida', 'acidentes pessoais', 'ap', 'funeral'],
  'residencial': ['residencial', 'casa', 'residência', 'residencia', 'apartamento', 'home', 'imóvel', 'imovel', 'condomínio'],
  'empresarial': ['empresarial', 'empresa', 'comercial', 'business', 'rc', 'responsabilidade civil', 'estabelecimento'],
  'consórcio': ['consórcio', 'consorcio', 'consortium'],
  'previdência': ['previdência', 'previdencia', 'vgbl', 'pgbl', 'aposentadoria', 'pension'],
  'viagem': ['viagem', 'travel', 'trip', 'turismo'],
  'rural': ['rural', 'agrícola', 'agricola', 'fazenda', 'plantação', 'colheita'],
  'transporte': ['transporte', 'carga', 'frete', 'transportadora', 'caminhão'],
  'fiança': ['fiança', 'fianca', 'aluguel', 'locação', 'locacao', 'rent'],
  'garantia': ['garantia', 'warranty', 'garantia estendida'],
  'pet': ['pet', 'animal', 'cachorro', 'gato', 'dog', 'cat'],
};

/**
 * Infere o ramo mais provável baseado na descrição
 * @param description - Descrição da transação
 * @param availableRamos - Lista de ramos disponíveis do usuário
 * @returns ID do ramo sugerido ou undefined se não encontrar correspondência
 */
export function inferRamoFromDescription(
  description: string,
  availableRamos: Array<{ id: string; nome: string }>
): string | undefined {
  if (!description || !availableRamos || availableRamos.length === 0) {
    return undefined;
  }

  const normalizedDescription = description.toLowerCase().trim();
  
  // Score para cada ramo disponível
  const ramoScores = new Map<string, number>();

  // Analisar cada ramo disponível
  for (const ramo of availableRamos) {
    const ramoNome = ramo.nome.toLowerCase();
    let score = 0;

    // Verificar se o nome do ramo está na descrição (match exato)
    if (normalizedDescription.includes(ramoNome)) {
      score += 100; // Peso alto para match exato
    }

    // Verificar palavras-chave associadas
    for (const [ramoKey, keywords] of Object.entries(RAMO_KEYWORDS)) {
      // Se o nome do ramo contém a chave do mapeamento
      if (ramoNome.includes(ramoKey)) {
        // Verificar quantas palavras-chave aparecem na descrição
        for (const keyword of keywords) {
          if (normalizedDescription.includes(keyword)) {
            score += 10; // Peso médio para cada palavra-chave
          }
        }
      }
    }

    // Similaridade parcial (primeiras letras)
    if (normalizedDescription.startsWith(ramoNome.substring(0, 3))) {
      score += 5;
    }

    if (score > 0) {
      ramoScores.set(ramo.id, score);
    }
  }

  // Retornar o ramo com maior score
  if (ramoScores.size === 0) {
    return undefined;
  }

  let maxScore = 0;
  let bestRamoId: string | undefined;

  for (const [ramoId, score] of ramoScores.entries()) {
    if (score > maxScore) {
      maxScore = score;
      bestRamoId = ramoId;
    }
  }

  if (maxScore >= 5) { // Threshold mínimo para sugerir
    return bestRamoId;
  }

  return undefined;
}

/**
 * Adiciona novo mapeamento de palavras-chave personalizado
 * (Útil para expansão futura)
 */
export function addCustomRamoKeywords(ramoName: string, keywords: string[]): void {
  const normalizedRamoName = ramoName.toLowerCase();
  if (RAMO_KEYWORDS[normalizedRamoName]) {
    RAMO_KEYWORDS[normalizedRamoName] = [
      ...RAMO_KEYWORDS[normalizedRamoName],
      ...keywords
    ];
  } else {
    RAMO_KEYWORDS[normalizedRamoName] = keywords;
  }
}
