import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, FileText, DollarSign, Search } from 'lucide-react';
import { useSupabaseClientsPaginated, ClientFilters } from '@/hooks/useSupabaseClientsPaginated';
import { useClientKPIs } from '@/hooks/useClientKPIs';
import { useDebounce } from '@/hooks/useDebounce';
import { KpiCard } from '@/components/policies/KpiCard';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ClientRowCard } from '@/components/clients/ClientRowCard';
import { NewClientModal } from '@/components/clients/NewClientModal';
import { ClientImportModal } from '@/components/clients/ClientImportModal';

import { usePageTitle } from '@/hooks/usePageTitle';
import { DeduplicationSection } from '@/components/clients/DeduplicationSection';
import { useAllClients } from '@/hooks/useAllClients';

export default function Clients() {
  usePageTitle('Clientes');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { allClients } = useAllClients();

  // Estado de paginação e filtros
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filters, setFilters] = useState<ClientFilters>({
    searchTerm: '',
    status: 'todos',
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Estado local para busca (rápido, sem delay)
  const [localSearchTerm, setLocalSearchTerm] = useState('');

  // Debounce da busca (500ms de atraso)
  const debouncedSearchTerm = useDebounce(localSearchTerm, 500);

  // Atualizar filtro server-side com o valor debounced
  useEffect(() => {
    setFilters(prev => ({ ...prev, searchTerm: debouncedSearchTerm }));
  }, [debouncedSearchTerm]);

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

  // Calcular comissão média por cliente COM APÓLICE (não dividir por zero!)
  const avgCommission = kpis.clientsWithPolicies > 0
    ? kpis.totalCommission / kpis.clientsWithPolicies
    : 0;

  // Resetar para página 1 quando os filtros ou limite mudarem
  useEffect(() => {
    setPage(1);
  }, [filters, limit]);

  const resetFilters = () => {
    setLocalSearchTerm(''); // Limpa a busca local
    setFilters({
      searchTerm: '',
      status: 'todos',
    });
    setLimit(10);
    setPage(1);
  };


  const handleImportComplete = () => {
    setIsImportModalOpen(false);
    // Invalidar query para recarregar dados
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['clients-paginated'] });
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
          title="Comissão Média"
          value={avgCommission.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
          icon={DollarSign}
          subtitle="Por Cliente com Apólice"
          isLoading={kpisLoading}
        />
      </div>

      {/* Header e Busca Principal */}
      <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
        <div className="text-2xl font-bold text-white">
          Clientes <span className="text-sm text-slate-400">({totalCount} total)</span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <Input
              type="search"
              placeholder="Buscar por nome, email, CPF..."
              className="bg-slate-800 border-slate-700 text-white pl-10 w-80"
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
            />
          </div>
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
          onDeduplicationComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            queryClient.invalidateQueries({ queryKey: ['clients-paginated'] });
          }}
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
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              <p className="text-white/60">Carregando clientes...</p>
            </div>
          </div>
        ) : clients.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <Users size={48} className="text-white/40" />
              <p className="text-white/60">
                {filters.searchTerm || filters.status !== 'todos'
                  ? 'Nenhum cliente encontrado com os filtros aplicados'
                  : 'Nenhum cliente cadastrado ainda'}
              </p>
            </div>
          </div>
        ) : (
          clients.map(client => (
            <ClientRowCard
              key={client.id}
              client={client}
              onClick={() => navigate(`/dashboard/clients/${client.id}`)}
            />
          ))
        )}
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
