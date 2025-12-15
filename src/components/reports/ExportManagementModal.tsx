import { useState, useMemo } from 'react';
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
import { FileDown, Loader2, Download, RefreshCw } from 'lucide-react';
import { generateManagementReport, ReportOptions } from '@/utils/pdf/generateManagementReport';
import { toast } from 'sonner';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import { useFilteredDataForReports } from '@/hooks/useFilteredDataForReports';

interface ExportManagementModalProps {
  initialDateRange: DateRange | undefined;
  disabled?: boolean;
}

const SECTION_OPTIONS = [
  { key: 'kpis', label: 'Visão Geral (KPIs)' },
  { key: 'financial', label: 'Resumo Financeiro' },
  { key: 'branches', label: 'Detalhamento por Ramo' },
  { key: 'companies', label: 'Detalhamento por Seguradora' },
  { key: 'producers', label: 'Detalhamento por Produtor' },
] as const;

type SectionKey = typeof SECTION_OPTIONS[number]['key'];

export function ExportManagementModal({
  initialDateRange,
  disabled
}: ExportManagementModalProps) {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [title, setTitle] = useState('Relatório de Gestão');
  const [notes, setNotes] = useState('');
  const [selectedSections, setSelectedSections] = useState<SectionKey[]>([
    'kpis', 'financial', 'branches', 'companies', 'producers'
  ]);
  
  // Estado local do período - pode ser alterado dentro do modal
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);

  // ========================================
  // BUSCA DE DADOS INTERNA - SEM AGRUPAMENTO "OUTROS"
  // ========================================
  const { 
    apolicesFiltradas, 
    dadosPerformanceProdutor,
    branchDistributionDataFromTransactions,
    companyDistributionDataFromTransactions,
    totalGanhos,
    totalPerdas,
    saldoLiquido,
    temDados,
    isLoading: isLoadingData
  } = useFilteredDataForReports({
    intervalo: dateRange,
    seguradoraIds: [],
    ramos: [],
    produtorIds: [],
    statusIds: []
  }, { limitResults: false }); // 🎯 FALSE = Lista completa SEM "Outros"

  // Calcular KPIs da carteira
  const portfolioData = useMemo(() => {
    const apolicesAtivas = apolicesFiltradas.filter(p => p.status === 'Ativa');
    const valorTotalCarteira = apolicesAtivas.reduce((sum, p) => sum + (p.premium_value || 0), 0);
    const numeroClientes = new Set(apolicesFiltradas.map(p => p.client_id)).size;
    const numeroApolices = apolicesFiltradas.length;
    const ticketMedio = numeroApolices > 0 ? valorTotalCarteira / numeroApolices : 0;

    return {
      valorTotalCarteira,
      numeroClientes,
      numeroApolices,
      ticketMedio
    };
  }, [apolicesFiltradas]);

  const handleSectionToggle = (section: SectionKey) => {
    setSelectedSections(prev => 
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleGenerate = async () => {
    if (selectedSections.length === 0) {
      toast.error('Selecione ao menos uma seção para o relatório.');
      return;
    }

    if (!temDados) {
      toast.error('Não há dados disponíveis para o período selecionado.');
      return;
    }

    setIsGenerating(true);
    try {
      const options: ReportOptions = {
        title,
        notes: notes.trim() || undefined,
        sections: {
          kpis: selectedSections.includes('kpis'),
          financial: selectedSections.includes('financial'),
          branches: selectedSections.includes('branches'),
          companies: selectedSections.includes('companies'),
          producers: selectedSections.includes('producers'),
        }
      };

      console.log('📊 Gerando relatório com dados:', {
        periodo: dateRange,
        portfolio: portfolioData,
        financial: { totalGanhos, totalPerdas, saldoLiquido },
        branches: branchDistributionDataFromTransactions.length,
        companies: companyDistributionDataFromTransactions.length,
        producers: dadosPerformanceProdutor.data.length
      });

      await generateManagementReport({
        period: { from: dateRange?.from, to: dateRange?.to },
        portfolio: portfolioData,
        financial: {
          totalGanhos,
          totalPerdas,
          saldoLiquido
        },
        branchDistribution: branchDistributionDataFromTransactions,
        companyDistribution: companyDistributionDataFromTransactions,
        producerPerformance: dadosPerformanceProdutor.data
      }, options);

      toast.success('Relatório de Gestão gerado com sucesso!');
      setOpen(false);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setTitle('Relatório de Gestão');
    setNotes('');
    setSelectedSections(['kpis', 'financial', 'branches', 'companies', 'producers']);
    setDateRange(initialDateRange);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Ao abrir, sincroniza com o período da tela
      setDateRange(initialDateRange);
    } else {
      resetForm();
    }
  };

  const formatPeriod = () => {
    if (!dateRange?.from) return 'Período não definido';
    const fromStr = format(dateRange.from, "dd/MM/yyyy", { locale: ptBR });
    const toStr = dateRange.to 
      ? format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })
      : fromStr;
    return `${fromStr} a ${toStr}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2"
          disabled={disabled}
        >
          <FileDown className="h-4 w-4" />
          Baixar Relatório Gerencial
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Configurar Relatório de Gestão</DialogTitle>
          <DialogDescription>
            Personalize o período e conteúdo do seu relatório antes de exportar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Seletor de Período */}
          <div className="space-y-2">
            <Label>Período do Relatório</Label>
            <DatePickerWithRange 
              date={dateRange}
              onDateChange={setDateRange}
              className="w-full"
            />
            {isLoadingData && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Atualizando dados...
              </div>
            )}
          </div>

          {/* Personalização */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Personalização</h4>
            <div className="space-y-2">
              <Label htmlFor="title">Título do Relatório</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Relatório de Gestão"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionais que aparecerão no final do relatório..."
                rows={2}
              />
            </div>
          </div>

          {/* Seções */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Seções do Relatório</h4>
            <div className="space-y-2">
              {SECTION_OPTIONS.map((section) => (
                <div key={section.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={section.key}
                    checked={selectedSections.includes(section.key)}
                    onCheckedChange={() => handleSectionToggle(section.key)}
                  />
                  <Label htmlFor={section.key} className="font-normal cursor-pointer">
                    {section.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Período:</span>
              <span className="font-medium">{formatPeriod()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Seções:</span>
              <span className="font-medium">{selectedSections.length} selecionadas</span>
            </div>
            {!isLoadingData && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Apólices no período:</span>
                <span className="font-medium">{portfolioData.numeroApolices}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || selectedSections.length === 0 || isLoadingData || !temDados}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando PDF...
              </>
            ) : isLoadingData ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
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
