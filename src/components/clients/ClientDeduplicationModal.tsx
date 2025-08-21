import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Merge, Users, CheckCircle, Eye } from 'lucide-react';
import { Client } from '@/types';
import { useSupabaseClients } from '@/hooks/useSupabaseClients';
import { MergePreview } from './MergePreview';
import { toast } from 'sonner';

interface DuplicateGroup {
  id: string;
  clients: Client[];
  reasons: string[];
  confidence: 'high' | 'medium' | 'low';
  score: number;
  similarityDetails: Array<{
    client1: Client;
    client2: Client;
    score: number;
    reasons: string[];
  }>;
}

interface ClientDeduplicationModalProps {
  clients: Client[];
  onDeduplicationComplete: () => void;
}

export function ClientDeduplicationModal({ clients, onDeduplicationComplete }: ClientDeduplicationModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [primaryClient, setPrimaryClient] = useState<Client | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { updateClient, deleteClient } = useSupabaseClients();

  // Funções auxiliares melhoradas
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

  const calculateNameSimilarity = (name1: string, name2: string): number => {
    const norm1 = normalizeName(name1);
    const norm2 = normalizeName(name2);

    if (norm1 === norm2) return 1.0;

    const distance = levenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);
    return 1 - (distance / maxLength);
  };

  const calculateDetailedSimilarity = (client1: Client, client2: Client) => {
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
        const lastDigits1 = phone1.slice(-8);
        const lastDigits2 = phone2.slice(-8);
        if (lastDigits1 === lastDigits2) {
          score += 15;
          reasons.push('Número similar (mesmo número, DDD diferente)');
        }
      }
    }

    // Nome (peso 20)
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

    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

    let confidence: 'high' | 'medium' | 'low';
    if (percentage >= 70 || score >= 60) {
      confidence = 'high';
    } else if (percentage >= 40 || score >= 30) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return { score: percentage, reasons, confidence };
  };

  // Detectar duplicatas com algoritmo melhorado
  const detectDuplicates = () => {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    clients.forEach(client => {
      if (processed.has(client.id)) return;

      const duplicates: Array<{ client: Client; similarity: any }> = [];

      clients.forEach(other => {
        if (other.id === client.id || processed.has(other.id)) return;

        const similarity = calculateDetailedSimilarity(client, other);

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

        const bestSimilarity = duplicates.reduce((best, current) =>
          current.similarity.score > best.score ? current.similarity : best,
          { score: 0, confidence: 'low' as const, reasons: [] }
        );

        const similarityDetails = duplicates.map(d => ({
          client1: client,
          client2: d.client,
          score: d.similarity.score,
          reasons: d.similarity.reasons
        }));

        groups.push({
          id: `group-${groups.length}`,
          clients: allClients,
          reasons: bestSimilarity.reasons,
          confidence: bestSimilarity.confidence,
          score: bestSimilarity.score,
          similarityDetails
        });
      }
    });

    // Ordenar grupos por confiança e score
    groups.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
        return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      }
      return b.score - a.score;
    });

    setDuplicateGroups(groups);
  };


  // Mesclar clientes
  const handleMergeClients = async () => {
    if (!selectedGroup || !primaryClient) return;

    setIsProcessing(true);
    try {
      const secondaryClients = selectedGroup.clients.filter(c => c.id !== primaryClient.id);
      
      // Lógica inteligente de mesclagem
      const mergedData: Partial<Client> = {
        name: primaryClient.name,
        email: primaryClient.email || secondaryClients.find(c => c.email)?.email,
        phone: primaryClient.phone || secondaryClients.find(c => c.phone)?.phone,
        cpfCnpj: primaryClient.cpfCnpj || secondaryClients.find(c => c.cpfCnpj)?.cpfCnpj,
        birthDate: primaryClient.birthDate || secondaryClients.find(c => c.birthDate)?.birthDate,
        maritalStatus: primaryClient.maritalStatus || secondaryClients.find(c => c.maritalStatus)?.maritalStatus,
        profession: primaryClient.profession || secondaryClients.find(c => c.profession)?.profession,
        cep: primaryClient.cep || secondaryClients.find(c => c.cep)?.cep,
        address: primaryClient.address || secondaryClients.find(c => c.address)?.address,
        number: primaryClient.number || secondaryClients.find(c => c.number)?.number,
        complement: primaryClient.complement || secondaryClients.find(c => c.complement)?.complement,
        neighborhood: primaryClient.neighborhood || secondaryClients.find(c => c.neighborhood)?.neighborhood,
        city: primaryClient.city || secondaryClients.find(c => c.city)?.city,
        state: primaryClient.state || secondaryClients.find(c => c.state)?.state,
        observations: [
          primaryClient.observations,
          ...secondaryClients.map(c => c.observations).filter(Boolean)
        ].filter(Boolean).join('\n\n=== MESCLADO AUTOMATICAMENTE ===\n\n')
      };

      // Log da mescla para auditoria
      console.log('Mesclando clientes:', {
        principal: primaryClient.name,
        secundarios: secondaryClients.map(c => c.name),
        dadosMesclados: mergedData
      });

      // Atualizar o cliente principal
      await updateClient(primaryClient.id, mergedData);

      // Deletar os clientes secundários
      for (const client of secondaryClients) {
        await deleteClient(client.id);
      }

      // Remover o grupo processado
      setDuplicateGroups(prev => prev.filter(g => g.id !== selectedGroup.id));
      setSelectedGroup(null);
      setPrimaryClient(null);
      
      toast.success(`${secondaryClients.length + 1} clientes mesclados com sucesso!`, {
        description: `Cliente principal: ${primaryClient.name}. ${secondaryClients.length} duplicatas removidas.`
      });
      onDeduplicationComplete();
    } catch (error) {
      console.error('Erro ao mesclar clientes:', error);
      toast.error('Erro ao mesclar clientes');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      detectDuplicates();
    }
  }, [isOpen, clients]);

  const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.clients.length, 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users size={16} />
          Deduplicar ({totalDuplicates > 0 ? totalDuplicates : 0})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-yellow-500" size={20} />
            Deduplicação de Clientes
          </DialogTitle>
        </DialogHeader>

        {duplicateGroups.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
            <h3 className="text-lg font-medium text-white mb-2">
              Nenhuma duplicata encontrada
            </h3>
            <p className="text-white/60">
              Todos os clientes parecem ser únicos.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {!selectedGroup ? (
              // Lista de grupos de duplicatas
              <div className="space-y-3">
                <p className="text-white/80">
                  Encontradas {duplicateGroups.length} possíveis duplicatas envolvendo {totalDuplicates} clientes:
                </p>
                {duplicateGroups.map((group) => (
                  <Card key={group.id} className="bg-white/5 border-white/10">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-sm">
                          {group.clients.length} clientes similares
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={group.confidence === 'high' ? 'destructive' : 
                                   group.confidence === 'medium' ? 'default' : 'secondary'}
                          >
                            {group.confidence === 'high' ? 'Alta' : 
                             group.confidence === 'medium' ? 'Média' : 'Baixa'} confiança
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => setSelectedGroup(group)}
                            className="gap-1"
                          >
                            <Merge size={14} />
                            Revisar
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white/80">
                            Score: {group.score.toFixed(0)}%
                          </span>
                          <div className="h-2 bg-white/10 rounded-full flex-1 max-w-[100px]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                group.confidence === 'high' ? 'bg-red-400' :
                                group.confidence === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                              }`}
                              style={{ width: `${Math.min(group.score, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-white/60">Razões da similaridade:</p>
                          <div className="flex flex-wrap gap-1">
                            {group.reasons.map((reason, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-white/60">Clientes envolvidos:</p>
                          <div className="flex flex-wrap gap-2">
                            {group.clients.map(client => (
                              <Badge key={client.id} variant="secondary" className="text-xs">
                                {client.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              // Interface de mesclagem
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedGroup(null)}
                  >
                    ← Voltar
                  </Button>
                  <h3 className="text-lg font-medium text-white">
                    Mesclar Clientes Duplicados
                  </h3>
                </div>

                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
                  <h4 className="text-white font-medium mb-2">Como funciona a mescla:</h4>
                  <ul className="text-sm text-white/80 space-y-1">
                    <li>• O cliente selecionado será mantido como principal</li>
                    <li>• Dados em branco serão preenchidos com informações dos outros clientes</li>
                    <li>• Observações serão combinadas</li>
                    <li>• Os clientes duplicados serão removidos</li>
                  </ul>
                </div>

                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-400/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-yellow-400" />
                    <span className="text-yellow-200 font-medium">Detalhes da Similaridade</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    {selectedGroup.similarityDetails.map((detail, idx) => (
                      <div key={idx} className="text-white/70">
                        <span className="font-medium">{detail.client1.name}</span> ↔ <span className="font-medium">{detail.client2.name}</span>
                        <div className="ml-4 text-xs text-white/60">
                          Score: {detail.score.toFixed(0)}% | {detail.reasons.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedGroup.clients.map((client) => (
                    <Card 
                      key={client.id} 
                      className={`cursor-pointer transition-all ${
                        primaryClient?.id === client.id 
                          ? 'bg-blue-500/20 border-blue-400' 
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                      onClick={() => setPrimaryClient(client)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          {primaryClient?.id === client.id && <CheckCircle size={16} className="text-blue-400" />}
                          {client.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="text-white/60">
                          <strong>Email:</strong> {client.email || 'Não informado'}
                        </div>
                        <div className="text-white/60">
                          <strong>Telefone:</strong> {client.phone || 'Não informado'}
                        </div>
                        <div className="text-white/60">
                          <strong>CPF/CNPJ:</strong> {client.cpfCnpj || 'Não informado'}
                        </div>
                        <div className="text-white/60">
                          <strong>Criado em:</strong> {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                        {client.observations && (
                          <div className="text-white/60">
                            <strong>Observações:</strong> {client.observations.slice(0, 50)}{client.observations.length > 50 ? '...' : ''}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {primaryClient && (
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedGroup(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleMergeClients}
                      disabled={isProcessing}
                      className="gap-2"
                    >
                      <Merge size={16} />
                      {isProcessing ? 'Mesclando...' : 'Mesclar Clientes'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
