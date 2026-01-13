import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { toast } from 'sonner';
import { Upload, FileText, Check, AlertCircle, Loader2, UserCheck, UserPlus, X, Sparkles, Clock, AlertTriangle, Zap, Eye, ExternalLink, Car } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseCompanies } from '@/hooks/useSupabaseCompanies';
import { useSupabaseProducers } from '@/hooks/useSupabaseProducers';
import { useSupabaseRamos } from '@/hooks/useSupabaseRamos';
import { useSupabaseBrokerages } from '@/hooks/useSupabaseBrokerages';
import { usePolicies } from '@/hooks/useAppData';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
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
  createClientFromEdited,
  uploadPolicyPdf,
  validateImportItem 
} from '@/services/policyImportService';
import { useAppStore } from '@/store';

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

interface ExtendedBulkOCRResponse extends BulkOCRResponse {
  metrics?: ProcessingMetrics;
}

const sanitizePremio = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const clean = value.replace(/[R$\s.]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }
  return 0;
};

// =====================================================
// PREMIUM STEPPER COMPONENT - BLACK & SILVER
// =====================================================
interface StepperProps {
  phase: BulkProcessingPhase;
}

const PremiumStepper = ({ phase }: StepperProps) => {
  const steps = [
    { id: 'ocr', label: 'OCR' },
    { id: 'ai', label: 'IA' },
    { id: 'reconciling', label: 'Vincular' },
  ];

  const getStepStatus = (stepId: string) => {
    const order = ['ocr', 'ai', 'reconciling'];
    const currentIdx = order.indexOf(phase);
    const stepIdx = order.indexOf(stepId);
    if (stepIdx < currentIdx) return 'complete';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="flex items-center justify-center gap-0 px-8 py-4 border-b border-white/5">
      {steps.map((step, idx) => {
        const status = getStepStatus(step.id);
        return (
          <React.Fragment key={step.id}>
            <div className={cn(
              "flex items-center gap-2 transition-all duration-300",
              status === 'active' && "scale-105",
            )}>
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                status === 'complete' && "border-zinc-400 bg-zinc-400/20 shadow-lg shadow-zinc-400/20",
                status === 'active' && "border-white bg-white/20 shadow-lg shadow-white/20",
                status === 'pending' && "border-zinc-700 bg-zinc-800/50",
              )}>
                {status === 'complete' ? (
                  <Check className="w-4 h-4 text-zinc-300" />
                ) : status === 'active' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <span className="text-zinc-600 text-xs">{idx + 1}</span>
                )}
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                status === 'complete' && "text-zinc-400",
                status === 'active' && "text-white",
                status === 'pending' && "text-zinc-600",
              )}>
                {step.label}
              </span>
            </div>
            
            {idx < steps.length - 1 && (
              <div className={cn(
                "w-12 h-0.5 mx-3 transition-all duration-500",
                getStepStatus(steps[idx + 1].id) !== 'pending' 
                  ? "bg-gradient-to-r from-zinc-400 to-zinc-300" 
                  : "bg-zinc-800"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export function ImportPoliciesModal({ open, onOpenChange }: ImportPoliciesModalProps) {
  const { user } = useAuth();
  const { companies } = useSupabaseCompanies();
  const { producers } = useSupabaseProducers();
  const { data: ramos = [] } = useSupabaseRamos();
  const { brokerages } = useSupabaseBrokerages();
  const { addPolicy } = usePolicies();
  const activeBrokerageId = useAppStore(state => state.activeBrokerageId);
  const setActiveBrokerage = useAppStore(state => state.setActiveBrokerage);
  const isMobile = useIsMobile();
  
  useEffect(() => {
    if (!activeBrokerageId && brokerages.length > 0 && open) {
      console.log('🏢 [AUTO] Selecionando primeira corretora:', brokerages[0].id);
      setActiveBrokerage(brokerages[0].id.toString());
      toast.info(`Corretora "${brokerages[0].name}" selecionada automaticamente`);
    }
  }, [activeBrokerageId, brokerages, setActiveBrokerage, open]);
  
  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<PolicyImportItem[]>([]);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [importResults, setImportResults] = useState({ success: 0, errors: 0 });
  const [processingStatus, setProcessingStatus] = useState<Map<number, FileProcessingStatus>>(new Map());
  
  const [batchProducerId, setBatchProducerId] = useState<string>('');
  const [batchCommissionRate, setBatchCommissionRate] = useState<string>('');
  
  const [bulkPhase, setBulkPhase] = useState<BulkProcessingPhase>('ocr');
  const [ocrProgress, setOcrProgress] = useState(0);
  
  const [processingMetrics, setProcessingMetrics] = useState<ProcessingMetrics | null>(null);
  
  // Split View: Selected item for PDF preview
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = useMemo(() => 
    items.find(i => i.id === selectedItemId) || items[0], 
    [items, selectedItemId]
  );
  
  // Mobile: Drawer for PDF preview
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  
  const [editedFields, setEditedFields] = useState<Map<string, Set<string>>>(new Map());
  
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
    setSelectedItemId(null);
    setMobilePreviewOpen(false);
    setEditedFields(new Map());
  }, []);

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  const markFieldEdited = (itemId: string, field: string) => {
    setEditedFields(prev => {
      const newMap = new Map(prev);
      const fields = newMap.get(itemId) || new Set();
      fields.add(field);
      newMap.set(itemId, fields);
      return newMap;
    });
  };

  const isFieldEdited = (itemId: string, field: string): boolean => {
    return editedFields.get(itemId)?.has(field) || false;
  };

  const handlePremioChange = (itemId: string, rawValue: string) => {
    let cleaned = rawValue.replace(/[^\d,.-]/g, '');
    if (cleaned.includes(',')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    const numValue = parseFloat(cleaned) || 0;
    markFieldEdited(itemId, 'premioLiquido');
    const item = items.find(i => i.id === itemId);
    if (item) {
      updateItem(itemId, { 
        premioLiquido: numValue,
        estimatedCommission: numValue * (item.commissionRate / 100)
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const MAX_SIZE = 5 * 1024 * 1024;
    
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

  const processBulkOCR = async () => {
    if (!user || files.length === 0) return;
    
    setStep('processing');
    setBulkPhase('ocr');
    setOcrProgress(0);
    setProcessingMetrics(null);
    
    const fileMap = new Map<string, File>();
    files.forEach(f => fileMap.set(f.name, f));
    
    const initialStatus = new Map<number, FileProcessingStatus>();
    files.forEach((_, i) => initialStatus.set(i, 'pending'));
    setProcessingStatus(initialStatus);
    
    try {
      const progressInterval = setInterval(() => {
        setOcrProgress(prev => {
          if (prev < files.length - 1) return prev + 1;
          return prev;
        });
      }, 1500);
      
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
      
      if (data.metrics) {
        setProcessingMetrics(data.metrics);
      }
      
      data.processedFiles?.forEach((fileName) => {
        const fileIdx = files.findIndex(f => f.name === fileName);
        if (fileIdx !== -1) {
          setProcessingStatus(prev => new Map(prev).set(fileIdx, 'success'));
        }
      });
      
      data.errors?.forEach(({ fileName }) => {
        const fileIdx = files.findIndex(f => f.name === fileName);
        if (fileIdx !== -1) {
          setProcessingStatus(prev => new Map(prev).set(fileIdx, 'error'));
        }
      });
      
      setBulkPhase('reconciling');
      
      const allPolicies: BulkOCRExtractedPolicy[] = data.data || [];
      
      const processedItems: PolicyImportItem[] = await Promise.all(
        allPolicies.map(async (policy) => {
          const file = fileMap.get(policy.arquivo_origem) || files[0];
          
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
              premio_liquido: sanitizePremio(policy.premio_liquido),
              premio_total: sanitizePremio(policy.premio_total),
            },
          };
          
          const clientResult = await reconcileClient(extracted, user.id);
          const seguradoraMatch = await matchSeguradora(policy.nome_seguradora, user.id);
          const ramoMatch = await matchRamo(policy.ramo_seguro, user.id);
          
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
            premioLiquido: sanitizePremio(policy.premio_liquido),
            premioTotal: sanitizePremio(policy.premio_total),
            tipoDocumento: policy.tipo_documento || null,
            tipoOperacao: policy.tipo_operacao || null,
            endossoMotivo: policy.endosso_motivo || null,
            tituloSugerido: policy.titulo_sugerido || '',
            identificacaoAdicional: policy.identificacao_adicional || null,
            estimatedCommission: sanitizePremio(policy.premio_liquido) * 0.15,
            isValid: false,
            validationErrors: [],
            isProcessing: false,
            isProcessed: true,
          };
          
          item.validationErrors = validateImportItem(item);
          item.isValid = item.validationErrors.length === 0;
          
          return item;
        })
      );
      
      setItems(processedItems);
      if (processedItems.length > 0) {
        setSelectedItemId(processedItems[0].id);
      }
      
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

  const updateItem = (id: string, updates: Partial<PolicyImportItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, ...updates };
      
      if ('commissionRate' in updates) {
        updated.estimatedCommission = updated.premioLiquido * (updated.commissionRate / 100);
      }
      
      updated.validationErrors = validateImportItem(updated);
      updated.isValid = updated.validationErrors.length === 0;
      
      return updated;
    }));
  };

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

  const processImport = async () => {
    if (!user) return;
    
    const validItems = items.filter(item => item.isValid);
    if (validItems.length === 0) {
      toast.error('Nenhuma apólice válida para importar');
      return;
    }

    const invalidClients = validItems.filter(item => 
      !item.clientName?.trim() ||
      item.clientName === 'Não Identificado' || 
      item.clientName.toUpperCase().includes('NÃO IDENTIFICADO') ||
      item.clientName.toUpperCase().includes('NAO IDENTIFICADO')
    );

    if (invalidClients.length > 0) {
      toast.error(`${invalidClients.length} item(s) com nome de cliente inválido. Edite o nome antes de salvar!`, {
        description: 'Clique no campo "Cliente" e digite o nome correto.',
        duration: 6000,
      });
      return;
    }

    if (!activeBrokerageId) {
      toast.error('Erro de configuração: corretora não selecionada.');
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

        if (item.clientStatus === 'new') {
          const newClient = await createClientFromEdited(
            item.clientName,
            item.clientCpfCnpj,
            item.extracted.cliente.email,
            item.extracted.cliente.telefone,
            item.extracted.cliente.endereco_completo,
            user.id
          );
          if (!newClient) {
            throw new Error('Falha ao criar cliente');
          }
          clientId = newClient.id;
        }

        const pdfUrl = await uploadPolicyPdf(
          item.file, 
          user.id,
          item.clientCpfCnpj || undefined,
          item.numeroApolice || undefined,
          activeBrokerageId
        );

        if (!pdfUrl) {
          throw new Error(`Upload do PDF falhou para ${item.fileName}`);
        }

        const isOrcamento = item.tipoDocumento === 'ORCAMENTO';
        const finalStatus = isOrcamento ? 'Orçamento' : 'Ativa';
        
        const primeiroNome = item.clientName?.split(' ')[0]?.replace(/NÃO|IDENTIFICADO/gi, '').trim() || 'Cliente';
        const objetoResumo = item.objetoSegurado 
          ? item.objetoSegurado.split(' ').slice(0, 3).join(' ').substring(0, 25)
          : '';
        const placa = item.identificacaoAdicional || '';
        const seguradoraSigla = item.seguradoraNome?.split(' ')[0]?.toUpperCase() || 'CIA';
        const tipoDoc = item.tipoDocumento === 'ENDOSSO' 
          ? 'ENDOSSO' 
          : item.tipoOperacao === 'RENOVACAO' 
            ? 'RENOVACAO' 
            : 'NOVA';
        
        let nomenclaturaElite = `${primeiroNome} - ${item.ramoNome || 'Seguro'}`;
        if (objetoResumo) nomenclaturaElite += ` (${objetoResumo})`;
        if (placa) nomenclaturaElite += ` - ${placa}`;
        nomenclaturaElite += ` - ${seguradoraSigla} - ${tipoDoc}`;
        const insuredAssetFinal = nomenclaturaElite.substring(0, 100);
        
        await addPolicy({
          clientId: clientId!,
          policyNumber: item.numeroApolice,
          insuranceCompany: item.seguradoraId!,
          type: item.ramoId!,
          insuredAsset: insuredAssetFinal,
          premiumValue: item.premioLiquido,
          commissionRate: item.commissionRate,
          startDate: item.dataInicio,
          expirationDate: item.dataFim,
          producerId: item.producerId!,
          status: finalStatus,
          automaticRenewal: !isOrcamento,
          isBudget: isOrcamento,
          pdfUrl,
          brokerageId: activeBrokerageId ? Number(activeBrokerageId) : undefined,
        });

        success++;
      } catch (error) {
        console.error('❌ [ERROR] Falha ao importar:', item.fileName, error);
        errors++;
      }
    }

    setImportResults({ success, errors });
    setStep('complete');
  };

  const validCount = items.filter(i => i.isValid).length;
  const invalidCount = items.filter(i => !i.isValid).length;

  const getProgressValue = () => {
    if (bulkPhase === 'ocr') {
      return (ocrProgress / Math.max(files.length, 1)) * 50;
    }
    if (bulkPhase === 'ai') {
      return 75;
    }
    return 90;
  };

  const getPhaseLabel = () => {
    if (bulkPhase === 'ocr') {
      return `Extraindo textos (${Math.min(ocrProgress + 1, files.length)} de ${files.length})...`;
    }
    if (bulkPhase === 'ai') {
      return 'IA mapeando apólices...';
    }
    return 'Vinculando clientes...';
  };

  // =====================================================
  // PDF PREVIEW PANEL COMPONENT (BLACK & SILVER)
  // =====================================================
  const PdfPreviewPanel = ({ item, className }: { item: PolicyImportItem | null; className?: string }) => (
    <div className={cn("h-full bg-zinc-950/50 backdrop-blur-lg flex flex-col", className)}>
      {item?.filePreviewUrl ? (
        <>
          <div className="flex-shrink-0 px-3 py-2 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <span className="text-xs text-zinc-400 truncate">{item.fileName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 hover:bg-white/10 text-zinc-400 hover:text-white"
              onClick={() => window.open(item.filePreviewUrl, '_blank')}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <iframe
              src={item.filePreviewUrl}
              className="w-full h-full border-0"
              title="Preview do documento"
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
          <div className="text-center">
            <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Clique em uma linha para visualizar o PDF</p>
          </div>
        </div>
      )}
    </div>
  );

  // =====================================================
  // REVIEW TABLE ROW COMPONENT - BLACK & SILVER
  // =====================================================
  const ReviewTableRow = ({ item, isSelected }: { item: PolicyImportItem; isSelected: boolean }) => (
    <TableRow 
      onClick={() => setSelectedItemId(item.id)}
      className={cn(
        "border-b border-white/5 transition-all cursor-pointer group",
        isSelected 
          ? "bg-white/5 border-l-2 border-l-zinc-400" 
          : "hover:bg-white/[0.02]"
      )}
    >
      {/* Cliente */}
      <TableCell className="py-3">
        {!item.processError && (
          <div className="space-y-1.5">
            <Input
              value={item.clientName}
              onChange={(e) => {
                markFieldEdited(item.id, 'clientName');
                updateItem(item.id, { clientName: e.target.value });
              }}
              className={cn(
                "h-8 bg-transparent border-zinc-700/50 text-sm font-medium transition-all",
                "focus:bg-zinc-900/50 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/20",
                !item.clientName && "border-red-500/50 bg-red-900/10",
                isFieldEdited(item.id, 'clientName') && "text-zinc-300 border-zinc-500/50"
              )}
              placeholder="Nome do Cliente"
            />
            <div className="flex items-center gap-2">
              <Input
                value={item.clientCpfCnpj || ''}
                onChange={(e) => {
                  markFieldEdited(item.id, 'clientCpfCnpj');
                  updateItem(item.id, { 
                    clientCpfCnpj: e.target.value,
                    clientStatus: 'new'
                  });
                }}
                className={cn(
                  "h-6 text-xs bg-transparent border-zinc-700/50 px-2 w-36 transition-all",
                  "focus:bg-zinc-900/50 focus:border-zinc-400",
                  isFieldEdited(item.id, 'clientCpfCnpj') && "text-zinc-300 border-zinc-500/50"
                )}
                placeholder="CPF/CNPJ"
              />
              {item.clientStatus === 'matched' ? (
                <Badge className="bg-zinc-700/30 text-zinc-200 border border-zinc-500/40 text-[10px] h-5">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Vinculado
                </Badge>
              ) : (
                <Badge className="bg-transparent text-zinc-400 border border-zinc-600/50 text-[10px] h-5">
                  <UserPlus className="w-3 h-3 mr-1" />
                  Novo
                </Badge>
              )}
            </div>
          </div>
        )}
      </TableCell>

      {/* Apólice + Prêmio */}
      <TableCell className="py-3">
        {!item.processError && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 flex-wrap">
              {item.tipoDocumento === 'PROPOSTA' && (
                <Badge variant="outline" className="text-zinc-400 border-zinc-600/40 text-[10px] h-4 px-1">
                  📋 Proposta
                </Badge>
              )}
              {item.tipoDocumento === 'ORCAMENTO' && (
                <Badge variant="outline" className="text-zinc-400 border-zinc-600/40 text-[10px] h-4 px-1">
                  💰 Orçamento
                </Badge>
              )}
              {item.tipoDocumento === 'ENDOSSO' && (
                <Badge variant="outline" className="text-zinc-400 border-zinc-600/40 text-[10px] h-4 px-1">
                  📝 Endosso
                </Badge>
              )}
              {item.tipoOperacao === 'RENOVACAO' && (
                <Badge variant="outline" className="text-zinc-400 border-zinc-600/40 text-[10px] h-4 px-1">
                  🔄 Renovação
                </Badge>
              )}
            </div>
            
            <Input
              value={item.numeroApolice}
              onChange={(e) => {
                markFieldEdited(item.id, 'numeroApolice');
                updateItem(item.id, { numeroApolice: e.target.value });
              }}
              className={cn(
                "h-7 bg-transparent border-zinc-700/50 text-sm font-medium transition-all",
                "focus:bg-zinc-900/50 focus:border-zinc-400",
                !item.numeroApolice && "border-red-500/50 bg-red-900/10",
                isFieldEdited(item.id, 'numeroApolice') && "text-zinc-300 border-zinc-500/50"
              )}
              placeholder="Nº Apólice"
            />
            
            <div className="flex items-center gap-1">
              <span className="text-zinc-600 text-xs">R$</span>
              <Input
                type="text"
                value={item.premioLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                onChange={(e) => handlePremioChange(item.id, e.target.value)}
                className={cn(
                  "h-6 w-24 bg-transparent border-zinc-700/50 text-xs px-2 transition-all",
                  "focus:bg-zinc-900/50 focus:border-zinc-400",
                  item.premioLiquido === 0 && "border-red-500/50 bg-red-900/10 text-red-400",
                  isFieldEdited(item.id, 'premioLiquido') && "text-zinc-300 border-zinc-500/50"
                )}
                placeholder="0,00"
              />
            </div>
          </div>
        )}
      </TableCell>

      {/* Objeto Segurado */}
      <TableCell className="py-3">
        {!item.processError && (
          <TooltipProvider>
            <div className="space-y-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    value={item.objetoSegurado || ''}
                    onChange={(e) => {
                      markFieldEdited(item.id, 'objetoSegurado');
                      updateItem(item.id, { objetoSegurado: e.target.value });
                    }}
                    className={cn(
                      "h-7 bg-transparent border-zinc-700/50 text-sm transition-all",
                      "focus:bg-zinc-900/50 focus:border-zinc-400",
                      !item.objetoSegurado && item.ramoNome?.toUpperCase().includes('AUTO') 
                        && "border-red-500/50 bg-red-900/10 animate-pulse",
                      isFieldEdited(item.id, 'objetoSegurado') && "text-zinc-300 border-zinc-500/50"
                    )}
                    placeholder="VW Golf GTI 2024"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Veículo, imóvel ou bem segurado</p>
                </TooltipContent>
              </Tooltip>
              
              <div className="flex items-center gap-1">
                <Car className="w-3 h-3 text-zinc-600" />
                <Input
                  value={item.identificacaoAdicional || ''}
                  onChange={(e) => {
                    markFieldEdited(item.id, 'identificacaoAdicional');
                    updateItem(item.id, { identificacaoAdicional: e.target.value.toUpperCase() });
                  }}
                  className={cn(
                    "h-6 text-xs bg-transparent border-zinc-700/50 px-1 w-24 uppercase font-mono transition-all",
                    "focus:bg-zinc-900/50 focus:border-zinc-400",
                    isFieldEdited(item.id, 'identificacaoAdicional') && "text-zinc-300 border-zinc-500/50"
                  )}
                  placeholder="ABC-1D23"
                />
              </div>
            </div>
          </TooltipProvider>
        )}
      </TableCell>

      {/* Seguradora */}
      <TableCell className="py-3">
        {!item.processError && (
          <div className="space-y-1">
            <Select
              value={item.seguradoraId || ''}
              onValueChange={(v) => updateItem(item.id, { seguradoraId: v })}
            >
              <SelectTrigger className={cn(
                "h-8 bg-transparent border-zinc-700/50 text-sm transition-all",
                !item.seguradoraId && "border-red-500/50"
              )}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!item.seguradoraId && item.seguradoraNome && (
              <div className="text-[10px] text-zinc-500 truncate">
                IA: {item.seguradoraNome}
              </div>
            )}
          </div>
        )}
      </TableCell>

      {/* Ramo */}
      <TableCell className="py-3">
        {!item.processError && (
          <div className="space-y-1">
            <Select
              value={item.ramoId || ''}
              onValueChange={(v) => updateItem(item.id, { ramoId: v })}
            >
              <SelectTrigger className={cn(
                "h-8 bg-transparent border-zinc-700/50 text-sm transition-all",
                !item.ramoId && "border-red-500/50"
              )}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {ramos.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!item.ramoId && item.ramoNome && (
              <div className="text-[10px] text-zinc-500 truncate">
                IA: {item.ramoNome}
              </div>
            )}
          </div>
        )}
      </TableCell>

      {/* Produtor */}
      <TableCell className="py-3">
        {!item.processError && (
          <Select
            value={item.producerId || ''}
            onValueChange={(v) => updateItem(item.id, { producerId: v })}
          >
            <SelectTrigger className={cn(
              "h-8 bg-transparent border-zinc-700/50 text-sm transition-all",
              !item.producerId && "border-red-500/50"
            )}>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {producers.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>

      {/* Comissão */}
      <TableCell className="py-3">
        {!item.processError && (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={item.commissionRate}
                onChange={(e) => updateItem(item.id, { commissionRate: parseFloat(e.target.value) || 0 })}
                className="h-7 w-14 bg-transparent border-zinc-700/50 text-sm text-center"
              />
              <span className="text-zinc-600 text-xs">%</span>
            </div>
            <div className="text-xs text-zinc-400 font-medium">
              R$ {item.estimatedCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </TableCell>

      {/* Status */}
      <TableCell className="py-3">
        {item.isProcessing ? (
          <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
        ) : item.processError ? (
          <AlertTriangle className="w-5 h-5 text-red-400" />
        ) : item.isValid ? (
          <div className="w-6 h-6 rounded-full bg-zinc-700/50 flex items-center justify-center">
            <Check className="w-4 h-4 text-zinc-300" />
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger>
              <div className="w-6 h-6 rounded-full bg-zinc-700/50 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-zinc-400" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <ul className="text-xs space-y-1">
                {item.validationErrors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-7xl h-[90vh] flex flex-col bg-black/85 backdrop-blur-2xl border border-white/[0.06] p-0 gap-0"
        style={{
          boxShadow: `
            0 0 80px -20px rgba(255,255,255,0.05),
            inset 0 1px 0 0 rgba(255,255,255,0.04)
          `
        }}
      >
        {/* Header - BLACK & SILVER */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b border-white/5">
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center border border-white/10">
              <Sparkles className="w-4 h-4 text-zinc-200" />
            </div>
            Importar Apólices via IA
          </DialogTitle>
        </DialogHeader>

        {/* Step: Upload - BLACK & SILVER */}
        {step === 'upload' && (
          <div className="flex-1 overflow-auto p-6 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-zinc-900/50 rounded-xl border border-zinc-700/30">
              <div className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-600/50">
                <Zap className="w-5 h-5 text-zinc-300" />
              </div>
              <div>
                <p className="text-zinc-200 font-medium text-sm">Importação em Lote Inteligente</p>
                <p className="text-zinc-500 text-xs">
                  OCR.space extrai o texto • IA mapeia todos os documentos de uma só vez
                </p>
              </div>
            </div>

            <div
              className="border border-dashed border-zinc-700/50 rounded-xl p-10 text-center hover:border-zinc-500/70 hover:bg-white/[0.02] transition-all duration-300 cursor-pointer group"
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
              <div className="w-16 h-16 mx-auto bg-zinc-900/50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-zinc-800/70 border border-zinc-700/50 group-hover:border-zinc-600 transition-all duration-300">
                <Upload className="w-8 h-8 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
              </div>
              <p className="text-white font-medium">
                Arraste PDFs de apólices aqui
              </p>
              <p className="text-zinc-600 text-sm mt-1">ou clique para selecionar arquivos</p>
              <p className="text-zinc-500 text-xs mt-3">
                ⚠️ Limite: 5MB por arquivo • OCR lê as 3 primeiras páginas
              </p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <Label className="text-zinc-500 text-sm">Arquivos selecionados ({files.length})</Label>
                <ScrollArea className="h-40 border border-zinc-700/50 rounded-xl bg-zinc-900/30">
                  <div className="p-2 space-y-1">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between py-2 px-3 hover:bg-white/5 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50">
                            <FileText className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div>
                            <span className="text-white text-sm">{file.name}</span>
                            <span className="text-zinc-600 text-xs ml-2">
                              ({(file.size / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={handleClose} 
                className="border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                onClick={processBulkOCR}
                disabled={files.length === 0}
                className="bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)]"
              >
                <Zap className="w-4 h-4 mr-2" />
                Processar em Lote ({files.length})
              </Button>
            </div>
          </div>
        )}

        {/* Step: Processing (OCR/AI) - BLACK & SILVER */}
        {step === 'processing' && items.length === 0 && (
          <div className="flex-1 overflow-auto flex flex-col">
            <PremiumStepper phase={bulkPhase} />
            
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50">
                  <Loader2 className="w-10 h-10 text-zinc-300 animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-zinc-500/30 animate-ping" />
              </div>
              
              <div className="text-center">
                <p className="text-white font-medium text-lg">{getPhaseLabel()}</p>
                <p className="text-zinc-500 text-sm mt-1">
                  {bulkPhase === 'ocr' && 'Extraindo texto dos PDFs...'}
                  {bulkPhase === 'ai' && 'Analisando documentos com IA...'}
                  {bulkPhase === 'reconciling' && 'Vinculando clientes existentes...'}
                </p>
              </div>
              
              <Progress value={getProgressValue()} className="w-full max-w-sm h-2" />
              
              <ScrollArea className="h-40 w-full max-w-md border border-zinc-700/50 rounded-xl bg-zinc-900/30">
                <div className="p-3 space-y-2">
                  {files.map((file, index) => {
                    const status = processingStatus.get(index);
                    return (
                      <div key={index} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5">
                        <span className="text-sm text-white truncate max-w-[200px]">{file.name}</span>
                        <div className="flex items-center gap-2">
                          {status === 'pending' && <Clock className="w-4 h-4 text-zinc-600" />}
                          {status === 'processing' && <Loader2 className="w-4 h-4 text-zinc-300 animate-spin" />}
                          {status === 'success' && <Check className="w-4 h-4 text-zinc-300" />}
                          {status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Step: Processing (Saving to DB) - BLACK & SILVER */}
        {step === 'processing' && items.length > 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
            <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50">
              <Loader2 className="w-10 h-10 text-zinc-300 animate-spin" />
            </div>
            
            <div className="text-center">
              <p className="text-white font-medium text-lg">
                Salvando {processingIndex + 1} de {items.filter(i => i.isValid).length}...
              </p>
              <p className="text-zinc-500 text-sm mt-1">
                Criando clientes e apólices
              </p>
            </div>
            
            <Progress 
              value={(processingIndex + 1) / items.filter(i => i.isValid).length * 100} 
              className="w-full max-w-sm h-2" 
            />
          </div>
        )}

        {/* Step: Review - SPLIT VIEW - BLACK & SILVER */}
        {step === 'review' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Batch Actions Bar */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-white/5 bg-zinc-900/30">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-zinc-500 text-sm font-medium">Aplicar a todos:</span>
                
                <div className="flex items-center gap-2">
                  <Select value={batchProducerId} onValueChange={setBatchProducerId}>
                    <SelectTrigger className="w-40 h-8 bg-transparent border-zinc-700/50 text-sm">
                      <SelectValue placeholder="Produtor" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {producers.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={applyBatchProducer} 
                    disabled={!batchProducerId} 
                    className="h-8 border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white"
                  >
                    Aplicar
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="% Comissão"
                    value={batchCommissionRate}
                    onChange={(e) => setBatchCommissionRate(e.target.value)}
                    className="w-24 h-8 bg-transparent border-zinc-700/50 text-sm"
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={applyBatchCommission} 
                    disabled={!batchCommissionRate} 
                    className="h-8 border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white"
                  >
                    Aplicar
                  </Button>
                </div>

                {/* Summary */}
                <div className="ml-auto flex items-center gap-3">
                  <Badge variant="outline" className="text-zinc-300 border-zinc-500/40">
                    {validCount} válidas
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="outline" className="text-zinc-500 border-zinc-600/40">
                      {invalidCount} pendentes
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Split View - Desktop / Full Table - Mobile */}
            <div className="flex-1 min-h-0">
              {isMobile ? (
                // Mobile: Full table + floating preview button
                <div className="h-full flex flex-col">
                  <ScrollArea className="flex-1">
                    <TooltipProvider>
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
                          <TableRow className="border-b border-white/5 hover:bg-transparent">
                            <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Cliente</TableHead>
                            <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Apólice</TableHead>
                            <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Objeto</TableHead>
                            <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Cia</TableHead>
                            <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Ramo</TableHead>
                            <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Produtor</TableHead>
                            <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Com.</TableHead>
                            <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <ReviewTableRow 
                              key={item.id} 
                              item={item} 
                              isSelected={selectedItemId === item.id}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </TooltipProvider>
                  </ScrollArea>
                  
                  {/* Mobile PDF Preview Drawer */}
                  <Drawer open={mobilePreviewOpen} onOpenChange={setMobilePreviewOpen}>
                    <DrawerTrigger asChild>
                      <Button 
                        className="fixed bottom-24 right-4 rounded-full w-14 h-14 shadow-xl bg-zinc-700 hover:bg-zinc-600 border border-zinc-600"
                      >
                        <Eye className="w-6 h-6" />
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent className="h-[70vh] bg-zinc-950 border-zinc-700">
                      <DrawerHeader className="border-b border-white/5">
                        <DrawerTitle className="text-white">Preview do Documento</DrawerTitle>
                      </DrawerHeader>
                      <PdfPreviewPanel item={selectedItem} className="flex-1" />
                    </DrawerContent>
                  </Drawer>
                </div>
              ) : (
                // Desktop: Split View with ResizablePanels
                <ResizablePanelGroup direction="horizontal" className="h-full">
                  {/* PDF Preview Panel */}
                  <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                    <PdfPreviewPanel item={selectedItem} className="border-r border-white/5" />
                  </ResizablePanel>

                  <ResizableHandle withHandle className="bg-white/5 hover:bg-zinc-500/30 transition-colors" />

                  {/* Table Panel */}
                  <ResizablePanel defaultSize={70}>
                    <ScrollArea className="h-full">
                      <TooltipProvider>
                        <Table>
                          <TableHeader className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
                            <TableRow className="border-b border-white/5 hover:bg-transparent">
                              <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Cliente</TableHead>
                              <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Apólice</TableHead>
                              <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Objeto</TableHead>
                              <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Cia</TableHead>
                              <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Ramo</TableHead>
                              <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Produtor</TableHead>
                              <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Com.</TableHead>
                              <TableHead className="text-zinc-500 text-xs font-medium uppercase tracking-wider w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => (
                              <ReviewTableRow 
                                key={item.id} 
                                item={item} 
                                isSelected={selectedItemId === item.id}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </TooltipProvider>
                    </ScrollArea>
                  </ResizablePanel>
                </ResizablePanelGroup>
              )}
            </div>

            {/* Footer Actions - BLACK & SILVER */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-white/5 bg-zinc-900/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => setStep('upload')} 
                  className="border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white"
                >
                  ← Voltar
                </Button>
                
                {processingMetrics && (
                  <Badge variant="outline" className="bg-zinc-900/50 text-zinc-400 border-zinc-700">
                    <Zap className="w-3 h-3 mr-1 text-zinc-400" />
                    {processingMetrics.totalDurationSec}s
                    <span className="text-zinc-600 mx-2">|</span>
                    <span className="text-zinc-500 text-xs">IA Tork v2.0</span>
                  </Badge>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleClose} 
                  className="border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={processImport}
                  disabled={validCount === 0 || !activeBrokerageId}
                  className={cn(
                    "bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-[0_0_25px_-5px_rgba(255,255,255,0.4)] hover:shadow-[0_0_35px_-5px_rgba(255,255,255,0.6)]",
                    !activeBrokerageId && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Importar {validCount} Apólice(s)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Complete - BLACK & SILVER */}
        {step === 'complete' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
            <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-600/50 shadow-lg shadow-zinc-500/10">
              <Check className="w-10 h-10 text-zinc-200" />
            </div>
            
            <div className="text-center">
              <h3 className="text-2xl font-semibold text-white">Importação Concluída!</h3>
              <p className="text-zinc-500 mt-2">
                {importResults.success} apólice(s) importada(s) com sucesso
                {importResults.errors > 0 && `, ${importResults.errors} erro(s)`}
              </p>
            </div>

            {processingMetrics && (
              <Badge variant="outline" className="text-zinc-300 border-zinc-500/50 px-4 py-2">
                ⚡ Tempo total: {processingMetrics.totalDurationSec}s
              </Badge>
            )}

            <Button 
              onClick={handleClose} 
              className="bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] px-8"
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
