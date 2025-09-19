import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, Search, Loader2, ArrowUpDown, Grid3X3, List } from 'lucide-react';
import { PrivacyToggle } from '@/components/ui/PrivacyToggle';
import { useSupabaseClients } from '@/hooks/useSupabaseClients';
import { useAllClients } from '@/hooks/useAllClients';
import { usePolicies, useCompanies, useCompanyBranches } from '@/hooks/useAppData';
import { NewClientModal } from '@/components/clients/NewClientModal';
import { useSearchParams } from 'react-router-dom';
import { ClientImportModal } from '@/components/clients/ClientImportModal';
import { ClientCardView } from '@/components/clients/ClientCardView';
import { ClientListView } from '@/components/clients/ClientListView';
import { DeduplicationSection } from '@/components/clients/DeduplicationSection';
import { ClientDeduplicationModal } from '@/components/clients/ClientDeduplicationModal';
import { usePageTitle } from '@/hooks/usePageTitle';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

type ViewMode = 'cards' | 'list';

export default function Clients() {
  usePageTitle('Clientes');

  // 🚀 **ESTADO DE PAGINAÇÃO E ORDENAÇÃO**
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc'
  });
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const pageSize = 15;
  const [seguradoraFiltro, setSeguradoraFiltro] = useState<string | 'all'>('all');
  const [ramoFiltro, setRamoFiltro] = useState<string | 'all'>('all');
  const [searchParams] = useSearchParams();
  React.useEffect(() => {
    const seg = searchParams.get('seguradora');
    const ramo = searchParams.get('ramo');
    if (seg) setSeguradoraFiltro(seg);
    if (ramo) setRamoFiltro(ramo);
  }, []);

  // 🔥 **ESTADO PARA CONTROLAR O MODAL DE IMPORTAÇÃO**
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Estado para a busca GLOBAL (aplicada no backend em todos os clientes)
  const [termoBusca, setTermoBusca] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  // 🚀 **HOOK COM PAGINAÇÃO, ORDENA��ÃO E BUSCA** (para exibição)
  const { clients, loading, totalCount, totalPages, refetch } = useSupabaseClients({
    pagination: { page: currentPage, pageSize },
    sortConfig,
    searchTerm: searchDebounce,
    filters: {
      seguradoraId: seguradoraFiltro !== 'all' ? seguradoraFiltro : null,
      ramo: ramoFiltro !== 'all' ? ramoFiltro : null
    }
  });

  // 🚀 **HOOK PARA TODOS OS CLIENTES** (para deduplicação e busca global)
  const { allClients, loading: loadingAll } = useAllClients();

  const { policies } = usePolicies();
  const { companies } = useCompanies();
  const { companyBranches } = useCompanyBranches();

  // Ramos disponíveis (opcionalmente filtrados pela seguradora)
  const branchOptions = React.useMemo(() => {
    const branches = seguradoraFiltro !== 'all'
      ? companyBranches.filter(b => b.companyId === seguradoraFiltro)
      : companyBranches;
    const unique = Array.from(new Set(branches.map(b => b.name)));
    return unique;
  }, [companyBranches, seguradoraFiltro]);

  // Debounce da busca para evitar muitas requisições
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(termoBusca);
      if (termoBusca !== searchDebounce) {
        setCurrentPage(1); // Reset para primeira página ao buscar
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [termoBusca]);


  const getClientPoliciesCount = (clientId: string) => {
    return policies.filter(p => p.clientId === clientId && p.status === 'Ativa').length;
  };

  // A filtragem agora é feita no BACKEND, então usamos diretamente os clientes retornados
  const clientesFiltrados = clients;

  // 🚀 **FUNÇÕES DE NAVEGAÇÃO DE PÁGINA**
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Não limpa mais a busca ao trocar de página
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  // 🚀 **FUNÇÃO DE ORDENAÇÃO**
  const handleSortChange = (value: string) => {
    const [key, direction] = value.split('-');
    setSortConfig({ key, direction: direction as 'asc' | 'desc' });
    setCurrentPage(1); // Reset para primeira página ao ordenar
  };

  // 🚀 **GERAÇÃO DE NÚMEROS DE PÁGINA**
  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  // 🔥 **FUNÇÃO PARA LIDAR COM CONCLUSÃO DA IMPORTAÇÃO**
  const handleImportComplete = () => {
    refetch(); // Recarrega a lista de clientes
    setIsImportModalOpen(false); // Fecha o modal
  };

  if (loading || loadingAll) {
    return (
      <div className="space-y-6">
        <SettingsPanel>
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={32} className="animate-spin text-blue-400" />
              <p className="text-white/60">Carregando clientes...</p>
            </div>
          </div>
        </SettingsPanel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Meus Clientes</h1>
          <p className="text-white/60">
            {searchDebounce ? (
              `Encontrados ${totalCount} clientes para "${searchDebounce}"`
            ) : (
              `Gerencie seus clientes e mantenha contato (${totalCount} clientes total)`
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <PrivacyToggle />
          <Button 
            onClick={() => setIsImportModalOpen(true)}
            variant="outline"
            className="border-blue-600 text-blue-400 hover:bg-blue-600/10"
          >
            Importar Planilha
          </Button>
          <NewClientModal />
        </div>
      </div>

      {/* PAINEL PRINCIPAL */}
      <SettingsPanel>
        <div className="space-y-6">
          {/* 🚀 **SEÇÃO UNIFICADA DE DEDUPLICAÇÃO** */}
          {allClients && allClients.length > 0 && (
            <DeduplicationSection
              clients={allClients}
              onDeduplicationComplete={refetch}
            />
          )}

          {/* 🚀 **BARRA DE CONTROLES: BUSCA, ORDENAÇÃO, FILTROS E VISUALIZAÇÃO** */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Barra de busca */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" size={20} />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filtro por Seguradora */}
            <div className="flex items-center gap-2">
              <Select value={seguradoraFiltro} onValueChange={(v) => {
                setSeguradoraFiltro(v as any);
                setRamoFiltro('all');
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Filtrar por Seguradora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Seguradoras</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Ramo */}
            <div className="flex items-center gap-2">
              <Select value={ramoFiltro} onValueChange={(v) => {
                setRamoFiltro(v as any);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Filtrar por Ramo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Ramos</SelectItem>
                  {branchOptions.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 🚀 **CONTROLES DE ORDENAÇÃO E VISUALIZAÇÃO** */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="text-white/60" size={16} />
              <Select
                value={`${sortConfig.key}-${sortConfig.direction}`}
                onValueChange={handleSortChange}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Ordenar por..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
                  <SelectItem value="createdAt-desc">Mais Recentes</SelectItem>
                  <SelectItem value="createdAt-asc">Mais Antigos</SelectItem>
                  <SelectItem value="email-asc">Email (A-Z)</SelectItem>
                  <SelectItem value="email-desc">Email (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 🚀 **SELETOR DE VISUALIZAÇÃO** */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="h-8 px-3"
              >
                <Grid3X3 size={16} />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 px-3"
              >
                <List size={16} />
              </Button>
            </div>
          </div>

          {/* 🚀 **CONTEÚDO PRINCIPAL - CARDS OU LISTA** */}
          {clientesFiltrados.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-white/40 mb-4">
                <User size={48} className="mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {clients.length === 0 
                  ? 'Nenhum cliente nesta página'
                  : 'Nenhum cliente encontrado'
                }
              </h3>
              <p className="text-white/60 mb-4">
                {clients.length === 0 
                  ? 'Navegue para outras páginas ou cadastre novos clientes.'
                  : `Nenhum cliente corresponde ao termo "${termoBusca}".`
                }
              </p>
              {totalCount === 0 && <NewClientModal />}
            </div>
          ) : (
            // Renderiza baseado no modo de visualização selecionado
            viewMode === 'cards' ? (
              <ClientCardView 
                clients={clientesFiltrados} 
                getActivePoliciesCount={getClientPoliciesCount}
              />
            ) : (
              <ClientListView 
                clients={clientesFiltrados} 
                getActivePoliciesCount={getClientPoliciesCount}
              />
            )
          )}

          {/* 🚀 **COMPONENTE DE PAGINAÇÃO** */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={handlePreviousPage}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {generatePageNumbers().map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        onClick={() => handlePageChange(pageNumber)}
                        isActive={pageNumber === currentPage}
                        className="cursor-pointer"
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  
                  {currentPage < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={handleNextPage}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          {/* 🚀 **INFORMAÇÕES DE PAGINAÇÃO** */}
          {totalCount > 0 && (
            <div className="text-center text-white/60 text-sm">
              Página {currentPage} de {totalPages} • {totalCount} clientes total
            </div>
          )}
        </div>
      </SettingsPanel>

      {/* 🔥 **MODAL DE IMPORTAÇÃO DE CLIENTES** */}
      <ClientImportModal 
        open={isImportModalOpen} 
        onOpenChange={setIsImportModalOpen}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
