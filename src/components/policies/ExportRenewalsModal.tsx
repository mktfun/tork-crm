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
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Filter } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseProducers } from '@/hooks/useSupabaseProducers';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, startOfMonth, endOfMonth, startOfToday, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { generateRenewalsReport, RenewalReportRow, RenewalReportOptions } from '@/utils/pdf/generateRenewalsReport';

interface ExportRenewalsModalProps {
  disabled?: boolean;
}

const RENEWAL_STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Em Contato', label: 'Em Contato' },
  { value: 'Proposta Enviada', label: 'Proposta Enviada' },
  { value: 'Renovada', label: 'Renovada' },
  { value: 'Não Renovada', label: 'Não Renovada' },
];

const PERIOD_OPTIONS = [
  { value: 'next-30', label: 'Próximos 30 dias' },
  { value: 'current-month', label: 'Mês Atual' },
  { value: 'next-60', label: 'Próximos 60 dias' },
  { value: 'next-90', label: 'Próximos 90 dias' },
  { value: 'all', label: 'Todas (sem limite)' },
];

export function ExportRenewalsModal({ disabled }: ExportRenewalsModalProps) {
  const { user } = useAuth();
  const { producers } = useSupabaseProducers();
  
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [isCountLoading, setIsCountLoading] = useState(false);

  // Filtros locais
  const [renewalStatus, setRenewalStatus] = useState('todos');
  const [period, setPeriod] = useState('next-30');
  const [producerId, setProducerId] = useState('todos');

  // Configurações do relatório
  const [title, setTitle] = useState('Relatório de Renovações');
  const [notes, setNotes] = useState('');
  const [columns, setColumns] = useState({
    vencimento: true,
    clienteContato: true,
    apoliceSeguradora: true,
    statusRenovacao: true,
    premio: true,
  });

  // Calcular período de datas
  const calculatedPeriod = useMemo(() => {
    const hoje = startOfToday();
    switch (period) {
      case 'next-30':
        return { start: hoje, end: addDays(hoje, 30), label: 'Próximos 30 dias' };
      case 'current-month':
        return { start: startOfMonth(hoje), end: endOfMonth(hoje), label: 'Mês Atual' };
      case 'next-60':
        return { start: hoje, end: addDays(hoje, 60), label: 'Próximos 60 dias' };
      case 'next-90':
        return { start: hoje, end: addDays(hoje, 90), label: 'Próximos 90 dias' };
      case 'all':
        return { start: null, end: null, label: 'Todas as renovações' };
      default:
        return { start: hoje, end: addDays(hoje, 30), label: 'Próximos 30 dias' };
    }
  }, [period]);

  // Contador em tempo real
  useEffect(() => {
    if (!open || !user) return;

    const countRenewals = async () => {
      setIsCountLoading(true);
      try {
        let query = supabase
          .from('apolices')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'Ativa');

        // Filtro de período
        if (calculatedPeriod.end) {
          query = query.lte('expiration_date', format(calculatedPeriod.end, 'yyyy-MM-dd'));
        }

        // Filtro de status de renovação
        if (renewalStatus !== 'todos') {
          query = query.eq('renewal_status', renewalStatus);
        }

        // Filtro de produtor
        if (producerId !== 'todos') {
          query = query.eq('producer_id', producerId);
        }

        const { count, error } = await query;
        if (!error) {
          setEstimatedCount(count);
        }
      } catch (err) {
        console.error('Erro ao contar renovações:', err);
      } finally {
        setIsCountLoading(false);
      }
    };

    const timer = setTimeout(countRenewals, 300);
    return () => clearTimeout(timer);
  }, [open, user, renewalStatus, period, producerId, calculatedPeriod]);

  // Filtros ativos para display
  const activeFiltersDisplay = useMemo(() => {
    const filters: { label: string; value: string }[] = [];
    
    if (renewalStatus !== 'todos') {
      filters.push({ label: 'Status', value: renewalStatus });
    }
    if (period !== 'all') {
      filters.push({ label: 'Período', value: calculatedPeriod.label });
    }
    if (producerId !== 'todos') {
      const producer = producers.find(p => p.id === producerId);
      filters.push({ label: 'Produtor', value: producer?.name || producerId });
    }
    
    return filters;
  }, [renewalStatus, period, producerId, calculatedPeriod, producers]);

  // Fetch completo (sem paginação)
  const fetchAllRenewals = async (): Promise<RenewalReportRow[]> => {
    if (!user) throw new Error('Usuário não autenticado');

    let query = supabase
      .from('apolices')
      .select(`
        id,
        policy_number,
        insurance_company,
        premium_value,
        expiration_date,
        renewal_status,
        producer_id,
        companies:insurance_company(name),
        clientes:client_id(name, phone, email)
      `)
      .eq('user_id', user.id)
      .eq('status', 'Ativa');

    // Filtro de período
    if (calculatedPeriod.end) {
      query = query.lte('expiration_date', format(calculatedPeriod.end, 'yyyy-MM-dd'));
    }

    // Filtro de status de renovação
    if (renewalStatus !== 'todos') {
      query = query.eq('renewal_status', renewalStatus);
    }

    // Filtro de produtor
    if (producerId !== 'todos') {
      query = query.eq('producer_id', producerId);
    }

    // Ordenar por vencimento
    query = query.order('expiration_date', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Nenhuma renovação encontrada com os filtros aplicados.');
    }

    // Mapear para formato do relatório
    return data.map(item => {
      const expirationDate = parseISO(item.expiration_date);
      const diasParaVencer = differenceInDays(expirationDate, new Date());

      return {
        id: item.id,
        policyNumber: item.policy_number || 'S/N',
        clientName: item.clientes?.name || 'Cliente não encontrado',
        clientPhone: item.clientes?.phone || null,
        clientEmail: item.clientes?.email || null,
        insuranceCompany: item.insurance_company || '',
        companyName: item.companies?.name || 'Seguradora não especificada',
        expirationDate: item.expiration_date,
        renewalStatus: item.renewal_status || 'Pendente',
        premiumValue: Number(item.premium_value) || 0,
        diasParaVencer,
      };
    });
  };

  // Gerar relatório
  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      const renewals = await fetchAllRenewals();
      
      const reportOptions: RenewalReportOptions = {
        title,
        filters: {
          renewalStatus: renewalStatus !== 'todos' ? renewalStatus : undefined,
          period: calculatedPeriod.label,
          producer: activeFiltersDisplay.find(f => f.label === 'Produtor')?.value,
        },
        columns,
        notes: notes || undefined,
      };

      await generateRenewalsReport(renewals, reportOptions);
      
      toast.success(`Relatório gerado com ${renewals.length} renovações!`);
      setOpen(false);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar relatório');
    } finally {
      setIsExporting(false);
    }
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
          Exportar Lista
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Exportar Relatório de Renovações
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* COLUNA ESQUERDA: Configurações */}
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

            {/* Colunas */}
            <div className="space-y-3">
              <Label className="text-slate-300">Colunas a incluir</Label>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-vencimento"
                    checked={columns.vencimento}
                    onCheckedChange={(checked) => 
                      setColumns(prev => ({ ...prev, vencimento: !!checked }))
                    }
                  />
                  <label htmlFor="col-vencimento" className="text-sm text-slate-300">
                    Vencimento (Dias Restantes)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-cliente"
                    checked={columns.clienteContato}
                    onCheckedChange={(checked) => 
                      setColumns(prev => ({ ...prev, clienteContato: !!checked }))
                    }
                  />
                  <label htmlFor="col-cliente" className="text-sm text-slate-300">
                    Cliente & Contato (Tel/Email)
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
                  <label htmlFor="col-apolice" className="text-sm text-slate-300">
                    Apólice & Seguradora
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="col-status"
                    checked={columns.statusRenovacao}
                    onCheckedChange={(checked) => 
                      setColumns(prev => ({ ...prev, statusRenovacao: !!checked }))
                    }
                  />
                  <label htmlFor="col-status" className="text-sm text-slate-300">
                    Status da Renovação
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
                  <label htmlFor="col-premio" className="text-sm text-slate-300">
                    Prêmio Atual
                  </label>
                </div>
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-300">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionais para o relatório..."
                className="bg-slate-800 border-slate-700 text-white h-20"
              />
            </div>
          </div>

          {/* COLUNA DIREITA: Filtros */}
          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-700 pb-2 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros do Relatório
            </h3>

            {/* Período de Vencimento */}
            <div className="space-y-2">
              <Label className="text-slate-300">Período de Vencimento</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {PERIOD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status da Renovação */}
            <div className="space-y-2">
              <Label className="text-slate-300">Status da Renovação</Label>
              <Select value={renewalStatus} onValueChange={setRenewalStatus}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {RENEWAL_STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Produtor */}
            <div className="space-y-2">
              <Label className="text-slate-300">Produtor</Label>
              <Select value={producerId} onValueChange={setProducerId}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="todos">Todos os Produtores</SelectItem>
                  {producers.map(producer => (
                    <SelectItem key={producer.id} value={producer.id}>
                      {producer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtros Ativos */}
            {activeFiltersDisplay.length > 0 && (
              <div className="space-y-2">
                <Label className="text-slate-300">Filtros Ativos</Label>
                <div className="flex flex-wrap gap-2">
                  {activeFiltersDisplay.map((filter, index) => (
                    <Badge key={index} variant="secondary" className="bg-slate-700 text-slate-200">
                      {filter.label}: {filter.value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium text-slate-200">Preview do Relatório</h4>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Renovações encontradas:</span>
                {isCountLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <span className="text-white font-semibold text-lg">
                    {estimatedCount ?? '-'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                O PDF será gerado em formato Landscape com as colunas selecionadas.
                Renovações vencidas aparecerão em destaque vermelho.
              </p>
            </div>
          </div>
        </div>

        {/* Footer com botões */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || !estimatedCount}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Gerar PDF ({estimatedCount || 0})
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
