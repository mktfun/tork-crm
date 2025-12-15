import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, Filter, Cake } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateClientsReport, ClientReportData, ClientReportOptions } from '@/utils/pdf/generateClientsReport';

interface ExportClientsModalProps {
  disabled?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'Ativo', label: 'Ativo' },
  { value: 'Inativo', label: 'Inativo' },
];

const TIPO_OPTIONS = [
  { value: 'todos', label: 'Todos os Tipos' },
  { value: 'PF', label: 'Pessoa Física (CPF)' },
  { value: 'PJ', label: 'Pessoa Jurídica (CNPJ)' },
];

const MESES = [
  { value: 'todos', label: 'Todos os Meses' },
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

interface LocalFilters {
  searchTerm: string;
  status: string;
  tipo: string;
  mesAniversario: string;
}

export function ExportClientsModal({ disabled }: ExportClientsModalProps) {
  const { user } = useAuth();
  
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [isCountLoading, setIsCountLoading] = useState(false);
  
  // Estado local dos filtros
  const [localFilters, setLocalFilters] = useState<LocalFilters>({
    searchTerm: '',
    status: 'todos',
    tipo: 'todos',
    mesAniversario: 'todos',
  });
  
  // Configurações do relatório
  const [title, setTitle] = useState('Relatório de Clientes');
  const [sortBy, setSortBy] = useState<'nome' | 'cadastro' | 'carteira' | 'aniversario'>('nome');
  const [columns, setColumns] = useState({
    nomeDocumento: true,
    contatos: true,
    localizacao: true,
    carteira: true,
    datas: true,
  });

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setLocalFilters({
        searchTerm: '',
        status: 'todos',
        tipo: 'todos',
        mesAniversario: 'todos',
      });
    }
  }, [open]);

  // ========================================
  // CONTADOR EM TEMPO REAL
  // ========================================
  useEffect(() => {
    if (!open || !user) return;

    const countClients = async () => {
      setIsCountLoading(true);
      try {
        let query = supabase
          .from('clientes')
          .select('id, cpf_cnpj, birth_date', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (localFilters.status !== 'todos') {
          query = query.eq('status', localFilters.status);
        }
        if (localFilters.searchTerm.trim()) {
          const term = localFilters.searchTerm.trim();
          query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,cpf_cnpj.ilike.%${term}%`);
        }

        // O filtro de tipo e mês será aplicado depois do fetch (client-side)
        // Mas para o count, fazemos uma aproximação
        const { count, error } = await query;
        if (!error) {
          setEstimatedCount(count);
        }
      } catch (err) {
        console.error('Erro ao contar clientes:', err);
      } finally {
        setIsCountLoading(false);
      }
    };

    const timer = setTimeout(countClients, 300);
    return () => clearTimeout(timer);
  }, [open, user, localFilters.searchTerm, localFilters.status]);

  // ========================================
  // FILTROS ATIVOS PARA DISPLAY
  // ========================================
  const getActiveFiltersDisplay = useMemo(() => {
    const filters: { label: string; value: string }[] = [];

    if (localFilters.status !== 'todos') {
      filters.push({ label: 'Status', value: localFilters.status });
    }
    if (localFilters.tipo !== 'todos') {
      filters.push({ label: 'Tipo', value: localFilters.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica' });
    }
    if (localFilters.mesAniversario !== 'todos') {
      const mes = MESES.find(m => m.value === localFilters.mesAniversario);
      filters.push({ label: 'Aniversariantes', value: mes?.label || localFilters.mesAniversario });
    }
    if (localFilters.searchTerm) {
      filters.push({ label: 'Busca', value: localFilters.searchTerm });
    }

    return filters;
  }, [localFilters]);

  // ========================================
  // FETCH COMPLETO COM DADOS AGREGADOS
  // ========================================
  const fetchAllClients = async (): Promise<ClientReportData[]> => {
    if (!user) throw new Error('Usuário não autenticado');

    // 1. Buscar clientes
    let clientQuery = supabase
      .from('clientes')
      .select('*')
      .eq('user_id', user.id);

    if (localFilters.status !== 'todos') {
      clientQuery = clientQuery.eq('status', localFilters.status);
    }
    if (localFilters.searchTerm.trim()) {
      const term = localFilters.searchTerm.trim();
      clientQuery = clientQuery.or(`name.ilike.%${term}%,email.ilike.%${term}%,cpf_cnpj.ilike.%${term}%`);
    }

    const { data: clientsRaw, error: clientsError } = await clientQuery.order('name');
    if (clientsError) throw clientsError;
    if (!clientsRaw || clientsRaw.length === 0) {
      throw new Error('Nenhum cliente encontrado com os filtros aplicados.');
    }

    // 2. Buscar apólices ativas para agregação (sum/count)
    const clientIds = clientsRaw.map(c => c.id);
    const { data: policiesData, error: policiesError } = await supabase
      .from('apolices')
      .select('client_id, premium_value, status')
      .eq('user_id', user.id)
      .in('client_id', clientIds)
      .eq('status', 'Ativa');

    if (policiesError) throw policiesError;

    // 3. Agregar dados de apólices por cliente
    const policyAggregation: Record<string, { count: number; total: number }> = {};
    (policiesData || []).forEach(p => {
      if (!policyAggregation[p.client_id]) {
        policyAggregation[p.client_id] = { count: 0, total: 0 };
      }
      policyAggregation[p.client_id].count++;
      policyAggregation[p.client_id].total += Number(p.premium_value) || 0;
    });

    // 4. Mapear e aplicar filtros client-side
    let clients: ClientReportData[] = clientsRaw.map(client => {
      const agg = policyAggregation[client.id] || { count: 0, total: 0 };
      return {
        id: client.id,
        nome: client.name,
        cpfCnpj: client.cpf_cnpj,
        email: client.email,
        telefone: client.phone,
        cidade: client.city,
        estado: client.state,
        dataNascimento: client.birth_date,
        dataCadastro: client.created_at,
        status: client.status,
        qtdeApolices: agg.count,
        valorTotalPremio: agg.total,
      };
    });

    // Filtro por TIPO (PF/PJ) - baseado no tamanho do CPF/CNPJ
    if (localFilters.tipo !== 'todos') {
      clients = clients.filter(c => {
        const doc = c.cpfCnpj?.replace(/\D/g, '') || '';
        if (localFilters.tipo === 'PF') {
          return doc.length === 11 || doc.length === 0; // CPF ou sem documento
        }
        return doc.length === 14; // CNPJ
      });
    }

    // Filtro por MÊS DE ANIVERSÁRIO
    if (localFilters.mesAniversario !== 'todos') {
      const targetMonth = parseInt(localFilters.mesAniversario, 10);
      clients = clients.filter(c => {
        if (!c.dataNascimento) return false;
        const birthDate = new Date(c.dataNascimento);
        return birthDate.getMonth() + 1 === targetMonth;
      });
    }

    if (clients.length === 0) {
      throw new Error('Nenhum cliente encontrado com os filtros aplicados.');
    }

    return clients;
  };

  // ========================================
  // GERAR RELATÓRIO
  // ========================================
  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const clients = await fetchAllClients();
      
      const reportOptions: ClientReportOptions = {
        title,
        filters: {
          status: localFilters.status !== 'todos' ? localFilters.status : undefined,
          tipo: localFilters.tipo !== 'todos' 
            ? (localFilters.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica') 
            : undefined,
          aniversariantes: localFilters.mesAniversario !== 'todos'
            ? MESES.find(m => m.value === localFilters.mesAniversario)?.label
            : undefined,
          busca: localFilters.searchTerm || undefined,
        },
        columns,
        sortBy,
      };

      await generateClientsReport(clients, reportOptions);
      
      toast.success(`Relatório gerado com ${clients.length} clientes!`);
      setOpen(false);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar relatório');
    } finally {
      setIsExporting(false);
    }
  };

  // Handler genérico para filtros
  const updateFilter = <K extends keyof LocalFilters>(key: K, value: LocalFilters[K]) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="bg-blue-700 hover:bg-blue-600 text-white border-blue-600"
        >
          <FileText className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Exportar Relatório de Clientes
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* ========================================
              COLUNA ESQUERDA: Configurações
              ======================================== */}
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-700 pb-2">
              Configurações do Relatório
            </h3>

            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-slate-300">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* Ordenação */}
            <div className="space-y-2">
              <Label className="text-slate-300">Ordenar por</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="nome">Nome (A-Z)</SelectItem>
                  <SelectItem value="cadastro">Data de Cadastro</SelectItem>
                  <SelectItem value="carteira">Valor da Carteira</SelectItem>
                  <SelectItem value="aniversario">Data de Aniversário</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Colunas */}
            <div className="space-y-3">
              <Label className="text-slate-300">Colunas a incluir</Label>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-nome"
                    checked={columns.nomeDocumento}
                    onCheckedChange={(checked) =>
                      setColumns(prev => ({ ...prev, nomeDocumento: !!checked }))
                    }
                  />
                  <label htmlFor="col-nome" className="text-sm text-slate-300 cursor-pointer">
                    Nome & Documento (CPF/CNPJ)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-contatos"
                    checked={columns.contatos}
                    onCheckedChange={(checked) =>
                      setColumns(prev => ({ ...prev, contatos: !!checked }))
                    }
                  />
                  <label htmlFor="col-contatos" className="text-sm text-slate-300 cursor-pointer">
                    Contatos (Email/Telefone)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-localizacao"
                    checked={columns.localizacao}
                    onCheckedChange={(checked) =>
                      setColumns(prev => ({ ...prev, localizacao: !!checked }))
                    }
                  />
                  <label htmlFor="col-localizacao" className="text-sm text-slate-300 cursor-pointer">
                    Localização (Cidade/UF)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-carteira"
                    checked={columns.carteira}
                    onCheckedChange={(checked) =>
                      setColumns(prev => ({ ...prev, carteira: !!checked }))
                    }
                  />
                  <label htmlFor="col-carteira" className="text-sm text-slate-300 cursor-pointer">
                    Carteira (Qtde + Valor)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-datas"
                    checked={columns.datas}
                    onCheckedChange={(checked) =>
                      setColumns(prev => ({ ...prev, datas: !!checked }))
                    }
                  />
                  <label htmlFor="col-datas" className="text-sm text-slate-300 cursor-pointer">
                    Datas (Cadastro/Nascimento)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================
              COLUNA DIREITA: Filtros
              ======================================== */}
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-700 pb-2 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Refinar Filtros
            </h3>

            {/* Busca */}
            <div className="space-y-2">
              <Label className="text-slate-300">Busca (nome, CPF, email)</Label>
              <Input
                value={localFilters.searchTerm}
                onChange={(e) => updateFilter('searchTerm', e.target.value)}
                placeholder="Digite para buscar..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-slate-300">Status</Label>
              <Select 
                value={localFilters.status} 
                onValueChange={(v) => updateFilter('status', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo (PF/PJ) */}
            <div className="space-y-2">
              <Label className="text-slate-300">Tipo de Cliente</Label>
              <Select 
                value={localFilters.tipo} 
                onValueChange={(v) => updateFilter('tipo', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {TIPO_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 🎂 Mês de Aniversário - CRUCIAL para CRM! */}
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-2">
                <Cake className="w-4 h-4 text-pink-400" />
                Aniversariantes do Mês
              </Label>
              <Select 
                value={localFilters.mesAniversario} 
                onValueChange={(v) => updateFilter('mesAniversario', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {MESES.map(mes => (
                    <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ========================================
            FOOTER
            ======================================== */}
        <div className="border-t border-slate-700 pt-4 space-y-4">
          {/* Filtros ativos */}
          {getActiveFiltersDisplay.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-slate-400">Filtros aplicados:</span>
              {getActiveFiltersDisplay.map((filter, idx) => (
                <Badge key={idx} variant="secondary" className="bg-slate-700 text-slate-200 text-xs">
                  {filter.label}: {filter.value}
                </Badge>
              ))}
            </div>
          )}

          {/* Contador */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">
              {isCountLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Contando...
                </span>
              ) : estimatedCount !== null ? (
                <span>
                  Aproximadamente <strong className="text-white">{estimatedCount}</strong> clientes
                </span>
              ) : null}
            </div>

            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Gerar Relatório
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Relatório em formato paisagem (landscape) • Inclui dados agregados de apólices
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
