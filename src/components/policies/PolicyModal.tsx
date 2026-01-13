
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  User, 
  Building2, 
  Calendar, 
  DollarSign, 
  Percent,
  Download,
  Eye,
  Edit3,
  RotateCcw,
  CheckCircle,
  X,
  ExternalLink
} from 'lucide-react';
import { Policy } from '@/types';
import { useSupabaseClients } from '@/hooks/useSupabaseClients';
import { usePolicies } from '@/hooks/useAppData';
import { AutoRenewalIndicator } from './AutoRenewalIndicator';
import { PolicyRenewalSection } from './PolicyRenewalSection';
import { PolicyCancelConfirmModal } from './PolicyCancelConfirmModal';
import { toast } from '@/hooks/use-toast';
import { formatDate } from '@/utils/dateUtils';

interface PolicyModalProps {
  policy: Policy | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (policy: Policy) => void;
  onRenew: (policy: Policy) => void;
}

export function PolicyModal({ policy, isOpen, onClose, onEdit, onRenew }: PolicyModalProps) {
  const { clients } = useSupabaseClients();
  const { updatePolicy } = usePolicies();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!policy) return null;

  const client = clients.find(c => c.id === policy.clientId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ativa': return 'bg-green-600';
      case 'Orçamento': return 'bg-blue-600';
      case 'Aguardando Apólice': return 'bg-yellow-600';
      case 'Cancelada': return 'bg-red-600';
      case 'Renovada': return 'bg-purple-600';
      default: return 'bg-gray-600';
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleActivatePolicy = async () => {
    if (policy.status !== 'Orçamento') return;
    
    setIsUpdating(true);
    try {
      await updatePolicy(policy.id, { status: 'Ativa' });
      toast({
        title: "Apólice ativada",
        description: "A apólice foi ativada com sucesso.",
      });
      onClose();
    } catch (error) {
      console.error('Erro ao ativar apólice:', error);
      toast({
        title: "Erro ao ativar",
        description: "Ocorreu um erro ao ativar a apólice.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelPolicy = async () => {
    if (!policy) return;
    
    setIsUpdating(true);
    try {
      await updatePolicy(policy.id, { status: 'Cancelada' });
      toast({
        title: "Apólice cancelada",
        description: "A apólice foi cancelada com sucesso.",
      });
      setIsCancelModalOpen(false);
      onClose();
    } catch (error) {
      console.error('Erro ao cancelar apólice:', error);
      toast({
        title: "Erro ao cancelar",
        description: "Ocorreu um erro ao cancelar a apólice.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadPdf = () => {
    if (policy.pdfAnexado?.dados) {
      const link = document.createElement('a');
      link.href = policy.pdfAnexado.dados;
      link.download = policy.pdfAnexado.nome;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Detalhes da Apólice {policy.policyNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Cabeçalho com Status e Renovação Automática */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={`${getStatusColor(policy.status)} text-white`}>
                  {policy.status}
                </Badge>
                <AutoRenewalIndicator 
                  automaticRenewal={policy.automaticRenewal}
                  expirationDate={policy.expirationDate}
                  status={policy.status}
                  size="md"
                />
              </div>
              
              <div className="flex gap-2">
                {/* Botão Ativar Apólice - apenas para Orçamentos */}
                {policy.status === 'Orçamento' && (
                  <Button
                    onClick={handleActivatePolicy}
                    disabled={isUpdating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {isUpdating ? 'Ativando...' : 'Ativar Apólice'}
                  </Button>
                )}
                
                {/* Botão Renovar - apenas para apólices Ativa */}
                {policy.status === 'Ativa' && (
                  <Button
                    onClick={() => onRenew(policy)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Renovar
                  </Button>
                )}
                
                {/* Botão Editar - sempre visível */}
                <Button
                  onClick={() => onEdit(policy)}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                
                {/* Botão Cancelar - sempre visível, exceto para já canceladas */}
                {policy.status !== 'Cancelada' && (
                  <Button
                    onClick={() => setIsCancelModalOpen(true)}
                    variant="destructive"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>

            {/* Informações Básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-slate-800 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Cliente
                  </h3>
                  <p className="text-white font-medium">{client?.name || 'Cliente não encontrado'}</p>
                  {client?.phone && (
                    <p className="text-slate-400 text-sm mt-1">{client.phone}</p>
                  )}
                  {client?.email && (
                    <p className="text-slate-400 text-sm">{client.email}</p>
                  )}
                </div>

                <div className="bg-slate-800 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Seguradora & Produto
                  </h3>
                  <p className="text-white font-medium">{policy.companies?.name || 'Não especificada'}</p>
                  <p className="text-slate-400 text-sm mt-1">{policy.ramos?.nome || policy.type || 'Ramo não especificado'}</p>
                  <p className="text-slate-300 text-sm mt-2">
                    <strong>Bem Segurado:</strong> {policy.insuredAsset}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-800 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Datas
                  </h3>
                  <div className="space-y-2">
                    {policy.startDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Início:</span>
                        <span className="text-white">
                          {formatDate(policy.startDate)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Vencimento:</span>
                      <span className="text-white">
                        {formatDate(policy.expirationDate)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Criada em:</span>
                      <span className="text-white">
                        {formatDate(policy.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Valores
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Prêmio:</span>
                      <span className="text-white font-medium">
                        {formatCurrency(policy.premiumValue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Comissão:</span>
                      <span className="text-green-400 font-medium flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        {policy.commissionRate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Valor Comissão:</span>
                      <span className="text-green-400 font-medium">
                        {formatCurrency(policy.premiumValue * (policy.commissionRate / 100))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PDF Anexado (base64) */}
            {policy.pdfAnexado && (
              <div className="bg-slate-800 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-slate-300 mb-3">PDF da Apólice</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-red-400" />
                    <span className="text-white">{policy.pdfAnexado.nome}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDownloadPdf}
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-slate-300"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* PDF via URL do Storage */}
            {policy.pdfUrl && !policy.pdfAnexado && (
              <div className="bg-slate-800 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-slate-300 mb-3">PDF da Apólice</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-red-400" />
                    <span className="text-white">Documento PDF</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => window.open(policy.pdfUrl, '_blank')}
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-slate-300"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Abrir
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-slate-300"
                    >
                      <a href={policy.pdfUrl} download>
                        <Download className="w-4 h-4 mr-1" />
                        Baixar
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Seção de Renovação Automática */}
            <PolicyRenewalSection
              policyId={policy.id}
              automaticRenewal={policy.automaticRenewal}
              expirationDate={policy.expirationDate}
            />

            {/* Informações Adicionais */}
            {(policy.bonus_class || policy.renewalStatus) && (
              <>
                <Separator className="bg-slate-700" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {policy.bonus_class && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-300 mb-2">Classe de Bônus</h4>
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        Classe {policy.bonus_class}
                      </Badge>
                    </div>
                  )}
                  {policy.renewalStatus && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-300 mb-2">Status de Renovação</h4>
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {policy.renewalStatus}
                      </Badge>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Cancelamento */}
      <PolicyCancelConfirmModal
        policy={policy}
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleCancelPolicy}
        isLoading={isUpdating}
      />
    </>
  );
}
