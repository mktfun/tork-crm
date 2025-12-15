import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileText, Loader2, Download } from 'lucide-react';
import { generateBillingReport, ReportOptions, ColumnKey } from '@/utils/pdf/generateBillingReport';
import { useToast } from '@/hooks/use-toast';
import { Transaction, Client, Policy, TransactionType } from '@/types';
import { DateRange } from 'react-day-picker';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface ExportBillingModalProps {
  transactions: Transaction[];
  metrics: {
    totalGanhos: number;
    totalPerdas: number;
    saldoLiquido: number;
    totalPrevisto: number;
  };
  dateRange: DateRange | undefined;
  clients: Client[];
  policies: Policy[];
  transactionTypes: TransactionType[];
  disabled?: boolean;
}

const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: 'date', label: 'Data' },
  { key: 'description', label: 'Descrição' },
  { key: 'client', label: 'Cliente' },
  { key: 'type', label: 'Tipo' },
  { key: 'status', label: 'Status' },
  { key: 'value', label: 'Valor' },
];

export function ExportBillingModal({
  transactions,
  metrics,
  dateRange,
  clients,
  policies,
  transactionTypes,
  disabled
}: ExportBillingModalProps) {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const [title, setTitle] = useState('Relatório de Faturamento');
  const [notes, setNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(['date', 'description', 'client', 'type', 'status', 'value']);
  const [totalTransactionsCount, setTotalTransactionsCount] = useState<number | null>(null);
  
  const { toast } = useToast();

  const handleColumnToggle = (column: ColumnKey) => {
    setSelectedColumns(prev => 
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const handleGenerate = async () => {
    if (selectedColumns.length === 0) {
      toast({
        title: "Selecione ao menos uma coluna",
        description: "É necessário selecionar pelo menos uma coluna para o relatório.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGenerating(true);
      setIsFetchingAll(true);

      // ========================================
      // FETCH TODAS AS TRANSAÇÕES DO PERÍODO (SEM PAGINAÇÃO)
      // ========================================
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '2000-01-01';
      const endDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '2099-12-31';

      console.log('🔄 Buscando TODAS as transações para o período:', { startDate, endDate });

      const { data: rpcData, error } = await supabase.rpc('get_faturamento_data', {
        p_user_id: user.id,
        p_start_date: startDate,
        p_end_date: endDate,
        p_page: 1,
        p_page_size: 5000, // Busca até 5000 registros
        p_timezone: 'America/Sao_Paulo'
      });

      setIsFetchingAll(false);

      if (error) {
        console.error('Erro ao buscar transações:', error);
        throw error;
      }

      // Parse dos dados da RPC (type assertion para evitar erros TS)
      const rpcResult = rpcData as { transactions?: any[]; total?: number } | null;
      const allTransactions: Transaction[] = (rpcResult?.transactions || []).map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        typeId: t.type_id,
        amount: Number(t.amount) || 0,
        description: t.description,
        date: t.date,
        dueDate: t.due_date,
        transactionDate: t.transaction_date,
        status: t.status,
        policyId: t.policy_id,
        clientId: t.client_id,
        nature: t.nature,
        companyId: t.company_id,
        ramoId: t.ramo_id,
        producerId: t.producer_id,
        brokerageId: t.brokerage_id,
        paidDate: t.paid_date,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }));

      console.log('📊 Total de transações encontradas:', allTransactions.length);

      // Filtrar transações por status
      let filteredTransactions = [...allTransactions];
      if (statusFilter === 'paid') {
        filteredTransactions = allTransactions.filter(t => t.status === 'PAGO');
      } else if (statusFilter === 'pending') {
        filteredTransactions = allTransactions.filter(t => t.status === 'PENDENTE' || t.status === 'PARCIALMENTE_PAGO');
      }

      // Log para debug
      console.log('📋 ExportModal - Transações filtradas:', {
        total: allTransactions.length,
        filtradas: filteredTransactions.length,
        filtro: statusFilter
      });

      if (filteredTransactions.length === 0) {
        toast({
          title: "Sem dados para exportar",
          description: "Não há transações com o filtro selecionado.",
          variant: "destructive"
        });
        setIsGenerating(false);
        return;
      }

      // Recalcular métricas baseado no filtro
      // Nota: O banco usa 'RECEITA'/'DESPESA', mas o PDF espera 'GANHO'/'PERDA'
      const filteredMetrics = filteredTransactions.reduce((acc, t) => {
        const transactionType = transactionTypes.find(tt => tt.id === t.typeId);
        const natureFromDb = transactionType?.nature || t.nature;
        const isGanho = natureFromDb === 'GANHO' || natureFromDb === 'RECEITA';
        const amount = Math.abs(t.amount);
        
        if (t.status === 'PAGO') {
          if (isGanho) acc.totalGanhos += amount;
          else acc.totalPerdas += amount;
        } else {
          acc.totalPrevisto += isGanho ? amount : -amount;
        }
        
        return acc;
      }, { totalGanhos: 0, totalPerdas: 0, totalPrevisto: 0, saldoLiquido: 0 });
      
      filteredMetrics.saldoLiquido = filteredMetrics.totalGanhos - filteredMetrics.totalPerdas;

      // Transformar dados com SANITIZAÇÃO de descrições
      const reportTransactions = filteredTransactions.map(t => {
        const client = clients.find(c => c.id === t.clientId);
        const transactionType = transactionTypes.find(tt => tt.id === t.typeId);
        const policy = policies.find(p => p.id === t.policyId);
        
        // SANITIZAÇÃO CRÍTICA: Nunca mostrar "undefined"
        let safeDescription = t.description?.trim() || '';
        if (!safeDescription || safeDescription.includes('undefined') || safeDescription === 'undefined') {
          if (policy?.policyNumber) {
            safeDescription = `Comissão Apólice ${policy.policyNumber}`;
          } else {
            safeDescription = transactionType?.name || 'Lançamento Manual';
          }
        }
        // Remove qualquer "undefined" residual
        safeDescription = safeDescription.replace(/undefined/gi, '').trim() || transactionType?.name || 'Lançamento';
        
        // Mapear nature do banco (RECEITA/DESPESA) para formato do PDF (GANHO/PERDA)
        const natureFromDb = transactionType?.nature || t.nature || 'RECEITA';
        const mappedNature: 'GANHO' | 'PERDA' = (natureFromDb === 'RECEITA' || natureFromDb === 'GANHO') ? 'GANHO' : 'PERDA';
        
        return {
          date: new Date(t.date).toLocaleDateString('pt-BR'),
          description: safeDescription,
          clientName: client?.name || 'Não informado',
          typeName: transactionType?.name || 'Transação',
          policyNumber: policy?.policyNumber || null,
          status: t.status === 'PAGO' ? 'Pago' : t.status === 'PARCIALMENTE_PAGO' ? 'Parcial' : 'Pendente',
          amount: t.amount,
          nature: mappedNature
        };
      });

      const options: ReportOptions = {
        title,
        notes: notes.trim() || undefined,
        selectedColumns,
        statusFilter
      };

      await generateBillingReport({
        transactions: reportTransactions,
        metrics: filteredMetrics,
        period: {
          from: dateRange?.from,
          to: dateRange?.to
        },
        options
      });

      toast({
        title: "Relatório gerado",
        description: `PDF exportado com ${filteredTransactions.length} transações.`,
      });

      setOpen(false);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível gerar o relatório. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
      setIsFetchingAll(false);
    }
  };

  const resetForm = () => {
    setTitle('Relatório de Faturamento');
    setNotes('');
    setStatusFilter('all');
    setSelectedColumns(['date', 'description', 'client', 'type', 'status', 'value']);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="bg-white/10 border-white/20 text-slate-200 hover:bg-white/20 gap-2"
          disabled={disabled || !transactions?.length}
        >
          <FileText className="h-4 w-4" />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configurar Relatório de Faturamento</DialogTitle>
          <DialogDescription>
            Personalize o conteúdo e formato do seu relatório antes de exportar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Seção 1 - Personalização */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Personalização</h4>
            <div className="space-y-2">
              <Label htmlFor="title">Título do Relatório</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Relatório de Faturamento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionais que aparecerão no rodapé do relatório..."
                rows={2}
              />
            </div>
          </div>

          {/* Seção 2 - Filtros */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Filtrar por Status</h4>
            <RadioGroup value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'paid' | 'pending')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal cursor-pointer">Todos os status</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="paid" id="paid" />
                <Label htmlFor="paid" className="font-normal cursor-pointer">Apenas Pagos</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pending" id="pending" />
                <Label htmlFor="pending" className="font-normal cursor-pointer">Apenas Pendentes</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Seção 3 - Colunas */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Colunas do Relatório</h4>
            <div className="grid grid-cols-2 gap-3">
              {COLUMN_OPTIONS.map((col) => (
                <div key={col.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={col.key}
                    checked={selectedColumns.includes(col.key)}
                    onCheckedChange={() => handleColumnToggle(col.key)}
                  />
                  <Label htmlFor={col.key} className="font-normal cursor-pointer">
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Contador de transações e aviso */}
          <div className="rounded-lg bg-muted/50 p-3 text-center space-y-1">
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {statusFilter === 'paid' 
                  ? transactions.filter(t => t.status === 'PAGO').length
                  : statusFilter === 'pending'
                  ? transactions.filter(t => t.status === 'PENDENTE' || t.status === 'PARCIALMENTE_PAGO').length
                  : transactions.length}
              </strong> transações visíveis na página atual
            </span>
            <p className="text-xs text-muted-foreground">
              O PDF incluirá <strong>todas</strong> as transações do período selecionado.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || selectedColumns.length === 0}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isFetchingAll ? 'Buscando dados...' : 'Gerando PDF...'}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Gerar Relatório
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
