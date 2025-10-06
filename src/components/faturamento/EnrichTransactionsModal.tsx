import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrphanTransactions, useBatchUpdateTransactions } from '@/hooks/useSupabaseTransactions';
import { useSupabaseRamos } from '@/hooks/useSupabaseRamos';
import { useSupabaseCompanies } from '@/hooks/useSupabaseCompanies';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EnrichTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EnrichTransactionsModal({ isOpen, onClose }: EnrichTransactionsModalProps) {
  const { toast } = useToast();
  const { data: orphanTransactions = [], isLoading: loadingTransactions } = useOrphanTransactions();
  const { data: ramos = [] } = useSupabaseRamos();
  const { companies } = useSupabaseCompanies();
  const { mutate: batchUpdate, isPending } = useBatchUpdateTransactions();

  const [updates, setUpdates] = useState<Record<string, { ramo_id: string | null; company_id: string | null }>>({});

  // Inicializar estado quando transações carregarem
  useEffect(() => {
    if (orphanTransactions.length > 0) {
      const initialUpdates = orphanTransactions.reduce((acc, tx) => {
        acc[tx.id] = { 
          ramo_id: null, 
          company_id: tx.company_id || null 
        };
        return acc;
      }, {} as Record<string, { ramo_id: string | null; company_id: string | null }>);
      setUpdates(initialUpdates);
    }
  }, [orphanTransactions]);

  const handleSelectChange = (txId: string, field: 'ramo_id' | 'company_id', value: string) => {
    setUpdates(prev => ({
      ...prev,
      [txId]: { ...prev[txId], [field]: value || null },
    }));
  };

  const handleSubmit = () => {
    const payload = Object.entries(updates)
      .filter(([_, value]) => value.ramo_id) // Apenas transações com ramo selecionado
      .map(([id, value]) => ({
        id,
        ramo_id: value.ramo_id,
        company_id: value.company_id,
      }));

    if (payload.length === 0) {
      toast({
        title: "Nenhuma seleção",
        description: "Selecione pelo menos um ramo para vincular.",
        variant: "destructive"
      });
      return;
    }

    batchUpdate(payload, {
      onSuccess: (message) => {
        toast({
          title: "Sucesso!",
          description: message,
        });
        onClose();
      },
      onError: (error: Error) => {
        toast({
          title: "Erro ao vincular",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Vincular Transações Pendentes Manualmente
          </DialogTitle>
        </DialogHeader>

        {loadingTransactions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            <span className="ml-2 text-slate-400">Carregando transações...</span>
          </div>
        ) : orphanTransactions.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma transação pendente sem ramo encontrada. 
              Todas as suas transações já estão vinculadas!
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              <p className="text-sm text-slate-400">
                {orphanTransactions.length} transação(ões) pendente(s) encontrada(s). 
                Selecione o ramo e seguradora para cada uma.
              </p>

              {orphanTransactions.map(tx => (
                <div key={tx.id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Informações da Transação */}
                    <div className="lg:col-span-3 mb-2">
                      <p className="font-semibold text-white">{tx.description}</p>
                      <div className="flex gap-4 text-xs text-slate-400 mt-1">
                        <span>{new Date(tx.date).toLocaleDateString('pt-BR')}</span>
                        <span className={tx.nature === 'RECEITA' ? 'text-green-400' : 'text-red-400'}>
                          {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>

                    {/* Select Ramo */}
                    <div>
                      <Label className="text-sm text-slate-300">
                        Ramo <span className="text-red-400">*</span>
                      </Label>
                      <Select 
                        value={updates[tx.id]?.ramo_id || ''} 
                        onValueChange={(value) => handleSelectChange(tx.id, 'ramo_id', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecione um ramo" />
                        </SelectTrigger>
                        <SelectContent>
                          {ramos.map(ramo => (
                            <SelectItem key={ramo.id} value={ramo.id}>
                              {ramo.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Select Seguradora */}
                    <div>
                      <Label className="text-sm text-slate-300">Seguradora</Label>
                      <Select 
                        value={updates[tx.id]?.company_id || ''} 
                        onValueChange={(value) => handleSelectChange(tx.id, 'company_id', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecione uma seguradora" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nenhuma</SelectItem>
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
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button variant="outline" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Vínculos'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
