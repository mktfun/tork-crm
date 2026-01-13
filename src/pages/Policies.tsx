import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCompanyNames } from '@/hooks/useCompanyNames';
import { useClients } from '@/hooks/useAppData';
import { PolicyFormModal } from '@/components/policies/PolicyFormModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, FileText, DollarSign, TrendingUp, AlertCircle, Download, Sparkles, SlidersHorizontal, X } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { formatDate, parseLocalDate } from '@/utils/dateUtils';
import { PolicyFilters } from '@/hooks/useFilteredPolicies';
import { Badge } from '@/components/ui/badge';
import { useSupabaseProducers } from '@/hooks/useSupabaseProducers';
import { AutoRenewalIndicator } from '@/components/policies/AutoRenewalIndicator';
import { useSupabasePoliciesPaginated } from '@/hooks/useSupabasePoliciesPaginated';
import { useSupabaseCompanies } from '@/hooks/useSupabaseCompanies';
import { usePolicyKPIs } from '@/hooks/usePolicyKPIs';
import { KpiCard } from '@/components/policies/KpiCard';
import { exportPoliciesCSV } from '@/utils/exportPoliciesCSV';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ExportPoliciesModal } from '@/components/policies/ExportPoliciesModal';
import { ImportPoliciesModal } from '@/components/policies/ImportPoliciesModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSupabaseRamos } from '@/hooks/useSupabaseRamos';

export default function Policies() {
  const { clients } = useClients();
  const { producers } = useSupabaseProducers();
  const { companies } = useSupabaseCompanies();
  const { data: ramos = [] } = useSupabaseRamos();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isNewPolicyModalOpen, setIsNewPolicyModalOpen] = useState(false);
  const [isAIImportModalOpen, setIsAIImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  // Estado de paginação e filtros
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filters, setFilters] = useState<PolicyFilters>({
    searchTerm: '',
    status: 'todos',
    insuranceCompany: 'todas',
    period: 'todos',
    producerId: 'todos',
    ramo: 'todos',
    customStart: null,
    customEnd: null,
  });

  // Usar o novo hook de paginação server-side
  const {
    policies: filteredPolicies,
    totalCount,
    totalPages,
    isLoading
  } = useSupabasePoliciesPaginated({
    page,
    limit,
    filters
  });

  // Buscar KPIs dinâmicos
  const { kpis, isLoading: kpisLoading } = usePolicyKPIs(filters);

  // Pegar seguradoras únicas dos dados carregados
  const uniqueInsuranceCompanies = useMemo(() => {
    const companyIds = new Set(companies.map(c => c.id));
    return Array.from(companyIds);
  }, [companies]);

  // Resetar para página 1 quando os filtros ou limite mudarem
  useEffect(() => {
    setPage(1);
  }, [filters, limit]);

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const seg = searchParams.get('seguradora');
    const ramo = searchParams.get('ramo');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const q = searchParams.get('q');
    setFilters(prev => ({
      ...prev,
      insuranceCompany: seg || prev.insuranceCompany,
      ramo: ramo || prev.ramo,
      period: start && end ? 'custom' : prev.period,
      customStart: start || prev.customStart || null,
      customEnd: end || prev.customEnd || null,
      searchTerm: q || prev.searchTerm,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      status: 'todos',
      insuranceCompany: 'todas',
      period: 'todos',
      producerId: 'todos',
      ramo: 'todos',
      customStart: null,
      customEnd: null,
    });
  };

  // Contagem de filtros avançados ativos
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.insuranceCompany !== 'todas') count++;
    if (filters.producerId !== 'todos') count++;
    if (filters.ramo !== 'todos') count++;
    if (filters.period !== 'todos') count++;
    if (filters.customStart) count++;
    if (filters.customEnd) count++;
    return count;
  }, [filters]);

  const handleCloseNewPolicyModal = () => {
    setIsNewPolicyModalOpen(false);
  };

  const handleExportCSV = async () => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      setIsExporting(true);
      await exportPoliciesCSV(filters, user);
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao exportar relatório');
    } finally {
      setIsExporting(false);
    }
  };

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

  // Componente de Filtros Avançados (reutilizável)
  const AdvancedFiltersContent = () => (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-white">Filtros Avançados</h4>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4 mr-1" />
            Limpar ({activeFilterCount})
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Seguradora */}
        <div>
          <Label htmlFor="insuranceCompany" className="text-slate-300 text-sm">Seguradora</Label>
          <Select
            value={filters.insuranceCompany}
            onValueChange={(value) => setFilters({ ...filters, insuranceCompany: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {companies.map(company => (
                <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ramo */}
        <div>
          <Label htmlFor="ramo" className="text-slate-300 text-sm">Ramo</Label>
          <Select
            value={filters.ramo}
            onValueChange={(value) => setFilters({ ...filters, ramo: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {ramos.map(ramo => (
                <SelectItem key={ramo.id} value={ramo.id}>{ramo.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Produtor */}
        <div>
          <Label htmlFor="producer" className="text-slate-300 text-sm">Produtor</Label>
          <Select
            value={filters.producerId}
            onValueChange={(value) => setFilters({ ...filters, producerId: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {producers.map(producer => (
                <SelectItem key={producer.id} value={producer.id}>{producer.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Período de Vencimento */}
        <div>
          <Label htmlFor="period" className="text-slate-300 text-sm">Vencimento</Label>
          <Select
            value={filters.period}
            onValueChange={(value) => setFilters({
              ...filters,
              period: value,
              customStart: value !== 'custom' ? null : filters.customStart,
              customEnd: value !== 'custom' ? null : filters.customEnd
            })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="current-month">Mês Corrente</SelectItem>
              <SelectItem value="next-30-days">Próximos 30 dias</SelectItem>
              <SelectItem value="next-90-days">Próximos 90 dias</SelectItem>
              <SelectItem value="expired">Expiradas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Data Início */}
        <div>
          <Label htmlFor="customStart" className="text-slate-300 text-sm">Vencimento (Início)</Label>
          <Input
            type="date"
            id="customStart"
            className="bg-slate-800 border-slate-700 text-white mt-1"
            value={filters.customStart || ''}
            onChange={(e) => setFilters(prev => ({
              ...prev,
              customStart: e.target.value || null,
              period: e.target.value || prev.customEnd ? 'custom' : 'todos'
            }))}
          />
        </div>

        {/* Data Fim */}
        <div>
          <Label htmlFor="customEnd" className="text-slate-300 text-sm">Vencimento (Fim)</Label>
          <Input
            type="date"
            id="customEnd"
            className="bg-slate-800 border-slate-700 text-white mt-1"
            value={filters.customEnd || ''}
            onChange={(e) => setFilters(prev => ({
              ...prev,
              customEnd: e.target.value || null,
              period: e.target.value || prev.customStart ? 'custom' : 'todos'
            }))}
          />
        </div>

        {/* Itens por página */}
        <div className="md:col-span-2">
          <Label htmlFor="limit" className="text-slate-300 text-sm">Itens por página</Label>
          <Select
            value={String(limit)}
            onValueChange={(value) => setLimit(Number(value))}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Seção de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Apólices Ativas"
          value={kpis.totalActive}
          icon={FileText}
          isLoading={kpisLoading}
        />
        <KpiCard
          title="Prêmio Total"
          value={kpis.totalPremium.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
          icon={DollarSign}
          isLoading={kpisLoading}
        />
        <KpiCard
          title="Comissão Estimada"
          value={kpis.estimatedCommission.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
          icon={TrendingUp}
          subtitle="Anual"
          isLoading={kpisLoading}
        />
        <KpiCard
          title="Vencendo em 30 dias"
          value={kpis.expiringSoon}
          icon={AlertCircle}
          variant={kpis.expiringSoon > 0 ? 'warning' : 'default'}
          isLoading={kpisLoading}
        />
      </div>

      {/* Header e Filtros */}
      <div className="flex flex-col gap-4">
        {/* Linha 1: Título e Ações */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-2xl font-bold text-white">
            Apólices <span className="text-sm text-slate-400">({totalCount} total)</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Grupo de Export - menor destaque */}
            <div className="flex gap-1">
              <Button
                onClick={handleExportCSV}
                disabled={isExporting}
                variant="outline"
                size="sm"
                className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
              >
                <Download className="w-4 h-4" />
                <span className="hidden lg:inline ml-2">{isExporting ? 'Exportando...' : 'CSV'}</span>
              </Button>
              <ExportPoliciesModal filters={filters} disabled={isLoading} />
            </div>
            
            {/* Separador visual */}
            <div className="h-6 w-px bg-slate-700 hidden md:block" />
            
            {/* Ações Principais */}
            <Button 
              onClick={() => setIsAIImportModalOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Importar Lote (OCR)
            </Button>
            
            <Button 
              onClick={() => setIsNewPolicyModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Apólice
            </Button>
          </div>
        </div>

        {/* Linha 2: Busca + Status + Filtros Avançados */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Busca */}
          <div className="flex-1 max-w-md">
            <Input
              type="search"
              placeholder="Buscar por apólice ou cliente..."
              className="bg-slate-800 border-slate-700 text-white w-full"
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
            />
          </div>

          {/* Status - visível por padrão */}
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ ...filters, status: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="Orçamento">Orçamento</SelectItem>
              <SelectItem value="Aguardando Apólice">Aguardando Apólice</SelectItem>
              <SelectItem value="Ativa">Ativa</SelectItem>
              <SelectItem value="Cancelada">Cancelada</SelectItem>
              <SelectItem value="Renovada">Renovada</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtros Avançados - Popover no Desktop, Drawer no Mobile */}
          {isMobile ? (
            <Drawer open={isAdvancedFiltersOpen} onOpenChange={setIsAdvancedFiltersOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" className="relative bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-purple-500 text-white text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent className="bg-slate-900 border-slate-700">
                <DrawerHeader>
                  <DrawerTitle className="text-white">Filtros Avançados</DrawerTitle>
                </DrawerHeader>
                <AdvancedFiltersContent />
                <div className="p-4 pt-0">
                  <DrawerClose asChild>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                      Aplicar Filtros
                    </Button>
                  </DrawerClose>
                </div>
              </DrawerContent>
            </Drawer>
          ) : (
            <Popover open={isAdvancedFiltersOpen} onOpenChange={setIsAdvancedFiltersOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="relative bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-purple-500 text-white text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] bg-slate-900 border-slate-700 p-0" align="end">
                <AdvancedFiltersContent />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Lista de Apólices */}
      <div className="grid gap-4">
        {filteredPolicies.map(policy => {
          const client = clients.find(c => c.id === policy.clientId);
          const producer = producers.find(p => p.id === policy.producerId);
          const isExpiringSoon = differenceInDays(parseLocalDate(policy.expirationDate), new Date()) <= 30;

          return (
            <div
              key={policy.id}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:bg-slate-750 transition-colors cursor-pointer"
              onClick={() => navigate(`/dashboard/policies/${policy.id}`)}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-semibold text-white">
                        {client?.name?.split(' ')[0] || 'Cliente'} - {(policy as typeof policy & { ramos?: { nome: string } }).ramos?.nome || policy.type || 'Seguro'}
                        {policy.insuredAsset && ` (${policy.insuredAsset.split(' ').slice(0, 3).join(' ')})`} - {policy.companies?.name?.split(' ')[0] || 'Cia'}
                      </h3>
                    <Badge
                      className={getStatusColor(policy.status) + " text-white"}
                    >
                      {policy.status}
                    </Badge>
                    <AutoRenewalIndicator
                      automaticRenewal={policy.automaticRenewal}
                      expirationDate={policy.expirationDate}
                      status={policy.status}
                    />
                    {isExpiringSoon && policy.status === 'Ativa' && (
                      <Badge variant="destructive" className="animate-pulse">
                        Vence em breve!
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Cliente</p>
                      <p className="text-white font-medium">{client?.name || 'Cliente não encontrado'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400">Seguradora</p>
                      <p className="text-white">{policy.companies?.name || 'Não especificada'}</p>
                    </div>

                    <div>
                      <p className="text-slate-400">Ramo</p>
                      <p className="text-white">{(policy as typeof policy & { ramos?: { nome: string } }).ramos?.nome || policy.type || 'Não especificado'}</p>
                    </div>

                    {producer && (
                      <div>
                        <p className="text-slate-400">Produtor</p>
                        <p className="text-white">{producer.name}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="text-right">
                    <p className="text-slate-400 text-sm">Prêmio</p>
                    <p className="text-white font-semibold text-lg">
                      {policy.premiumValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <p className="text-green-400 text-xs">
                      {policy.commissionRate}% comissão
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-slate-400 text-sm">Vencimento</p>
                    <p className={`font-medium ${isExpiringSoon ? 'text-red-400' : 'text-white'}`}>
                      {formatDate(policy.expirationDate)}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {differenceInDays(parseLocalDate(policy.expirationDate), new Date())} dias
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controles de Paginação */}
      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={(newPage) => setPage(newPage)}
        isLoading={isLoading}
      />

      {/* Modais */}


      {/* Modal Nova Apólice */}
      {isNewPolicyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Nova Apólice</h2>
              <Button
                onClick={handleCloseNewPolicyModal}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white"
              >
                ×
              </Button>
            </div>
            <PolicyFormModal
              onClose={handleCloseNewPolicyModal}
              onPolicyAdded={() => { }}
            />
          </div>
        </div>
      )}

      {/* Modal Importação via IA */}
      <ImportPoliciesModal
        open={isAIImportModalOpen}
        onOpenChange={setIsAIImportModalOpen}
      />

    </div>
  );
}
