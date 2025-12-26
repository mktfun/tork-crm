import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Loader2, Calendar } from 'lucide-react';
import { format, isFuture, parseISO } from 'date-fns';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useFinancialAccounts, useRegisterExpense } from '@/hooks/useFinanceiro';
import { FinancialAccount } from '@/types/financeiro';
import { Badge } from '@/components/ui/badge';

interface FormData {
  description: string;
  amount: string;
  transactionDate: string;
  expenseAccountId: string;
  assetAccountId: string;
  referenceNumber: string;
}

export function NovaDespesaModal() {
  const [open, setOpen] = useState(false);
  
  const { data: expenseAccounts = [], isLoading: loadingExpense } = useFinancialAccounts('expense');
  const { data: assetAccounts = [], isLoading: loadingAsset } = useFinancialAccounts('asset');
  
  const registerExpense = useRegisterExpense();
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      description: '',
      amount: '',
      transactionDate: format(new Date(), 'yyyy-MM-dd'),
      expenseAccountId: '',
      assetAccountId: '',
      referenceNumber: ''
    }
  });

  // Detectar se a data selecionada é futura
  const transactionDate = watch('transactionDate');
  const isDateFuture = useMemo(() => {
    if (!transactionDate) return false;
    try {
      return isFuture(parseISO(transactionDate));
    } catch {
      return false;
    }
  }, [transactionDate]);

  const onSubmit = async (data: FormData) => {
    try {
      const amount = parseFloat(data.amount.replace(',', '.'));
      
      if (isNaN(amount) || amount <= 0) {
        toast.error('Valor inválido');
        return;
      }

      await registerExpense.mutateAsync({
        description: data.description,
        amount,
        transactionDate: data.transactionDate,
        expenseAccountId: data.expenseAccountId,
        assetAccountId: data.assetAccountId,
        referenceNumber: data.referenceNumber || undefined
      });

      toast.success('Despesa registrada com sucesso!');
      reset();
      setOpen(false);
    } catch (error: any) {
      console.error('Erro ao registrar despesa:', error);
      toast.error(error.message || 'Erro ao registrar despesa');
    }
  };

  const isLoading = loadingExpense || loadingAsset;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Despesa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar Despesa</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              placeholder="Ex: Pagamento de conta de luz"
              {...register('description', { required: 'Descrição obrigatória' })}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                {...register('amount', { required: 'Valor obrigatório' })}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="transactionDate">Data *</Label>
                {isDateFuture && (
                  <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/30 bg-amber-500/10">
                    <Calendar className="w-3 h-3" />
                    Previsão
                  </Badge>
                )}
              </div>
              <Input
                id="transactionDate"
                type="date"
                {...register('transactionDate', { required: 'Data obrigatória' })}
              />
              {isDateFuture && (
                <p className="text-xs text-muted-foreground">
                  Despesas futuras aparecem como previsão no Fluxo de Caixa
                </p>
              )}
              {errors.transactionDate && (
                <p className="text-sm text-destructive">{errors.transactionDate.message}</p>
              )}
            </div>
          </div>

          {/* Categoria (Conta de Despesa) */}
          <div className="space-y-2">
            <Label>Para que foi? (Categoria) *</Label>
            <Select
              onValueChange={(value) => setValue('expenseAccountId', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {expenseAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code ? `${acc.code} - ${acc.name}` : acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('expenseAccountId', { required: 'Selecione uma categoria' })} />
            {errors.expenseAccountId && (
              <p className="text-sm text-destructive">{errors.expenseAccountId.message}</p>
            )}
          </div>

          {/* Conta de Saída (Ativo) */}
          <div className="space-y-2">
            <Label>De onde saiu o dinheiro? *</Label>
            <Select
              onValueChange={(value) => setValue('assetAccountId', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {assetAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code ? `${acc.code} - ${acc.name}` : acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('assetAccountId', { required: 'Selecione uma conta' })} />
            {errors.assetAccountId && (
              <p className="text-sm text-destructive">{errors.assetAccountId.message}</p>
            )}
          </div>

          {/* Referência (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="referenceNumber">Referência (opcional)</Label>
            <Input
              id="referenceNumber"
              placeholder="Ex: NF 12345, Boleto, etc."
              {...register('referenceNumber')}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={registerExpense.isPending}
            >
              {registerExpense.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Despesa'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
