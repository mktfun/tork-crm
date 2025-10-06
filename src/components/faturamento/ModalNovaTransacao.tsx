import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Sparkles } from 'lucide-react';
import { useTransactions, useTransactionTypes, useClients, usePolicies, useCompanies } from '@/hooks/useAppData';
import { useSupabaseRamos } from '@/hooks/useSupabaseRamos';
import { useSupabaseProducers } from '@/hooks/useSupabaseProducers';
import { Transaction } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { inferRamoFromDescription } from '@/utils/text-inference';

export function ModalNovaTransacao() {
  const { addTransaction } = useTransactions();
  const { transactionTypes } = useTransactionTypes();
  const { clients } = useClients();
  const { policies } = usePolicies();
  const { companies } = useCompanies();
  const { data: ramos = [] } = useSupabaseRamos();
  const { producers } = useSupabaseProducers();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [ramoSugerido, setRamoSugerido] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    typeId: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    clientId: '',
    policyId: '',
    companyId: '',
    producerId: '',
    ramo: ''
  });

  // Lógica de sugestão inteligente de Ramo baseada na descrição
  useEffect(() => {
    if (formData.description && !formData.ramo) {
      const ramosDisponiveis = ramos.map(r => r.nome);
      const sugestao = inferRamoFromDescription(formData.description, ramosDisponiveis);
      setRamoSugerido(sugestao);
    } else {
      setRamoSugerido(null);
    }
  }, [formData.description, formData.ramo, ramos]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.typeId || !formData.description || formData.amount <= 0) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const transactionData: Omit<Transaction, 'id' | 'createdAt'> = {
      typeId: formData.typeId,
      description: formData.description,
      amount: formData.amount,
      status: 'REALIZADO',
      date: formData.date,
      nature: 'GANHO',
      transactionDate: formData.date,
      dueDate: formData.date,
      ...(formData.clientId && { clientId: formData.clientId }),
      ...(formData.policyId && { policyId: formData.policyId }),
      ...(formData.companyId && { companyId: formData.companyId }),
      ...(formData.producerId && { producerId: formData.producerId }),
    };

    addTransaction(transactionData);
    
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
      companyId: '',
      producerId: '',
      ramo: ''
    });
    setRamoSugerido(null);
    
    setIsOpen(false);
  };

  const handleAceitarSugestao = () => {
    if (ramoSugerido) {
      setFormData(prev => ({ ...prev, ramo: ramoSugerido }));
      setRamoSugerido(null);
    }
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
              {(transactionTypes || []).map(type => (
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
            {ramoSugerido && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Sugestão: {ramoSugerido}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAceitarSugestao}
                  className="h-7 text-xs"
                >
                  Aceitar
                </Button>
              </div>
            )}
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
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ramo">Ramo</Label>
                <select
                  id="ramo"
                  value={formData.ramo}
                  onChange={(e) => handleInputChange('ramo', e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                >
                  <option value="">Selecione</option>
                  {(ramos || []).map(ramo => (
                    <option key={ramo.id} value={ramo.nome}>
                      {ramo.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="producerId">Produtor</Label>
                <select
                  id="producerId"
                  value={formData.producerId}
                  onChange={(e) => handleInputChange('producerId', e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                >
                  <option value="">Nenhum produtor</option>
                  {(producers || []).map(producer => (
                    <option key={producer.id} value={producer.id}>
                      {producer.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="clientId">Cliente</Label>
              <select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => handleInputChange('clientId', e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="">Nenhum cliente</option>
                {(clients || []).map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
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
                {(policies || []).map(policy => (
                  <option key={policy.id} value={policy.id}>
                    {policy.policyNumber} - {(clients || []).find(c => c.id === policy.clientId)?.name}
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
                {(companies || []).map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
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
