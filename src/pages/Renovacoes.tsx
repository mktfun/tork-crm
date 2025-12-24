import { useState } from 'react';
import { AppCard } from '@/components/ui/app-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Calendar, Clock, AlertTriangle, CheckCircle, RotateCcw, Filter, Loader2 } from 'lucide-react';
import { formatDate } from '@/utils/dateUtils';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useCompanyNames } from '@/hooks/useCompanyNames';
import { useSupabaseRenewals } from '@/hooks/useSupabaseRenewals';
import { usePolicies } from '@/hooks/useAppData';
import { Policy } from '@/types';
import { RenewPolicyModal } from '@/components/policies/RenewPolicyModal';
import { ExportRenewalsModal } from '@/components/policies/ExportRenewalsModal';

export default function Renovacoes() {
  usePageTitle('Renovações');
  
  const { updatePolicy } = usePolicies();
  const { getCompanyName, loading: companiesLoading } = useCompanyNames();
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('60');
  const [currentPage, setCurrentPage] = useState(1);
  
  const pageSize = 12; // 12 cards por página

  // Usar o novo hook especializado
  // Converter para número: "all" = -1, outros = parseInt
  const periodNumber = filterPeriod === 'all' ? -1 : parseInt(filterPeriod);
  
  const { renewals, totalCount, loading, error, refetch } = useSupabaseRenewals(
    {
      period: periodNumber,
      renewalStatus: filterStatus
    },
    {
      page: currentPage,
      pageSize
    }
  );

  const totalPages = Math.ceil(totalCount / pageSize);

  const updateRenewalStatus = async (policyId: string, newStatus: Policy['renewalStatus']) => {
    await updatePolicy(policyId, { renewalStatus: newStatus });
    refetch(); // Recarregar dados após atualização
  };

  const handleRenewClick = (policy: any) => {
    setSelectedPolicy(policy);
    setIsRenewModalOpen(true);
  };

  const handleRenewSuccess = () => {
    setSelectedPolicy(null);
    setIsRenewModalOpen(false);
    refetch(); // Recarregar dados após renovação
  };

  const handleFilterChange = (newFilter: string, type: 'status' | 'period') => {
    if (type === 'status') {
      setFilterStatus(newFilter);
    } else {
      setFilterPeriod(newFilter);
    }
    setCurrentPage(1); // Resetar para primeira página ao filtrar
  };

  const getRenewalStatusBadge = (status: string, diasParaVencer: number) => {
    if (diasParaVencer < 0 && status === 'Pendente') {
      return <Badge variant="destructive">Vencida - Pendente</Badge>;
    }
    
    switch (status) {
      case 'Pendente':
        return <Badge variant="outline" className="text-yellow-400 border-yellow-500">Pendente</Badge>;
      case 'Em Contato':
        return <Badge variant="outline" className="text-blue-400 border-blue-500">Em Contato</Badge>;
      case 'Proposta Enviada':
        return <Badge variant="outline" className="text-purple-400 border-purple-500">Proposta Enviada</Badge>;
      case 'Renovada':
        return <Badge variant="default" className="text-green-400 border-green-500 bg-green-500/10">Renovada</Badge>;
      case 'Não Renovada':
        return <Badge variant="destructive">Não Renovada</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const getPriorityColor = (daysUntilExpiration: number) => {
    if (daysUntilExpiration < 0) return 'border-red-500 bg-red-500/10';
    if (daysUntilExpiration <= 15) return 'border-orange-500 bg-orange-500/10';
    if (daysUntilExpiration <= 30) return 'border-yellow-500 bg-yellow-500/10';
    return 'border-blue-500 bg-blue-500/10';
  };

  const renderPolicyCard = (policy: any) => (
    <AppCard key={policy.id} className={`p-4 ${getPriorityColor(policy.diasParaVencer)}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white">{policy.policyNumber}</h3>
          <p className="text-sm text-slate-400">{policy.clientName}</p>
        </div>
        {getRenewalStatusBadge(policy.renewalStatus || 'Pendente', policy.diasParaVencer)}
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <p className="text-slate-400">Vencimento</p>
          <p className="text-white font-medium">
            {formatDate(policy.expirationDate)}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Dias restantes</p>
          <p className={`font-bold ${policy.diasParaVencer < 0 ? 'text-red-400' : policy.diasParaVencer <= 15 ? 'text-orange-400' : 'text-blue-400'}`}>
            {policy.diasParaVencer < 0 ? `${Math.abs(policy.diasParaVencer)} dias atrasado` : `${policy.diasParaVencer} dias`}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Seguradora</p>
          <p className="text-white font-medium">
            {policy.companies?.name || 'Seguradora não especificada'}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Prêmio</p>
          <p className="text-green-400 font-bold">
            {policy.premiumValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <p className="text-xs text-slate-400">Status da Renovação</p>
          <Select
            value={policy.renewalStatus || 'Pendente'}
            onValueChange={(value) => updateRenewalStatus(policy.id, value as Policy['renewalStatus'])}
          >
            <SelectTrigger className="w-full bg-slate-800 border-slate-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Em Contato">Em Contato</SelectItem>
              <SelectItem value="Proposta Enviada">Proposta Enviada</SelectItem>
              <SelectItem value="Renovada">Renovada</SelectItem>
              <SelectItem value="Não Renovada">Não Renovada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Botão de Renovação */}
        {policy.renewalStatus !== 'Renovada' && policy.renewalStatus !== 'Não Renovada' && (
          <Button
            onClick={() => handleRenewClick(policy)}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm py-2"
            size="sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Processar Renovação
          </Button>
        )}
      </div>
    </AppCard>
  );

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <AppCard className="p-8 text-center">
            <div className="text-red-500 mb-4">
              <AlertTriangle size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Erro ao carregar renovações</h3>
            <p className="text-slate-400 mb-4">Não foi possível carregar os dados. Verifique sua conexão e tente novamente.</p>
            <Button onClick={refetch} variant="outline">
              Tentar novamente
            </Button>
          </AppCard>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Renovações</h1>
          <p className="text-slate-400">Gerencie as renovações de apólices próximas ao vencimento</p>
        </div>

        {/* Filtros */}
        <div className="mb-6">
          <AppCard className="p-4">
            <div className="flex items-center gap-4 flex-wrap justify-between">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300">Filtros:</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-400">Período:</label>
                  <Select value={filterPeriod} onValueChange={(value) => handleFilterChange(value, 'period')}>
                    <SelectTrigger className="w-32 bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="60">60 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="120">120 dias</SelectItem>
                      <SelectItem value="all">Todas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-400">Status:</label>
                  <Select value={filterStatus} onValueChange={(value) => handleFilterChange(value, 'status')}>
                    <SelectTrigger className="w-40 bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em Contato">Em Contato</SelectItem>
                      <SelectItem value="Proposta Enviada">Proposta Enviada</SelectItem>
                      <SelectItem value="Renovada">Renovada</SelectItem>
                      <SelectItem value="Não Renovada">Não Renovada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {loading && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Carregando...</span>
                  </div>
                )}
              </div>

              {/* Botão Exportar */}
              <ExportRenewalsModal disabled={loading || renewals.length === 0} />
            </div>
          </AppCard>
        </div>

        {/* Lista de Renovações */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <AppCard key={index} className="p-4 animate-pulse">
                <div className="h-4 bg-slate-700 rounded mb-2"></div>
                <div className="h-3 bg-slate-700 rounded mb-4 w-2/3"></div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="h-3 bg-slate-700 rounded"></div>
                  <div className="h-3 bg-slate-700 rounded"></div>
                </div>
                <div className="h-8 bg-slate-700 rounded"></div>
              </AppCard>
            ))}
          </div>
        ) : renewals.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {renewals.map(renderPolicyCard)}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) setCurrentPage(currentPage - 1);
                        }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(page);
                          }}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                        }}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        ) : (
          <AppCard className="p-8 text-center">
            <div className="text-slate-600 mb-4">
              <CheckCircle size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Nenhuma renovação pendente
            </h3>
            <p className="text-slate-400">
              Todas as apólices estão com renovações em dia ou não há apólices que atendem aos filtros selecionados.
            </p>
          </AppCard>
        )}

        {/* Modal de Renovação */}
        <RenewPolicyModal 
          policy={selectedPolicy}
          isOpen={isRenewModalOpen}
          onClose={() => setIsRenewModalOpen(false)}
          onSuccess={handleRenewSuccess}
        />
      </div>
    </div>
  );
}
