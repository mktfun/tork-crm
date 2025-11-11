import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, FileText, DollarSign, Plus, Search } from 'lucide-react';
import { useSupabaseClientsPaginated, ClientFilters } from '@/hooks/useSupabaseClientsPaginated';
import { useClientKPIs } from '@/hooks/useClientKPIs';
import { KpiCard } from '@/components/policies/KpiCard';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ClientRowCard } from '@/components/clients/ClientRowCard';
import { NewClientModal } from '@/components/clients/NewClientModal';
import { ClientImportModal } from '@/components/clients/ClientImportModal';
import { usePolicies } from '@/hooks/useAppData';
import { usePageTitle } from '@/hooks/usePageTitle';
import { DeduplicationSection } from '@/components/clients/DeduplicationSection';
import { useAllClients } from '@/hooks/useAllClients';

export default function Clients() {
  usePageTitle('Clientes');
  const navigate = useNavigate();
  const { policies } = usePolicies();
  const { allClients } = useAllClients();

  // Estado de paginação e filtros
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filters, setFilters] = useState<ClientFilters>({
    searchTerm: '',
    status: 'todos',
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Usar o novo hook de paginação server-side
  const {
    clients,
    totalCount,
    totalPages,
    isLoading
  } = useSupabaseClientsPaginated({
    page,
    limit,
    filters
  });

  // Buscar KPIs dinâmicos
  const { kpis, isLoading: kpisLoading } = useClientKPIs(filters);

  // Resetar para página 1 quando os filtros ou limite mudarem
  useEffect(() => {
    setPage(1);
  }, [filters, limit]);

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      status: 'todos',
    });
  };

  const getClientPoliciesCount = (clientId: string) => {
    return policies.filter(p => p.clientId === clientId && p.status === 'Ativa').length;
  };

  const getClientTotalPremium = (clientId: string) => {
    return policies
      .filter(p => p.clientId === clientId && p.status === 'Ativa')
      .reduce((sum, p) => sum + p.premiumValue, 0);
  };

  const handleImportComplete = () => {
    setIsImportModalOpen(false);
    // Invalidar query para recarregar dados
    window.location.reload();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Seção de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Clientes Ativos"
          value={kpis.totalActive}
          icon={Users}
          isLoading={kpisLoading}
        />
        <KpiCard
          title="Novos (30 dias)"
          value={kpis.newClientsLast30d}
          icon={UserPlus}
          isLoading={kpisLoading}
        />
        <KpiCard
          title="Com Apólices"
          value={kpis.clientsWithPolicies}
          icon={FileText}
          isLoading={kpisLoading}
        />
        <KpiCard
          title="Valor Total"
          value={kpis.totalPoliciesValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
          icon={DollarSign}
          isLoading={kpisLoading}
        />
      </div>

      {/* Header e Filtros */}
      <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
        <div className="text-2xl font-bold text-white">
          Clientes <span className="text-sm text-slate-400">({totalCount} total)</span>
        </div>

        <div className="flex items-center space-x-4">
          <Input
            type="search"
            placeholder="Buscar por nome, email, CPF..."
            className="bg-slate-800 border-slate-700 text-white"
            value={filters.searchTerm}
            onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
          />
          <Button
            onClick={() => setIsImportModalOpen(true)}
            variant="outline"
            className="bg-green-700 hover:bg-green-600 text-white border-green-600"
          >
            Importar Planilha
          </Button>
          <NewClientModal />
        </div>
      </div>

      {/* Seção de Deduplicação */}
      {allClients && allClients.length > 0 && (
        <DeduplicationSection
          clients={allClients}
          onDeduplicationComplete={() => window.location.reload()}
        />
      )}

      {/* Filtros Avançados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-4">
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
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Itens por página */}
        <div>
          <Label htmlFor="limit" className="text-slate-300">Itens por pág.</Label>
          <Select
            value={String(limit)}
            onValueChange={(value) => setLimit(Number(value))}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
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

        {/* Resetar Filtros */}
        <div className="flex items-end">
          <Button
            onClick={resetFilters}
            variant="outline"
            className="w-full bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
          >
            Limpar Filtros
          </Button>
        </div>
      </div>

      {/* Lista de Clientes */}
      <div className="grid gap-4">
        {clients.map(client => {
          const activePoliciesCount = getClientPoliciesCount(client.id);
          const totalPremium = getClientTotalPremium(client.id);
          
          return (
            <ClientRowCard
              key={client.id}
              client={client}
              activePoliciesCount={activePoliciesCount}
              totalPremium={totalPremium}
              onClick={() => navigate(`/dashboard/clients/${client.id}`)}
            />
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

      {/* Modal de Importação */}
      <ClientImportModal 
        open={isImportModalOpen} 
        onOpenChange={setIsImportModalOpen}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
