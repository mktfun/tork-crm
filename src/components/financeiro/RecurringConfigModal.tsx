import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Repeat, 
  Plus, 
  Pencil, 
  CalendarDays, 
  DollarSign,
  Loader2
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

import { useFinancialAccounts } from '@/hooks/useFinanceiro';
import { 
  useCreateRecurringConfig, 
  useUpdateRecurringConfig 
} from '@/hooks/useRecurringConfigs';
import { 
  RecurringConfig, 
  RecurringFrequency, 
  RecurringNature,
  FREQUENCY_LABELS 
} from '@/types/recurring';

const formSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  amount: z.number().positive('Valor deve ser positivo'),
  nature: z.enum(['expense', 'revenue']),
  account_id: z.string().optional(),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  day_of_month: z.number().min(1).max(31).optional().nullable(),
  start_date: z.string(),
  end_date: z.string().optional().nullable(),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface RecurringConfigModalProps {
  config?: RecurringConfig | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function RecurringConfigModal({ 
  config, 
  trigger, 
  onSuccess 
}: RecurringConfigModalProps) {
  const [open, setOpen] = useState(false);
  
  const { data: accounts = [] } = useFinancialAccounts();
  const createMutation = useCreateRecurringConfig();
  const updateMutation = useUpdateRecurringConfig();
  
  const isEditing = !!config;
  const isLoading = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      amount: 0,
      nature: 'expense',
      account_id: undefined,
      frequency: 'monthly',
      day_of_month: 10,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: null,
      is_active: true,
    },
  });

  // Reset form when config changes or modal opens
  useEffect(() => {
    if (open) {
      if (config) {
        form.reset({
          name: config.name,
          description: config.description || '',
          amount: config.amount,
          nature: config.nature as RecurringNature,
          account_id: config.account_id || undefined,
          frequency: config.frequency as RecurringFrequency,
          day_of_month: config.day_of_month || 10,
          start_date: config.start_date,
          end_date: config.end_date || null,
          is_active: config.is_active,
        });
      } else {
        form.reset({
          name: '',
          description: '',
          amount: 0,
          nature: 'expense',
          account_id: undefined,
          frequency: 'monthly',
          day_of_month: 10,
          start_date: format(new Date(), 'yyyy-MM-dd'),
          end_date: null,
          is_active: true,
        });
      }
    }
  }, [open, config, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        amount: values.amount,
        nature: values.nature,
        account_id: values.account_id || undefined,
        frequency: values.frequency,
        day_of_month: values.day_of_month || undefined,
        start_date: values.start_date,
        end_date: values.end_date || undefined,
        is_active: values.is_active,
      };

      if (isEditing && config) {
        await updateMutation.mutateAsync({ id: config.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }

      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  // Filter accounts by nature
  const filteredAccounts = accounts.filter(acc => {
    const nature = form.watch('nature');
    return nature === 'expense' ? acc.type === 'expense' : acc.type === 'revenue';
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Recorrência
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5" />
            {isEditing ? 'Editar Recorrência' : 'Nova Recorrência'}
          </DialogTitle>
          <DialogDescription>
            Configure uma despesa ou receita que se repete periodicamente.
            Ela será projetada automaticamente no fluxo de caixa.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nome e Natureza */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Aluguel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="revenue">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Valor e Frequência */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$) *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          type="number" 
                          step="0.01" 
                          className="pl-9"
                          placeholder="0,00"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequência *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dia do vencimento (para mensais) */}
            {form.watch('frequency') === 'monthly' && (
              <FormField
                control={form.control}
                name="day_of_month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia do Vencimento</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          type="number" 
                          min={1} 
                          max={31}
                          className="pl-9"
                          placeholder="10"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Dia do mês em que vence (1-31)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Conta contábil */}
            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta Contábil</FormLabel>
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma conta..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.code ? `${acc.code} - ` : ''}{acc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Início *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Fim (opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value || ''} 
                      />
                    </FormControl>
                    <FormDescription>
                      Deixe vazio para infinito
                    </FormDescription>
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
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detalhes adicionais..."
                      className="resize-none"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Ativo */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="cursor-pointer">Ativo</FormLabel>
                    <FormDescription>
                      Desative para pausar as projeções
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch 
                      checked={field.value} 
                      onCheckedChange={field.onChange} 
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
