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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Loader2, CalendarIcon, Filter } from 'lucide-react';
import { PolicyFilters } from '@/hooks/useFilteredPolicies';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseCompanies } from '@/hooks/useSupabaseCompanies';
import { useSupabaseProducers } from '@/hooks/useSupabaseProducers';
import { useSupabaseRamos } from '@/hooks/useSupabaseRamos';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, addDays, startOfToday, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { generatePoliciesReport, PolicyReportData, PolicyReportOptions } from '@/utils/pdf/generatePoliciesReport';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface ExportPoliciesModalProps {
  filters: PolicyFilters;
  disabled?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'Ativa', label: 'Ativa' },
  { value: 'Aguardando Apólice', label: 'Aguardando Apólice' },
  { value: 'Cancelada', label: 'Cancelada' },
  { value: 'Expirada', label: 'Expirada' },
];

const PERIOD_OPTIONS = [
  { value: 'todos', label: 'Todos os Períodos' },
  { value: 'current-month', label: 'Mês Corrente' },
  { value: 'next-30-days', label: 'Próximos 30 dias' },
  { value: 'next-90-days', label: 'Próximos 90 dias' },
  { value: 'expired', label: 'Expiradas' },
  { value: 'custom', label: 'Personalizado...' },
];

export function ExportPoliciesModal({ filters: initialFilters, disabled }: ExportPoliciesModalProps) {
  const { user } = useAuth();
  const { companies } = useSupabaseCompanies();
  const { producers } = useSupabaseProducers();
  const { data: ramos } = useSupabaseRamos();
  
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [isCountLoading, setIsCountLoading] = useState(false);
  
  // ========================================
  // ESTADO LOCAL DOS FILTROS (independente da tela pai)
  // ========================================
  const [localFilters, setLocalFilters] = useState<PolicyFilters>({
    status: 'todos',
    insuranceCompany: 'todas',
    ramo: 'todos',
    producerId: 'todos',
    period: 'todos',
    searchTerm: '',
    customStart: undefined,
    customEnd: undefined,
  });

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  
  // Configurações do relatório
  const [title, setTitle] = useState('Relatório de Apólices');
  const [sortBy, setSortBy] = useState<'vencimento' | 'cliente' | 'seguradora' | 'premio'>('vencimento');
  const [columns, setColumns] = useState({
    clienteContato: true,
    apoliceSeguradora: true,
    vigencia: true,
    ramo: true,
    premio: true,
    comissao: false, // OFF por padrão
  });

  // ========================================
  // INICIALIZAR COM FILTROS DA TELA PAI ao abrir
  // ========================================
  useEffect(() => {
    if (open) {
      setLocalFilters({
        status: initialFilters.status || 'todos',
        insuranceCompany: initialFilters.insuranceCompany || 'todas',
        ramo: initialFilters.ramo || 'todos',
        producerId: initialFilters.producerId || 'todos',
        period: initialFilters.period || 'todos',
        searchTerm: initialFilters.searchTerm || '',
        customStart: initialFilters.customStart,
        customEnd: initialFilters.customEnd,
      });

      // Inicializar dateRange se período customizado
      if (initialFilters.period === 'custom' && initialFilters.customStart && initialFilters.customEnd) {
        setDateRange({
          from: new Date(initialFilters.customStart),
          to: new Date(initialFilters.customEnd),
        });
      } else {
        setDateRange(undefined);
      }
    }
  }, [open, initialFilters]);

  // ========================================
  // CONTADOR EM TEMPO REAL (com debounce)
  // ========================================
  useEffect(() => {
    if (!open || !user) return;

    const countPolicies = async () => {
      setIsCountLoading(true);
      try {
        let query = supabase
          .from('apolices')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Aplicar filtros locais
        if (localFilters.status && localFilters.status !== 'todos') {
          query = query.eq('status', localFilters.status);
        }
        if (localFilters.insuranceCompany && localFilters.insuranceCompany !== 'todas') {
          query = query.eq('insurance_company', localFilters.insuranceCompany);
        }
        if (localFilters.ramo && localFilters.ramo !== 'todos') {
          query = query.eq('ramo_id', localFilters.ramo);
        }
        if (localFilters.producerId && localFilters.producerId !== 'todos') {
          query = query.eq('producer_id', localFilters.producerId);
        }
        if (localFilters.searchTerm && localFilters.searchTerm.trim()) {
          const searchTerm = localFilters.searchTerm.trim();
          query = query.or(`policy_number.ilike.%${searchTerm}%,insured_asset.ilike.%${searchTerm}%`);
        }

        // Filtro por período
        if (localFilters.period && localFilters.period !== 'todos') {
          const hoje = startOfToday();
          if (localFilters.period === 'custom' && dateRange?.from && dateRange?.to) {
            query = query
              .gte('expiration_date', format(dateRange.from, 'yyyy-MM-dd'))
              .lte('expiration_date', format(dateRange.to, 'yyyy-MM-dd'));
          } else {
            switch (localFilters.period) {
              case 'current-month':
                query = query
                  .gte('expiration_date', format(startOfMonth(hoje), 'yyyy-MM-dd'))
                  .lte('expiration_date', format(endOfMonth(hoje), 'yyyy-MM-dd'));
                break;
              case 'next-30-days':
                query = query
                  .gte('expiration_date', format(hoje, 'yyyy-MM-dd'))
                  .lte('expiration_date', format(addDays(hoje, 30), 'yyyy-MM-dd'));
                break;
              case 'next-90-days':
                query = query
                  .gte('expiration_date', format(hoje, 'yyyy-MM-dd'))
                  .lte('expiration_date', format(addDays(hoje, 90), 'yyyy-MM-dd'));
                break;
              case 'expired':
                query = query.lt('expiration_date', format(hoje, 'yyyy-MM-dd'));
                break;
            }
          }
        }

        const { count, error } = await query;
        if (!error) {
          setEstimatedCount(count);
        }
      } catch (err) {
        console.error('Erro ao contar apólices:', err);
      } finally {
        setIsCountLoading(false);
      }
    };

    const timer = setTimeout(countPolicies, 300); // debounce 300ms
    return () => clearTimeout(timer);
  }, [open, user, localFilters, dateRange]);

  // ========================================
  // HELPERS PARA EXIBIR FILTROS ATIVOS
  // ========================================
  const getActiveFiltersDisplay = useMemo(() => {
    const activeFilters: { label: string; value: string }[] = [];

    if (localFilters.status && localFilters.status !== 'todos') {
      activeFilters.push({ label: 'Status', value: localFilters.status });
    }
    if (localFilters.insuranceCompany && localFilters.insuranceCompany !== 'todas') {
      const company = companies.find(c => c.id === localFilters.insuranceCompany);
      activeFilters.push({ label: 'Seguradora', value: company?.name || localFilters.insuranceCompany });
    }
    if (localFilters.ramo && localFilters.ramo !== 'todos') {
      const ramo = ramos?.find(r => r.id === localFilters.ramo);
      activeFilters.push({ label: 'Ramo', value: ramo?.nome || localFilters.ramo });
    }
    if (localFilters.producerId && localFilters.producerId !== 'todos') {
      const producer = producers.find(p => p.id === localFilters.producerId);
      activeFilters.push({ label: 'Produtor', value: producer?.name || localFilters.producerId });
    }
    if (localFilters.period && localFilters.period !== 'todos') {
      const periodLabels: Record<string, string> = {
        'current-month': 'Mês Corrente',
        'next-30-days': 'Próximos 30 dias',
        'next-90-days': 'Próximos 90 dias',
        'expired': 'Expiradas',
        'custom': dateRange?.from && dateRange?.to 
          ? `${format(dateRange.from, 'dd/MM/yy')} - ${format(dateRange.to, 'dd/MM/yy')}`
          : 'Personalizado'
      };
      activeFilters.push({ label: 'Período', value: periodLabels[localFilters.period] || localFilters.period });
    }
    if (localFilters.searchTerm) {
      activeFilters.push({ label: 'Busca', value: localFilters.searchTerm });
    }

    return activeFilters;
  }, [localFilters, companies, producers, ramos, dateRange]);

  // ========================================
  // FETCH COMPLETO (SEM PAGINAÇÃO) - USA localFilters
  // ========================================
  const fetchAllPolicies = async (): Promise<PolicyReportData[]> => {
    if (!user) throw new Error('Usuário não autenticado');

    let query = supabase
      .from('apolices')
      .select(`
        id,
        policy_number,
        status,
        premium_value,
        commission_rate,
        expiration_date,
        start_date,
        type,
        companies:insurance_company (name),
        ramos:ramo_id (nome),
        clientes:client_id (name, phone, email)
      `)
      .eq('user_id', user.id);

    // 🎯 Usar localFilters (não initialFilters!)
    if (localFilters.status && localFilters.status !== 'todos') {
      query = query.eq('status', localFilters.status);
    }
    if (localFilters.insuranceCompany && localFilters.insuranceCompany !== 'todas') {
      query = query.eq('insurance_company', localFilters.insuranceCompany);
    }
    if (localFilters.ramo && localFilters.ramo !== 'todos') {
      query = query.eq('ramo_id', localFilters.ramo);
    }
    if (localFilters.producerId && localFilters.producerId !== 'todos') {
      query = query.eq('producer_id', localFilters.producerId);
    }
    if (localFilters.searchTerm && localFilters.searchTerm.trim()) {
      const searchTerm = localFilters.searchTerm.trim();
      query = query.or(`policy_number.ilike.%${searchTerm}%,insured_asset.ilike.%${searchTerm}%`);
    }

    // Filtro por período (usa localFilters + dateRange)
    if (localFilters.period && localFilters.period !== 'todos') {
      const hoje = startOfToday();
      if (localFilters.period === 'custom' && dateRange?.from && dateRange?.to) {
        query = query
          .gte('expiration_date', format(dateRange.from, 'yyyy-MM-dd'))
          .lte('expiration_date', format(dateRange.to, 'yyyy-MM-dd'));
      } else {
        switch (localFilters.period) {
          case 'current-month':
            query = query
              .gte('expiration_date', format(startOfMonth(hoje), 'yyyy-MM-dd'))
              .lte('expiration_date', format(endOfMonth(hoje), 'yyyy-MM-dd'));
            break;
          case 'next-30-days':
            query = query
              .gte('expiration_date', format(hoje, 'yyyy-MM-dd'))
              .lte('expiration_date', format(addDays(hoje, 30), 'yyyy-MM-dd'));
            break;
          case 'next-90-days':
            query = query
              .gte('expiration_date', format(hoje, 'yyyy-MM-dd'))
              .lte('expiration_date', format(addDays(hoje, 90), 'yyyy-MM-dd'));
            break;
          case 'expired':
            query = query.lt('expiration_date', format(hoje, 'yyyy-MM-dd'));
            break;
        }
      }
    }

    // SEM PAGINAÇÃO - buscar tudo
    const { data, error } = await query.order('expiration_date', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Nenhuma apólice encontrada com os filtros aplicados.');
    }

    // Mapear para o formato do relatório
    return data.map(policy => ({
      numero: policy.policy_number,
      cliente: {
        nome: policy.clientes?.name || 'Cliente não encontrado',
        telefone: policy.clientes?.phone || null,
        email: policy.clientes?.email || null,
      },
      seguradora: policy.companies?.name || null,
      ramo: policy.ramos?.nome || policy.type || null,
      vigencia: {
        inicio: policy.start_date,
        fim: policy.expiration_date,
      },
      premio: Number(policy.premium_value) || 0,
      comissao: (Number(policy.premium_value) || 0) * (Number(policy.commission_rate) || 0) / 100,
      comissaoPercentual: Number(policy.commission_rate) || 0,
      status: policy.status,
    }));
  };

  // ========================================
  // GERAR RELATÓRIO
  // ========================================
  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const policies = await fetchAllPolicies();
      
      const seguradoraFilter = getActiveFiltersDisplay.find(f => f.label === 'Seguradora')?.value;
      const produtorFilter = getActiveFiltersDisplay.find(f => f.label === 'Produtor')?.value;
      const periodoFilter = getActiveFiltersDisplay.find(f => f.label === 'Período')?.value;

      const reportOptions: PolicyReportOptions = {
        title,
        filters: {
          status: localFilters.status !== 'todos' ? localFilters.status : undefined,
          seguradora: seguradoraFilter,
          produtor: produtorFilter,
          periodo: periodoFilter,
        },
        columns,
        sortBy,
      };

      await generatePoliciesReport(policies, reportOptions);
      
      toast.success(`Relatório gerado com ${policies.length} apólices!`);
      setOpen(false);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar relatório');
    } finally {
      setIsExporting(false);
    }
  };

  // ========================================
  // HANDLERS DOS FILTROS LOCAIS
  // ========================================
  const updateFilter = <K extends keyof PolicyFilters>(key: K, value: PolicyFilters[K]) => {
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
            Exportar Relatório de Apólices
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* ========================================
              COLUNA ESQUERDA: Configurações do Relatório
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
                  <SelectItem value="vencimento">Data de Vencimento</SelectItem>
                  <SelectItem value="cliente">Nome do Cliente (A-Z)</SelectItem>
                  <SelectItem value="seguradora">Seguradora</SelectItem>
                  <SelectItem value="premio">Prêmio (Maior primeiro)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Colunas */}
            <div className="space-y-3">
              <Label className="text-slate-300">Colunas a incluir</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-cliente"
                    checked={columns.clienteContato}
                    onCheckedChange={(checked) =>
                      setColumns(prev => ({ ...prev, clienteContato: !!checked }))
                    }
                  />
                  <label htmlFor="col-cliente" className="text-sm text-slate-300 cursor-pointer">
                    Cliente & Contato
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-apolice"
                    checked={columns.apoliceSeguradora}
                    onCheckedChange={(checked) =>
                      setColumns(prev => ({ ...prev, apoliceSeguradora: !!checked }))
                    }
                  />
                  <label htmlFor="col-apolice" className="text-sm text-slate-300 cursor-pointer">
                    Apólice & Seguradora
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-vigencia"
                    checked={columns.vigencia}
                    onCheckedChange={(checked) =>
                      setColumns(prev => ({ ...prev, vigencia: !!checked }))
                    }
                  />
                  <label htmlFor="col-vigencia" className="text-sm text-slate-300 cursor-pointer">
                    Vigência
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-ramo"
                    checked={columns.ramo}
                    onCheckedChange={(checked) =>
                      setColumns(prev => ({ ...prev, ramo: !!checked }))
                    }
                  />
                  <label htmlFor="col-ramo" className="text-sm text-slate-300 cursor-pointer">
                    Ramo
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-premio"
                    checked={columns.premio}
                    onCheckedChange={(checked) =>
                      setColumns(prev => ({ ...prev, premio: !!checked }))
                    }
                  />
                  <label htmlFor="col-premio" className="text-sm text-slate-300 cursor-pointer">
                    Prêmio
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-comissao"
                    checked={columns.comissao}
                    onCheckedChange={(checked) =>
                      setColumns(prev => ({ ...prev, comissao: !!checked }))
                    }
                  />
                  <label htmlFor="col-comissao" className="text-sm text-slate-300 cursor-pointer">
                    Comissão
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================
              COLUNA DIREITA: Filtros de Dados
              ======================================== */}
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-700 pb-2 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Refinar Filtros
            </h3>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-slate-300">Status</Label>
              <Select 
                value={localFilters.status || 'todos'} 
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

            {/* Seguradora */}
            <div className="space-y-2">
              <Label className="text-slate-300">Seguradora</Label>
              <Select 
                value={localFilters.insuranceCompany || 'todas'} 
                onValueChange={(v) => updateFilter('insuranceCompany', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="todas">Todas as Seguradoras</SelectItem>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ramo */}
            <div className="space-y-2">
              <Label className="text-slate-300">Ramo</Label>
              <Select 
                value={localFilters.ramo || 'todos'} 
                onValueChange={(v) => updateFilter('ramo', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="todos">Todos os Ramos</SelectItem>
                  {ramos?.map(ramo => (
                    <SelectItem key={ramo.id} value={ramo.id}>{ramo.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Produtor */}
            <div className="space-y-2">
              <Label className="text-slate-300">Produtor</Label>
              <Select 
                value={localFilters.producerId || 'todos'} 
                onValueChange={(v) => updateFilter('producerId', v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="todos">Todos os Produtores</SelectItem>
                  {producers.map(producer => (
                    <SelectItem key={producer.id} value={producer.id}>{producer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período */}
            <div className="space-y-2">
              <Label className="text-slate-300">Período (Vencimento)</Label>
              <Select 
                value={localFilters.period || 'todos'} 
                onValueChange={(v) => {
                  updateFilter('period', v);
                  if (v !== 'custom') {
                    setDateRange(undefined);
                  }
                }}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {PERIOD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Picker (se custom) */}
            {localFilters.period === 'custom' && (
              <div className="space-y-2">
                <Label className="text-slate-300">Intervalo de Datas</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-slate-800 border-slate-700 text-white hover:bg-slate-700",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                            {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yy", { locale: ptBR })
                        )
                      ) : (
                        <span>Selecione o período</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Busca */}
            <div className="space-y-2">
              <Label className="text-slate-300">Busca (nº apólice / bem segurado)</Label>
              <Input
                value={localFilters.searchTerm || ''}
                onChange={(e) => updateFilter('searchTerm', e.target.value)}
                placeholder="Digite para buscar..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
        </div>

        {/* ========================================
            FOOTER: Resumo + Botão
            ======================================== */}
        <div className="border-t border-slate-700 pt-4 space-y-4">
          {/* Filtros ativos em badges */}
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

          {/* Contador em tempo real */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">
              {isCountLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Contando...
                </span>
              ) : estimatedCount !== null ? (
                <span>
                  <strong className="text-white">{estimatedCount}</strong> apólices encontradas
                </span>
              ) : null}
            </div>

            <Button
              onClick={handleExport}
              disabled={isExporting || estimatedCount === 0}
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
            Relatório em formato paisagem (landscape) • Alterações nos filtros não afetam a tela principal
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
