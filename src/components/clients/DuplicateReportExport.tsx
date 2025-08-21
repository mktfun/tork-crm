import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Client } from '@/types';
import { toast } from 'sonner';

interface DuplicateReportExportProps {
  clients: Client[];
}

interface DuplicateGroup {
  id: string;
  clients: Client[];
  reasons: string[];
  confidence: 'high' | 'medium' | 'low';
  score: number;
}

export function DuplicateReportExport({ clients }: DuplicateReportExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Reutilizar a lógica de detecção de duplicatas
  const detectDuplicatesForReport = (): DuplicateGroup[] => {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

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

    const calculateSimilarity = (client1: Client, client2: Client) => {
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
        }
      }

      maxScore += 20;
      if (normalizeName(client1.name) === normalizeName(client2.name)) {
        score += 20;
        reasons.push('Nome muito similar');
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

    clients.forEach(client => {
      if (processed.has(client.id)) return;

      const duplicates: Array<{ client: Client; similarity: any }> = [];
      
      clients.forEach(other => {
        if (other.id === client.id || processed.has(other.id)) return;
        
        const similarity = calculateSimilarity(client, other);
        
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

        groups.push({
          id: `group-${groups.length}`,
          clients: allClients,
          reasons: bestSimilarity.reasons,
          confidence: bestSimilarity.confidence,
          score: bestSimilarity.score
        });
      }
    });

    return groups.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
        return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      }
      return b.score - a.score;
    });
  };

  const generateCSVReport = async () => {
    setIsGenerating(true);
    try {
      const duplicateGroups = detectDuplicatesForReport();
      
      if (duplicateGroups.length === 0) {
        toast.info('Nenhuma duplicata encontrada para exportar');
        return;
      }

      // Cabeçalho do CSV
      const headers = [
        'Grupo',
        'Confiança',
        'Score (%)',
        'Razões',
        'Nome',
        'Email',
        'Telefone',
        'CPF/CNPJ',
        'Data Nascimento',
        'Endereço',
        'Cidade',
        'Estado',
        'Data Criação'
      ];

      let csvContent = headers.join(',') + '\n';

      // Dados das duplicatas
      duplicateGroups.forEach((group, groupIndex) => {
        group.clients.forEach((client, clientIndex) => {
          const row = [
            `"Grupo ${groupIndex + 1}"`,
            `"${group.confidence === 'high' ? 'Alta' : group.confidence === 'medium' ? 'Média' : 'Baixa'}"`,
            `"${group.score.toFixed(1)}"`,
            `"${group.reasons.join('; ')}"`,
            `"${client.name || ''}"`,
            `"${client.email || ''}"`,
            `"${client.phone || ''}"`,
            `"${client.cpfCnpj || ''}"`,
            `"${client.birthDate ? new Date(client.birthDate).toLocaleDateString('pt-BR') : ''}"`,
            `"${client.address || ''}"`,
            `"${client.city || ''}"`,
            `"${client.state || ''}"`,
            `"${new Date(client.createdAt).toLocaleDateString('pt-BR')}"`
          ];
          csvContent += row.join(',') + '\n';
        });
        
        // Linha separadora entre grupos
        if (groupIndex < duplicateGroups.length - 1) {
          csvContent += '\n';
        }
      });

      // Download do arquivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio-duplicatas-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Relatório exportado com ${duplicateGroups.length} grupos de duplicatas`);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório de duplicatas');
    } finally {
      setIsGenerating(false);
    }
  };

  const duplicateGroups = detectDuplicatesForReport();
  const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.clients.length, 0);

  if (duplicateGroups.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            Relatório de Duplicatas
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-2 text-white/60 hover:text-white"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>

        {/* Versão resumida */}
        {!isExpanded && (
          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-white/60">
              {duplicateGroups.length} grupos • {totalDuplicates} clientes afetados
            </div>
            <Button
              onClick={generateCSVReport}
              disabled={isGenerating}
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs gap-1"
            >
              <Download size={12} />
              {isGenerating ? 'Gerando...' : 'CSV'}
            </Button>
          </div>
        )}
      </CardHeader>

      {/* Conteúdo expandido */}
      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{duplicateGroups.length}</div>
              <div className="text-white/60">Grupos</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{totalDuplicates}</div>
              <div className="text-white/60">Clientes</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-400">
                {duplicateGroups.filter(g => g.confidence === 'high').length}
              </div>
              <div className="text-white/60">Alta Prioridade</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">
                {((totalDuplicates / clients.length) * 100).toFixed(1)}%
              </div>
              <div className="text-white/60">da Base</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Calendar size={12} />
              Gerado em {new Date().toLocaleDateString('pt-BR')}
            </div>

            <Button
              onClick={generateCSVReport}
              disabled={isGenerating}
              size="sm"
              className="gap-2"
            >
              <Download size={14} />
              {isGenerating ? 'Gerando...' : 'Exportar CSV'}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
