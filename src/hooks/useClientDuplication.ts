import { useMemo } from 'react';
import { Client } from '@/types';

interface DuplicateAlert {
  count: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

interface SimilarityScore {
  score: number;
  reasons: string[];
  confidence: 'high' | 'medium' | 'low';
}

export function useClientDuplication(clients: Client[]) {
  const duplicateAlert = useMemo((): DuplicateAlert => {
    const groups: Array<{ clients: Client[]; confidence: 'high' | 'medium' | 'low'; score: number }> = [];
    const processed = new Set<string>();

    // Funções de normalização melhoradas
    const normalizeName = (name: string): string => {
      return name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/\b(da|de|do|dos|das)\b/g, '') // Remove preposições
        .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, ' ') // Normaliza espaços
        .trim();
    };

    const normalizePhone = (phone: string): string => {
      const cleaned = phone.replace(/\D/g, '');
      // Remove código do país se presente
      if (cleaned.startsWith('55') && cleaned.length === 13) {
        return cleaned.substring(2);
      }
      return cleaned;
    };

    const normalizeDocument = (doc: string): string => {
      return doc.replace(/\D/g, '');
    };

    const normalizeEmail = (email: string): string => {
      return email.toLowerCase().trim();
    };

    // Função para calcular similaridade de Levenshtein
    const levenshteinDistance = (str1: string, str2: string): number => {
      const matrix = [];
      for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
          if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      return matrix[str2.length][str1.length];
    };

    // Função para calcular similaridade entre nomes
    const calculateNameSimilarity = (name1: string, name2: string): number => {
      const norm1 = normalizeName(name1);
      const norm2 = normalizeName(name2);

      if (norm1 === norm2) return 1.0;

      const distance = levenshteinDistance(norm1, norm2);
      const maxLength = Math.max(norm1.length, norm2.length);
      return 1 - (distance / maxLength);
    };

    // Função principal para calcular similaridade entre clientes
    const calculateSimilarity = (client1: Client, client2: Client): SimilarityScore => {
      let score = 0;
      const reasons: string[] = [];
      let maxScore = 0;

      // CPF/CNPJ exato (peso 40)
      if (client1.cpfCnpj && client2.cpfCnpj) {
        maxScore += 40;
        if (normalizeDocument(client1.cpfCnpj) === normalizeDocument(client2.cpfCnpj)) {
          score += 40;
          reasons.push('CPF/CNPJ idêntico');
        }
      }

      // Email exato (peso 35)
      if (client1.email && client2.email) {
        maxScore += 35;
        if (normalizeEmail(client1.email) === normalizeEmail(client2.email)) {
          score += 35;
          reasons.push('Email idêntico');
        }
      }

      // Telefone (peso 25)
      if (client1.phone && client2.phone) {
        maxScore += 25;
        const phone1 = normalizePhone(client1.phone);
        const phone2 = normalizePhone(client2.phone);
        if (phone1 === phone2) {
          score += 25;
          reasons.push('Telefone idêntico');
        } else if (phone1.length >= 8 && phone2.length >= 8) {
          // Verifica se os últimos 8 dígitos são iguais (número sem DDD)
          const lastDigits1 = phone1.slice(-8);
          const lastDigits2 = phone2.slice(-8);
          if (lastDigits1 === lastDigits2) {
            score += 15;
            reasons.push('Número de telefone similar');
          }
        }
      }

      // Nome (peso 20, mas com cálculo de similaridade)
      maxScore += 20;
      const nameSimilarity = calculateNameSimilarity(client1.name, client2.name);
      if (nameSimilarity >= 0.9) {
        score += 20;
        reasons.push('Nome muito similar');
      } else if (nameSimilarity >= 0.7) {
        score += 10;
        reasons.push('Nome similar');
      }

      // Data de nascimento (peso 10)
      if (client1.birthDate && client2.birthDate) {
        maxScore += 10;
        if (client1.birthDate === client2.birthDate) {
          score += 10;
          reasons.push('Data de nascimento idêntica');
        }
      }

      // Endereço (peso 5)
      if (client1.address && client2.address && client1.city && client2.city) {
        maxScore += 5;
        if (normalizeName(client1.address) === normalizeName(client2.address) &&
            normalizeName(client1.city) === normalizeName(client2.city)) {
          score += 5;
          reasons.push('Endereço idêntico');
        }
      }

      // Calcular porcentagem final
      const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

      let confidence: 'high' | 'medium' | 'low';
      if (percentage >= 70 || score >= 60) {
        confidence = 'high';
      } else if (percentage >= 40 || score >= 30) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      return {
        score: percentage,
        reasons,
        confidence
      };
    };

    // Algoritmo melhorado para detectar duplicatas
    clients.forEach(client => {
      if (processed.has(client.id)) return;

      const duplicates: Array<{ client: Client; similarity: SimilarityScore }> = [];

      clients.forEach(other => {
        if (other.id === client.id || processed.has(other.id)) return;

        const similarity = calculateSimilarity(client, other);

        // Threshold mais inteligente baseado na confiança
        const shouldInclude =
          (similarity.confidence === 'high' && similarity.score >= 60) ||
          (similarity.confidence === 'medium' && similarity.score >= 40) ||
          (similarity.confidence === 'low' && similarity.score >= 30);

        if (shouldInclude) {
          duplicates.push({ client: other, similarity });
        }
      });

      if (duplicates.length > 0) {
        const allClients = [client, ...duplicates.map(d => d.client)];
        allClients.forEach(c => processed.add(c.id));

        // Determinar a melhor confiança do grupo
        const bestSimilarity = duplicates.reduce((best, current) =>
          current.similarity.score > best.score ? current.similarity : best,
          { score: 0, confidence: 'low' as const, reasons: [] }
        );

        groups.push({
          clients: allClients,
          confidence: bestSimilarity.confidence,
          score: bestSimilarity.score
        });
      }
    });

    const totalCount = groups.reduce((sum, group) => sum + group.clients.length, 0);
    const highConfidence = groups.filter(g => g.confidence === 'high').reduce((sum, group) => sum + group.clients.length, 0);
    const mediumConfidence = groups.filter(g => g.confidence === 'medium').reduce((sum, group) => sum + group.clients.length, 0);
    const lowConfidence = groups.filter(g => g.confidence === 'low').reduce((sum, group) => sum + group.clients.length, 0);

    return {
      count: totalCount,
      highConfidence,
      mediumConfidence,
      lowConfidence
    };
  }, [clients]);

  return { duplicateAlert };
}
