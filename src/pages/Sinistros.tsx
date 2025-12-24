import { useState } from 'react';
import { AppCard } from '@/components/ui/app-card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/dateUtils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSinistros } from '@/hooks/useSinistros';
import { SinistroFormModal } from '@/components/sinistros/SinistroFormModal';
import { SinistroDetailsModal } from '@/components/sinistros/SinistroDetailsModal';
import {
  ShieldAlert,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Eye,
  Filter,
  Calendar,
  DollarSign,
  MapPin,
  User,
  AlertCircle,
  Loader2
} from 'lucide-react';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Aberto':
      return 'bg-blue-500';
    case 'Em Análise':
      return 'bg-yellow-500';
    case 'Aprovado':
      return 'bg-green-500';
    case 'Negado':
      return 'bg-red-500';
    case 'Finalizado':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Aberto':
      return <AlertTriangle className="w-4 h-4" />;
    case 'Em Análise':
      return <Clock className="w-4 h-4" />;
    case 'Aprovado':
      return <CheckCircle className="w-4 h-4" />;
    case 'Negado':
      return <XCircle className="w-4 h-4" />;
    case 'Finalizado':
      return <CheckCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

export default function Sinistros() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Todos');
  const [selectedType, setSelectedType] = useState('Todos');
  const [selectedSinistro, setSelectedSinistro] = useState<any>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const { data: sinistros = [], isLoading, error, refetch } = useSinistros();

  const handleViewSinistro = (sinistro: any) => {
    setSelectedSinistro(sinistro);
    setDetailsModalOpen(true);
  };

  // Filtros aplicados
  const filteredSinistros = sinistros.filter(sinistro => {
    const matchesSearch =
      sinistro.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sinistro.claim_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sinistro.claim_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sinistro.policy_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'Todos' || sinistro.status === selectedStatus;
    const matchesType = selectedType === 'Todos' || sinistro.claim_type === selectedType;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Estatísticas rápidas
  const stats = {
    total: sinistros.length,
    abertos: sinistros.filter(s => s.status === 'Aberto').length,
    emAnalise: sinistros.filter(s => s.status === 'Em Análise').length,
    aprovados: sinistros.filter(s => s.status === 'Aprovado').length,
    valorTotal: sinistros.reduce((acc, s) => acc + (s.claim_amount || 0), 0)
  };

  const statusOptions = ['Todos', 'Aberto', 'Em Análise', 'Documentação Pendente', 'Aprovado', 'Negado', 'Cancelado', 'Finalizado'];
  const typeOptions = ['Todos', 'Colisão', 'Roubo', 'Furto', 'Incêndio', 'Danos Elétricos', 'Enchente', 'Granizo', 'Vandalismo', 'Quebra de Vidros', 'Assistência 24h', 'Outros'];

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6" />
              Sinistros
            </h1>
            <p className="text-white/60">Gerencie ocorrências e processos de sinistro</p>
          </div>
        </div>

        <Alert className="border-red-500 bg-red-500/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar sinistros.
            <Button
              variant="link"
              className="p-0 h-auto text-red-400 hover:text-red-300"
              onClick={() => refetch()}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6" />
            Sinistros
          </h1>
          <p className="text-white/60">Gerencie ocorrências e processos de sinistro</p>
        </div>
        <SinistroFormModal onSuccess={() => refetch()} />
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AppCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Total</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <ShieldAlert className="w-8 h-8 text-blue-400" />
          </div>
        </AppCard>

        <AppCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Abertos</p>
              <p className="text-2xl font-bold text-yellow-400">{stats.abertos}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
          </div>
        </AppCard>

        <AppCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Em Análise</p>
              <p className="text-2xl font-bold text-orange-400">{stats.emAnalise}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-400" />
          </div>
        </AppCard>

        <AppCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Aprovados</p>
              <p className="text-2xl font-bold text-green-400">{stats.aprovados}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </AppCard>

        <AppCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Valor Total</p>
              <p className="text-lg font-bold text-white">
                {stats.valorTotal.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                })}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-400" />
          </div>
        </AppCard>
      </div>

      {/* Filtros */}
      <AppCard>
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por cliente, protocolo, tipo ou apólice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/60">Filtros:</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <p className="text-sm text-white/60 mb-2">Status:</p>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <Button
                    key={status}
                    variant={selectedStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedStatus(status)}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              <p className="text-sm text-white/60 mb-2">Tipo:</p>
              <div className="flex flex-wrap gap-2">
                {typeOptions.slice(0, 6).map((type) => (
                  <Button
                    key={type}
                    variant={selectedType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedType(type)}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AppCard>

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <AppCard key={i} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j}>
                      <Skeleton className="h-4 w-16 mb-1" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-16 w-full" />
              </div>
            </AppCard>
          ))}
        </div>
      )}

      {/* Lista de Sinistros */}
      {!isLoading && (
        <div className="grid gap-4">
          {filteredSinistros.map((sinistro) => (
            <AppCard key={sinistro.id} className="hover:bg-white/5 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="font-semibold text-white text-lg">
                      {sinistro.claim_number || `#${sinistro.id.slice(-8)}`}
                    </h3>
                    <Badge className={`${getStatusColor(sinistro.status)} text-white flex items-center gap-1`}>
                      {getStatusIcon(sinistro.status)}
                      {sinistro.status}
                    </Badge>
                    {sinistro.priority && sinistro.priority !== 'Média' && (
                      <Badge variant="outline" className={`${
                        sinistro.priority === 'Alta' ? 'border-orange-500 text-orange-400' :
                        sinistro.priority === 'Urgente' ? 'border-red-500 text-red-400' :
                        'border-gray-500 text-gray-400'
                      }`}>
                        {sinistro.priority}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-white/40" />
                      <div>
                        <span className="text-white/60">Cliente:</span>
                        <p className="text-white font-medium">{sinistro.client_name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-white/40" />
                      <div>
                        <span className="text-white/60">Apólice:</span>
                        <p className="text-white font-medium">{sinistro.policy_number || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-white/40" />
                      <div>
                        <span className="text-white/60">Tipo:</span>
                        <p className="text-white font-medium">{sinistro.claim_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-white/40" />
                      <div>
                        <span className="text-white/60">Ocorrência:</span>
                        <p className="text-white font-medium">
                          {formatDate(sinistro.occurrence_date)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {sinistro.location_occurrence && (
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-white/40" />
                      <span className="text-white/60 text-sm">Local:</span>
                      <p className="text-white/80 text-sm">{sinistro.location_occurrence}</p>
                    </div>
                  )}

                  <div className="mb-3">
                    <span className="text-white/60 text-sm">Descrição:</span>
                    <p className="text-white/80 text-sm mt-1">{sinistro.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    {sinistro.claim_amount && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-white/60">Solicitado:</span>
                        <span className="text-green-400 font-semibold">
                          {sinistro.claim_amount.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })}
                        </span>
                      </div>
                    )}

                    {sinistro.approved_amount && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-blue-400" />
                        <span className="text-white/60">Aprovado:</span>
                        <span className="text-blue-400 font-semibold">
                          {sinistro.approved_amount.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })}
                        </span>
                      </div>
                    )}

                    {sinistro.insurance_company && (
                      <div>
                        <span className="text-white/60">Seguradora:</span>
                        <span className="text-white ml-1">{sinistro.insurance_company}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewSinistro(sinistro)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Visualizar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleViewSinistro(sinistro);
                      // Vai abrir na aba de documentos
                    }}
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Documentos
                  </Button>
                </div>
              </div>
            </AppCard>
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {!isLoading && filteredSinistros.length === 0 && (
        <AppCard className="text-center py-12">
          <ShieldAlert className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {sinistros.length === 0
              ? 'Nenhum sinistro registrado'
              : 'Nenhum sinistro encontrado'}
          </h3>
          <p className="text-white/60 mb-6">
            {sinistros.length === 0
              ? 'Registre o primeiro sinistro para começar o gerenciamento.'
              : searchTerm || selectedStatus !== 'Todos' || selectedType !== 'Todos'
                ? 'Tente ajustar os filtros para encontrar o que procura.'
                : 'Carregue mais dados ou verifique sua conexão.'}
          </p>
          {sinistros.length === 0 && (
            <SinistroFormModal onSuccess={() => refetch()}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Registrar Primeiro Sinistro
              </Button>
            </SinistroFormModal>
          )}
          {sinistros.length > 0 && filteredSinistros.length === 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setSelectedStatus('Todos');
                setSelectedType('Todos');
              }}
            >
              Limpar Filtros
            </Button>
          )}
        </AppCard>
      )}

      {/* Modal de Detalhes */}
      <SinistroDetailsModal
        sinistro={selectedSinistro}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        onSuccess={() => {
          refetch();
          setDetailsModalOpen(false);
        }}
      />
    </div>
  );
}
