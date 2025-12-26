import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseRamos } from '@/hooks/useSupabaseRamos';
import { useSupabaseCompanies } from '@/hooks/useSupabaseCompanies';
import { useClients, useTransactionTypes } from '@/hooks/useAppData';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { formatDate } from '@/utils/dateUtils';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

interface EditTransactionModalProps {
  transactionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditTransactionModal({ 
  transactionId, 
  isOpen, 
  onClose,
  onSuccess 
}: EditTransactionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados do formulário
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [typeId, setTypeId] = useState('');
  const [clientId, setClientId] = useState('');
  const [ramoId, setRamoId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Buscar dados da transação específica
  const { data: transaction, isLoading: loadingTransaction } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: async () => {
      if (!transactionId) return null;
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error) {
        console.error('Erro ao buscar transação:', error);
        throw error;
      }

      return data;
    },
    enabled: !!transactionId && isOpen,
  });

  // Buscar listas para os dropdowns
  const { data: ramos = [] } = useSupabaseRamos();
  const { companies } = useSupabaseCompanies();
  const { clients } = useClients();
  const { transactionTypes } = useTransactionTypes();

  // Identificar se é transação manual ou automática
  const isManualTransaction = transaction?.policy_id === null;

  // Preencher o formulário quando os dados da transação chegam
  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description || '');
      setAmount(String(transaction.amount || ''));
      setDate(transaction.date || '');
      setTypeId(transaction.type_id || '');
      setClientId(transaction.client_id || '__none__');
      setRamoId(transaction.ramo_id || '__none__');
      setCompanyId(transaction.company_id || '__none__');
      setStatus(transaction.status || 'PENDENTE');
    }
  }, [transaction]);

  // Resetar formulário ao fechar
  useEffect(() => {
    if (!isOpen) {
      setDescription('');
      setAmount('');
      setDate('');
      setTypeId('');
      setClientId('__none__');
      setRamoId('__none__');
      setCompanyId('__none__');
      setStatus('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!transactionId) return;

    try {
      setIsUpdating(true);

      const updates: any = {
        status: status,
        ramo_id: ramoId === '__none__' ? null : ramoId || null,
        company_id: companyId === '__none__' ? null : companyId || null,
      };

      // Se for transação manual, permitir editar mais campos
      if (isManualTransaction) {
        updates.description = description;
        updates.amount = parseFloat(amount) || 0;
        updates.date = date;
        updates.type_id = typeId;
        updates.client_id = clientId === '__none__' ? null : clientId || null;
        
        // Atualizar nature baseado no tipo selecionado
        const selectedType = transactionTypes.find(t => t.id === typeId);
        if (selectedType) {
          updates.nature = selectedType.nature;
        }
      }

      const { error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', transactionId);

      if (error) {
        throw error;
      }

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-paginated'] });

      toast({
        title: "Sucesso!",
        description: "Transação atualizada com sucesso.",
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao atualizar transação:', error);
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar a transação.",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const transactionType = transactionTypes.find(t => t.id === transaction?.type_id);
  const isGanho = transactionType?.nature === 'GANHO' || transaction?.nature === 'RECEITA' || transaction?.nature === 'GANHO';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            {isManualTransaction ? 'Editar Transação Manual' : 'Detalhes da Transação'}
          </DialogTitle>
        </DialogHeader>

        {loadingTransaction ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            <span className="ml-2 text-slate-400">Carregando dados...</span>
          </div>
        ) : transaction ? (
          <div className="space-y-6">
            {/* Badge de Tipo */}
            <div className="flex items-center gap-2">
              <Badge 
                variant={isManualTransaction ? 'default' : 'secondary'}
                className={isManualTransaction 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }
              >
                {isManualTransaction ? '✏️ Transação Manual' : '🔄 Transação Automática'}
              </Badge>
            </div>

            {/* Aviso para transações automáticas */}
            {!isManualTransaction && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-400 mb-1">Transação gerada automaticamente</p>
                  <p className="text-slate-400">
                    Esta transação foi criada a partir de uma apólice. Para editar os valores principais, 
                    acesse a apólice vinculada. Aqui você pode alterar apenas o status, ramo e seguradora.
                  </p>
                  {transaction.policy_id && (
                    <Link 
                      to={`/policies/${transaction.policy_id}`}
                      className="inline-flex items-center gap-1 mt-2 text-blue-400 hover:text-blue-300 hover:underline"
                      onClick={onClose}
                    >
                      <LinkIcon size={14} />
                      Ver apólice vinculada
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Informações da Transação (somente leitura para automáticas) */}
            {!isManualTransaction && (
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <h3 className="font-semibold text-white mb-3">Informações da Transação</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Descrição:</span>
                    <p className="text-white font-medium">{transaction.description}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Valor:</span>
                    <p className={`font-bold ${isGanho ? 'text-green-400' : 'text-red-400'}`}>
                      {transaction.amount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Data:</span>
                    <p className="text-white">{formatDate(transaction.date)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Tipo:</span>
                    <p className="text-white">{transactionType?.name || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Campos de Edição Completa para Transações Manuais */}
            {isManualTransaction && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Descrição */}
                  <div className="md:col-span-2">
                    <Label className="text-sm text-slate-300 mb-2 block">Descrição</Label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descrição da transação"
                      className="bg-slate-800/50 border-slate-700"
                    />
                  </div>

                  {/* Valor */}
                  <div>
                    <Label className="text-sm text-slate-300 mb-2 block">Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="bg-slate-800/50 border-slate-700"
                    />
                  </div>

                  {/* Data */}
                  <div>
                    <Label className="text-sm text-slate-300 mb-2 block">Data</Label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="bg-slate-800/50 border-slate-700"
                    />
                  </div>

                  {/* Tipo de Transação */}
                  <div>
                    <Label className="text-sm text-slate-300 mb-2 block">Tipo</Label>
                    <Select value={typeId} onValueChange={setTypeId}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-700">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {transactionTypes.map(type => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} ({type.nature === 'GANHO' ? 'Receita' : 'Despesa'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cliente */}
                  <div>
                    <Label className="text-sm text-slate-300 mb-2 block">
                      Cliente <span className="text-slate-500">(opcional)</span>
                    </Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-700">
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {clients.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Campos editáveis para ambos os tipos */}
            <div className="space-y-4 pt-4 border-t border-slate-700">
              <h4 className="text-sm font-medium text-slate-300">Classificação</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status */}
                <div>
                  <Label className="text-sm text-slate-300 mb-2 block">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="bg-slate-800/50 border-slate-700">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDENTE">Pendente</SelectItem>
                      <SelectItem value="PAGO">Pago</SelectItem>
                      <SelectItem value="PARCIALMENTE_PAGO">Parcialmente Pago</SelectItem>
                      <SelectItem value="ATRASADO">Atrasado</SelectItem>
                      <SelectItem value="CANCELADO">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Ramo */}
                <div>
                  <Label className="text-sm text-slate-300 mb-2 block">
                    Ramo <span className="text-slate-500">(opcional)</span>
                  </Label>
                  <Select value={ramoId} onValueChange={setRamoId}>
                    <SelectTrigger className="bg-slate-800/50 border-slate-700">
                      <SelectValue placeholder="Selecione um ramo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {ramos.map(ramo => (
                        <SelectItem key={ramo.id} value={ramo.id}>
                          {ramo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Seguradora */}
                <div>
                  <Label className="text-sm text-slate-300 mb-2 block">
                    Seguradora <span className="text-slate-500">(opcional)</span>
                  </Label>
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger className="bg-slate-800/50 border-slate-700">
                      <SelectValue placeholder="Selecione uma seguradora" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      <SelectItem value="__none__">Nenhuma</SelectItem>
                      {companies.map(company => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            Transação não encontrada
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isUpdating || !transaction}>
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}