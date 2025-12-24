
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, RotateCcw } from 'lucide-react';
import { format, addYears, isAfter } from 'date-fns';
import { useSupabasePolicies } from '@/hooks/useSupabasePolicies';
import { useToast } from '@/hooks/use-toast';
import { Policy } from '@/types';
import { formatDate, parseLocalDate } from '@/utils/dateUtils';

const renewalSchema = z.object({
  newPremiumValue: z.number().min(0.01, 'Valor do prêmio deve ser maior que zero'),
  newCommissionRate: z.number().min(0, 'Taxa de comissão deve ser maior ou igual a zero').max(100, 'Taxa de comissão não pode ser maior que 100%'),
  bonusClass: z.string().optional(),
  newExpirationDate: z.string().min(1, 'Nova data de vencimento é obrigatória'),
  observations: z.string().optional(),
  renewalType: z.enum(['manual', 'auto_12m', 'auto_24m'], {
    message: 'Tipo de renovação é obrigatório'
  })
}).refine((data) => {
  // Validar se a nova data de vencimento é futura
  const newDate = new Date(data.newExpirationDate);
  const today = new Date();
  return isAfter(newDate, today);
}, {
  message: 'A nova data de vencimento deve ser posterior à data atual',
  path: ['newExpirationDate']
});

type RenewalFormData = z.infer<typeof renewalSchema>;

interface RenewPolicyModalProps {
  policy: Policy | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RenewPolicyModal({ policy, isOpen, onClose, onSuccess }: RenewPolicyModalProps) {
  const [isRenewing, setIsRenewing] = useState(false);
  const { addPolicy, updatePolicy } = useSupabasePolicies();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<RenewalFormData>({
    resolver: zodResolver(renewalSchema),
    defaultValues: {
      newPremiumValue: policy?.premiumValue || 0,
      newCommissionRate: policy?.commissionRate || 0,
      bonusClass: policy?.bonus_class || '0',
      renewalType: 'manual'
    }
  });

  const renewalType = watch('renewalType');

  // Gerar número único para apólice renovada
  const generateRenewedPolicyNumber = (originalNumber: string) => {
    const timestamp = Date.now();
    const year = new Date().getFullYear();
    return `${originalNumber}-R${year}-${timestamp.toString().slice(-6)}`;
  };

  // Validar campos obrigatórios da apólice original
  const validateOriginalPolicy = (policy: Policy) => {
    const missingFields = [];
    
    if (!policy.insuranceCompany) missingFields.push('Seguradora');
    if (!policy.type) missingFields.push('Ramo');
    if (!policy.policyNumber) missingFields.push('Número da apólice');
    
    return missingFields;
  };

  // Calcular nova data de vencimento baseada no tipo
  const calculateNewExpirationDate = (type: string) => {
    if (!policy?.expirationDate) return '';
    
    const currentExpiration = parseLocalDate(policy.expirationDate);
    let newDate: Date;
    
    switch (type) {
      case 'auto_12m':
        newDate = addYears(currentExpiration, 1);
        break;
      case 'auto_24m':
        newDate = addYears(currentExpiration, 2);
        break;
      default:
        newDate = addYears(currentExpiration, 1);
    }
    
    return format(newDate, 'yyyy-MM-dd');
  };

  // Atualizar data quando tipo de renovação muda
  const handleRenewalTypeChange = (type: string) => {
    setValue('renewalType', type as any);
    const newDate = calculateNewExpirationDate(type);
    setValue('newExpirationDate', newDate);
  };

  const onSubmit = async (data: RenewalFormData) => {
    if (!policy) {
      console.error('❌ Política não encontrada para renovação');
      return;
    }

    console.log('🔄 Iniciando processo de renovação para apólice:', policy.policyNumber);

    // Validar campos obrigatórios da apólice original
    const missingFields = validateOriginalPolicy(policy);
    if (missingFields.length > 0) {
      toast({
        title: 'Erro na Renovação',
        description: `A apólice original possui campos obrigatórios em branco: ${missingFields.join(', ')}. Complete essas informações antes de renovar.`,
        variant: 'destructive',
      });
      return;
    }

    // Validar se nova data é posterior à data de vencimento original
    const originalExpiration = new Date(policy.expirationDate);
    const newExpiration = new Date(data.newExpirationDate);
    
    if (!isAfter(newExpiration, originalExpiration)) {
      toast({
        title: 'Erro na Renovação',
        description: 'A nova data de vencimento deve ser posterior à data de vencimento atual da apólice.',
        variant: 'destructive',
      });
      return;
    }

    setIsRenewing(true);
    try {
      console.log('📝 Criando nova apólice renovada...');
      
      // Gerar número único para a apólice renovada
      const renewedPolicyNumber = generateRenewedPolicyNumber(policy.policyNumber!);
      console.log('🔢 Número da nova apólice:', renewedPolicyNumber);

      // 🎯 ETAPA 1: Criar nova apólice renovada PRIMEIRO
      const renewedPolicy = {
        clientId: policy.clientId,
        policyNumber: renewedPolicyNumber,
        insuranceCompany: policy.insuranceCompany!,
        type: policy.type!,
        insuredAsset: policy.insuredAsset || 'Não especificado',
        premiumValue: data.newPremiumValue,
        commissionRate: data.newCommissionRate,
        status: 'Ativa' as const,
        expirationDate: data.newExpirationDate,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        producerId: policy.producerId,
        brokerageId: policy.brokerageId,
        bonus_class: data.bonusClass,
        userId: policy.userId,
        automaticRenewal: true // ✅ ADICIONADO: Campo obrigatório
      };

      console.log('💾 Salvando nova apólice renovada...');
      await addPolicy(renewedPolicy);
      console.log('✅ Nova apólice criada com sucesso');

      // 🎯 ETAPA 2: Marcar apólice original como renovada DEPOIS
      console.log('🔄 Atualizando status da apólice original para "Renovada"...');
      await updatePolicy(policy.id, { 
        status: 'Renovada',
        bonus_class: data.bonusClass 
      });
      console.log('✅ Apólice original marcada como renovada');

      toast({
        title: 'Renovação Concluída',
        description: `Apólice ${policy.policyNumber} renovada com sucesso! Nova apólice: ${renewedPolicyNumber}`,
        variant: 'default',
      });

      console.log('🎉 Processo de renovação concluído com sucesso');
      reset();
      onClose();
      onSuccess?.();
      
    } catch (error) {
      console.error('❌ Erro durante o processo de renovação:', error);
      
      // Tratamento de erro mais específico
      let errorMessage = 'Erro desconhecido durante a renovação.';
      
      if (error instanceof Error) {
        if (error.message.includes('constraint')) {
          errorMessage = 'Erro de validação no banco de dados. Verifique se todos os campos estão corretos.';
        } else if (error.message.includes('duplicate')) {
          errorMessage = 'Número da apólice já existe. Tente novamente.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: 'Erro na Renovação',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsRenewing(false);
    }
  };

  if (!policy) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-green-400" />
            Renovar Apólice: {policy.policyNumber}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações da Apólice Atual */}
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-600">
            <h3 className="text-sm font-medium text-slate-300 mb-2">Apólice Atual</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Prêmio Atual:</span>
                <span className="text-white ml-2">
                  {policy.premiumValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Vencimento:</span>
                <span className="text-white ml-2">
                  {formatDate(policy.expirationDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Verificação de Campos Obrigatórios */}
          {(!policy.insuranceCompany || !policy.type || !policy.policyNumber) && (
            <div className="bg-yellow-900/20 border border-yellow-600 p-4 rounded-lg">
              <h3 className="text-yellow-400 font-medium mb-2">⚠️ Atenção: Campos Obrigatórios</h3>
              <p className="text-yellow-300 text-sm">
                Esta apólice possui campos obrigatórios em branco. Complete essas informações antes de renovar:
              </p>
              <ul className="text-yellow-300 text-sm mt-2 list-disc list-inside">
                {!policy.insuranceCompany && <li>Seguradora</li>}
                {!policy.type && <li>Ramo</li>}
                {!policy.policyNumber && <li>Número da apólice</li>}
              </ul>
            </div>
          )}

          {/* Tipo de Renovação */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="renewalType" className="text-slate-300">Tipo de Renovação</Label>
              <Select value={renewalType} onValueChange={handleRenewalTypeChange}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (Personalizada)</SelectItem>
                  <SelectItem value="auto_12m">Automática - 12 meses</SelectItem>
                  <SelectItem value="auto_24m">Automática - 24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dados da Nova Apólice */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="newPremiumValue" className="text-slate-300">Novo Valor do Prêmio *</Label>
              <Input
                id="newPremiumValue"
                type="number"
                step="0.01"
                min="0"
                {...register('newPremiumValue', { valueAsNumber: true })}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="0,00"
              />
              {errors.newPremiumValue && (
                <p className="text-red-400 text-xs mt-1">{errors.newPremiumValue.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="newCommissionRate" className="text-slate-300">Nova Taxa de Comissão (%) *</Label>
              <Input
                id="newCommissionRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register('newCommissionRate', { valueAsNumber: true })}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="0,00"
              />
              {errors.newCommissionRate && (
                <p className="text-red-400 text-xs mt-1">{errors.newCommissionRate.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="bonusClass" className="text-slate-300">Classe de Bônus</Label>
              <Select value={watch('bonusClass')} onValueChange={(value) => setValue('bonusClass', value)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Classe 0 (Padrão)</SelectItem>
                  <SelectItem value="1">Classe 1 (-10%)</SelectItem>
                  <SelectItem value="2">Classe 2 (-20%)</SelectItem>
                  <SelectItem value="3">Classe 3 (-30%)</SelectItem>
                  <SelectItem value="4">Classe 4 (-40%)</SelectItem>
                  <SelectItem value="5">Classe 5 (-50%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="newExpirationDate" className="text-slate-300">Nova Data de Vencimento *</Label>
              <Input
                id="newExpirationDate"
                type="date"
                {...register('newExpirationDate')}
                className="bg-slate-800 border-slate-600 text-white"
              />
              {errors.newExpirationDate && (
                <p className="text-red-400 text-xs mt-1">{errors.newExpirationDate.message}</p>
              )}
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="observations" className="text-slate-300">Observações da Renovação</Label>
            <Textarea
              id="observations"
              {...register('observations')}
              className="bg-slate-800 border-slate-600 text-white"
              placeholder="Observações sobre a renovação..."
              rows={3}
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isRenewing || (!policy.insuranceCompany || !policy.type || !policy.policyNumber)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isRenewing ? 'Renovando...' : 'Confirmar Renovação'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
