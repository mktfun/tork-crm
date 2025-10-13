
import React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, addYears } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Stepper } from '@/components/ui/stepper';
import { Edit3, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { QuoteUploadButton, ExtractedQuoteData } from './QuoteUploadButton';
import { useClients, usePolicies } from '@/hooks/useAppData';
import { QuickAddClientModal } from '@/components/clients/QuickAddClientModal';
import { useSupabaseCompanies } from '@/hooks/useSupabaseCompanies';
import { useSupabaseRamos } from '@/hooks/useSupabaseRamos';
import { useRamosByCompany } from '@/hooks/useRamosByCompany';
import { useSupabaseProducers } from '@/hooks/useSupabaseProducers';
import { useSupabaseBrokerages } from '@/hooks/useSupabaseBrokerages';
import { useSupabaseCompanyBranches } from '@/hooks/useSupabaseCompanyBranches';
import { Separator } from '@/components/ui/separator';
import { policyFormSchema, PolicyFormData } from '@/schemas/policySchema';
import { Policy } from '@/types';
import { toast } from 'sonner';

interface PolicyFormModalProps {
  policy?: Policy;
  isEditing?: boolean;
  onClose: () => void;
  onPolicyAdded?: () => void;
}

const STEPS = [
  'Informações Principais',
  'Detalhes do Seguro', 
  'Valores e Vigência',
  'Envolvidos'
];

export function PolicyFormModal({ policy, isEditing = false, onClose, onPolicyAdded }: PolicyFormModalProps) {
  const { clients, refetch: refetchClients } = useClients();
  const { addPolicy, updatePolicy } = usePolicies();
  const { companies } = useSupabaseCompanies();
  const { producers } = useSupabaseProducers();
  const { brokerages } = useSupabaseBrokerages();
  const { companyBranches } = useSupabaseCompanyBranches();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualDueDate, setIsManualDueDate] = useState(false);

  // Preparar valores default baseado no modo (criar ou editar)
  const getDefaultValues = (): Partial<PolicyFormData> => {
    if (isEditing && policy) {
      return {
        clientId: policy.clientId,
        policyNumber: policy.policyNumber || '',
        insuranceCompany: policy.insuranceCompany || '',
        type: policy.type || '',
        insuredAsset: policy.insuredAsset || '',
        premiumValue: policy.premiumValue,
        commissionRate: policy.commissionRate,
        status: policy.status,
        startDate: policy.startDate || '',
        expirationDate: policy.expirationDate,
        producerId: policy.producerId || '',
        brokerageId: policy.brokerageId?.toString() || '',
        automaticRenewal: policy.automaticRenewal ?? true,
      };
    }
    
    return {
      status: 'Orçamento' as const,
      commissionRate: 20,
      insuredAsset: '',
      automaticRenewal: true,
    };
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
    resetField,
    trigger
  } = useForm<PolicyFormData>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: getDefaultValues()
  });

  const selectedCompanyId = watch('insuranceCompany');
  const { data: availableBranches = [] } = useRamosByCompany(selectedCompanyId);
  
  // Reset branch when company changes
  React.useEffect(() => {
    if (selectedCompanyId && watch('type')) {
      setValue('type', '');
    }
  }, [selectedCompanyId, setValue, watch]);
  const currentStatus = watch('status');
  const startDate = watch('startDate');

  // Auto-calculate expiration date effect
  React.useEffect(() => {
    if (!isManualDueDate && startDate && !isEditing) {
      const calculatedExpirationDate = format(addYears(new Date(startDate), 1), 'yyyy-MM-dd');
      setValue('expirationDate', calculatedExpirationDate);
    }
  }, [startDate, isManualDueDate, setValue, isEditing]);

  const handleToggleDueDateMode = () => {
    if (isManualDueDate) {
      resetField('expirationDate');
      setIsManualDueDate(false);
      if (startDate) {
        const calculatedExpirationDate = format(addYears(new Date(startDate), 1), 'yyyy-MM-dd');
        setValue('expirationDate', calculatedExpirationDate);
      }
    } else {
      setIsManualDueDate(true);
    }
  };

  const getFieldsForStep = (step: number): (keyof PolicyFormData)[] => {
    switch (step) {
      case 1:
        return ['clientId', 'insuredAsset', 'status'];
      case 2:
        return ['insuranceCompany', 'type', 'policyNumber'];
      case 3:
        return ['premiumValue', 'commissionRate', 'startDate', 'expirationDate'];
      case 4:
        return ['producerId', 'brokerageId'];
      default:
        return [];
    }
  };

  const handleNext = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isStepValid = await trigger(fieldsToValidate);
    
    if (isStepValid && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSubmitting(true);
    
    try {
      const data = watch();
      const finalData = {
        ...data,
        brokerageId: data.brokerageId ? parseInt(data.brokerageId) : undefined,
        expirationDate: data.expirationDate || (startDate ? format(addYears(new Date(startDate), 1), 'yyyy-MM-dd') : undefined),
      };

      if (isEditing && policy) {
        await updatePolicy(policy.id, finalData);
      } else {
        await addPolicy(finalData);
      }

      reset();
      setCurrentStep(1);
      setIsManualDueDate(false);
      onPolicyAdded?.();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar apólice:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clientOptions = clients.map(client => ({
    value: client.id,
    label: `${client.name} - ${client.phone}`
  }));

  const handleClientCreated = (newClient: any) => {
    // Refetch clients to include the new one
    refetchClients();
    // Auto-select the new client
    setValue('clientId', newClient.id);
  };

  // ✅ VERSÃO FINAL CORRIGIDA - Com retry para carregamento de ramos
  const handleQuoteDataExtracted = async (data: ExtractedQuoteData) => {
    console.log('📋 Preenchendo formulário com dados extraídos:', data);

    // ============================================
    // 1. CLIENTE - Matching Inteligente
    // ============================================
    if (data.clientName) {
      console.log('👤 Buscando cliente:', data.clientName);
      
      const normalizedSearchName = data.clientName.toLowerCase().trim();
      
      let foundClient = clients.find(c => 
        c.name.toLowerCase().trim() === normalizedSearchName
      );
      
      if (!foundClient) {
        foundClient = clients.find(c => {
          const clientName = c.name.toLowerCase().trim();
          return clientName.includes(normalizedSearchName) || 
                 normalizedSearchName.includes(clientName);
        });
      }
      
      if (!foundClient) {
        const searchWords = normalizedSearchName.split(' ').filter(w => w.length > 2);
        foundClient = clients.find(c => {
          const clientWords = c.name.toLowerCase().split(' ');
          const matchCount = searchWords.filter(sw => 
            clientWords.some(cw => cw.includes(sw) || sw.includes(cw))
          ).length;
          return matchCount >= Math.min(2, searchWords.length);
        });
      }
      
      if (foundClient) {
        setValue('clientId', foundClient.id);
        console.log('✅ Cliente encontrado:', foundClient.name);
        toast.success('Cliente identificado', {
          description: `${foundClient.name} selecionado automaticamente`
        });
      } else {
        console.warn('⚠️ Cliente não encontrado na base:', data.clientName);
        toast.warning('Cliente não cadastrado', {
          description: `${data.clientName} não foi encontrado. Considere cadastrá-lo primeiro.`
        });
      }
    }

    // ============================================
    // 2. BEM SEGURADO
    // ============================================
    if (data.insuredItem) {
      setValue('insuredAsset', data.insuredItem);
      console.log('✅ Bem segurado:', data.insuredItem);
    }

    // ============================================
    // 3. NÚMERO DA APÓLICE
    // ============================================
    if (data.policyNumber) {
      setValue('policyNumber', data.policyNumber);
      console.log('✅ Número da apólice:', data.policyNumber);
    }

    // ============================================
    // 4. VALOR DO PRÊMIO
    // ============================================
    if (data.premiumValue) {
      setValue('premiumValue', data.premiumValue);
      console.log('✅ Prêmio:', data.premiumValue);
    }

    // ============================================
    // 5. TAXA DE COMISSÃO
    // ============================================
    if (data.commissionPercentage) {
      setValue('commissionRate', data.commissionPercentage);
      console.log('✅ Comissão:', data.commissionPercentage);
    } else {
      console.log('⚠️ Comissão não identificada no PDF');
    }

    // ============================================
    // 6. DATA DE INÍCIO
    // ============================================
    if (data.startDate && data.startDate !== 'null' && data.startDate !== 'undefined' && !isNaN(new Date(data.startDate).getTime())) {
      setValue('startDate', data.startDate);
      const expirationDate = addYears(new Date(data.startDate), 1);
      setValue('expirationDate', format(expirationDate, 'yyyy-MM-dd'));
      console.log('✅ Data de início:', data.startDate);
    }

    // ============================================
    // 7. RENOVAÇÃO AUTOMÁTICA
    // ============================================
    setValue('automaticRenewal', data.shouldGenerateRenewal);

    // ============================================
    // 8. SEGURADORA - Matching Fuzzy Inteligente
    // ============================================
    if (data.insurerName) {
      console.log('🏢 Buscando seguradora:', data.insurerName);
      
      const normalizedInsurerName = data.insurerName.toLowerCase().trim();
      
      let foundCompany = companies.find(c => 
        c.name.toLowerCase().trim() === normalizedInsurerName
      );
      
      if (!foundCompany) {
        foundCompany = companies.find(c => {
          const companyName = c.name.toLowerCase().trim();
          return companyName.includes(normalizedInsurerName) || 
                 normalizedInsurerName.includes(companyName);
        });
      }
      
      if (!foundCompany) {
        const searchWords = normalizedInsurerName.split(' ').filter(w => w.length > 2);
        foundCompany = companies.find(c => {
          const companyWords = c.name.toLowerCase().split(' ');
          return searchWords.every(sw => 
            companyWords.some(cw => cw.includes(sw) || sw.includes(cw))
          );
        });
      }
      
      if (foundCompany) {
        setValue('insuranceCompany', foundCompany.id);
        console.log('✅ Seguradora encontrada:', foundCompany.name);
        toast.success('Seguradora identificada', {
          description: `${foundCompany.name} selecionada automaticamente`
        });
      } else {
        console.warn('⚠️ Seguradora não encontrada na base:', data.insurerName);
        console.log('📋 Seguradoras disponíveis:', companies.map(c => c.name));
        toast.warning('Seguradora não cadastrada', {
          description: `${data.insurerName} não foi encontrada. Cadastre-a primeiro.`
        });
      }
    }

    // ============================================
    // 9. RAMO - Com RETRY até os ramos carregarem
    // ============================================
    if (data.insuranceLine) {
      console.log('🏷️ Buscando ramo:', data.insuranceLine);
      
      // ✅ CORREÇÃO: Função recursiva que tenta até 5 vezes
      const tryFindRamo = (attempt: number = 1, maxAttempts: number = 5) => {
        setTimeout(() => {
          console.log(`📋 Tentativa ${attempt}/${maxAttempts} - Ramos disponíveis:`, availableBranches.length);
          
          // Se ainda não carregou e não atingiu o máximo de tentativas, tenta novamente
          if (availableBranches.length === 0 && attempt < maxAttempts) {
            console.log('⏳ Aguardando ramos carregarem...');
            tryFindRamo(attempt + 1, maxAttempts);
            return;
          }
          
          // Se não carregou após todas as tentativas
          if (availableBranches.length === 0) {
            console.error('❌ Ramos não carregaram após', maxAttempts, 'tentativas');
            toast.warning('Erro ao carregar ramos', {
              description: 'Selecione o ramo manualmente'
            });
            return;
          }
          
          // Agora sim, fazer o matching
          console.log('📋 Ramos disponíveis:', availableBranches.map(r => r.nome));
          
          const normalizedRamoName = data.insuranceLine!.toLowerCase().trim();
          
          // Matching exato
          let foundRamo = availableBranches.find(r => 
            r.nome.toLowerCase().trim() === normalizedRamoName
          );
          
          // Matching parcial
          if (!foundRamo) {
            foundRamo = availableBranches.find(r => {
              const ramoName = r.nome.toLowerCase().trim();
              return ramoName.includes(normalizedRamoName) || 
                     normalizedRamoName.includes(ramoName);
            });
          }
          
          // Matching por palavras-chave
          if (!foundRamo) {
            const searchWords = normalizedRamoName.split(' ').filter(w => w.length > 2);
            foundRamo = availableBranches.find(r => {
              const ramoWords = r.nome.toLowerCase().split(' ');
              return searchWords.some(sw => 
                ramoWords.some(rw => rw.includes(sw) || sw.includes(rw))
              );
            });
          }
          
          // Matching por abreviações
          if (!foundRamo) {
            const abreviacoes: Record<string, string[]> = {
              'auto': ['automóvel', 'veículo', 'carro', 'automóveis'],
              'residencial': ['residência', 'casa', 'imóvel'],
              'vida': ['seguro de vida', 'vida individual'],
              'rc': ['responsabilidade civil', 'resp civil'],
              'empresarial': ['empresa', 'comercial']
            };
            
            for (const [key, variants] of Object.entries(abreviacoes)) {
              if (normalizedRamoName.includes(key) || variants.some(v => normalizedRamoName.includes(v))) {
                foundRamo = availableBranches.find(r => {
                  const ramoLower = r.nome.toLowerCase();
                  return ramoLower.includes(key) || variants.some(v => ramoLower.includes(v));
                });
                if (foundRamo) break;
              }
            }
          }
          
          if (foundRamo) {
            setValue('type', foundRamo.nome);
            console.log('✅ Ramo encontrado:', foundRamo.nome);
            toast.success('Ramo identificado', {
              description: `${foundRamo.nome} selecionado automaticamente`
            });
          } else {
            console.warn('⚠️ Ramo não encontrado para esta seguradora:', data.insuranceLine);
            toast.warning('Ramo não disponível', {
              description: `${data.insuranceLine} não está cadastrado para esta seguradora`
            });
          }
        }, attempt * 800); // Aumenta o delay a cada tentativa (800ms, 1600ms, 2400ms...)
      };
      
      // Iniciar tentativas
      tryFindRamo();
    }

    // ============================================
    // 10. VALIDAÇÃO E NAVEGAÇÃO AUTOMÁTICA
    // ============================================
    await trigger();
    
    setTimeout(() => {
      const hasClient = !!watch('clientId');
      const hasInsurer = !!watch('insuranceCompany');
      
      if (hasClient && hasInsurer) {
        if (currentStep === 1) {
          setCurrentStep(2);
          toast.success('Formulário preenchido!', {
            description: 'Dados principais identificados. Revise e continue.'
          });
        }
      } else {
        const missing = [];
        if (!hasClient) missing.push('Cliente');
        if (!hasInsurer) missing.push('Seguradora');
        
        if (missing.length > 0) {
          toast.warning('Atenção', {
            description: `Não foi possível identificar: ${missing.join(', ')}. Selecione manualmente.`
          });
        }
      }
    }, 3000); // Aguarda 3s para dar tempo de todos os dados carregarem

    console.log('✅ Processamento concluído');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Botão de Upload de Orçamento PDF */}
            {!isEditing && (
              <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <h3 className="text-sm font-medium text-white mb-2">
                  Importação Rápida com IA
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Faça upload de um orçamento em PDF e a IA preencherá automaticamente os campos do formulário.
                </p>
                <QuoteUploadButton 
                  onDataExtracted={handleQuoteDataExtracted}
                  disabled={isSubmitting}
                />
              </div>
            )}

            <Separator className="bg-white/10" />

            {/* Cliente Selection */}
            <div>
              <Label htmlFor="clientId" className="text-white">Cliente *</Label>
              <div className="flex gap-2 mt-1">
                <div className="flex-1">
                  <Combobox
                    options={clientOptions}
                    value={watch('clientId')}
                    onValueChange={(value) => setValue('clientId', value)}
                    placeholder="Buscar e selecionar cliente..."
                    searchPlaceholder="Digite o nome ou telefone do cliente..."
                    emptyText="Nenhum cliente encontrado."
                  />
                </div>
                <QuickAddClientModal onClientCreated={handleClientCreated} />
              </div>
              {errors.clientId && (
                <p className="text-red-400 text-sm mt-1">{errors.clientId.message}</p>
              )}
            </div>

            {/* Bem Segurado */}
            <div>
              <Label htmlFor="insuredAsset" className="text-white">Bem Segurado *</Label>
              <Textarea
                {...register('insuredAsset')}
                className="bg-slate-900/50 border-slate-700 text-white mt-1"
                placeholder="Descreva o bem segurado..."
                rows={3}
              />
              {errors.insuredAsset && (
                <p className="text-red-400 text-sm mt-1">{errors.insuredAsset.message}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status" className="text-white">Status *</Label>
              <Select value={watch('status')} onValueChange={(value) => setValue('status', value as any)}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900/95 backdrop-blur-lg border-slate-700 text-white">
                  <SelectItem value="Orçamento" className="hover:bg-white/10 focus:bg-white/10">Orçamento</SelectItem>
                  <SelectItem value="Aguardando Apólice" className="hover:bg-white/10 focus:bg-white/10">Aguardando Apólice</SelectItem>
                  <SelectItem value="Ativa" className="hover:bg-white/10 focus:bg-white/10">Ativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {/* Seguradora */}
            <div>
              <Label htmlFor="insuranceCompany" className="text-white">
                Seguradora {currentStatus !== 'Orçamento' && '*'}
              </Label>
              <Select value={watch('insuranceCompany')} onValueChange={(value) => setValue('insuranceCompany', value)}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white mt-1">
                  <SelectValue placeholder="Selecione a seguradora" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900/95 backdrop-blur-lg border-slate-700 text-white">
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id} className="hover:bg-white/10 focus:bg-white/10">
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.insuranceCompany && (
                <p className="text-red-400 text-sm mt-1">{errors.insuranceCompany.message}</p>
              )}
            </div>

            {/* Ramo */}
            <div>
              <Label htmlFor="type" className="text-white">
                Ramo {currentStatus !== 'Orçamento' && '*'}
              </Label>
              <Select value={watch('type')} onValueChange={(value) => setValue('type', value)}>
                <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white mt-1">
                  <SelectValue placeholder="Selecione o ramo" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900/95 backdrop-blur-lg border-slate-700 text-white">
                  {availableBranches.map((ramo) => (
                    <SelectItem key={ramo.id} value={ramo.id} className="hover:bg-white/10 focus:bg-white/10">
                      {ramo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-red-400 text-sm mt-1">{errors.type.message}</p>
              )}
            </div>

            {/* Número da Apólice */}
            <div>
              <Label htmlFor="policyNumber" className="text-white">Número da Apólice</Label>
              <Input
                {...register('policyNumber')}
                className="bg-slate-900/50 border-slate-700 text-white mt-1"
                placeholder="Ex: 12345678"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Valores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="premiumValue" className="text-white">Valor do Prêmio *</Label>
                <Input
                  {...register('premiumValue', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0"
                  className="bg-slate-900/50 border-slate-700 text-white mt-1"
                  placeholder="0,00"
                />
                {errors.premiumValue && (
                  <p className="text-red-400 text-sm mt-1">{errors.premiumValue.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="commissionRate" className="text-white">Taxa de Comissão (%) *</Label>
                <Input
                  {...register('commissionRate', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="bg-slate-900/50 border-slate-700 text-white mt-1"
                  placeholder="20"
                />
                {errors.commissionRate && (
                  <p className="text-red-400 text-sm mt-1">{errors.commissionRate.message}</p>
                )}
              </div>
            </div>

            <Separator className="bg-slate-700" />

            {/* Toggle Renovação Automática */}
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="automaticRenewal" className="text-white">
                Gerar Renovação Automática?
              </Label>
              <Switch
                id="automaticRenewal"
                checked={watch('automaticRenewal')}
                onCheckedChange={(checked) => setValue('automaticRenewal', checked)}
              />
            </div>

            {/* Datas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate" className="text-white">Data de Início *</Label>
                <Input
                  {...register('startDate')}
                  type="date"
                  className="bg-slate-900/50 border-slate-700 text-white mt-1"
                />
                {errors.startDate && (
                  <p className="text-red-400 text-sm mt-1">{errors.startDate.message}</p>
                )}
              </div>
              
              {/* Data de Vencimento com Toggle */}
              <div>
                <div className="flex items-center gap-2">
                  <Label className="text-white">Data de Vencimento</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleToggleDueDateMode}
                        className="h-6 w-6 p-0 text-white hover:bg-white/10"
                      >
                        {isManualDueDate ? <X size={14} /> : <Edit3 size={14} />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isManualDueDate ? 'Voltar para cálculo automático' : 'Alterar para data manual'}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                {isManualDueDate ? (
                  <Input
                    {...register('expirationDate')}
                    type="date"
                    className="bg-slate-900/50 border-slate-700 text-white mt-1"
                  />
                ) : (
                  <div className="mt-1 flex h-10 w-full items-center rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-gray-400">
                    Calculada automaticamente (+1 ano)
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {/* Produtor e Corretora */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="producerId" className="text-white">Produtor</Label>
                <Select value={watch('producerId')} onValueChange={(value) => setValue('producerId', value)}>
                  <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white mt-1">
                    <SelectValue placeholder="Selecione o produtor" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900/95 backdrop-blur-lg border-slate-700 text-white">
                    {producers.map((producer) => (
                      <SelectItem key={producer.id} value={producer.id} className="hover:bg-white/10 focus:bg-white/10">
                        {producer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="brokerageId" className="text-white">Corretora</Label>
                <Select value={watch('brokerageId')} onValueChange={(value) => setValue('brokerageId', value)}>
                  <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white mt-1">
                    <SelectValue placeholder="Selecione a corretora" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900/95 backdrop-blur-lg border-slate-700 text-white">
                    {brokerages.map((brokerage) => (
                      <SelectItem key={brokerage.id} value={brokerage.id.toString()} className="hover:bg-white/10 focus:bg-white/10">
                        {brokerage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderNavigationButtons = () => {
    return (
      <div className="flex justify-between pt-6 mt-6 border-t border-slate-700">
        <Button
          type="button"
          variant="outline"
          onClick={currentStep === 1 ? onClose : handleBack}
          className="bg-slate-700 text-white hover:bg-slate-600"
        >
          {currentStep === 1 ? (
            'Cancelar'
          ) : (
            <>
              <ChevronLeft size={16} className="mr-1" />
              Voltar
            </>
          )}
        </Button>

        {currentStep < STEPS.length ? (
          <Button
            type="button"
            onClick={handleNext}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Avançar
            <ChevronRight size={16} className="ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting 
              ? (isEditing ? 'Salvando...' : 'Criando...') 
              : (isEditing ? 'Salvar Alterações' : 'Criar Apólice')
            }
          </Button>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Stepper */}
        <Stepper steps={STEPS} currentStep={currentStep} />
        
        <div>
          {/* Step Content */}
          <div className="min-h-[400px]">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          {renderNavigationButtons()}
        </div>
      </div>
    </TooltipProvider>
  );
}
