import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Plus, Calendar, AlertTriangle, MapPin, Search, User, FileText } from 'lucide-react';
import { useCreateSinistro } from '@/hooks/useSinistros';
import { useClients, usePolicies } from '@/hooks/useAppData';
import { format } from 'date-fns';
import { formatDate } from '@/utils/dateUtils';

const sinistroSchema = z.object({
  policy_id: z.string().optional(), // Agora opcional
  client_id: z.string().optional(),
  occurrence_date: z.string().min(1, 'Data da ocorrência é obrigatória'),
  claim_type: z.string().min(1, 'Tipo do sinistro é obrigatório'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  location_occurrence: z.string().optional(),
  circumstances: z.string().optional(),
  police_report_number: z.string().optional(),
  claim_amount: z.string().optional(),
  deductible_amount: z.string().optional(),
  priority: z.string().optional(),
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
  { value: 'Baixa', label: 'Baixa' },
  { value: 'Média', label: 'Média' },
  { value: 'Alta', label: 'Alta' },
  { value: 'Urgente', label: 'Urgente' },
];

interface SinistroFormModalProps {
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function SinistroFormModal({ children, onSuccess }: SinistroFormModalProps) {
  const [open, setOpen] = useState(false);
  const createSinistro = useCreateSinistro();
  const { clients = [] } = useClients();
  const { policies = [] } = usePolicies();

  const form = useForm<SinistroFormData>({
    resolver: zodResolver(sinistroSchema),
    defaultValues: {
      occurrence_date: format(new Date(), 'yyyy-MM-dd'),
      priority: 'Média',
      claim_amount: '',
      deductible_amount: '',
    },
  });

  const selectedPolicyId = form.watch('policy_id');
  const selectedPolicy = policies.find(p => p.id === selectedPolicyId);


  // Auto-preenche o cliente quando uma apólice é selecionada
  const handlePolicyChange = useCallback((policyId: string) => {
    const policy = policies.find(p => p.id === policyId);
    if (policy?.clientId) {
      form.setValue('client_id', policy.clientId);
    }
  }, [policies, form]);

  const onSubmit = async (data: SinistroFormData) => {
    try {
      const submitData = {
        ...data,
        claim_amount: data.claim_amount ? parseFloat(data.claim_amount) : undefined,
        deductible_amount: data.deductible_amount ? parseFloat(data.deductible_amount) : undefined,
      };

      await createSinistro.mutateAsync(submitData);

      // Reset em ordem correta para evitar problemas
      form.reset({
        occurrence_date: new Date().toISOString().split('T')[0],
        priority: 'Média',
        claim_amount: '',
        deductible_amount: '',
      });
      setOpen(false);

      // Chamar onSuccess após um pequeno delay para garantir que o modal fechou
      setTimeout(() => {
        onSuccess?.();
      }, 100);
    } catch (error) {
      console.error('Erro ao criar sinistro:', error);
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
      
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Registrar Novo Sinistro
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Data da Ocorrência */}
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

              {/* Tipo do Sinistro */}
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

            {/* Descrição */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição da Ocorrência *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva detalhadamente o que aconteceu..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Local da Ocorrência */}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Número do B.O. */}
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

              {/* Prioridade */}
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
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Circunstâncias */}
            <FormField
              control={form.control}
              name="circumstances"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Circunstâncias Detalhadas</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detalhe as circunstâncias, condições climáticas, testemunhas, etc..."
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Valor Estimado */}
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

              {/* Franquia */}
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
            </div>

            {/* Seção de Vinculação (Opcional) */}
            <div className="border-t border-white/10 pt-6">
              <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Vinculação (Opcional)
              </h4>
              <p className="text-sm text-white/60 mb-4">
                Você pode vincular este sinistro a uma apólice e cliente específicos. Esta informação pode ser adicionada posteriormente.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Apólice com busca - Agora opcional */}
                <FormField
                  control={form.control}
                  name="policy_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Apólice
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handlePolicyChange(value);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma apólice (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {policies.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                              Nenhuma apólice disponível
                            </div>
                          ) : (
                            policies.map((policy) => (
                              <SelectItem key={policy.id} value={policy.id}>
                                <div className="flex flex-col items-start py-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {policy.policyNumber || `Orçamento #${policy.id.slice(-4)}`}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                      {policy.status}
                                    </span>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {policy.client?.name || 'Cliente não informado'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {policy.companies?.name || 'Seguradora'} • {policy.ramos?.nome || policy.type}
                                  </div>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Cliente (auto-preenchido ou manual) */}
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Cliente
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar cliente (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                              {client.phone && (
                                <span className="text-muted-foreground ml-2">({client.phone})</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Informações da Apólice Selecionada */}
              {selectedPolicy && (
                <div className="md:col-span-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4">
                  <h4 className="font-medium text-blue-400 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Informações da Apólice Vinculada
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div>
                        <span className="text-white/60 text-sm">Número:</span>
                        <p className="text-white font-medium">
                          {selectedPolicy.policyNumber || `Orçamento #${selectedPolicy.id.slice(-4)}`}
                        </p>
                      </div>
                      <div>
                        <span className="text-white/60 text-sm">Seguradora:</span>
                        <p className="text-white">{selectedPolicy.companies?.name || 'Seguradora não especificada'}</p>
                      </div>
                      <div>
                        <span className="text-white/60 text-sm">Tipo:</span>
                        <p className="text-white">{selectedPolicy.ramos?.nome || selectedPolicy.type}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-white/60 text-sm flex items-center gap-1">
                          <User className="w-3 h-3" />
                          Cliente:
                        </span>
                        <p className="text-white font-medium">{selectedPolicy.client?.name}</p>
                        {selectedPolicy.client?.phone && (
                          <p className="text-white/80 text-sm">{selectedPolicy.client.phone}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-white/60 text-sm">Vigência:</span>
                        <p className="text-white">
                          {selectedPolicy.expirationDate &&
                            formatDate(selectedPolicy.expirationDate)}
                        </p>
                      </div>
                      <div>
                        <span className="text-white/60 text-sm">Status:</span>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ml-2 ${
                          selectedPolicy.status === 'Ativa' ? 'bg-green-500/20 text-green-400' :
                          selectedPolicy.status === 'Orçamento' ? 'bg-orange-500/20 text-orange-400' :
                          selectedPolicy.status === 'Aguardando Apólice' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {selectedPolicy.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                disabled={createSinistro.isPending}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createSinistro.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createSinistro.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Registrar Sinistro
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
