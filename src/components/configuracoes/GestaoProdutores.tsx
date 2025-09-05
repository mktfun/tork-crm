
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { MaskedInput } from '@/components/ui/masked-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useSupabaseProducers } from '@/hooks/useSupabaseProducers';
import { useSupabaseBrokerages } from '@/hooks/useSupabaseBrokerages';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AppCard } from '@/components/ui/app-card';
import { producerSchema, ProducerFormData } from '@/schemas/producerSchema';

export function GestaoProdutores() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProducer, setEditingProducer] = useState<any>(null);
  const [cpfCnpjValue, setCpfCnpjValue] = useState('');
  const [isCnpj, setIsCnpj] = useState(false);
  
  const { producers, loading, addProducer, updateProducer, deleteProducer, isAdding, isUpdating, isDeleting } = useSupabaseProducers();
  const { brokerages } = useSupabaseBrokerages();

  const form = useForm<ProducerFormData>({
    resolver: zodResolver(producerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      cpfCnpj: '',
      companyName: '',
      brokerage_id: 0,
    },
  });

  // Detectar se é CPF ou CNPJ baseado no comprimento
  useEffect(() => {
    const cleanValue = cpfCnpjValue.replace(/\D/g, '');
    setIsCnpj(cleanValue.length > 11);
    
    // Limpar razão social se mudar de CNPJ para CPF
    if (cleanValue.length <= 11 && form.getValues('companyName')) {
      form.setValue('companyName', '');
    }
  }, [cpfCnpjValue, form]);

  const handleSubmit = async (data: ProducerFormData) => {
    try {
      const submitData = {
        ...data,
        email: data.email || null,
        phone: data.phone || null,
        cpfCnpj: data.cpfCnpj || null,
        companyName: data.companyName || null,
      };
      
      if (editingProducer) {
        await updateProducer(editingProducer.id, submitData);
      } else {
        await addProducer(submitData);
      }
      setIsDialogOpen(false);
      setEditingProducer(null);
      form.reset();
      setCpfCnpjValue('');
    } catch (error) {
      console.error('Error saving producer:', error);
    }
  };

  const handleEdit = (producer: any) => {
    setEditingProducer(producer);
    form.reset({
      name: producer.name || '',
      email: producer.email || '',
      phone: producer.phone || '',
      cpfCnpj: producer.cpfCnpj || '',
      companyName: producer.companyName || '',
      brokerage_id: producer.brokerage_id || 0,
    });
    setCpfCnpjValue(producer.cpfCnpj || '');
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProducer(id);
    } catch (error) {
      console.error('Error deleting producer:', error);
    }
  };

  const handleNewProducer = () => {
    setEditingProducer(null);
    form.reset();
    setCpfCnpjValue('');
    setIsDialogOpen(true);
  };

  // Helper function to get brokerage name by ID
  const getBrokerageName = (brokerageId: number) => {
    const brokerage = brokerages.find(b => b.id === brokerageId);
    return brokerage?.name || '-';
  };

  // Função para formatar CPF/CNPJ para exibição
  const formatCpfCnpj = (value: string | null) => {
    if (!value) return '-';
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length === 11) {
      return cleanValue.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleanValue.length === 14) {
      return cleanValue.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return value;
  };

  return (
    <AppCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Gestão de Produtores</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewProducer} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Produtor
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingProducer ? 'Editar Produtor' : 'Novo Produtor'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-slate-300">Nome do Produtor</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder="Ex: João Silva"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-400 mt-1">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="cpfCnpj" className="text-slate-300">CPF/CNPJ</Label>
                  <Controller
                    name="cpfCnpj"
                    control={form.control}
                    render={({ field }) => (
                      <MaskedInput
                        id="cpfCnpj"
                        mask={isCnpj ? "99.999.999/9999-99" : "999.999.999-99"}
                        placeholder={isCnpj ? "00.000.000/0000-00" : "000.000.000-00"}
                        className="bg-slate-800 border-slate-700 text-white"
                        value={field.value || ''}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          setCpfCnpjValue(e.target.value);
                        }}
                      />
                    )}
                  />
                  {form.formState.errors.cpfCnpj && (
                    <p className="text-sm text-red-400 mt-1">
                      {form.formState.errors.cpfCnpj.message}
                    </p>
                  )}
                </div>
              </div>

              {isCnpj && (
                <div>
                  <Label htmlFor="companyName" className="text-slate-300">
                    Razão Social <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    {...form.register('companyName')}
                    placeholder="Ex: João Silva Seguros LTDA"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  {form.formState.errors.companyName && (
                    <p className="text-sm text-red-400 mt-1">
                      {form.formState.errors.companyName.message}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register('email')}
                    placeholder="joao@exemplo.com"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-red-400 mt-1">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="phone" className="text-slate-300">Telefone</Label>
                  <Input
                    id="phone"
                    {...form.register('phone')}
                    placeholder="(11) 99999-9999"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="brokerage_id" className="text-slate-300">Corretora</Label>
                <Controller
                  name="brokerage_id"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value ? field.value.toString() : ''}
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Selecione uma corretora" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {brokerages.map((brokerage) => (
                          <SelectItem key={brokerage.id} value={brokerage.id.toString()}>
                            {brokerage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.brokerage_id && (
                  <p className="text-sm text-red-400 mt-1">
                    {form.formState.errors.brokerage_id.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isAdding || isUpdating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {editingProducer ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div>
        {loading ? (
          <div className="text-center py-8">
            <div className="text-slate-400">Carregando...</div>
          </div>
        ) : producers.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p>Nenhum produtor cadastrado ainda.</p>
            <p className="text-sm mt-1">Clique em "Adicionar Produtor" para começar.</p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden border border-slate-700">
            <Table>
              <TableHeader>
                <TableRow className="border-b-slate-700 hover:bg-slate-800/50">
                  <TableHead className="text-white">Nome</TableHead>
                  <TableHead className="text-white">CPF/CNPJ</TableHead>
                  <TableHead className="text-white">Email</TableHead>
                  <TableHead className="text-white">Telefone</TableHead>
                  <TableHead className="text-white">Corretora</TableHead>
                  <TableHead className="text-right text-white">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {producers.map((producer) => (
                  <TableRow key={producer.id} className="border-b-slate-800 hover:bg-slate-800/30">
                    <TableCell className="font-medium text-slate-200">
                      <div>
                        <div>{producer.name}</div>
                        {producer.companyName && (
                          <div className="text-xs text-slate-400">{producer.companyName}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{formatCpfCnpj(producer.cpfCnpj)}</TableCell>
                    <TableCell className="text-slate-300">{producer.email || '-'}</TableCell>
                    <TableCell className="text-slate-300">{producer.phone || '-'}</TableCell>
                    <TableCell className="text-slate-300">{getBrokerageName(producer.brokerage_id)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(producer)}
                          className="border-slate-700 text-slate-300 hover:bg-slate-800"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="border-slate-700 text-slate-300 hover:bg-slate-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-slate-900 border-slate-800">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-400">
                                Tem certeza que deseja excluir o produtor "{producer.name}"?
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-slate-700 text-slate-300 hover:bg-slate-800">
                                Cancelar
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(producer.id)}
                                disabled={isDeleting}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppCard>
  );
}
