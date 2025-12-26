import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useCreateAccount, useUpdateAccount } from '@/hooks/useFinanceiro';
import { FinancialAccount, FinancialAccountType, ACCOUNT_TYPE_LABELS } from '@/types/financeiro';

interface FormData {
  name: string;
  code: string;
  description: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: FinancialAccount | null;
  accountType: FinancialAccountType;
}

export function AccountFormModal({ open, onOpenChange, account, accountType }: Props) {
  const isEditing = !!account;
  
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: '',
      code: '',
      description: ''
    }
  });

  // Reset form quando o modal abrir/fechar ou mudar conta
  useEffect(() => {
    if (open && account) {
      reset({
        name: account.name,
        code: account.code || '',
        description: account.description || ''
      });
    } else if (open) {
      reset({ name: '', code: '', description: '' });
    }
  }, [open, account, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditing && account) {
        await updateAccount.mutateAsync({
          accountId: account.id,
          updates: {
            name: data.name,
            code: data.code || undefined,
            description: data.description || undefined
          }
        });
        toast.success('Conta atualizada com sucesso!');
      } else {
        await createAccount.mutateAsync({
          name: data.name,
          type: accountType,
          code: data.code || undefined,
          description: data.description || undefined
        });
        toast.success('Conta criada com sucesso!');
      }
      
      onOpenChange(false);
      reset();
    } catch (error: any) {
      console.error('Erro ao salvar conta:', error);
      toast.error(error.message || 'Erro ao salvar conta');
    }
  };

  const isPending = createAccount.isPending || updateAccount.isPending;
  
  const typeLabel = accountType === 'asset' 
    ? 'Conta Bancária' 
    : accountType === 'expense' 
      ? 'Categoria de Despesa' 
      : 'Categoria de Receita';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar' : 'Nova'} {typeLabel}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Altere os dados da conta abaixo.' 
              : `Preencha os dados para criar uma nova ${typeLabel.toLowerCase()}.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              placeholder={accountType === 'asset' ? 'Ex: Banco Itaú' : 'Ex: Marketing Digital'}
              {...register('name', { required: 'Nome obrigatório' })}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Código (opcional)</Label>
            <Input
              id="code"
              placeholder="Ex: 1.1.01"
              {...register('code')}
            />
            <p className="text-xs text-muted-foreground">
              Código para organização do plano de contas
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descrição adicional..."
              rows={2}
              {...register('description')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Atualizar'
              ) : (
                'Criar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
