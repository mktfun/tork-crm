
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form } from '@/components/ui/form';
import { PersonalDataTab } from './form-tabs/PersonalDataTab';
import { AddressContactTab } from './form-tabs/AddressContactTab';
import { ObservationsTab } from './form-tabs/ObservationsTab';
import { clientSchema, type ClientFormData } from '@/schemas/clientSchema';
import { useClients } from '@/hooks/useAppData';
import { toast } from 'sonner';

export function NewClientModal() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const { addClient } = useClients();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      status: 'Ativo',
      cpfCnpj: '',
      birthDate: '',
      maritalStatus: '',
      profession: '',
      cep: '',
      address: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      observations: '',
    }
  });

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      const data = form.getValues();
      // Clean up empty string values to undefined for optional fields
      const cleanedData = {
        ...data,
        cpfCnpj: data.cpfCnpj || undefined,
        birthDate: data.birthDate || undefined,
        maritalStatus: data.maritalStatus || undefined,
        profession: data.profession || undefined,
        cep: data.cep || undefined,
        address: data.address || undefined,
        number: data.number || undefined,
        complement: data.complement || undefined,
        neighborhood: data.neighborhood || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        observations: data.observations || undefined,
      };

      await addClient(cleanedData);
      toast.success('Cliente criado com sucesso!');
      form.reset();
      setOpen(false);
      setActiveTab('personal');
    } catch (error) {
      toast.error('Erro ao criar cliente');
      console.error('Erro ao criar cliente:', error);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleNextTab = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (activeTab === 'personal') setActiveTab('address');
    if (activeTab === 'address') setActiveTab('observations');
  };

  const handlePrevTab = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (activeTab === 'address') setActiveTab('personal');
    if (activeTab === 'observations') setActiveTab('address');
  };

  const handleClose = () => {
    const isDirty = form.formState.isDirty;
    if (isDirty) {
      const confirm = window.confirm('Existem dados não salvos. Deseja realmente fechar?');
      if (!confirm) return;
    }
    
    form.reset();
    setOpen(false);
    setActiveTab('personal');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus size={16} />
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-4xl max-h-[90vh] overflow-hidden bg-slate-900/95 backdrop-blur-lg border-white/20 text-white"
        onPointerDownOutside={handleClose}
        onEscapeKeyDown={handleClose}
      >
        <DialogHeader>
          <DialogTitle className="text-white text-2xl">Cadastro de Cliente</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
                <TabsTrigger 
                  value="personal" 
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Dados Pessoais
                </TabsTrigger>
                <TabsTrigger 
                  value="address" 
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Endereço e Contato
                </TabsTrigger>
                <TabsTrigger 
                  value="observations" 
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Observações
                </TabsTrigger>
              </TabsList>

              <div className="mt-6 max-h-[60vh] overflow-y-auto">
                <TabsContent value="personal" className="space-y-4">
                  <PersonalDataTab form={form} />
                </TabsContent>

                <TabsContent value="address" className="space-y-4">
                  <AddressContactTab form={form} />
                </TabsContent>

                <TabsContent value="observations" className="space-y-4">
                  <ObservationsTab form={form} />
                </TabsContent>
              </div>
            </Tabs>
            
            <div className="flex justify-between pt-4 border-t border-white/20">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              
              <div className="flex gap-3">
                {activeTab !== 'personal' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevTab}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Anterior
                  </Button>
                )}
                
                {activeTab !== 'observations' ? (
                  <Button
                    type="button"
                    onClick={handleNextTab}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Próximo
                  </Button>
                ) : (
                  <Button 
                    type="button"
                    onClick={onSubmit}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting ? 'Salvando...' : 'Salvar Cliente'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
