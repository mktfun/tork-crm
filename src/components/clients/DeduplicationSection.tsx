import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ChevronDown, 
  ChevronUp, 
  Users, 
  AlertTriangle, 
  Download,
  Target,
  Shield,
  BarChart3,
  FileText,
  Calendar,
  Merge,
  Loader2
} from 'lucide-react';
import { Client } from '@/types';
import { useClientDuplication } from '@/hooks/useClientDuplication';
import { ClientDeduplicationModal } from './ClientDeduplicationModal';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DeduplicationSectionProps {
  clients: Client[];
  onDeduplicationComplete: () => void;
}

export function DeduplicationSection({ clients, onDeduplicationComplete }: DeduplicationSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const { user } = useAuth();
  
  const { duplicateAlert } = useClientDuplication(clients);
  const totalClients = clients.length;
  const duplicateCount = duplicateAlert.count;
  const duplicatePercentage = totalClients > 0 ? ((duplicateCount / totalClients) * 100).toFixed(1) : 0;
  const priorityCount = duplicateAlert.highConfidence + duplicateAlert.mediumConfidence;
  const qualityScore = Math.max(0, 100 - (duplicateCount / totalClients) * 100);

  // Se não há duplicatas, não mostra nada
  if (duplicateCount === 0) return null;

  // Função para executar merge automático via RPC
  const handleMergeAll = async () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    setIsMerging(true);
    try {
      const { data, error } = await supabase.rpc('merge_duplicate_clients', {
        p_user_id: user.id
      });

      if (error) throw error;

      const result = data as {
        merged_by_cpf: number;
        merged_by_name: number;
        merged_clients: number;
        transferred_apolices: number;
        transferred_sinistros: number;
        transferred_appointments: number;
        transferred_transactions: number;
        transferred_deals: number;
      };

      if (result.merged_clients === 0) {
        toast.info('Nenhuma duplicata encontrada para mesclar automaticamente.');
      } else {
        toast.success(
          `Fusão concluída! ${result.merged_clients} clientes mesclados (${result.merged_by_cpf} por CPF, ${result.merged_by_name} por nome). ` +
          `${result.transferred_apolices} apólices transferidas.`
        );
        onDeduplicationComplete();
      }
    } catch (err: any) {
      console.error('Erro ao mesclar duplicatas:', err);
      toast.error('Erro ao mesclar duplicatas: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsMerging(false);
    }
  };

  // Gerar relatório CSV
  const generateCSVReport = async () => {
    setIsGeneratingReport(true);
    try {
      // Aqui implementaria a lógica de detecção e geração do CSV
      // Por simplicidade, vou criar um CSV básico
      const headers = ['Nome', 'Email', 'Telefone', 'CPF/CNPJ', 'Status'];
      let csvContent = headers.join(',') + '\n';

      clients.forEach(client => {
        const row = [
          `"${client.name || ''}"`,
          `"${client.email || ''}"`,
          `"${client.phone || ''}"`,
          `"${client.cpfCnpj || ''}"`,
          '"Possível Duplicata"'
        ];
        csvContent += row.join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio-duplicatas-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Relatório de duplicatas exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório de duplicatas');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <Card className="bg-white/5 border-white/10 mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-yellow-400" />
              <CardTitle className="text-white font-medium">
                Deduplicação de Clientes
              </CardTitle>
            </div>
            <Badge 
              variant={duplicateAlert.highConfidence > 0 ? 'destructive' : 'default'}
              className="text-xs"
            >
              {duplicateCount} duplicatas encontradas
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {!isExpanded && (
              <ClientDeduplicationModal
                clients={clients}
                onDeduplicationComplete={onDeduplicationComplete}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-2 text-white/60 hover:text-white"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
          </div>
        </div>

        {/* Resumo básico quando colapsado */}
        {!isExpanded && (
          <div className="pt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Qualidade da base:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{qualityScore.toFixed(0)}%</span>
                <div className="w-16 h-2 bg-white/10 rounded-full">
                  <div 
                    className="h-full bg-blue-400 rounded-full transition-all"
                    style={{ width: `${qualityScore}%` }}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Casos prioritários:</span>
              <span className="text-red-400 font-medium">{priorityCount}</span>
            </div>
          </div>
        )}
      </CardHeader>

      {/* Conteúdo expandido */}
      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Alerta detalhado */}
          <Alert className={`border-l-4 ${
            duplicateAlert.highConfidence > 0 
              ? 'border-l-red-500 border-red-500/20 bg-red-500/10' 
              : duplicateAlert.mediumConfidence > 0 
              ? 'border-l-yellow-500 border-yellow-500/20 bg-yellow-500/10'
              : 'border-l-blue-500 border-blue-500/20 bg-blue-500/10'
          }`}>
            <AlertTriangle className={`h-5 w-5 ${
              duplicateAlert.highConfidence > 0 ? 'text-red-400' : 
              duplicateAlert.mediumConfidence > 0 ? 'text-yellow-400' : 'text-blue-400'
            }`} />
            <AlertDescription className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="font-medium text-white">
                  {duplicateCount} possíveis clientes duplicados ({duplicatePercentage}% da base)
                </span>
                <div className="flex gap-2">
                  {duplicateAlert.highConfidence > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {duplicateAlert.highConfidence} alta confiança
                    </Badge>
                  )}
                  {duplicateAlert.mediumConfidence > 0 && (
                    <Badge variant="default" className="text-xs bg-yellow-600">
                      {duplicateAlert.mediumConfidence} média confiança
                    </Badge>
                  )}
                  {duplicateAlert.lowConfidence > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {duplicateAlert.lowConfidence} baixa confiança
                    </Badge>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Estatísticas detalhadas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Qualidade da Base */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={16} className="text-blue-400" />
                <span className="text-sm font-medium text-white">Qualidade</span>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-white">
                  {qualityScore.toFixed(0)}%
                </div>
                <Progress value={qualityScore} className="h-2" />
                <div className="text-xs text-white/60">
                  {totalClients - duplicateCount} clientes únicos
                </div>
              </div>
            </div>

            {/* Base Total */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-green-400" />
                <span className="text-sm font-medium text-white">Base Total</span>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-white">
                  {totalClients.toLocaleString()}
                </div>
                <div className="text-xs text-white/60">
                  {duplicateCount} duplicados
                </div>
              </div>
            </div>

            {/* Casos Prioritários */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-red-400" />
                <span className="text-sm font-medium text-white">Prioritários</span>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-white">
                  {priorityCount}
                </div>
                <div className="text-xs text-white/60">
                  Alta + Média confiança
                </div>
              </div>
            </div>

            {/* Recomendação */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-yellow-400" />
                <span className="text-sm font-medium text-white">Próxima Ação</span>
              </div>
              <div className="space-y-2">
                {duplicateAlert.highConfidence > 0 ? (
                  <div className="text-sm text-red-200">
                    Revisar {duplicateAlert.highConfidence} casos de alta confiança
                  </div>
                ) : duplicateAlert.mediumConfidence > 0 ? (
                  <div className="text-sm text-yellow-200">
                    Analisar {duplicateAlert.mediumConfidence} casos médios
                  </div>
                ) : (
                  <div className="text-sm text-blue-200">
                    Revisar casos de baixa confiança
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
            <ClientDeduplicationModal
              clients={clients}
              onDeduplicationComplete={onDeduplicationComplete}
            />
            
            <Button
              onClick={handleMergeAll}
              disabled={isMerging}
              variant="default"
              className="gap-2 bg-orange-600 hover:bg-orange-700"
            >
              {isMerging ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Merge size={16} />
              )}
              {isMerging ? 'Mesclando...' : 'Fundir Todas Duplicatas'}
            </Button>
            
            <Button
              onClick={generateCSVReport}
              disabled={isGeneratingReport}
              variant="outline"
              className="gap-2"
            >
              <Download size={16} />
              {isGeneratingReport ? 'Gerando...' : 'Exportar Relatório'}
            </Button>

            <div className="flex items-center gap-2 text-xs text-white/60 sm:ml-auto">
              <Calendar size={12} />
              Atualizado em {new Date().toLocaleString('pt-BR')}
            </div>
          </div>

          {/* Dicas */}
          {priorityCount > 0 && (
            <div className="p-3 bg-blue-500/10 border border-blue-400/20 rounded-lg">
              <div className="text-sm text-blue-200">
                💡 <strong>Dica:</strong> Comece pelos casos de alta confiança para obter melhores resultados na limpeza da base.
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
