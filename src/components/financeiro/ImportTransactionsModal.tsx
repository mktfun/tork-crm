import { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  Upload, 
  FileSpreadsheet, 
  ArrowRight, 
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  Settings2,
  Tag,
  CheckCircle2
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

import { useFinancialAccountsWithDefaults, useBulkImport } from '@/hooks/useFinanceiro';
import { FinancialAccount, ImportedTransaction, ColumnMapping, BulkImportPayload } from '@/types/financeiro';
import { 
  parseCurrencyBRL, 
  parseDateBRL, 
  detectColumnTypes, 
  suggestCategoryAccount,
  validateCSVFile 
} from '@/utils/csvFinanceParser';

type WizardStep = 'upload' | 'account' | 'mapping' | 'categorize';

const STEPS: { key: WizardStep; label: string; icon: React.ElementType }[] = [
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'account', label: 'Conta', icon: Settings2 },
  { key: 'mapping', label: 'Colunas', icon: FileSpreadsheet },
  { key: 'categorize', label: 'Categorizar', icon: Tag },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ImportTransactionsModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedAssetAccountId, setSelectedAssetAccountId] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    dateColumn: '',
    descriptionColumn: '',
    amountColumn: '',
    referenceColumn: ''
  });
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');

  const { data: accounts = [], isLoading: accountsLoading } = useFinancialAccountsWithDefaults();
  const bulkImport = useBulkImport();

  // Filtrar contas por tipo
  const assetAccounts = useMemo(() => 
    accounts.filter(a => a.type === 'asset'), [accounts]
  );
  const expenseAccounts = useMemo(() => 
    accounts.filter(a => a.type === 'expense'), [accounts]
  );
  const revenueAccounts = useMemo(() => 
    accounts.filter(a => a.type === 'revenue'), [accounts]
  );
  const categoryAccounts = useMemo(() => 
    [...expenseAccounts, ...revenueAccounts], [expenseAccounts, revenueAccounts]
  );

  // Estatísticas
  const uncategorizedCount = useMemo(() => 
    transactions.filter(t => !t.categoryAccountId).length, [transactions]
  );
  const canFinish = uncategorizedCount === 0 && transactions.length > 0;

  // ============ HANDLERS ============

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validation = validateCSVFile(selectedFile);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setFile(selectedFile);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const data = results.data as Record<string, any>[];
        const csvHeaders = results.meta.fields || [];
        
        setRawData(data);
        setHeaders(csvHeaders);

        // Auto-detectar colunas
        const detected = detectColumnTypes(csvHeaders, data.slice(0, 5));
        setColumnMapping({
          dateColumn: detected.dateColumn || '',
          descriptionColumn: detected.descriptionColumn || '',
          amountColumn: detected.amountColumn || '',
          referenceColumn: detected.referenceColumn || ''
        });

        toast.success(`${data.length} linhas carregadas`);
      },
      error: (error) => {
        toast.error(`Erro ao ler arquivo: ${error.message}`);
      }
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const fakeEvent = { target: { files: [droppedFile] } } as any;
      handleFileChange(fakeEvent);
    }
  }, [handleFileChange]);

  const processTransactions = useCallback(() => {
    if (!columnMapping.dateColumn || !columnMapping.descriptionColumn || !columnMapping.amountColumn) {
      toast.error('Mapeie as colunas obrigatórias');
      return;
    }

    const processed: ImportedTransaction[] = rawData.map((row) => {
      const description = String(row[columnMapping.descriptionColumn] || '').trim();
      const amount = parseCurrencyBRL(row[columnMapping.amountColumn]);
      const dateStr = parseDateBRL(String(row[columnMapping.dateColumn] || ''));
      const reference = columnMapping.referenceColumn 
        ? String(row[columnMapping.referenceColumn] || '').trim() 
        : undefined;

      // Sugerir categoria automaticamente
      const suggestedCategoryId = suggestCategoryAccount(description, categoryAccounts);

      return {
        id: crypto.randomUUID(),
        description,
        transactionDate: dateStr || new Date().toISOString().split('T')[0],
        amount,
        referenceNumber: reference,
        categoryAccountId: suggestedCategoryId || undefined,
        originalRow: row
      };
    }).filter(t => t.description && t.amount !== 0);

    setTransactions(processed);
    setStep('categorize');
  }, [rawData, columnMapping, categoryAccounts]);

  const handleCategoryChange = useCallback((txId: string, categoryId: string) => {
    setTransactions(prev => prev.map(t => 
      t.id === txId ? { ...t, categoryAccountId: categoryId } : t
    ));
  }, []);

  const handleToggleSelect = useCallback((txId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(txId)) {
        next.delete(txId);
      } else {
        next.add(txId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((onlyUncategorized: boolean) => {
    if (onlyUncategorized) {
      const uncatIds = transactions.filter(t => !t.categoryAccountId).map(t => t.id);
      setSelectedIds(new Set(uncatIds));
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  }, [transactions]);

  const handleApplyBulkCategory = useCallback(() => {
    if (!bulkCategoryId || selectedIds.size === 0) return;

    setTransactions(prev => prev.map(t => 
      selectedIds.has(t.id) ? { ...t, categoryAccountId: bulkCategoryId } : t
    ));
    setSelectedIds(new Set());
    setBulkCategoryId('');
    toast.success(`Categoria aplicada a ${selectedIds.size} transações`);
  }, [bulkCategoryId, selectedIds]);

  const handleImport = useCallback(async () => {
    if (!selectedAssetAccountId) {
      toast.error('Selecione a conta bancária');
      return;
    }

    const payload: BulkImportPayload = {
      assetAccountId: selectedAssetAccountId,
      transactions: transactions.map(t => ({
        description: t.description,
        transactionDate: t.transactionDate,
        amount: t.amount,
        categoryAccountId: t.categoryAccountId!,
        referenceNumber: t.referenceNumber
      }))
    };

    try {
      const result = await bulkImport.mutateAsync(payload);
      
      if (result.errorCount > 0) {
        toast.warning(`${result.successCount} importadas, ${result.errorCount} erros`);
      } else {
        toast.success(`${result.successCount} transações importadas com sucesso!`);
      }

      // Reset e fechar
      setOpen(false);
      resetState();
    } catch (error: any) {
      toast.error(`Erro na importação: ${error.message}`);
    }
  }, [selectedAssetAccountId, transactions, bulkImport]);

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setRawData([]);
    setHeaders([]);
    setSelectedAssetAccountId('');
    setColumnMapping({ dateColumn: '', descriptionColumn: '', amountColumn: '', referenceColumn: '' });
    setTransactions([]);
    setSelectedIds(new Set());
    setBulkCategoryId('');
  }, []);

  const goToStep = useCallback((newStep: WizardStep) => {
    // Validações antes de avançar
    if (newStep === 'account' && !file) {
      toast.error('Envie um arquivo primeiro');
      return;
    }
    if (newStep === 'mapping' && !selectedAssetAccountId) {
      toast.error('Selecione uma conta bancária');
      return;
    }
    if (newStep === 'categorize') {
      processTransactions();
      return;
    }
    setStep(newStep);
  }, [file, selectedAssetAccountId, processTransactions]);

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  // ============ RENDER STEPS ============

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById('csv-input')?.click()}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">Arraste seu arquivo CSV aqui</p>
        <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
        <p className="text-xs text-muted-foreground">Formatos aceitos: .csv (até 5MB)</p>
        <Input
          id="csv-input"
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {file && (
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <div className="flex-1">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">{rawData.length} linhas encontradas</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderAccountStep = () => (
    <div className="space-y-4">
      <div>
        <Label className="text-base">Para qual conta este extrato se refere?</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Selecione a conta bancária de onde as transações entraram/saíram
        </p>
      </div>

      {accountsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {assetAccounts.map((acc) => (
            <Card 
              key={acc.id}
              className={`cursor-pointer transition-all ${
                selectedAssetAccountId === acc.id 
                  ? 'border-primary bg-primary/5' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedAssetAccountId(acc.id)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  selectedAssetAccountId === acc.id 
                    ? 'border-primary bg-primary' 
                    : 'border-muted-foreground'
                }`} />
                <div>
                  <p className="font-medium">{acc.name}</p>
                  {acc.description && (
                    <p className="text-sm text-muted-foreground">{acc.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-6">
      <div>
        <Label className="text-base">Mapeie as colunas do seu CSV</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Indique qual coluna contém cada informação
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Coluna Data *</Label>
          <Select 
            value={columnMapping.dateColumn} 
            onValueChange={(v) => setColumnMapping(prev => ({ ...prev, dateColumn: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {headers.map(h => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Coluna Descrição *</Label>
          <Select 
            value={columnMapping.descriptionColumn} 
            onValueChange={(v) => setColumnMapping(prev => ({ ...prev, descriptionColumn: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {headers.map(h => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Coluna Valor *</Label>
          <Select 
            value={columnMapping.amountColumn} 
            onValueChange={(v) => setColumnMapping(prev => ({ ...prev, amountColumn: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {headers.map(h => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Coluna Referência (opcional)</Label>
          <Select 
            value={columnMapping.referenceColumn || ''} 
            onValueChange={(v) => setColumnMapping(prev => ({ ...prev, referenceColumn: v || undefined }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Nenhuma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Nenhuma</SelectItem>
              {headers.map(h => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview */}
      <div>
        <Label className="text-sm text-muted-foreground">Preview (primeiras 3 linhas)</Label>
        <div className="mt-2 border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Descrição</th>
                <th className="p-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rawData.slice(0, 3).map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{row[columnMapping.dateColumn] || '-'}</td>
                  <td className="p-2 truncate max-w-[200px]">{row[columnMapping.descriptionColumn] || '-'}</td>
                  <td className="p-2 text-right">{row[columnMapping.amountColumn] || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCategorizeStep = () => (
    <div className="space-y-4">
      {/* Bulk Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => handleSelectAll(true)}
        >
          Selecionar sem categoria ({uncategorizedCount})
        </Button>
        
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Categoria..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" disabled>Selecione...</SelectItem>
                {categoryAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.type === 'expense' ? '📤' : '📥'} {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              size="sm" 
              onClick={handleApplyBulkCategory}
              disabled={!bulkCategoryId}
            >
              Aplicar ({selectedIds.size})
            </Button>
          </div>
        )}
      </div>

      {/* Status */}
      {uncategorizedCount > 0 && (
        <div className="flex items-center gap-2 text-amber-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{uncategorizedCount} transações sem categoria</span>
        </div>
      )}

      {/* Transaction List */}
      <ScrollArea className="h-[350px] border rounded-lg">
        <div className="p-2 space-y-1">
          {transactions.map((tx) => (
            <Card 
              key={tx.id} 
              className={`bg-card/50 ${!tx.categoryAccountId ? 'border-amber-500/30' : ''}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedIds.has(tx.id)}
                    onCheckedChange={() => handleToggleSelect(tx.id)}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.transactionDate}
                      {tx.referenceNumber && ` • ${tx.referenceNumber}`}
                    </p>
                  </div>
                  
                  <p className={`font-semibold text-sm whitespace-nowrap ${
                    tx.amount > 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </p>
                  
                  <Select 
                    value={tx.categoryAccountId || ''} 
                    onValueChange={(v) => handleCategoryChange(tx.id, v)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.type === 'expense' ? '📤' : '📥'} {acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Importar CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Transações do Extrato</DialogTitle>
          <DialogDescription>
            Importe transações de um arquivo CSV de extrato bancário
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 py-4 border-b">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = s.key === step;
            const isPast = i < currentStepIndex;
            
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : isPast 
                      ? 'bg-emerald-500/20 text-emerald-500' 
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {isPast ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-auto py-4">
          {step === 'upload' && renderUploadStep()}
          {step === 'account' && renderAccountStep()}
          {step === 'mapping' && renderMappingStep()}
          {step === 'categorize' && renderCategorizeStep()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => {
              if (currentStepIndex > 0) {
                setStep(STEPS[currentStepIndex - 1].key);
              }
            }}
            disabled={currentStepIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <div className="text-sm text-muted-foreground">
            {step === 'categorize' && `${transactions.length} transações`}
          </div>

          {step === 'categorize' ? (
            <Button
              onClick={handleImport}
              disabled={!canFinish || bulkImport.isPending}
            >
              {bulkImport.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Importar {transactions.length} Transações
            </Button>
          ) : (
            <Button
              onClick={() => goToStep(STEPS[currentStepIndex + 1]?.key)}
              disabled={
                (step === 'upload' && !file) ||
                (step === 'account' && !selectedAssetAccountId) ||
                (step === 'mapping' && (!columnMapping.dateColumn || !columnMapping.descriptionColumn || !columnMapping.amountColumn))
              }
            >
              Próximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
