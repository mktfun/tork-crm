import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { useClients, usePolicies } from '@/hooks/useAppData';
import { useSupabaseAppointments } from '@/hooks/useSupabaseAppointments';
import { useCompanyNames } from '@/hooks/useCompanyNames';
import { useToast } from '@/hooks/use-toast';
import { RecurrenceConfig } from './RecurrenceConfig';

interface AppointmentModalProps {
  initialDate?: Date;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: React.ReactNode;
}

export function AppointmentModal({
  initialDate,
  isOpen,
  onOpenChange,
  triggerButton
}: AppointmentModalProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    policyId: '',
    title: '',
    date: '',
    time: '',
    notes: '',
    priority: 'Normal'
  });
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null);
  
  const {
    addAppointment,
    isAdding
  } = useSupabaseAppointments();
  const {
    clients
  } = useClients();
  const {
    policies
  } = usePolicies();
  const {
    getCompanyName,
    loading: companiesLoading
  } = useCompanyNames();
  const {
    toast
  } = useToast();

  // Controle de estado do modal
  const modalOpen = isOpen !== undefined ? isOpen : open;
  const setModalOpen = onOpenChange || setOpen;

  // Efeito para preencher data inicial
  useEffect(() => {
    if (initialDate) {
      const formattedDate = initialDate.toISOString().split('T')[0];
      setFormData(prev => ({
        ...prev,
        date: formattedDate
      }));
    }
  }, [initialDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.date.trim() || !formData.time.trim()) {
      toast({
        title: "Erro",
        description: "Título, data e horário são obrigatórios",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await addAppointment({
        client_id: formData.clientId === 'none' || !formData.clientId ? null : formData.clientId,
        policy_id: formData.policyId === 'none' || !formData.policyId ? null : formData.policyId,
        title: formData.title.trim(),
        date: formData.date,
        time: formData.time,
        status: 'Pendente',
        notes: formData.notes.trim() || undefined,
        priority: formData.priority,
        recurrence_rule: recurrenceRule
      });
      
      toast({
        title: "Sucesso",
        description: recurrenceRule ? "Agendamento criado com renovação automática configurada!" : "Agendamento criado com sucesso!"
      });

      // Limpar formulário e fechar modal
      setFormData({
        clientId: '',
        policyId: '',
        title: '',
        date: '',
        time: '',
        notes: '',
        priority: 'Normal'
      });
      setRecurrenceRule(null);
      setModalOpen(false);
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar agendamento. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Preparar opções para o combobox de clientes
  const clientOptions = [
    { value: 'none', label: 'Nenhum cliente específico' },
    ...clients.map(client => ({
      value: client.id,
      label: `${client.name} - ${client.phone || client.email || 'Sem contato'}`
    }))
  ];

  // Preparar opções para o combobox de apólices (filtradas pelo cliente selecionado)
  const selectedClientPolicies = formData.clientId && formData.clientId !== 'none' 
    ? policies.filter(p => p.clientId === formData.clientId) 
    : policies;

  const policyOptions = [
    { value: 'none', label: 'Nenhuma apólice específica' },
    ...selectedClientPolicies.map(policy => ({
      value: policy.id,
      label: `${policy.type || 'Sem tipo'} - ${companiesLoading ? '...' : getCompanyName(policy.insuranceCompany)} ${policy.policyNumber ? `(${policy.policyNumber})` : ''}`
    }))
  ];

  // Se não há triggerButton, renderizar apenas o modal controlado externamente
  if (!triggerButton) {
    return (
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-700 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {initialDate ? 'Agendar para ' + initialDate.toLocaleDateString('pt-BR') : 'Criar Novo Agendamento'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-slate-300">Título do Agendamento *</Label>
              <Input 
                id="title" 
                value={formData.title} 
                onChange={e => handleInputChange('title', e.target.value)} 
                placeholder="Ex: Renovação de Seguro Auto" 
                className="bg-slate-800 border-slate-600 text-white" 
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-slate-300">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={e => handleInputChange('date', e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time" className="text-slate-300">Horário *</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={e => handleInputChange('time', e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority" className="text-slate-300">Prioridade</Label>
                <Select value={formData.priority} onValueChange={value => handleInputChange('priority', value)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientId" className="text-slate-300">Cliente (opcional)</Label>
              <Combobox
                options={clientOptions}
                value={formData.clientId}
                onValueChange={value => handleInputChange('clientId', value)}
                placeholder="Selecione um cliente"
                searchPlaceholder="Buscar cliente por nome, telefone ou email..."
                emptyText="Nenhum cliente encontrado"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="policyId" className="text-slate-300">Apólice (opcional)</Label>
              <Combobox
                options={policyOptions}
                value={formData.policyId}
                onValueChange={value => handleInputChange('policyId', value)}
                placeholder="Selecione uma apólice"
                searchPlaceholder="Buscar apólice por tipo, seguradora ou número..."
                emptyText="Nenhuma apólice encontrada"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-300">Observações (opcional)</Label>
              <Textarea 
                id="notes" 
                value={formData.notes} 
                onChange={e => handleInputChange('notes', e.target.value)} 
                placeholder="Observações sobre o agendamento..." 
                className="bg-slate-800 border-slate-600 text-white" 
                rows={3} 
              />
            </div>

            <RecurrenceConfig onRecurrenceChange={setRecurrenceRule} initialRecurrence={null} />

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setModalOpen(false)} 
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isAdding}>
                {isAdding ? 'Criando...' : 'Criar Agendamento'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogTrigger asChild>
        {triggerButton}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {initialDate ? 'Agendar para ' + initialDate.toLocaleDateString('pt-BR') : 'Criar Novo Agendamento'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-slate-300">Título do Agendamento *</Label>
            <Input 
              id="title" 
              value={formData.title} 
              onChange={e => handleInputChange('title', e.target.value)} 
              placeholder="Ex: Renovação de Seguro Auto" 
              className="bg-slate-800 border-slate-600 text-white" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-slate-300">Data *</Label>
              <Input 
                id="date" 
                type="date" 
                value={formData.date} 
                onChange={e => handleInputChange('date', e.target.value)} 
                className="bg-slate-800 border-slate-600 text-white" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time" className="text-slate-300">Horário *</Label>
              <Input 
                id="time" 
                type="time" 
                value={formData.time} 
                onChange={e => handleInputChange('time', e.target.value)} 
                className="bg-slate-800 border-slate-600 text-white" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId" className="text-slate-300">Cliente (opcional)</Label>
            <Combobox
              options={clientOptions}
              value={formData.clientId}
              onValueChange={value => handleInputChange('clientId', value)}
              placeholder="Selecione um cliente"
              searchPlaceholder="Buscar cliente por nome, telefone ou email..."
              emptyText="Nenhum cliente encontrado"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="policyId" className="text-slate-300">Apólice (opcional)</Label>
            <Combobox
              options={policyOptions}
              value={formData.policyId}
              onValueChange={value => handleInputChange('policyId', value)}
              placeholder="Selecione uma apólice"
              searchPlaceholder="Buscar apólice por tipo, seguradora ou número..."
              emptyText="Nenhuma apólice encontrada"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-slate-300">Observações (opcional)</Label>
            <Textarea 
              id="notes" 
              value={formData.notes} 
              onChange={e => handleInputChange('notes', e.target.value)} 
              placeholder="Observações sobre o agendamento..." 
              className="bg-slate-800 border-slate-600 text-white" 
              rows={3} 
            />
          </div>

          <RecurrenceConfig onRecurrenceChange={setRecurrenceRule} initialRecurrence={null} />

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setModalOpen(false)} 
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isAdding}>
              {isAdding ? 'Criando...' : 'Criar Agendamento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
