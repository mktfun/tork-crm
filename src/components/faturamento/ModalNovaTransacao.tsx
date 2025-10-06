
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { useTransactions, useTransactionTypes, useClients, usePolicies, useCompanies } from '@/hooks/useAppData';
import { Transaction } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function ModalNovaTransacao() {
  const { addTransaction } = useTransactions();
  const { transactionTypes } = useTransactionTypes();
  const { clients } = useClients(); // Dados REAIS dos clientes
  const { policies } = usePolicies(); // Dados REAIS das apólices
  const { companies } = useCompanies(); // Dados REAIS das seguradoras
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    typeId: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    clientId: '',
    policyId: '',
    companyId: ''
  });

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.typeId || !formData.description || formData.amount <= 0) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const transactionData: Omit<Transaction, 'id' | 'createdAt'> = {
      typeId: formData.typeId,
      description: formData.description,
      amount: formData.amount,
      status: 'REALIZADO',
      date: formData.date,
      // 🆕 NOVOS CAMPOS OBRIGATÓRIOS
      nature: 'GANHO', // Valor padrão, pode ser determinado pelo tipo de transação
      transactionDate: formData.date,
      dueDate: formData.date,
      ...(formData.clientId && { clientId: formData.clientId }),
      ...(formData.policyId && { policyId: formData.policyId }),
      ...(formData.companyId && { companyId: formData.companyId })
    };

    addTransaction(transactionData);
    
    // --- A CURA ESTÁ AQUI ---
    toast({
      title: "Sucesso!",
      description: "Transação adicionada com sucesso!"
    });
    
    // Reset form
    setFormData({
      typeId: '',
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      clientId: '',
      policyId: '',
      companyId: ''
    });
    
    setIsOpen(false); // A ordem para fechar a porta!
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus size={16} />
          Adicionar Transação Manual
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="typeId">Tipo de Transação *</Label>
            <select
              id="typeId"
              value={formData.typeId}
              onChange={(e) => handleInputChange('typeId', e.target.value)}
              className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              required
            >
              <option value="">Selecione um tipo</option>
              {transactionTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.nature})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Descreva a transação"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Associações Opcionais */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Associar a (Opcional)</h4>
            
            <div>
              <Label htmlFor="clientId">Cliente</Label>
              <select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => handleInputChange('clientId', e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="">Nenhum cliente</option>
                {/* DADOS REAIS DOS CLIENTES */}
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name} {/* MOSTRA O NOME PARA O USUÁRIO */}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="policyId">Apólice</Label>
              <select
                id="policyId"
                value={formData.policyId}
                onChange={(e) => handleInputChange('policyId', e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="">Nenhuma apólice</option>
                {/* DADOS REAIS DAS APÓLICES */}
                {policies.map(policy => (
                  <option key={policy.id} value={policy.id}>
                    {policy.policyNumber} - {clients.find(c => c.id === policy.clientId)?.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="companyId">Seguradora</Label>
              <select
                id="companyId"
                value={formData.companyId}
                onChange={(e) => handleInputChange('companyId', e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="">Nenhuma seguradora</option>
                {/* DADOS REAIS DAS SEGURADORAS */}
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name} {/* MOSTRA O NOME PARA O USUÁRIO */}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Adicionar Transação
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
