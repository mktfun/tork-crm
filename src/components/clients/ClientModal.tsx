
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useGenericSupabaseMutation } from '@/hooks/useGenericSupabaseMutation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

interface FormData {
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  birthDate: string;
  maritalStatus: 'Solteiro(a)' | 'Casado(a)' | 'Divorciado(a)' | 'Viúvo(a)' | '';
  profession: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  observations: string;
  status: 'Ativo' | 'Inativo';
}

export function ClientModal() {
  const [open, setOpen] = useState(false);
  
  const { addItem: addClient, isAdding } = useGenericSupabaseMutation({
    tableName: 'clientes',
    queryKey: 'clients',
    onSuccessMessage: {
      add: 'Cliente adicionado com sucesso'
    }
  });
  
  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
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
      status: 'Ativo'
    }
  });

  const onSubmit = async (data: FormData) => {
    // Map form data to database format
    const clientData = {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      cpf_cnpj: data.cpfCnpj || null,
      birth_date: data.birthDate || null,
      marital_status: data.maritalStatus || null,
      profession: data.profession || null,
      status: data.status || 'Ativo',
      cep: data.cep || null,
      address: data.address || null,
      number: data.number || null,
      complement: data.complement || null,
      neighborhood: data.neighborhood || null,
      city: data.city || null,
      state: data.state || null,
      observations: data.observations || null,
    };

    addClient(clientData, {
      onSuccess: () => {
        reset();
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus size={16} />
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900/95 backdrop-blur-lg border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl">Cadastro de Cliente</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Dados Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="name" className="text-white">Nome Completo *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Digite o nome completo"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="cpfCnpj" className="text-white">CPF/CNPJ</Label>
                <Input
                  id="cpfCnpj"
                  {...register('cpfCnpj')}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              
              <div>
                <Label htmlFor="birthDate" className="text-white">Data de Nascimento</Label>
                <Input
                  id="birthDate"
                  {...register('birthDate')}
                  type="date"
                  className="bg-black/20 border-white/20 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="maritalStatus" className="text-white">Estado Civil</Label>
                <select
                  id="maritalStatus"
                  {...register('maritalStatus')}
                  className="w-full h-10 px-3 py-2 border border-white/20 bg-black/20 rounded-md text-sm text-white"
                >
                  <option value="">Selecione</option>
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viúvo(a)">Viúvo(a)</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="profession" className="text-white">Profissão</Label>
                <Input
                  id="profession"
                  {...register('profession')}
                  placeholder="Ex: Engenheiro, Médico..."
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
            </div>
          </div>

          {/* Endereço e Contato */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Endereço e Contato</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cep" className="text-white">CEP</Label>
                <Input
                  id="cep"
                  {...register('cep')}
                  placeholder="00000-000"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="address" className="text-white">Logradouro</Label>
                <Input
                  id="address"
                  {...register('address')}
                  placeholder="Rua, Avenida..."
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              
              <div>
                <Label htmlFor="number" className="text-white">Número</Label>
                <Input
                  id="number"
                  {...register('number')}
                  placeholder="123"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              
              <div>
                <Label htmlFor="complement" className="text-white">Complemento</Label>
                <Input
                  id="complement"
                  {...register('complement')}
                  placeholder="Apto, Bloco..."
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              
              <div>
                <Label htmlFor="neighborhood" className="text-white">Bairro</Label>
                <Input
                  id="neighborhood"
                  {...register('neighborhood')}
                  placeholder="Centro, Vila..."
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              
              <div>
                <Label htmlFor="city" className="text-white">Cidade</Label>
                <Input
                  id="city"
                  {...register('city')}
                  placeholder="São Paulo"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              
              <div>
                <Label htmlFor="state" className="text-white">UF</Label>
                <Input
                  id="state"
                  {...register('state')}
                  placeholder="SP"
                  maxLength={2}
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              
              <div>
                <Label htmlFor="phone" className="text-white">Telefone *</Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  placeholder="(11) 99999-9999"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="email" className="text-white">Email *</Label>
                <Input
                  id="email"
                  {...register('email')}
                  type="email"
                  placeholder="cliente@email.com"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                  required
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Observações</h3>
            <div>
              <Label htmlFor="observations" className="text-white">Observações Gerais</Label>
              <Textarea
                id="observations"
                {...register('observations')}
                placeholder="Informações adicionais sobre o cliente..."
                rows={4}
                className="bg-black/20 border-white/20 text-white placeholder:text-white/50 resize-none"
              />
            </div>
            
            <div>
              <Label htmlFor="status" className="text-white">Status do Cliente</Label>
              <select
                id="status"
                {...register('status')}
                className="w-full h-10 px-3 py-2 border border-white/20 bg-black/20 rounded-md text-sm text-white"
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>
          </div>
          
          <DialogFooter className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isAdding}
            >
              {isAdding ? 'Salvando...' : 'Salvar Cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
