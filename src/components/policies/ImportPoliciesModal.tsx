import React, { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, FileText, Check, AlertCircle, Loader2, UserCheck, UserPlus, X, Sparkles, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseCompanies } from '@/hooks/useSupabaseCompanies';
import { useSupabaseProducers } from '@/hooks/useSupabaseProducers';
import { useSupabaseRamos } from '@/hooks/useSupabaseRamos';
import { usePolicies } from '@/hooks/useAppData';
import { 
  ExtractedPolicyData, 
  PolicyImportItem, 
  AnalyzePolicyResult 
} from '@/types/policyImport';
import { 
  reconcileClient, 
  matchSeguradora, 
  matchRamo, 
  createClient, 
  uploadPolicyPdf,
  validateImportItem 
} from '@/services/policyImportService';

interface ImportPoliciesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'processing' | 'review' | 'complete';
type FileProcessingStatus = 'pending' | 'processing' | 'success' | 'error' | 'rate_limited';

export function ImportPoliciesModal({ open, onOpenChange }: ImportPoliciesModalProps) {
  const { user } = useAuth();
  const { companies } = useSupabaseCompanies();
  const { producers } = useSupabaseProducers();
  const { data: ramos = [] } = useSupabaseRamos();
  const { addPolicy } = usePolicies();
  
  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<PolicyImportItem[]>([]);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, errors: 0 });
  const [processingStatus, setProcessingStatus] = useState<Map<number, FileProcessingStatus>>(new Map());
  
  // Batch actions state
  const [batchProducerId, setBatchProducerId] = useState<string>('');
  const [batchCommissionRate, setBatchCommissionRate] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetModal = useCallback(() => {
    setStep('upload');
    setFiles([]);
    setItems([]);
    setProcessingIndex(0);
    setImportResults({ success: 0, errors: 0 });
    setBatchProducerId('');
    setBatchCommissionRate('');
    setProcessingStatus(new Map());
  }, []);

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const validFiles = selectedFiles.filter(file => 
      file.type === 'application/pdf' || file.type.startsWith('image/')
    );
    
    if (validFiles.length !== selectedFiles.length) {
      toast.warning('Alguns arquivos foram ignorados. Apenas PDFs e imagens são aceitos.');
    }
    
    setFiles(prev => [...prev, ...validFiles]);
  };

  // Handle drag and drop
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    const validFiles = droppedFiles.filter(file => 
      file.type === 'application/pdf' || file.type.startsWith('image/')
    );
    
    if (validFiles.length !== droppedFiles.length) {
      toast.warning('Alguns arquivos foram ignorados. Apenas PDFs e imagens são aceitos.');
    }
    
    setFiles(prev => [...prev, ...validFiles]);
  }, []);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Process a single file
  const processSingleFile = async (file: File, index: number): Promise<PolicyImportItem | null> => {
    if (!user) return null;

    try {
      const base64 = await fileToBase64(file);

      const response = await fetch(
        `https://jaouwhckqqnaxqyfvgyq.supabase.co/functions/v1/analyze-policy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            fileBase64: base64,
            mimeType: file.type,
          }),
        }
      );

      // Check for rate limit
      if (response.status === 429) {
        throw new Error('429: Rate limit exceeded');
      }

      // Check for bad request (corrupted/password-protected PDF)
      if (response.status === 400) {
        throw new Error('400: Erro ao ler arquivo. Verifique se é um PDF válido e não tem senha.');
      }

      const result: AnalyzePolicyResult = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Falha na extração');
      }

      const extracted = result.data;

      // Reconcile client
      const clientResult = await reconcileClient(extracted, user.id);

      // Match seguradora and ramo
      const seguradoraMatch = await matchSeguradora(extracted.apolice.nome_seguradora, user.id);
      const ramoMatch = await matchRamo(extracted.apolice.ramo_seguro, user.id);

      // Create preview URL
      const filePreviewUrl = URL.createObjectURL(file);

      const item: PolicyImportItem = {
        id: crypto.randomUUID(),
        file,
        filePreviewUrl,
        fileName: file.name,
        extracted,
        clientStatus: clientResult.status,
        clientId: clientResult.clientId,
        clientName: extracted.cliente.nome_completo,
        clientCpfCnpj: extracted.cliente.cpf_cnpj,
        matchedBy: clientResult.matchedBy,
        seguradoraId: seguradoraMatch?.id || null,
        seguradoraNome: extracted.apolice.nome_seguradora,
        ramoId: ramoMatch?.id || null,
        ramoNome: extracted.apolice.ramo_seguro,
        producerId: null,
        commissionRate: 15,
        numeroApolice: extracted.apolice.numero_apolice,
        dataInicio: extracted.apolice.data_inicio,
        dataFim: extracted.apolice.data_fim,
        objetoSegurado: extracted.objeto_segurado.descricao_bem,
        premioLiquido: extracted.valores.premio_liquido,
        premioTotal: extracted.valores.premio_total,
        estimatedCommission: extracted.valores.premio_liquido * 0.15,
        isValid: false,
        validationErrors: [],
        isProcessing: false,
        isProcessed: true,
      };

      // Validate
      item.validationErrors = validateImportItem(item);
      item.isValid = item.validationErrors.length === 0;

      return item;
    } catch (error: any) {
      console.error('Error processing file:', file.name, error);
      
      // Create error item to keep in list
      const errorItem: PolicyImportItem = {
        id: crypto.randomUUID(),
        file,
        filePreviewUrl: URL.createObjectURL(file),
        fileName: file.name,
        extracted: {
          cliente: { nome_completo: '', cpf_cnpj: null, email: null, telefone: null, endereco_completo: null },
          apolice: { numero_apolice: '', nome_seguradora: '', data_inicio: '', data_fim: '', ramo_seguro: '' },
          objeto_segurado: { descricao_bem: '' },
          valores: { premio_liquido: 0, premio_total: 0 },
        },
        clientStatus: 'new',
        clientId: undefined,
        clientName: '',
        clientCpfCnpj: null,
        seguradoraId: null,
        seguradoraNome: '',
        ramoId: null,
        ramoNome: '',
        producerId: null,
        commissionRate: 15,
        numeroApolice: '',
        dataInicio: '',
        dataFim: '',
        objetoSegurado: '',
        premioLiquido: 0,
        premioTotal: 0,
        estimatedCommission: 0,
        isValid: false,
        validationErrors: ['Erro na extração via IA'],
        isProcessing: false,
        isProcessed: false,
        processError: error.message || 'Falha ao processar',
      };

      return errorItem;
    }
  };

  // Process files with OCR - Sequential with delays
  const processFiles = async () => {
    if (!user || files.length === 0) return;
    
    setStep('processing');
    const processedItems: PolicyImportItem[] = [];
    
    // Initialize status for each file
    const initialStatus = new Map<number, FileProcessingStatus>();
    files.forEach((_, i) => initialStatus.set(i, 'pending'));
    setProcessingStatus(initialStatus);
    
    for (let i = 0; i < files.length; i++) {
      setProcessingIndex(i);
      setProcessingStatus(prev => new Map(prev).set(i, 'processing'));
      
      const file = files[i];
      let didBackoff = false;
      
      try {
        const item = await processSingleFile(file, i);
        
        if (item) {
          if (item.processError) {
            // Check if it's a rate limit error
            if (item.processError.includes('429')) {
              setProcessingStatus(prev => new Map(prev).set(i, 'rate_limited'));
              toast.warning(`Rate limit atingido em ${file.name}. Aguardando 5s...`);
              processedItems.push(item);
              // BACKOFF: Wait 5 seconds on rate limit
              await new Promise(resolve => setTimeout(resolve, 5000));
              didBackoff = true;
            } else {
              setProcessingStatus(prev => new Map(prev).set(i, 'error'));
              processedItems.push(item);
            }
          } else {
            setProcessingStatus(prev => new Map(prev).set(i, 'success'));
            processedItems.push(item);
          }
        }
        
        // DELAY: Wait 2 seconds between files (skip if we already did backoff)
        if (i < files.length - 1 && !didBackoff) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error: any) {
        console.error('Error processing file:', file.name, error);
        
        if (error.message?.includes('429')) {
          setProcessingStatus(prev => new Map(prev).set(i, 'rate_limited'));
          toast.warning(`Rate limit atingido. Aguardando 5s antes do próximo...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          didBackoff = true;
        } else {
          setProcessingStatus(prev => new Map(prev).set(i, 'error'));
        }
      }
    }

    setItems(processedItems);
    setStep('review');
  };

  // Retry processing a single failed item
  const retryProcessing = async (itemId: string) => {
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex === -1 || !user) return;

    const item = items[itemIndex];
    
    // Mark as processing
    setItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, isProcessing: true, processError: undefined } : i
    ));

    try {
      const base64 = await fileToBase64(item.file);

      const response = await fetch(
        `https://jaouwhckqqnaxqyfvgyq.supabase.co/functions/v1/analyze-policy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            fileBase64: base64,
            mimeType: item.file.type,
          }),
        }
      );

      if (response.status === 429) {
        throw new Error('Rate limit atingido. Tente novamente em alguns segundos.');
      }

      const result: AnalyzePolicyResult = await response.json();

      if (result.success && result.data) {
        const extracted = result.data;
        const clientResult = await reconcileClient(extracted, user.id);
        const seguradoraMatch = await matchSeguradora(extracted.apolice.nome_seguradora, user.id);
        const ramoMatch = await matchRamo(extracted.apolice.ramo_seguro, user.id);

        setItems(prev => prev.map(i => {
          if (i.id !== itemId) return i;

          const updated: PolicyImportItem = {
            ...i,
            extracted,
            clientStatus: clientResult.status,
            clientId: clientResult.clientId,
            clientName: extracted.cliente.nome_completo,
            clientCpfCnpj: extracted.cliente.cpf_cnpj,
            matchedBy: clientResult.matchedBy,
            seguradoraId: seguradoraMatch?.id || null,
            seguradoraNome: extracted.apolice.nome_seguradora,
            ramoId: ramoMatch?.id || null,
            ramoNome: extracted.apolice.ramo_seguro,
            numeroApolice: extracted.apolice.numero_apolice,
            dataInicio: extracted.apolice.data_inicio,
            dataFim: extracted.apolice.data_fim,
            objetoSegurado: extracted.objeto_segurado.descricao_bem,
            premioLiquido: extracted.valores.premio_liquido,
            premioTotal: extracted.valores.premio_total,
            estimatedCommission: extracted.valores.premio_liquido * (i.commissionRate / 100),
            isProcessing: false,
            isProcessed: true,
            processError: undefined,
          };

          updated.validationErrors = validateImportItem(updated);
          updated.isValid = updated.validationErrors.length === 0;

          return updated;
        }));

        toast.success(`${item.fileName} processado com sucesso!`);
      } else {
        throw new Error(result.error || 'Falha na extração');
      }
    } catch (error: any) {
      setItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, isProcessing: false, processError: error.message } : i
      ));
      toast.error(`Erro: ${error.message}`);
    }
  };

  // Update item field
  const updateItem = (id: string, updates: Partial<PolicyImportItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, ...updates };
      
      // Recalculate commission if rate changed
      if ('commissionRate' in updates) {
        updated.estimatedCommission = updated.premioLiquido * (updated.commissionRate / 100);
      }
      
      // Revalidate
      updated.validationErrors = validateImportItem(updated);
      updated.isValid = updated.validationErrors.length === 0;
      
      return updated;
    }));
  };

  // Apply batch producer
  const applyBatchProducer = () => {
    if (!batchProducerId) return;
    setItems(prev => prev.map(item => {
      const updated = { ...item, producerId: batchProducerId };
      updated.validationErrors = validateImportItem(updated);
      updated.isValid = updated.validationErrors.length === 0;
      return updated;
    }));
    toast.success('Produtor aplicado a todas as apólices');
  };

  // Apply batch commission rate
  const applyBatchCommission = () => {
    const rate = parseFloat(batchCommissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Taxa de comissão inválida');
      return;
    }
    setItems(prev => prev.map(item => {
      const updated = { 
        ...item, 
        commissionRate: rate,
        estimatedCommission: item.premioLiquido * (rate / 100)
      };
      updated.validationErrors = validateImportItem(updated);
      updated.isValid = updated.validationErrors.length === 0;
      return updated;
    }));
    toast.success('Comissão aplicada a todas as apólices');
  };

  // Process import
  const processImport = async () => {
    if (!user) return;
    
    const validItems = items.filter(item => item.isValid);
    if (validItems.length === 0) {
      toast.error('Nenhuma apólice válida para importar');
      return;
    }

    setStep('processing');
    setProcessingIndex(0);
    
    let success = 0;
    let errors = 0;

    for (let i = 0; i < validItems.length; i++) {
      setProcessingIndex(i);
      const item = validItems[i];

      try {
        let clientId = item.clientId;

        // Create client if new
        if (item.clientStatus === 'new') {
          const newClient = await createClient(item.extracted.cliente, user.id);
          if (!newClient) {
            throw new Error('Falha ao criar cliente');
          }
          clientId = newClient.id;
        }

        // Upload PDF
        const pdfUrl = await uploadPolicyPdf(item.file, user.id);

        // Create policy using existing hook (which handles commission generation)
        await addPolicy({
          clientId: clientId!,
          policyNumber: item.numeroApolice,
          insuranceCompany: item.seguradoraId!,
          type: item.ramoId!,
          insuredAsset: item.objetoSegurado,
          premiumValue: item.premioLiquido,
          commissionRate: item.commissionRate,
          startDate: item.dataInicio,
          expirationDate: item.dataFim,
          producerId: item.producerId!,
          status: 'Ativa',
          automaticRenewal: true,
          isBudget: false,
          pdfUrl,
        });

        success++;
      } catch (error) {
        console.error('Error importing policy:', item.fileName, error);
        errors++;
      }
    }

    setImportResults({ success, errors });
    setStep('complete');
  };

  const validCount = items.filter(i => i.isValid).length;
  const invalidCount = items.filter(i => !i.isValid).length;
  const errorCount = items.filter(i => i.processError).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Importar Apólices via IA
          </DialogTitle>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 flex-1 overflow-auto">
            <div
              className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-purple-500 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <p className="text-white font-medium">Arraste PDFs de apólices aqui</p>
              <p className="text-slate-400 text-sm">ou clique para selecionar arquivos</p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <Label className="text-slate-300">Arquivos selecionados ({files.length})</Label>
                <ScrollArea className="h-40 border border-slate-700 rounded-lg p-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between py-2 px-3 hover:bg-slate-800 rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-400" />
                        <span className="text-white text-sm">{file.name}</span>
                        <span className="text-slate-500 text-xs">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={processFiles}
                disabled={files.length === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Processar com IA
              </Button>
            </div>
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="py-6 space-y-4 flex-1 overflow-auto">
            <div className="text-center">
              <Loader2 className="w-10 h-10 mx-auto text-purple-400 animate-spin" />
              <p className="text-white font-medium mt-4">
                Processando {processingIndex + 1} de {files.length || items.length}...
              </p>
              <p className="text-slate-400 text-sm">
                Extraindo dados com inteligência artificial (2s entre cada)
              </p>
            </div>
            
            <Progress value={(processingIndex + 1) / (files.length || items.length) * 100} className="w-full max-w-md mx-auto" />
            
            {/* File status list */}
            <ScrollArea className="h-48 border border-slate-700 rounded-lg p-2 max-w-md mx-auto">
              {files.map((file, index) => {
                const status = processingStatus.get(index);
                return (
                  <div key={index} className="flex items-center justify-between py-2 px-3">
                    <span className="text-sm text-white truncate max-w-[200px]">{file.name}</span>
                    <div className="flex items-center gap-2">
                      {status === 'pending' && <Clock className="w-4 h-4 text-slate-400" />}
                      {status === 'processing' && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}
                      {status === 'success' && <Check className="w-4 h-4 text-green-400" />}
                      {status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                      {status === 'rate_limited' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                    </div>
                  </div>
                );
              })}
            </ScrollArea>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Batch Actions - Fixed at top */}
            <div className="flex-shrink-0 bg-slate-800/50 rounded-lg p-4 flex flex-wrap items-center gap-4">
              <span className="text-slate-300 text-sm font-medium">Aplicar a todos:</span>
              
              <div className="flex items-center gap-2">
                <Select value={batchProducerId} onValueChange={setBatchProducerId}>
                  <SelectTrigger className="w-48 bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Produtor" />
                  </SelectTrigger>
                  <SelectContent>
                    {producers.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={applyBatchProducer} disabled={!batchProducerId}>
                  Aplicar
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="% Comissão"
                  value={batchCommissionRate}
                  onChange={(e) => setBatchCommissionRate(e.target.value)}
                  className="w-28 bg-slate-700 border-slate-600"
                />
                <Button size="sm" variant="outline" onClick={applyBatchCommission} disabled={!batchCommissionRate}>
                  Aplicar
                </Button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className="text-green-400 border-green-400/50">
                  {validCount} válidas
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="outline" className="text-red-400 border-red-400/50">
                    {errorCount} falharam
                  </Badge>
                )}
                {invalidCount > 0 && invalidCount !== errorCount && (
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400/50">
                    {invalidCount} incompletas
                  </Badge>
                )}
              </div>
            </div>

            {/* Table with scroll - Expandable area */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full max-h-[calc(90vh-280px)] border border-slate-700 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">PDF</TableHead>
                      <TableHead className="w-56">Cliente</TableHead>
                      <TableHead>Apólice</TableHead>
                      <TableHead>Seguradora</TableHead>
                      <TableHead>Ramo</TableHead>
                      <TableHead>Produtor</TableHead>
                      <TableHead className="w-32">% / Comissão</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className={item.processError ? 'bg-red-900/20' : !item.isValid ? 'bg-yellow-900/10' : ''}>
                        {/* PDF Thumbnail */}
                        <TableCell>
                          <div className="w-10 h-10 bg-slate-700 rounded flex items-center justify-center">
                            <FileText className="w-5 h-5 text-purple-400" />
                          </div>
                        </TableCell>

                        {/* Cliente */}
                        <TableCell>
                          {item.processError ? (
                            <div 
                              className="text-sm text-red-400"
                              title="PDF inválido, com senha, corrompido ou ilegível para OCR."
                            >
                              <div className="font-medium">{item.fileName}</div>
                              <div className="text-xs mt-1">
                                {item.processError.includes('400') 
                                  ? 'Erro ao ler arquivo. Verifique se é um PDF válido e não tem senha.'
                                  : item.processError}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {item.clientStatus === 'matched' ? (
                                  <UserCheck className="w-4 h-4 text-green-400" />
                                ) : (
                                  <UserPlus className="w-4 h-4 text-blue-400" />
                                )}
                                <Input
                                  value={item.clientName}
                                  onChange={(e) => updateItem(item.id, { clientName: e.target.value })}
                                  className="h-8 bg-slate-700 border-slate-600 text-sm"
                                />
                              </div>
                              <div className="text-xs text-slate-400 pl-6">
                                {item.clientStatus === 'matched' ? (
                                  <span className="text-green-400">
                                    ✓ Vinculado ({item.matchedBy === 'cpf_cnpj' ? 'CPF' : 'Email'})
                                  </span>
                                ) : (
                                  <span className="text-blue-400">🆕 Criar novo</span>
                                )}
                                {item.clientCpfCnpj && (
                                  <span className="ml-2">{item.clientCpfCnpj}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </TableCell>

                        {/* Apólice */}
                        <TableCell>
                          {!item.processError && (
                            <div className="text-sm">
                              <div className="font-medium text-white">{item.numeroApolice}</div>
                              <div className="text-slate-400 text-xs truncate max-w-40" title={item.objetoSegurado}>
                                {item.objetoSegurado}
                              </div>
                              <div className="text-slate-500 text-xs">
                                R$ {item.premioLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          )}
                        </TableCell>

                        {/* Seguradora */}
                        <TableCell>
                          {!item.processError && (
                            <>
                              <Select
                                value={item.seguradoraId || ''}
                                onValueChange={(v) => updateItem(item.id, { seguradoraId: v })}
                              >
                                <SelectTrigger className="h-8 bg-slate-700 border-slate-600 text-sm">
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {companies.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!item.seguradoraId && item.seguradoraNome && (
                                <div className="text-xs text-yellow-400 mt-1">
                                  IA leu: {item.seguradoraNome}
                                </div>
                              )}
                            </>
                          )}
                        </TableCell>

                        {/* Ramo */}
                        <TableCell>
                          {!item.processError && (
                            <>
                              <Select
                                value={item.ramoId || ''}
                                onValueChange={(v) => updateItem(item.id, { ramoId: v })}
                              >
                                <SelectTrigger className="h-8 bg-slate-700 border-slate-600 text-sm">
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {ramos.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!item.ramoId && item.ramoNome && (
                                <div className="text-xs text-yellow-400 mt-1">
                                  IA leu: {item.ramoNome}
                                </div>
                              )}
                            </>
                          )}
                        </TableCell>

                        {/* Produtor */}
                        <TableCell>
                          {!item.processError && (
                            <Select
                              value={item.producerId || ''}
                              onValueChange={(v) => updateItem(item.id, { producerId: v })}
                            >
                              <SelectTrigger className="h-8 bg-slate-700 border-slate-600 text-sm">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {producers.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>

                        {/* Comissão */}
                        <TableCell>
                          {!item.processError && (
                            <>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={item.commissionRate}
                                  onChange={(e) => updateItem(item.id, { commissionRate: parseFloat(e.target.value) || 0 })}
                                  className="h-8 w-16 bg-slate-700 border-slate-600 text-sm"
                                />
                                <span className="text-slate-400">%</span>
                              </div>
                              <div className="text-xs text-green-400 mt-1">
                                R$ {item.estimatedCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {item.isProcessing ? (
                            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                          ) : item.processError ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => retryProcessing(item.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Tentar
                            </Button>
                          ) : item.isValid ? (
                            <Check className="w-5 h-5 text-green-400" />
                          ) : (
                            <div title={item.validationErrors.join('\n')}>
                              <AlertCircle className="w-5 h-5 text-yellow-400" />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            {/* Actions - Fixed at footer */}
            <div className="flex-shrink-0 flex justify-between items-center pt-2 border-t border-slate-700">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button
                onClick={processImport}
                disabled={validCount === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                Processar {validCount} apólice{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <div className="py-12 text-center space-y-4 flex-1">
            <Check className="w-16 h-16 mx-auto text-green-400" />
            <h3 className="text-xl font-semibold text-white">Importação Concluída!</h3>
            <div className="space-y-2">
              <p className="text-green-400">
                ✓ {importResults.success} apólice{importResults.success !== 1 ? 's' : ''} importada{importResults.success !== 1 ? 's' : ''} com sucesso
              </p>
              {importResults.errors > 0 && (
                <p className="text-red-400">
                  ✗ {importResults.errors} erro{importResults.errors !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <Button onClick={handleClose} className="mt-4">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
