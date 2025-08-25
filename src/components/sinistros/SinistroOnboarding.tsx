import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Loader2, 
  Plus, 
  Calendar, 
  AlertTriangle, 
  MapPin, 
  ChevronRight,
  ChevronLeft,
  FileText,
  Shield,
  DollarSign,
  CheckCircle,
  User
} from 'lucide-react';
import { useCreateSinistro } from '@/hooks/useSinistros';
import { useClients, usePolicies, useCompanies } from '@/hooks/useAppData';

const steps = [
  {
    id: 1,
    title: 'Informações Básicas',
    description: 'Data e tipo da ocorrência',
    icon: AlertTriangle
  },
  {
    id: 2,
    title: 'Descrição Detalhada',
    description: 'Informe o que aconteceu',
    icon: FileText
  },
  {
    id: 3,
    title: 'Local e Circunstâncias',
    description: 'Onde e como aconteceu',
    icon: MapPin
  },
  {
    id: 4,
    title: 'Valores e Documentos',
    description: 'Informações financeiras',
    icon: DollarSign
  },
  {
    id: 5,
    title: 'Confirmação',
    description: 'Revise e confirme',
    icon: CheckCircle
  }
];

const sinistroSchema = z.object({
  // Passo 1
  policy_id: z.string().optional(), // Agora opcional
  client_id: z.string().optional(),
  company_id: z.string().optional(),
  
  // Passo 2
  occurrence_date: z.string().min(1, 'Data da ocorrência é obrigatória'),
  claim_type: z.string().min(1, 'Tipo do sinistro é obrigatório'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  priority: z.string().optional(),
  
  // Passo 3
  location_occurrence: z.string().optional(),
  circumstances: z.string().optional(),
  
  // Passo 4
  police_report_number: z.string().optional(),
  claim_amount: z.string().optional(),
  deductible_amount: z.string().optional(),
});

type SinistroFormData = z.infer<typeof sinistroSchema>;

const claimTypes = [
  'Colisão',
  'Roubo', 
  'Furto',
  'Incêndio',
  'Danos Elétricos',
  'Enchente',
  'Granizo',
  'Vandalismo',
  'Quebra de Vidros',
  'Assistência 24h',
  'Outros'
];

const priorities = [
  { value: 'Baixa', label: 'Baixa', color: 'text-gray-400' },
  { value: 'Média', label: 'Média', color: 'text-blue-400' },
  { value: 'Alta', label: 'Alta', color: 'text-orange-400' },
  { value: 'Urgente', label: 'Urgente', color: 'text-red-400' },
];

interface SinistroOnboardingProps {
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function SinistroOnboarding({ children, onSuccess }: SinistroOnboardingProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
  const createSinistro = useCreateSinistro();
  const { clients = [] } = useClients();
  const { policies = [] } = usePolicies();
  const { companies = [] } = useCompanies();

  const form = useForm<SinistroFormData>({
    resolver: zodResolver(sinistroSchema),
    defaultValues: {
      occurrence_date: new Date().toISOString().split('T')[0], // Formato mais estável
      priority: 'Média',
      claim_amount: '',
      deductible_amount: '',
    },
  });

  const selectedPolicyId = form.watch('policy_id');
  const selectedPolicy = policies.find(p => p.id === selectedPolicyId);

  // Auto-preenche o cliente e seguradora quando uma apólice é selecionada
  useEffect(() => {
    if (selectedPolicy) {
      if (selectedPolicy.clientId) {
        form.setValue('client_id', selectedPolicy.clientId);
      }
      // Buscar a seguradora baseada na apólice se disponível
      const company = companies.find(c => c.name === selectedPolicy.insuranceCompany);
      if (company) {
        form.setValue('company_id', company.id);
      }
    }
  }, [selectedPolicyId, companies]); // Removido 'form' das dependências

  const progress = (currentStep / steps.length) * 100;

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCompletedSteps(prev => [...prev, currentStep]);
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateCurrentStep = () => {
    const values = form.getValues();

    switch (currentStep) {
      case 1:
        return !!values.occurrence_date && !!values.claim_type; // Data e tipo são obrigatórios
      case 2:
        return values.description && values.description.length >= 10; // Descrição obrigatória
      case 3:
        return true; // Passo opcional
      case 4:
        return true; // Passo opcional
      default:
        return true;
    }
  };

  const onSubmit = async (data: SinistroFormData) => {
    try {
      const submitData = {
        ...data,
        claim_amount: data.claim_amount ? parseFloat(data.claim_amount) : undefined,
        deductible_amount: data.deductible_amount ? parseFloat(data.deductible_amount) : undefined,
      };

      await createSinistro.mutateAsync(submitData);
      
      // Reset em ordem correta
      setCurrentStep(1);
      setCompletedSteps([]);
      form.reset({
        occurrence_date: new Date().toISOString().split('T')[0],
        priority: 'Média',
        claim_amount: '',
        deductible_amount: '',
      });
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao criar sinistro:', error);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Informações Básicas</h3>
              <p className="text-white/60">Quando e que tipo de sinistro aconteceu?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="occurrence_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Data da Ocorrência *
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="claim_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo do Sinistro *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {claimTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridade</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a prioridade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {priorities.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          <span className={priority.color}>{priority.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Seção de Vinculação Opcional */}
            <div className="border-t border-white/10 pt-4">
              <h4 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Vincular Apólice (Opcional)
              </h4>
              <p className="text-xs text-white/60 mb-3">
                Você pode vincular este sinistro a uma apólice específica ou fazer isso posteriormente.
              </p>

              <FormField
                control={form.control}
                name="policy_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apólice</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma apólice (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {policies.map((policy) => (
                          <SelectItem key={policy.id} value={policy.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{policy.policyNumber}</span>
                              <span className="text-sm text-muted-foreground">
                                {policy.insuranceCompany} - {policy.type}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedPolicy && (
                <Card className="bg-blue-500/10 border-blue-500/20 mt-3">
                  <CardContent className="p-3">
                    <h4 className="font-medium text-blue-400 mb-2 text-sm">Apólice Selecionada</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-white/60">Cliente:</span>
                        <p className="text-white font-medium">
                          {clients.find(c => c.id === selectedPolicy.clientId)?.name || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-white/60">Seguradora:</span>
                        <p className="text-white font-medium">{selectedPolicy.insuranceCompany}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <FileText className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Descrição Detalhada</h3>
              <p className="text-white/60">Conte-nos detalhadamente o que aconteceu</p>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição Detalhada da Ocorrência *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva detalhadamente o que aconteceu, como ocorreu, quais danos foram causados, condições do momento, pessoas envolvidas, etc..."
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h4 className="font-medium text-blue-400 mb-2">💡 Dicas para uma boa descrição</h4>
              <ul className="text-sm text-white/80 space-y-1">
                <li>• Relate os fatos em ordem cronológica</li>
                <li>• Descreva as condições climáticas e do local</li>
                <li>• Mencione se havia testemunhas</li>
                <li>• Detalhe os danos observados</li>
                <li>• Inclua informações sobre outros envolvidos</li>
              </ul>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Local e Circunstâncias</h3>
              <p className="text-white/60">Onde e como aconteceu (opcional)</p>
            </div>

            <FormField
              control={form.control}
              name="location_occurrence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Local da Ocorrência
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Av. Paulista, 1000 - São Paulo/SP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="circumstances"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Circunstâncias Detalhadas</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detalhe as circunstâncias, condições climáticas, testemunhas, condições do local, etc..."
                      className="min-h-[120px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <DollarSign className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Valores e Documentos</h3>
              <p className="text-white/60">Informações financeiras e documentais</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="claim_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Estimado (R$)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0,00" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deductible_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Franquia (R$)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0,00" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="police_report_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do B.O.</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 123456/2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <h4 className="font-medium text-yellow-400 mb-2">📋 Documentos Necessários</h4>
              <ul className="text-sm text-white/80 space-y-1">
                <li>• Boletim de Ocorrência (se aplicável)</li>
                <li>• Fotos dos danos</li>
                <li>• Documentos do veículo/bem</li>
                <li>• Orçamentos de reparo</li>
                <li>• Relatórios técnicos</li>
              </ul>
              <p className="text-xs text-white/60 mt-2">
                Você poderá anexar os documentos após o registro inicial
              </p>
            </div>
          </div>
        );

      case 5:
        const formData = form.getValues();
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Confirme os Dados</h3>
              <p className="text-white/60">Revise as informações antes de registrar</p>
            </div>

            <div className="space-y-4">
              <Card className="bg-white/5">
                <CardContent className="p-4">
                  <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Apólice e Cliente
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-white/60">Apólice:</span>
                      <p className="text-white">{selectedPolicy?.policyNumber}</p>
                    </div>
                    <div>
                      <span className="text-white/60">Cliente:</span>
                      <p className="text-white">
                        {clients.find(c => c.id === formData.client_id)?.name}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5">
                <CardContent className="p-4">
                  <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Detalhes da Ocorrência
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-white/60">Tipo:</span>
                      <span className="text-white ml-2">{formData.claim_type}</span>
                    </div>
                    <div>
                      <span className="text-white/60">Data:</span>
                      <span className="text-white ml-2">
                        {formData.occurrence_date && new Date(formData.occurrence_date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/60">Descrição:</span>
                      <p className="text-white/80 text-xs mt-1">{formData.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {(formData.claim_amount || formData.deductible_amount) && (
                <Card className="bg-white/5">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Valores
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {formData.claim_amount && (
                        <div>
                          <span className="text-white/60">Valor Estimado:</span>
                          <p className="text-white font-medium">
                            {parseFloat(formData.claim_amount).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            })}
                          </p>
                        </div>
                      )}
                      {formData.deductible_amount && (
                        <div>
                          <span className="text-white/60">Franquia:</span>
                          <p className="text-white font-medium">
                            {parseFloat(formData.deductible_amount).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Registrar Sinistro
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Registrar Novo Sinistro
          </DialogTitle>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-white/60">
              <span>Passo {currentStep} de {steps.length}</span>
              <span>{Math.round(progress)}% concluído</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>

          {/* Steps Navigation */}
          <div className="flex items-center justify-between py-2">
            {steps.map((step) => {
              const Icon = step.icon;
              const isCompleted = completedSteps.includes(step.id);
              const isCurrent = step.id === currentStep;
              
              return (
                <div key={step.id} className="flex flex-col items-center space-y-1">
                  <div className={`p-2 rounded-full transition-colors ${
                    isCompleted ? 'bg-green-500' :
                    isCurrent ? 'bg-blue-500' : 'bg-white/10'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs text-center max-w-16 ${
                    isCurrent ? 'text-white' : 'text-white/60'
                  }`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-1">
              {renderStepContent()}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-6 flex-shrink-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>

              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>

                {currentStep < steps.length ? (
                  <Button 
                    type="button"
                    onClick={nextStep}
                    disabled={!validateCurrentStep()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Próximo
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button 
                    type="submit" 
                    disabled={createSinistro.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {createSinistro.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Registrar Sinistro
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
