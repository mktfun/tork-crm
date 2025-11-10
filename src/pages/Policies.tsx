import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCompanyNames } from '@/hooks/useCompanyNames';
import { useClients } from '@/hooks/useAppData';
import { PolicyFormModal } from '@/components/policies/PolicyFormModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, FileText, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addDays, isWithinInterval, differenceInDays } from 'date-fns';
import { PolicyFilters } from '@/hooks/useFilteredPolicies';
import { Badge } from '@/components/ui/badge';
import { useSupabaseProducers } from '@/hooks/useSupabaseProducers';
import { AutoRenewalIndicator } from '@/components/policies/AutoRenewalIndicator';
import { useSupabasePoliciesPaginated } from '@/hooks/useSupabasePoliciesPaginated';
import { useSupabaseCompanies } from '@/hooks/useSupabaseCompanies';
import { usePolicyKPIs } from '@/hooks/usePolicyKPIs';
import { KpiCard } from '@/components/policies/KpiCard';

export default function Policies() {
  const { clients } = useClients();
  const { producers } = useSupabaseProducers();
  const { companies } = useSupabaseCompanies();
  const navigate = useNavigate();
  const [isNewPolicyModalOpen, setIsNewPolicyModalOpen] = useState(false);
  
  // Estado de paginação e filtros
  const [page, setPage] = useState(1);
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
    limit: 10,
    filters
  });

  // Buscar KPIs dinâmicos
  const { kpis, isLoading: kpisLoading } = usePolicyKPIs(filters);

  // Pegar seguradoras únicas dos dados carregados
  const uniqueInsuranceCompanies = useMemo(() => {
    const companyIds = new Set(companies.map(c => c.id));
    return Array.from(companyIds);
  }, [companies]);

  // Resetar para página 1 quando os filtros mudarem
  useEffect(() => {
    setPage(1);
  }, [filters]);

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




  const handleCloseNewPolicyModal = () => {
    setIsNewPolicyModalOpen(false);
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
      <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
        <div className="text-2xl font-bold text-white">
          Apólices <span className="text-sm text-slate-400">({totalCount} total)</span>
        </div>

        <div className="flex items-center space-x-4">
          <Input
            type="search"
            placeholder="Buscar por apólice ou cliente..."
            className="bg-slate-800 border-slate-700 text-white"
            value={filters.searchTerm}
            onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
          />
          <Button
            onClick={() => setIsNewPolicyModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Apólice
          </Button>
        </div>
      </div>

      {/* Filtros Avançados */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Status */}
        <div>
          <Label htmlFor="status" className="text-slate-300">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ ...filters, status: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Orçamento">Orçamento</SelectItem>
              <SelectItem value="Aguardando Apólice">Aguardando Apólice</SelectItem>
              <SelectItem value="Ativa">Ativa</SelectItem>
              <SelectItem value="Cancelada">Cancelada</SelectItem>
              <SelectItem value="Renovada">Renovada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Seguradora */}
        <div>
          <Label htmlFor="insuranceCompany" className="text-slate-300">Seguradora</Label>
          <Select
            value={filters.insuranceCompany}
            onValueChange={(value) => setFilters({ ...filters, insuranceCompany: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
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

        {/* Produtor */}
        <div>
          <Label htmlFor="producer" className="text-slate-300">Produtor</Label>
          <Select
            value={filters.producerId}
            onValueChange={(value) => setFilters({ ...filters, producerId: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
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
          <Label htmlFor="period" className="text-slate-300">Vencimento</Label>
          <Select
            value={filters.period}
            onValueChange={(value) => setFilters({ ...filters, period: value })}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
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

        {/* Resetar Filtros */}
        <div className="flex items-end">
          <button
            onClick={resetFilters}
            className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Lista de Apólices */}
      <div className="grid gap-4">
        {filteredPolicies.map(policy => {
          const client = clients.find(c => c.id === policy.clientId);
          const producer = producers.find(p => p.id === policy.producerId);
          const isExpiringSoon = differenceInDays(new Date(policy.expirationDate), new Date()) <= 30;
          
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
                      {policy.policyNumber || `Orçamento #${policy.id.slice(0, 8)}`}
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
                      <p className="text-white">{(policy as any).ramos?.nome || policy.type || 'Não especificado'}</p>
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
                      {new Date(policy.expirationDate).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {differenceInDays(new Date(policy.expirationDate), new Date())} dias
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
              onPolicyAdded={() => {}}
            />
          </div>
        </div>
      )}

    </div>
  );
}
