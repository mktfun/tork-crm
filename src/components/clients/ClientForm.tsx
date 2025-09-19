import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { PersonalDataTab } from './form-tabs/PersonalDataTab';
import { AddressContactTab } from './form-tabs/AddressContactTab';
import { ObservationsTab } from './form-tabs/ObservationsTab';
import { clientSchema, type ClientFormData } from '@/schemas/clientSchema';

interface ClientFormProps {
  mode: 'full' | 'quick';
  onSubmit: (data: ClientFormData) => void | Promise<void>;
  isSubmitting?: boolean;
  onCancel?: () => void;
  defaultValues?: Partial<ClientFormData>;
}

export function ClientForm({ 
  mode, 
  onSubmit, 
  isSubmitting = false, 
  onCancel,
  defaultValues 
}: ClientFormProps) {
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
      ...defaultValues
    }
  });

  const handleSubmit = async (data: ClientFormData) => {
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

    await onSubmit(cleanedData);
    
    if (!isSubmitting) {
      form.reset();
    }
  };

  if (mode === 'quick') {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <PersonalDataTab form={form} />
              </div>
            </div>
          </div>
          
          <div className="flex justify-between pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
            )}
            
            <Button 
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white ml-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Cliente'}
            </Button>
          </div>
        </form>
      </Form>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Dados Pessoais</h3>
            <PersonalDataTab form={form} />
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Endereço e Contato</h3>
            <AddressContactTab form={form} />
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Observações</h3>
            <ObservationsTab form={form} />
          </div>
        </div>
        
        <div className="flex justify-between pt-4 border-t border-white/20">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
          )}
          
          <Button 
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white ml-auto"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Cliente'}
          </Button>
        </div>
      </form>
    </Form>
  );
}