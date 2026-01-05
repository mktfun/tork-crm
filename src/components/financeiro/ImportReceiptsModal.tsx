import { useState, useCallback, useRef } from 'react';
import { Upload, Loader2, Image as ImageIcon, Trash2, Check, AlertCircle, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import { supabase } from '@/integrations/supabase/client';
import { useFinancialAccounts, useRegisterExpense } from '@/hooks/useFinanceiro';
import { ReceiptImportItem, ExtractedReceiptData } from '@/types/financeiro';

// Gerar ID único
function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Converter File para Base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o prefixo "data:...;base64,"
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Chamar Edge Function de OCR
async function analyzeReceipt(file: File): Promise<ExtractedReceiptData | null> {
  try {
    const base64 = await fileToBase64(file);
    
    const { data, error } = await supabase.functions.invoke('analyze-receipt', {
      body: { 
        fileBase64: base64, 
        mimeType: file.type 
      }
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Erro na análise');
    
    return data.data as ExtractedReceiptData;
  } catch (err) {
    console.error('Erro ao analisar recibo:', err);
    return null;
  }
}

// Upload para Storage
async function uploadReceiptToStorage(file: File, userId: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/${generateId()}.${ext}`;
    
    const { error } = await supabase.storage
      .from('comprovantes')
      .upload(fileName, file, { contentType: file.type });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('comprovantes')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (err) {
    console.error('Erro ao fazer upload:', err);
    return null;
  }
}

export function ImportReceiptsModal() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReceiptImportItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: expenseAccounts = [] } = useFinancialAccounts('expense');
  const { data: assetAccounts = [] } = useFinancialAccounts('asset');
  const registerExpense = useRegisterExpense();

  // Encontrar conta de destino padrão (primeiro ativo)
  const defaultAssetAccountId = assetAccounts[0]?.id || '';

  // Handler para seleção de arquivos
  const handleFilesSelected = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(f => 
      f.type.startsWith('image/') || f.type === 'application/pdf'
    );

    if (validFiles.length === 0) {
      toast.error('Selecione imagens ou PDFs válidos');
      return;
    }

    // Criar itens iniciais
    const newItems: ReceiptImportItem[] = validFiles.map(file => ({
      id: generateId(),
      file,
      thumbnailUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      extractedData: null,
      isLoading: true,
      description: file.name.replace(/\.[^/.]+$/, ''),
      amount: 0,
      transactionDate: format(new Date(), 'yyyy-MM-dd'),
      categoryAccountId: '',
      selected: true,
    }));

    setItems(prev => [...prev, ...newItems]);
    setIsProcessing(true);
    setProcessProgress(0);

    // Processar cada arquivo com OCR
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const extractedData = await analyzeReceipt(item.file);
      
      setItems(prev => prev.map(it => {
        if (it.id !== item.id) return it;
        
        // Tentar encontrar categoria correspondente
        let categoryAccountId = '';
        if (extractedData?.category_guess) {
          const match = expenseAccounts.find(acc => 
            acc.name.toLowerCase().includes(extractedData.category_guess!.toLowerCase()) ||
            extractedData.category_guess!.toLowerCase().includes(acc.name.toLowerCase())
          );
          if (match) categoryAccountId = match.id;
        }
        
        return {
          ...it,
          isLoading: false,
          extractedData,
          description: extractedData?.merchant_name || it.description,
          amount: extractedData?.amount || 0,
          transactionDate: extractedData?.date || it.transactionDate,
          categoryAccountId,
          error: extractedData ? undefined : 'Não foi possível ler este recibo',
        };
      }));

      setProcessProgress(Math.round(((i + 1) / newItems.length) * 100));
    }

    setIsProcessing(false);
    setProcessProgress(100);
  }, [expenseAccounts]);

  // Drop handler
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  }, [handleFilesSelected]);

  // Remover item
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  // Toggle seleção
  const toggleSelection = (id: string) => {
    setItems(prev => prev.map(it => 
      it.id === id ? { ...it, selected: !it.selected } : it
    ));
  };

  // Atualizar campo de um item
  const updateItem = (id: string, field: keyof ReceiptImportItem, value: any) => {
    setItems(prev => prev.map(it => 
      it.id === id ? { ...it, [field]: value } : it
    ));
  };

  // Importar selecionados
  const handleImport = async () => {
    const selectedItems = items.filter(it => it.selected && !it.isLoading && it.amount > 0);
    
    if (selectedItems.length === 0) {
      toast.error('Selecione pelo menos um recibo válido');
      return;
    }

    if (!defaultAssetAccountId) {
      toast.error('Configure uma conta de origem primeiro');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Usuário não autenticado');
      setIsImporting(false);
      return;
    }

    for (const item of selectedItems) {
      try {
        // 1. Upload do arquivo
        const fileUrl = await uploadReceiptToStorage(item.file, user.id);
        
        // 2. Registrar despesa (sem attachments por enquanto - a RPC não suporta)
        await registerExpense.mutateAsync({
          description: item.description,
          amount: item.amount,
          transactionDate: item.transactionDate,
          expenseAccountId: item.categoryAccountId,
          assetAccountId: defaultAssetAccountId,
          referenceNumber: fileUrl ? `Recibo: ${item.file.name}` : undefined,
          memo: fileUrl || undefined,
        });

        successCount++;
      } catch (err) {
        console.error('Erro ao importar:', err);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} despesa(s) importada(s) com sucesso!`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erro(s) na importação`);
    }

    setIsImporting(false);
    setItems([]);
    setOpen(false);
  };

  const selectedCount = items.filter(it => it.selected && !it.isLoading).length;
  const hasLoadingItems = items.some(it => it.isLoading);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4" />
          Importar via IA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Importar Recibos com IA
          </DialogTitle>
          <DialogDescription>
            Arraste fotos de notas fiscais ou recibos. A IA irá ler os dados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Área de Drop */}
          {items.length === 0 && (
            <div
              className="border-2 border-dashed border-border/50 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                Arraste fotos ou PDFs aqui
              </p>
              <p className="text-sm text-muted-foreground">
                ou clique para selecionar arquivos
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
              />
            </div>
          )}

          {/* Barra de Progresso */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                A IA está lendo seus recibos...
              </div>
              <Progress value={processProgress} className="h-2" />
            </div>
          )}

          {/* Lista de Itens */}
          {items.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Adicionar mais
                </Button>
                <Badge variant="secondary">
                  {selectedCount} selecionado(s)
                </Badge>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
                />
              </div>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex gap-4 p-4 rounded-lg border transition-colors ${
                        item.selected ? 'bg-muted/30 border-primary/30' : 'bg-muted/10 border-border/30'
                      }`}
                    >
                      {/* Checkbox + Thumbnail */}
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={() => toggleSelection(item.id)}
                          disabled={item.isLoading}
                        />
                        <div className="w-16 h-16 rounded bg-muted flex items-center justify-center overflow-hidden">
                          {item.thumbnailUrl ? (
                            <img 
                              src={item.thumbnailUrl} 
                              alt="Preview" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Campos Editáveis */}
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {item.isLoading ? (
                          <div className="col-span-4 flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Analisando...
                          </div>
                        ) : (
                          <>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs">Descrição</Label>
                              <Input
                                value={item.description}
                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                placeholder="Descrição"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Valor (R$)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.amount || ''}
                                onChange={(e) => updateItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                placeholder="0,00"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Data</Label>
                              <Input
                                type="date"
                                value={item.transactionDate}
                                onChange={(e) => updateItem(item.id, 'transactionDate', e.target.value)}
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs">Categoria</Label>
                              <Select
                                value={item.categoryAccountId}
                                onValueChange={(v) => updateItem(item.id, 'categoryAccountId', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseAccounts.map((acc) => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                      {acc.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {item.error && (
                              <div className="col-span-2 flex items-center gap-1 text-xs text-amber-600">
                                <AlertCircle className="w-3 h-3" />
                                {item.error}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Remover */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setItems([]); setOpen(false); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || hasLoadingItems || selectedCount === 0}
              className="gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Importar {selectedCount} Despesa(s)
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
