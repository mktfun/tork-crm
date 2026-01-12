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
import { Upload, FileText, Check, AlertCircle, Loader2, UserCheck, UserPlus, X, Sparkles, Clock, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseCompanies } from '@/hooks/useSupabaseCompanies';
import { useSupabaseProducers } from '@/hooks/useSupabaseProducers';
import { useSupabaseRamos } from '@/hooks/useSupabaseRamos';
import { usePolicies } from '@/hooks/useAppData';
import { 
  ExtractedPolicyData, 
  PolicyImportItem, 
  BulkOCRExtractedPolicy,
  BulkOCRResponse,
  DocumentType
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
type FileProcessingStatus = 'pending' | 'processing' | 'success' | 'error';
type BulkProcessingPhase = 'ocr' | 'ai' | 'reconciling';

interface ProcessingMetrics {
  totalDurationSec: string;
  ocrDurationSec?: string;
  aiDurationSec?: string;
  filesProcessed: number;
  policiesExtracted: number;
}

// Extended response type with metrics
interface ExtendedBulkOCRResponse extends BulkOCRResponse {
  metrics?: ProcessingMetrics;
}

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
  
  // Bulk OCR progress state
  const [bulkPhase, setBulkPhase] = useState<BulkProcessingPhase>('ocr');
  const [ocrProgress, setOcrProgress] = useState(0); // X of N files
  
  // Performance metrics
  const [processingMetrics, setProcessingMetrics] = useState<ProcessingMetrics | null>(null);
  
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
    setBulkPhase('ocr');
    setOcrProgress(0);
    setProcessingMetrics(null);
  }, []);

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  // Handle file selection with 5MB limit
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    
    const validFiles = selectedFiles.filter(file => {
      if (file.size > MAX_SIZE) {
        toast.warning(`${file.name} ignorado: maior que 5MB`);
        return false;
      }
      if (!(file.type === 'application/pdf' || file.type.startsWith('image/'))) {
        toast.warning(`${file.name} ignorado: apenas PDFs e imagens são aceitos.`);
        return false;
      }
      return true;
    });
    
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
        // Debug logging para verificar base64
        console.log(`📁 [DEBUG] ${file.name}: base64 total length = ${result.length}`);
        console.log(`📁 [DEBUG] ${file.name}: starts with = ${result.substring(0, 50)}`);
        // Enviar base64 completo - a edge function limpa o prefixo
        const base64Data = result.split(',')[1];
        console.log(`📁 [DEBUG] ${file.name}: clean base64 length = ${base64Data.length}`);
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Process files with Bulk OCR (OCR.space + Lovable AI)
  const processBulkOCR = async () => {
    if (!user || files.length === 0) return;
    
    setStep('processing');
    setBulkPhase('ocr');
    setOcrProgress(0);
    setProcessingMetrics(null);
    
    const fileMap = new Map<string, File>();
    files.forEach(f => fileMap.set(f.name, f));
    
    // Initialize status
    const initialStatus = new Map<number, FileProcessingStatus>();
    files.forEach((_, i) => initialStatus.set(i, 'pending'));
    setProcessingStatus(initialStatus);
    
    try {
      // Simulate OCR progress while waiting (updates every 500ms)
      const progressInterval = setInterval(() => {
        setOcrProgress(prev => {
          if (prev < files.length - 1) return prev + 1;
          return prev;
        });
      }, 1500);
      
      // Convert all files to base64
      const filesBase64 = await Promise.all(
        files.map(async (file, idx) => {
          setProcessingStatus(prev => new Map(prev).set(idx, 'processing'));
          const base64 = await fileToBase64(file);
          return {
            base64,
            fileName: file.name,
            mimeType: file.type
          };
        })
      );
      
      setBulkPhase('ai');
      
      // Call the bulk OCR edge function
      const { data, error } = await supabase.functions.invoke<ExtendedBulkOCRResponse>('ocr-bulk-analyze', {
        body: { files: filesBase64 }
      });
      
      clearInterval(progressInterval);
      setOcrProgress(files.length);
      
      if (error) {
        console.error('Bulk OCR error:', error);
        files.forEach((_, i) => {
          setProcessingStatus(prev => new Map(prev).set(i, 'error'));
        });
        
        if (error.message?.includes('429')) {
          toast.error('Rate limit da IA atingido. Aguarde e tente novamente.');
        } else if (error.message?.includes('402')) {
          toast.error('Créditos insuficientes. Adicione créditos na sua conta.');
        } else {
          toast.error(`Erro no processamento: ${error.message}`);
        }
        setStep('upload');
        return;
      }
      
      if (!data?.success) {
        toast.error(data?.error || 'Erro desconhecido no processamento');
        setStep('upload');
        return;
      }
      
      // Save metrics
      if (data.metrics) {
        setProcessingMetrics(data.metrics);
      }
      
      // Mark successful files
      data.processedFiles?.forEach((fileName) => {
        const fileIdx = files.findIndex(f => f.name === fileName);
        if (fileIdx !== -1) {
          setProcessingStatus(prev => new Map(prev).set(fileIdx, 'success'));
        }
      });
      
      // Mark failed files
      data.errors?.forEach(({ fileName }) => {
        const fileIdx = files.findIndex(f => f.name === fileName);
        if (fileIdx !== -1) {
          setProcessingStatus(prev => new Map(prev).set(fileIdx, 'error'));
        }
      });
      
      // Reconcile clients
      setBulkPhase('reconciling');
      
      const allPolicies: BulkOCRExtractedPolicy[] = data.data || [];
      
      const processedItems: PolicyImportItem[] = await Promise.all(
        allPolicies.map(async (policy) => {
          const file = fileMap.get(policy.arquivo_origem) || files[0];
          
          // Convert to ExtractedPolicyData format for reconciliation
          const extracted: ExtractedPolicyData = {
            cliente: {
              nome_completo: policy.nome_cliente,
              cpf_cnpj: policy.cpf_cnpj,
              email: policy.email,
              telefone: policy.telefone,
              endereco_completo: policy.endereco_completo || null,
            },
            apolice: {
              numero_apolice: policy.numero_apolice,
              nome_seguradora: policy.nome_seguradora,
              data_inicio: policy.data_inicio,
              data_fim: policy.data_fim,
              ramo_seguro: policy.ramo_seguro,
            },
            objeto_segurado: {
              descricao_bem: policy.descricao_bem || policy.objeto_segurado || '',
            },
            valores: {
              premio_liquido: policy.premio_liquido || 0,
              premio_total: policy.premio_total || 0,
            },
          };
          
          // Reconcile client
          const clientResult = await reconcileClient(extracted, user.id);
          const seguradoraMatch = await matchSeguradora(policy.nome_seguradora, user.id);
          const ramoMatch = await matchRamo(policy.ramo_seguro, user.id);
          
          // Build objeto_segurado with identificacao_adicional
          const objetoCompleto = policy.objeto_segurado 
            ? (policy.identificacao_adicional 
                ? `${policy.objeto_segurado} - ${policy.identificacao_adicional}` 
                : policy.objeto_segurado)
            : policy.descricao_bem || '';
          
          const item: PolicyImportItem = {
            id: crypto.randomUUID(),
            file,
            filePreviewUrl: URL.createObjectURL(file),
            fileName: policy.arquivo_origem,
            extracted,
            clientStatus: clientResult.status,
            clientId: clientResult.clientId,
            clientName: policy.nome_cliente,
            clientCpfCnpj: policy.cpf_cnpj,
            matchedBy: clientResult.matchedBy,
            seguradoraId: seguradoraMatch?.id || null,
            seguradoraNome: policy.nome_seguradora,
            ramoId: ramoMatch?.id || null,
            ramoNome: policy.ramo_seguro,
            producerId: null,
            commissionRate: 15,
            numeroApolice: policy.numero_apolice || policy.numero_proposta || '',
            dataInicio: policy.data_inicio,
            dataFim: policy.data_fim,
            objetoSegurado: objetoCompleto,
            premioLiquido: policy.premio_liquido || 0,
            premioTotal: policy.premio_total || 0,
            // NOVOS CAMPOS v3.0
            tipoDocumento: policy.tipo_documento || null,
            tipoOperacao: policy.tipo_operacao || null,
            endossoMotivo: policy.endosso_motivo || null,
            tituloSugerido: policy.titulo_sugerido || '',
            identificacaoAdicional: policy.identificacao_adicional || null,
            estimatedCommission: (policy.premio_liquido || 0) * 0.15,
            isValid: false,
            validationErrors: [],
            isProcessing: false,
            isProcessed: true,
          };
          
          // Validate
          item.validationErrors = validateImportItem(item);
          item.isValid = item.validationErrors.length === 0;
          
          return item;
        })
      );
      
      setItems(processedItems);
      
      if (processedItems.length === 0) {
        toast.error('Nenhum documento foi processado com sucesso');
        setStep('upload');
        return;
      }
      
      toast.success(`${processedItems.length} apólice(s) extraída(s) com sucesso!`);
      setStep('review');
      
    } catch (error: any) {
      console.error('Bulk OCR error:', error);
      toast.error(error.message || 'Erro ao processar documentos');
      setStep('upload');
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

        // Upload PDF with structured naming
        const pdfUrl = await uploadPolicyPdf(
          item.file, 
          user.id,
          item.clientCpfCnpj || undefined,
          item.numeroApolice || undefined
        );

        // Create policy using existing hook (which handles commission generation)
        // Use titulo_sugerido as insuredAsset if available
        // Handle ORCAMENTO/PROPOSTA with specific status
        const isOrcamento = item.tipoDocumento === 'ORCAMENTO';
        const isProposta = item.tipoDocumento === 'PROPOSTA';
        
        await addPolicy({
          clientId: clientId!,
          policyNumber: item.numeroApolice,
          insuranceCompany: item.seguradoraId!,
          type: item.ramoId!,
          insuredAsset: item.tituloSugerido || item.objetoSegurado,
          premiumValue: item.premioLiquido,
          commissionRate: item.commissionRate,
          startDate: item.dataInicio,
          expirationDate: item.dataFim,
          producerId: item.producerId!,
          status: isOrcamento ? 'Orçamento' : isProposta ? 'Pendente' : 'Ativa',
          automaticRenewal: !isOrcamento && !isProposta,
          isBudget: isOrcamento,
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

  // Calculate progress percentage based on phase
  const getProgressValue = () => {
    if (bulkPhase === 'ocr') {
      return (ocrProgress / Math.max(files.length, 1)) * 50;
    }
    if (bulkPhase === 'ai') {
      return 75;
    }
    return 90;
  };

  // Get phase label
  const getPhaseLabel = () => {
    if (bulkPhase === 'ocr') {
      return `Extraindo textos (${Math.min(ocrProgress + 1, files.length)} de ${files.length})...`;
    }
    if (bulkPhase === 'ai') {
      return 'IA mapeando apólices...';
    }
    return 'Vinculando clientes...';
  };

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
            {/* Info Banner */}
            <div className="flex items-center gap-3 p-3 bg-green-600/20 rounded-lg border border-green-600/40">
              <Zap className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-green-400 font-medium text-sm">Importação em Lote Inteligente</p>
                <p className="text-green-400/70 text-xs">
                  OCR.space extrai o texto • IA mapeia todos os documentos de uma só vez • ~98% mais econômico
                </p>
              </div>
            </div>

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
              <p className="text-white font-medium">
                Arraste PDFs de apólices aqui
              </p>
              <p className="text-slate-400 text-sm">ou clique para selecionar arquivos</p>
              <p className="text-amber-400 text-xs mt-2">
                ⚠️ OCR.space free lê apenas as 3 primeiras páginas de cada PDF
              </p>
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
                onClick={processBulkOCR}
                disabled={files.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Zap className="w-4 h-4 mr-2" />
                Processar em Lote ({files.length})
              </Button>
            </div>
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && items.length === 0 && (
          <div className="py-6 space-y-6 flex-1 overflow-auto">
            <div className="text-center">
              <Loader2 className="w-10 h-10 mx-auto text-purple-400 animate-spin" />
              <p className="text-white font-medium mt-4">{getPhaseLabel()}</p>
              <p className="text-slate-400 text-sm">
                {bulkPhase === 'ocr' && 'Extraindo texto dos PDFs (pdf-parse local + OCR fallback)...'}
                {bulkPhase === 'ai' && 'Analisando documentos com IA Lovable...'}
                {bulkPhase === 'reconciling' && 'Vinculando clientes existentes...'}
              </p>
            </div>
            
            {/* Visual Stepper */}
            <div className="flex justify-center items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${bulkPhase === 'ocr' ? 'bg-green-600' : 'bg-green-600/30'}`}>
                <span className="text-white text-xs font-medium">1</span>
                <span className="text-white text-xs">OCR</span>
                {bulkPhase !== 'ocr' && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="w-8 h-0.5 bg-slate-600" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${bulkPhase === 'ai' ? 'bg-purple-600' : bulkPhase === 'reconciling' ? 'bg-purple-600/30' : 'bg-slate-700'}`}>
                <span className="text-white text-xs font-medium">2</span>
                <span className="text-white text-xs">IA</span>
                {bulkPhase === 'reconciling' && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="w-8 h-0.5 bg-slate-600" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${bulkPhase === 'reconciling' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                <span className="text-white text-xs font-medium">3</span>
                <span className="text-white text-xs">Vincular</span>
              </div>
            </div>
            
            <Progress value={getProgressValue()} className="w-full max-w-md mx-auto" />
            
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
                    </div>
                  </div>
                );
              })}
            </ScrollArea>
          </div>
        )}

        {/* Step: Importing (saving to DB) */}
        {step === 'processing' && items.length > 0 && (
          <div className="py-6 space-y-4 flex-1 overflow-auto">
            <div className="text-center">
              <Loader2 className="w-10 h-10 mx-auto text-purple-400 animate-spin" />
              <p className="text-white font-medium mt-4">
                Salvando {processingIndex + 1} de {items.filter(i => i.isValid).length}...
              </p>
              <p className="text-slate-400 text-sm">
                Criando clientes e apólices
              </p>
            </div>
            <Progress value={(processingIndex + 1) / items.filter(i => i.isValid).length * 100} className="w-full max-w-md mx-auto" />
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Performance Badge */}
            {processingMetrics && (
              <div className="flex items-center justify-center gap-2 p-2 bg-green-600/20 rounded-lg border border-green-600/40">
                <Zap className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-sm font-medium">
                  ⚡ Processado em {processingMetrics.totalDurationSec}s | {processingMetrics.filesProcessed} arquivo(s) extraído(s) | {processingMetrics.policiesExtracted} apólice(s) mapeada(s)
                </span>
              </div>
            )}

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
              <ScrollArea className="h-full max-h-[calc(90vh-350px)] border border-slate-700 rounded-lg">
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
                        {/* PDF Thumbnail with attachment indicator */}
                        <TableCell>
                          <div className="relative">
                            <div className="w-10 h-10 bg-slate-700 rounded flex items-center justify-center">
                              <FileText className="w-5 h-5 text-purple-400" />
                            </div>
                            {/* Indicador de anexo 📎 */}
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center">
                              <span className="text-[8px]">📎</span>
                            </div>
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
                              <div className="text-xs mt-1">{item.processError}</div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {item.clientStatus === 'matched' ? (
                                  <UserCheck className="w-4 h-4 text-green-400" />
                                ) : (
                                  <UserPlus className="w-4 h-4 text-yellow-400" />
                                )}
                                <Input
                                  value={item.clientName}
                                  onChange={(e) => updateItem(item.id, { clientName: e.target.value })}
                                  className={`h-8 bg-slate-700 border-slate-600 text-sm ${!item.clientName ? 'border-red-500 bg-red-900/20' : ''}`}
                                  placeholder="Nome do cliente"
                                />
                              </div>
                              {/* Badge de Status do Cliente v3.0 */}
                              <div className="pl-6">
                                {item.clientStatus === 'matched' ? (
                                  <Badge className="bg-green-600/20 text-green-400 border-green-600/40 text-[10px] h-5">
                                    <UserCheck className="w-3 h-3 mr-1" />
                                    Vinculando a {item.clientName.split(' ')[0]}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/40 text-[10px] h-5">
                                    <UserPlus className="w-3 h-3 mr-1" />
                                    Criando Novo Cliente
                                  </Badge>
                                )}
                                {item.clientCpfCnpj && (
                                  <span className="ml-2 text-xs text-slate-400">{item.clientCpfCnpj}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </TableCell>

                        {/* Apólice */}
                        <TableCell>
                          {!item.processError && (
                            <div className="text-sm space-y-1">
                              {/* Badges de Tipo de Documento v3.0 */}
                              <div className="flex items-center gap-1 flex-wrap">
                                {item.tipoDocumento === 'PROPOSTA' && (
                                  <Badge variant="outline" className="text-blue-400 border-blue-400/40 text-[10px] h-4 px-1">
                                    📋 Proposta
                                  </Badge>
                                )}
                                {item.tipoDocumento === 'ORCAMENTO' && (
                                  <Badge variant="outline" className="text-amber-400 border-amber-400/40 text-[10px] h-4 px-1">
                                    💰 Orçamento
                                  </Badge>
                                )}
                                {item.tipoDocumento === 'ENDOSSO' && (
                                  <Badge variant="outline" className="text-purple-400 border-purple-400/40 text-[10px] h-4 px-1">
                                    📝 Endosso
                                  </Badge>
                                )}
                                {item.tipoOperacao === 'RENOVACAO' && (
                                  <Badge variant="outline" className="text-cyan-400 border-cyan-400/40 text-[10px] h-4 px-1">
                                    🔄 Renovação
                                  </Badge>
                                )}
                              </div>
                              
                              <div className={`font-medium text-white ${!item.numeroApolice ? 'text-red-400' : ''}`}>
                                {item.numeroApolice || '⚠️ Não detectado'}
                              </div>
                              
                              {/* Título Sugerido pela IA v3.0 */}
                              {item.tituloSugerido && (
                                <div className="text-purple-300 text-[10px] truncate max-w-48" title={item.tituloSugerido}>
                                  💡 {item.tituloSugerido}
                                </div>
                              )}
                              
                              <div className="text-slate-400 text-xs truncate max-w-40" title={item.objetoSegurado}>
                                {item.objetoSegurado || '-'}
                              </div>
                              
                              {/* Motivo do Endosso */}
                              {item.endossoMotivo && (
                                <div className="text-purple-400 text-[10px]">
                                  ↳ {item.endossoMotivo}
                                </div>
                              )}
                              
                              <div className={`text-xs ${item.premioLiquido === 0 ? 'text-red-400' : 'text-slate-500'}`}>
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
                                <SelectTrigger className={`h-8 bg-slate-700 border-slate-600 text-sm ${!item.seguradoraId ? 'border-red-500' : ''}`}>
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
                                <SelectTrigger className={`h-8 bg-slate-700 border-slate-600 text-sm ${!item.ramoId ? 'border-red-500' : ''}`}>
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
                              <SelectTrigger className={`h-8 bg-slate-700 border-slate-600 text-sm ${!item.producerId ? 'border-red-500' : ''}`}>
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
                            <AlertTriangle className="w-5 h-5 text-red-400" />
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

            {/* Actions */}
            <div className="flex-shrink-0 flex justify-between items-center pt-4 border-t border-slate-700">
              <Button variant="outline" onClick={() => setStep('upload')}>
                ← Voltar
              </Button>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={processImport}
                  disabled={validCount === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Importar {validCount} Apólice(s)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <div className="py-12 text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-green-600/20 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-white">Importação Concluída!</h3>
              <p className="text-slate-400 mt-2">
                {importResults.success} apólice(s) importada(s) com sucesso
                {importResults.errors > 0 && `, ${importResults.errors} erro(s)`}
              </p>
            </div>

            {processingMetrics && (
              <Badge variant="outline" className="text-green-400 border-green-400/50">
                ⚡ Tempo total: {processingMetrics.totalDurationSec}s
              </Badge>
            )}

            <Button onClick={handleClose} className="bg-purple-600 hover:bg-purple-700">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
