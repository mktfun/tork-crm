
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ClientForm } from './ClientForm';
import { useGenericSupabaseMutation } from '@/hooks/useGenericSupabaseMutation';
import { toast } from 'sonner';

export function NewClientModal() {
  const [open, setOpen] = useState(false);
  const { addItem: addClient, isAdding } = useGenericSupabaseMutation({
    tableName: 'clientes',
    queryKey: 'clients',
    onSuccessMessage: {
      add: 'Cliente criado com sucesso'
    }
  });

  const handleClientSubmit = async (data: any) => {
    try {
      await addClient(data);
      setOpen(false);
    } catch (error) {
      toast.error('Erro ao criar cliente');
      console.error('Erro ao criar cliente:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus size={16} />
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden bg-slate-900/95 backdrop-blur-lg border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl">Cadastro de Cliente</DialogTitle>
        </DialogHeader>
        
        <div className="max-h-[75vh] overflow-y-auto">
          <ClientForm
            mode="full"
            onSubmit={handleClientSubmit}
            isSubmitting={isAdding}
            onCancel={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
