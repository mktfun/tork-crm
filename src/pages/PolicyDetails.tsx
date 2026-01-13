import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Download, FileText, Upload, Calendar, DollarSign, Building2, User, Phone, Mail, MapPin, Edit, Calculator, ArrowRight, Ban, RotateCcw, ExternalLink } from 'lucide-react';
import { formatDate } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { usePolicies } from '@/hooks/useAppData';
import { useSupabaseClients } from '@/hooks/useSupabaseClients';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useCompanyNames } from '@/hooks/useCompanyNames';
import { useProducerNames } from '@/hooks/useProducerNames';
import { BudgetConversionModal } from '@/components/policies/BudgetConversionModal';
import { RenewPolicyModal } from '@/components/policies/RenewPolicyModal';
import { PolicyFormModal } from '@/components/policies/PolicyFormModal';
import { AutoRenewalIndicator } from '@/components/policies/AutoRenewalIndicator';
import { PolicyRenewalSection } from '@/components/policies/PolicyRenewalSection';
import type { Policy } from '@/types';
import { CommissionExtract } from '@/components/policies/CommissionExtract';
import { useToast } from '@/hooks/use-toast';

export default function PolicyDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { policies, updatePolicy, ativarEAnexarPdf, isUpdatingPolicy } = usePolicies();
  const { clients } = useSupabaseClients();
  const { getCompanyName } = useCompanyNames();
  const { getProducerName } = useProducerNames();
  const { toast } = useToast();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [client, setClient] = useState<any>(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isEditPolicyModalOpen, setIsEditPolicyModalOpen] = useState(false);

  const isBudget = policy?.status === 'Orçamento';

  usePageTitle(policy ? `${isBudget ? 'Orçamento' : 'Apólice'} ${policy.policyNumber || `ORÇ-${policy.id.slice(-8)}`}` : 'Detalhes');

  useEffect(() => {
    if (id && policies.length > 0) {
      const foundPolicy = policies.find(p => p.id === id);
      if (foundPolicy) {
        setPolicy(foundPolicy);
        
        // Buscar cliente associado
        const associatedClient = clients.find(c => c.id === foundPolicy.clientId);
        setClient(associatedClient);
      }
    }
  }, [id, policies, clients]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && policy) {
      // Validar se é PDF
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Erro',
          description: 'Apenas arquivos PDF são permitidos.',
          variant: 'destructive',
        });
        return;
      }

      // Validar tamanho (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Erro',
          description: 'O arquivo deve ter no máximo 10MB.',
          variant: 'destructive',
        });
        return;
      }

      try {
        await ativarEAnexarPdf(policy.id, file);
        
        // Mensagem de sucesso baseada no status atual
        const isCurrentlyActive = policy.status === 'Ativa';
        toast({
          title: 'Sucesso',
          description: isCurrentlyActive 
            ? 'PDF anexado com sucesso!' 
            : 'PDF anexado e apólice ativada com sucesso!',
          variant: 'default',
        });
      } catch (error) {
        console.error('Erro ao fazer upload do PDF:', error);
        toast({
          title: 'Erro',
          description: 'Erro ao anexar PDF. Tente novamente.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDownloadPdf = () => {
    if (policy?.pdfAnexado) {
      const link = document.createElement('a');
      link.href = policy.pdfAnexado.dados;
      link.download = policy.pdfAnexado.nome;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCancelPolicy = async () => {
    if (policy) {
      try {
        await updatePolicy(policy.id, { status: 'Cancelada' });
        toast({
          title: 'Sucesso',
          description: 'Apólice cancelada com sucesso.',
          variant: 'default',
        });
      } catch (error) {
        console.error('Erro ao cancelar apólice:', error);
        toast({
          title: 'Erro',
          description: 'Erro ao cancelar apólice. Tente novamente.',
          variant: 'destructive',
        });
      }
    }
  };

  if (!policy) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/policies')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>
          <div className="text-center py-12">
            <p className="text-slate-400">Registro não encontrado</p>
          </div>
        </div>
      </div>
    );
  }

  // Verificar se tem PDF (base64 OU URL do Storage)
  const hasPdf = !!(policy.pdfAnexado || policy.pdfUrl);
  
  // Determinar se deve mostrar o botão de upload
  const shouldShowUpload = policy.status === 'Aguardando Apólice' || 
                          (policy.status === 'Ativa' && !hasPdf);

  // Texto do botão baseado no status
  const getUploadButtonText = () => {
    if (policy.status === 'Aguardando Apólice') {
      return 'Anexar PDF e Ativar';
    }
    if (policy.status === 'Ativa' && !hasPdf) {
      return 'Anexar PDF';
    }
    return 'Anexar PDF';
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/policies')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                {isBudget ? (
                  <Calculator className="w-5 h-5 text-blue-400" />
                ) : (
                  <FileText className="w-5 h-5 text-green-400" />
                )}
                <h1 className="text-2xl font-bold text-white">
                  {client?.name?.split(' ')[0] || 'Cliente'} - {policy.ramos?.nome || policy.type || 'Seguro'}
                  {policy.insuredAsset && ` (${policy.insuredAsset.split(' ').slice(0, 3).join(' ')})`} - {policy.companies?.name?.split(' ')[0] || 'Cia'}
                </h1>
              </div>
              <p className="text-slate-400">{isBudget ? 'Orçamento' : 'Apólice'} {policy.policyNumber || `ORÇ-${policy.id.slice(-8)}`}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge
              variant={policy.status === 'Ativa' ? 'default' : 'secondary'}
              className={
                policy.status === 'Ativa'
                  ? 'bg-green-600/80 text-white hover:bg-green-700/80'
                  : policy.status === 'Orçamento'
                  ? 'bg-blue-600/80 text-white hover:bg-blue-700/80'
                  : policy.status === 'Cancelada'
                  ? 'bg-red-600/80 text-white hover:bg-red-700/80'
                  : 'bg-yellow-600/80 text-white hover:bg-yellow-700/80'
              }
            >
              {policy.status}
            </Badge>
            <AutoRenewalIndicator
              automaticRenewal={policy.automaticRenewal}
              expirationDate={policy.expirationDate}
              status={policy.status}
            />
            {policy.renewalStatus && (
              <Badge variant="outline">
                {policy.renewalStatus}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações da Apólice/Orçamento */}
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  {isBudget ? (
                    <>
                      <Calculator className="w-5 h-5" />
                      Detalhes do Orçamento
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Detalhes da Apólice
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">
                      {isBudget ? 'ID do Orçamento' : 'Número da Apólice'}
                    </p>
                    <p className="font-medium text-white">
                      {policy.policyNumber || `ORÇ-${policy.id.slice(-8)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Seguradora</p>
                    <p className="font-medium text-white">{policy.companies?.name || 'Seguradora não especificada'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Ramo</p>
                    <p className="font-medium text-white">{policy.ramos?.nome || policy.type || 'Ramo não especificado'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Status</p>
                    <Badge 
                      variant={policy.status === 'Ativa' ? 'default' : 'secondary'}
                      className={
                        policy.status === 'Ativa' 
                          ? 'bg-green-600/80 text-white hover:bg-green-700/80' 
                          : policy.status === 'Orçamento'
                          ? 'bg-blue-600/80 text-white hover:bg-blue-700/80'
                          : policy.status === 'Cancelada'
                          ? 'bg-red-600/80 text-white hover:bg-red-700/80'
                          : 'bg-yellow-600/80 text-white hover:bg-yellow-700/80'
                      }
                    >
                      {policy.status}
                    </Badge>
                  </div>
                </div>

                {policy.insuredAsset && (
                  <div>
                    <p className="text-sm text-slate-400">Bem Segurado</p>
                    <p className="font-medium text-white">{policy.insuredAsset}</p>
                  </div>
                )}

                {policy.producerId && (
                  <div>
                    <p className="text-sm text-slate-400">Produtor</p>
                    <p className="font-medium text-white">{getProducerName(policy.producerId)}</p>
                  </div>
                )}

                <Separator className="bg-slate-700" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Prêmio</p>
                    <p className="font-bold text-green-400">
                      {policy.premiumValue.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Comissão</p>
                    <p className="font-bold text-blue-400">
                      {policy.commissionRate}% 
                      <span className="text-sm text-slate-400 ml-2">
                        ({(policy.premiumValue * policy.commissionRate / 100).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        })})
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Data de Início</p>
                    <p className="font-medium text-white">
                      {policy.startDate ? formatDate(policy.startDate) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Data de Vencimento</p>
                    <p className="font-medium text-white">
                      {formatDate(policy.expirationDate)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informações do Cliente */}
            {client && (
              <Card className="bg-slate-900/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-lg">{client.name}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {client.phone}
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {client.email}
                        </div>
                      </div>
                    </div>
                    <Link to={`/clients/${client.id}`}>
                      <Button variant="outline" size="sm">
                        Ver Detalhes
                      </Button>
                    </Link>
                  </div>
                  
                  {client.address && (
                    <div className="flex items-start gap-2 text-sm text-slate-400">
                      <MapPin className="w-4 h-4 mt-0.5" />
                      <div>
                        {client.address}, {client.number && `${client.number}, `}
                        {client.neighborhood && `${client.neighborhood}, `}
                        {client.city} - {client.state}
                        {client.cep && ` • CEP: ${client.cep}`}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Commission Extract - only for non-budgets */}
            {!isBudget && policy && <CommissionExtract policy={policy} />}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Ações */}
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isBudget ? (
                  <BudgetConversionModal
                    budgetId={policy.id}
                    budgetDescription={`${policy.companies?.name || 'Seguradora'} - ${policy.ramos?.nome || 'Ramo'}`}
                    onConversionSuccess={() => {
                      // Refresh the page or update the policy state
                      window.location.reload();
                    }}
                  >
                    <Button className="w-full">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Converter em Apólice
                    </Button>
                  </BudgetConversionModal>
                ) : (
                  <>
                    {policy.status === 'Ativa' && (
                      <Button className="w-full" onClick={() => setIsRenewModalOpen(true)}>
                        <RotateCcw className="w-4 h-4 mr-2" /> Renovar
                      </Button>
                    )}
                    <Button variant="outline" className="w-full" onClick={() => setIsEditPolicyModalOpen(true)}>
                      <Edit className="w-4 h-4 mr-2" /> Editar Apólice
                    </Button>
                    {shouldShowUpload && (
                      <div>
                        <label htmlFor="pdf-upload">
                          <Button asChild className="w-full" disabled={isUpdatingPolicy}>
                            <span className="cursor-pointer">
                              <Upload className="w-4 h-4 mr-2" />
                              {isUpdatingPolicy ? 'Processando...' : getUploadButtonText()}
                            </span>
                          </Button>
                        </label>
                        <input
                          id="pdf-upload"
                          type="file"
                          accept=".pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          {policy.status === 'Aguardando Apólice' 
                            ? 'Anexe a apólice em PDF para ativar (máx. 10MB)'
                            : 'Anexe o PDF da apólice (máx. 10MB)'
                          }
                        </p>
                      </div>
                    )}

                    {/* PDF Anexado (base64) */}
                    {policy.pdfAnexado && (
                      <Button variant="outline" className="w-full" onClick={handleDownloadPdf}>
                        <Download className="w-4 h-4 mr-2" />
                        Baixar PDF
                      </Button>
                    )}

                    {/* PDF via URL do Storage */}
                    {policy.pdfUrl && !policy.pdfAnexado && (
                      <div className="space-y-2">
                        <Button 
                          variant="outline" 
                          className="w-full" 
                          onClick={() => window.open(policy.pdfUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Ver PDF Original
                        </Button>
                        <Button variant="outline" className="w-full" asChild>
                          <a href={policy.pdfUrl} download>
                            <Download className="w-4 h-4 mr-2" />
                            Baixar PDF
                          </a>
                        </Button>
                      </div>
                    )}

                    {(policy.status === 'Ativa' || policy.status === 'Aguardando Apólice') && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="w-full text-red-400 hover:text-red-300">
                            <Ban className="w-4 h-4 mr-2" />
                            Cancelar Apólice
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-900 border-slate-700">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Cancelar Apólice</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-300">
                              Tem certeza que deseja cancelar esta apólice? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-slate-700 text-white hover:bg-slate-600">
                              Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={handleCancelPolicy}
                              className="bg-red-600 text-white hover:bg-red-700"
                            >
                              Confirmar Cancelamento
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Informações Adicionais */}
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Informa&ccedil;&otilde;es</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-slate-400">Criado em</p>
                  <p className="text-sm text-white">
                    {new Date(policy.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                
                {policy.renewalStatus && (
                  <div>
                    <p className="text-sm text-slate-400">Status da Renovação</p>
                    <Badge variant="outline" className="text-xs">
                      {policy.renewalStatus}
                    </Badge>
                  </div>
                )}

                {policy.pdfAnexado && (
                  <div>
                    <p className="text-sm text-slate-400">PDF Anexado</p>
                    <p className="text-sm text-white">{policy.pdfAnexado.nome}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Renovação Automática - abaixo de Informações */}
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Renova&ccedil;&atilde;o Autom&aacute;tica</CardTitle>
              </CardHeader>
              <CardContent>
                <PolicyRenewalSection
                  policyId={policy.id}
                  automaticRenewal={policy.automaticRenewal}
                  expirationDate={policy.expirationDate}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {policy && (
        <>
          <RenewPolicyModal
            policy={policy}
            isOpen={isRenewModalOpen}
            onClose={() => setIsRenewModalOpen(false)}
            onSuccess={() => setIsRenewModalOpen(false)}
          />

          {isEditPolicyModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Editar Apólice</h2>
                  <Button
                    onClick={() => setIsEditPolicyModalOpen(false)}
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-white"
                  >
                    ×
                  </Button>
                </div>
                <PolicyFormModal
                  policy={policy}
                  isEditing={true}
                  onClose={() => setIsEditPolicyModalOpen(false)}
                  onPolicyAdded={() => setIsEditPolicyModalOpen(false)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
