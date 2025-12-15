import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Users, CheckCircle, FileText, Calendar, Loader2 } from 'lucide-react';
import { Client } from '@/types';
import { useSafeMerge, ClientRelationships, SmartMergeField } from '@/hooks/useSafeMerge';
import { SafeMergePreview } from './SafeMergePreview';
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
  const [secondaryClient, setSecondaryClient] = useState<Client | null>(null);
  const [relationshipsMap, setRelationshipsMap] = useState<Map<string, ClientRelationships>>(new Map());
  const [smartMergeFields, setSmartMergeFields] = useState<SmartMergeField[]>([]);
  const [showMergePreview, setShowMergePreview] = useState(false);

  const { 
    fetchClientRelationships, 
    calculateSmartMergeFields, 
    executeSafeMerge, 
    isLoading, 
    isMerging 
  } = useSafeMerge();

  // Funções auxiliares
  const normalizeName = (name: string): string => {
    return name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(da|de|do|dos|das)\b/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
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

    if (client1.cpfCnpj && client2.cpfCnpj) {
      maxScore += 40;
      if (normalizeDocument(client1.cpfCnpj) === normalizeDocument(client2.cpfCnpj)) {
        score += 40;
        reasons.push('CPF/CNPJ idêntico');
      }
    }

    if (client1.email && client2.email) {
      maxScore += 35;
      if (normalizeEmail(client1.email) === normalizeEmail(client2.email)) {
        score += 35;
        reasons.push('Email idêntico');
      }
    }

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
          reasons.push('Número similar');
        }
      }
    }

    maxScore += 20;
    const nameSimilarity = calculateNameSimilarity(client1.name, client2.name);
    if (nameSimilarity >= 0.9) {
      score += 20;
      reasons.push('Nome muito similar');
    } else if (nameSimilarity >= 0.7) {
      score += 10;
      reasons.push('Nome similar');
    }

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

    groups.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
        return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      }
      return b.score - a.score;
    });

    setDuplicateGroups(groups);
  };

  // Buscar relacionamentos quando um grupo é selecionado
  useEffect(() => {
    if (selectedGroup) {
      const clientIds = selectedGroup.clients.map(c => c.id);
      fetchClientRelationships(clientIds).then(relationships => {
        const map = new Map<string, ClientRelationships>();
        relationships.forEach(r => map.set(r.clientId, r));
        setRelationshipsMap(map);
      });
    }
  }, [selectedGroup]);

  // Calcular smart merge quando os clientes são selecionados
  useEffect(() => {
    if (primaryClient && secondaryClient) {
      const fields = calculateSmartMergeFields(primaryClient, secondaryClient);
      setSmartMergeFields(fields);
    }
  }, [primaryClient, secondaryClient]);

  // Selecionar cliente para merge (sistema par-a-par)
  const handleSelectClientForMerge = (client: Client) => {
    if (!primaryClient) {
      setPrimaryClient(client);
    } else if (primaryClient.id === client.id) {
      setPrimaryClient(null);
      setSecondaryClient(null);
    } else if (secondaryClient?.id === client.id) {
      setSecondaryClient(null);
    } else {
      setSecondaryClient(client);
    }
  };

  // Trocar primário/secundário
  const handleSwapClients = () => {
    if (primaryClient && secondaryClient) {
      const temp = primaryClient;
      setPrimaryClient(secondaryClient);
      setSecondaryClient(temp);
    }
  };

  // Executar merge seguro
  const handleConfirmMerge = async (fieldsToInherit: SmartMergeField[]) => {
    if (!primaryClient || !secondaryClient) return;

    const result = await executeSafeMerge(primaryClient, [secondaryClient], fieldsToInherit);

    if (result.success) {
      // Remover clientes mesclados do grupo
      const updatedClients = selectedGroup!.clients.filter(
        c => c.id !== secondaryClient.id
      );

      if (updatedClients.length <= 1) {
        // Se sobrou só um cliente, remover o grupo
        setDuplicateGroups(prev => prev.filter(g => g.id !== selectedGroup!.id));
        setSelectedGroup(null);
      } else {
        // Atualizar grupo com clientes restantes
        const updatedGroup = { ...selectedGroup!, clients: updatedClients };
        setDuplicateGroups(prev => 
          prev.map(g => g.id === selectedGroup!.id ? updatedGroup : g)
        );
        setSelectedGroup(updatedGroup);
      }

      setPrimaryClient(null);
      setSecondaryClient(null);
      setShowMergePreview(false);
      onDeduplicationComplete();
    }
  };

  // Cancelar merge preview
  const handleCancelMerge = () => {
    setShowMergePreview(false);
  };

  // Reset ao fechar modal
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedGroup(null);
      setPrimaryClient(null);
      setSecondaryClient(null);
      setShowMergePreview(false);
      setRelationshipsMap(new Map());
    }
  };

  useEffect(() => {
    if (isOpen) {
      detectDuplicates();
    }
  }, [isOpen, clients]);

  const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.clients.length, 0);

  const getRelationshipCount = (clientId: string) => {
    const rel = relationshipsMap.get(clientId);
    if (!rel) return { total: 0, apolices: 0, appointments: 0, sinistros: 0 };
    return {
      total: rel.apolicesCount + rel.appointmentsCount + rel.sinistrosCount,
      apolices: rel.apolicesCount,
      appointments: rel.appointmentsCount,
      sinistros: rel.sinistrosCount
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users size={16} />
          Deduplicar ({totalDuplicates > 0 ? totalDuplicates : 0})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} />
            Deduplicação Segura de Clientes
          </DialogTitle>
        </DialogHeader>

        {duplicateGroups.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto mb-4 text-emerald-500" size={48} />
            <h3 className="text-lg font-medium mb-2">
              Nenhuma duplicata encontrada
            </h3>
            <p className="text-muted-foreground">
              Todos os clientes parecem ser únicos.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {!selectedGroup ? (
              // Lista de grupos de duplicatas
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Encontradas {duplicateGroups.length} possíveis duplicatas envolvendo {totalDuplicates} clientes:
                </p>
                {duplicateGroups.map((group) => (
                  <Card key={group.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
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
                          >
                            Revisar
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            Score: {group.score.toFixed(0)}%
                          </span>
                          <div className="h-2 bg-muted rounded-full flex-1 max-w-[100px]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                group.confidence === 'high' ? 'bg-destructive' :
                                group.confidence === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(group.score, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {group.reasons.map((reason, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.clients.map(client => (
                            <Badge key={client.id} variant="secondary" className="text-xs">
                              {client.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : showMergePreview && primaryClient && secondaryClient ? (
              // Safe Merge Preview (Split View)
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMergePreview(false)}
                  >
                    ← Voltar
                  </Button>
                  <h3 className="text-lg font-medium">
                    Confirmar Mesclagem
                  </h3>
                </div>
                
                <SafeMergePreview
                  primaryClient={primaryClient}
                  secondaryClient={secondaryClient}
                  primaryRelationships={relationshipsMap.get(primaryClient.id) || {
                    clientId: primaryClient.id,
                    apolicesCount: 0,
                    appointmentsCount: 0,
                    sinistrosCount: 0
                  }}
                  secondaryRelationships={relationshipsMap.get(secondaryClient.id) || {
                    clientId: secondaryClient.id,
                    apolicesCount: 0,
                    appointmentsCount: 0,
                    sinistrosCount: 0
                  }}
                  smartMergeFields={smartMergeFields}
                  onConfirm={handleConfirmMerge}
                  onCancel={handleCancelMerge}
                  onSwap={handleSwapClients}
                  isProcessing={isMerging}
                />
              </div>
            ) : (
              // Seleção de clientes (par-a-par)
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedGroup(null);
                      setPrimaryClient(null);
                      setSecondaryClient(null);
                    }}
                  >
                    ← Voltar
                  </Button>
                  <h3 className="text-lg font-medium">
                    Selecionar Clientes para Mesclar
                  </h3>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
                  <h4 className="font-medium mb-2">Mesclagem Par-a-Par (Segura):</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>1️⃣ Clique no cliente que será <strong>MANTIDO</strong> (borda verde)</li>
                    <li>2️⃣ Clique no cliente que será <strong>REMOVIDO</strong> (borda vermelha)</li>
                    <li>3️⃣ Revise e confirme a mesclagem</li>
                    <li>4️⃣ Se houver mais clientes, repita o processo</li>
                  </ul>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Carregando informações...</span>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedGroup.clients.map((client) => {
                        const isPrimary = primaryClient?.id === client.id;
                        const isSecondary = secondaryClient?.id === client.id;
                        const rel = getRelationshipCount(client.id);
                        
                        return (
                          <Card 
                            key={client.id} 
                            className={`cursor-pointer transition-all ${
                              isPrimary 
                                ? 'border-emerald-500 bg-emerald-500/10' 
                                : isSecondary
                                  ? 'border-destructive bg-destructive/10'
                                  : 'hover:bg-muted/50'
                            }`}
                            onClick={() => handleSelectClientForMerge(client)}
                          >
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  {isPrimary && <Badge className="bg-emerald-600">MANTER</Badge>}
                                  {isSecondary && <Badge variant="destructive">REMOVER</Badge>}
                                  {client.name}
                                </span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <div className="text-muted-foreground">
                                <strong>Email:</strong> {client.email || '—'}
                              </div>
                              <div className="text-muted-foreground">
                                <strong>Telefone:</strong> {client.phone || '—'}
                              </div>
                              <div className="text-muted-foreground">
                                <strong>CPF/CNPJ:</strong> {client.cpfCnpj || '—'}
                              </div>
                              
                              {/* Relacionamentos */}
                              <div className="flex items-center gap-3 pt-2 border-t">
                                <span className="flex items-center gap-1 text-xs">
                                  <FileText className="h-3 w-3 text-blue-500" />
                                  {rel.apolices} apólices
                                </span>
                                <span className="flex items-center gap-1 text-xs">
                                  <Calendar className="h-3 w-3 text-purple-500" />
                                  {rel.appointments} agendamentos
                                </span>
                                <span className="flex items-center gap-1 text-xs">
                                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                                  {rel.sinistros} sinistros
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {primaryClient && secondaryClient && (
                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPrimaryClient(null);
                            setSecondaryClient(null);
                          }}
                        >
                          Limpar Seleção
                        </Button>
                        <Button
                          onClick={() => setShowMergePreview(true)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          Revisar Mesclagem
                        </Button>
                      </div>
                    )}

                    {primaryClient && !secondaryClient && (
                      <p className="text-center text-muted-foreground text-sm py-2">
                        Agora selecione o cliente que será <strong>removido</strong>
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
