import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGenericSupabaseMutation } from '@/hooks/useGenericSupabaseMutation';
import { Plus } from 'lucide-react';
import { Client } from '@/types';

// Schema simplificado para cadastro rápido - apenas campos essenciais
const quickClientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['Ativo', 'Inativo']).default('Ativo')
}).refine((data) => {
  const hasEmail = data.email && data.email.trim() !== '';
  const hasPhone = data.phone && data.phone.trim() !== '';
  return hasEmail || hasPhone;
}, {
  message: 'É obrigatório informar pelo menos email ou telefone',
  path: ['email']
});

interface QuickAddClientModalProps {
  onClientCreated: (client: Client) => void;
  triggerClassName?: string;
}

const clientMutationConfig = {
  tableName: 'clientes' as const,
  queryKey: 'clients',
  onSuccessMessage: {
    add: 'Cliente cadastrado com sucesso!'
  }
};

export function QuickAddClientModal({ onClientCreated, triggerClassName }: QuickAddClientModalProps) {
  const [open, setOpen] = useState(false);
  const { addItemAsync, isAdding } = useGenericSupabaseMutation(clientMutationConfig);

  const form = useForm({
    resolver: zodResolver(quickClientSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      status: 'Ativo' as const
    }
  });

  const onSubmit = async (data: any) => {
    try {
      // Use addItemAsync to get the actual created client data
      const newClient = await addItemAsync(data) as any;
      
      if (newClient) {
        // Chamar callback com o cliente real criado
        onClientCreated({
          id: newClient.id,
          name: newClient.name,
          email: newClient.email || '',
          phone: newClient.phone || '',
          status: newClient.status,
          createdAt: newClient.created_at || new Date().toISOString()
        } as Client);
        
        form.reset();
        setOpen(false);
      }
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={`border-primary/20 text-primary hover:bg-primary/10 ${triggerClassName}`}
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-slate-900/95 backdrop-blur-lg border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Cadastro Rápido de Cliente</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome */}
          <div>
            <Label htmlFor="name" className="text-white">Nome *</Label>
            <Input
              {...form.register('name')}
              className="bg-slate-900/50 border-slate-700 text-white mt-1"
              placeholder="Nome completo do cliente"
            />
            {form.formState.errors.name && (
              <p className="text-red-400 text-sm mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input
              {...form.register('email')}
              type="email"
              className="bg-slate-900/50 border-slate-700 text-white mt-1"
              placeholder="email@exemplo.com"
            />
            {form.formState.errors.email && (
              <p className="text-red-400 text-sm mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>

          {/* Telefone */}
          <div>
            <Label htmlFor="phone" className="text-white">Telefone</Label>
            <Input
              {...form.register('phone')}
              className="bg-slate-900/50 border-slate-700 text-white mt-1"
              placeholder="(11) 99999-9999"
            />
            {form.formState.errors.phone && (
              <p className="text-red-400 text-sm mt-1">{form.formState.errors.phone.message}</p>
            )}
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status" className="text-white">Status</Label>
            <Select value={form.watch('status')} onValueChange={(value) => form.setValue('status', value as any)}>
              <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900/95 backdrop-blur-lg border-slate-700 text-white">
                <SelectItem value="Ativo" className="hover:bg-white/10 focus:bg-white/10">Ativo</SelectItem>
                <SelectItem value="Inativo" className="hover:bg-white/10 focus:bg-white/10">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isAdding}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {isAdding ? 'Salvando...' : 'Salvar Cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}