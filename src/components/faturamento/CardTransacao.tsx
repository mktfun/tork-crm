import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, DollarSign, ExternalLink } from 'lucide-react';
import { Transaction } from '@/types';
import { useTransactionTypes, useClients, usePolicies, useCompanies } from '@/hooks/useAppData';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/utils/dateUtils';
import { getTransactionDisplayTitle } from '@/utils/transactionUtils';

interface CardTransacaoProps {
  transaction: Transaction;
  onMarkAsRealized: (transactionId: string, newStatus: 'REALIZADO') => void;
}

export function CardTransacao({ transaction, onMarkAsRealized }: CardTransacaoProps) {
  const navigate = useNavigate();
  const { transactionTypes } = useTransactionTypes();
  const { clients } = useClients();
  const { policies } = usePolicies();
  const { companies } = useCompanies();

  const getTransactionType = () => {
    const type = transactionTypes.find(t => t.id === transaction.typeId);
    return type || { name: 'Tipo não encontrado', nature: 'GANHO' as const };
  };

  const getAssociatedData = () => {
    const data = {
      client: null as any,
      policy: null as any,
      company: null as any
    };
    
    if (transaction.clientId) {
      data.client = clients.find(c => c.id === transaction.clientId);
    }
    
    if (transaction.policyId) {
      data.policy = policies.find(p => p.id === transaction.policyId);
    }
    
    if (transaction.companyId) {
      data.company = companies.find(c => c.id === transaction.companyId);
    }
    
    return data;
  };

  const handleClientClick = (clientId: string) => {
    navigate(`/clients/${clientId}`);
  };

  const transactionType = getTransactionType();
  const associatedData = getAssociatedData();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${transactionType.nature === 'GANHO' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
              <DollarSign className={`w-4 h-4 ${transactionType.nature === 'GANHO' ? 'text-emerald-400' : 'text-rose-400'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-white truncate max-w-xs">{getTransactionDisplayTitle(transaction, policies, clients)}</h3>
              <p className="text-sm text-zinc-400">{transactionType.name}</p>
            </div>
            <Badge 
              variant="outline"
              className={transaction.status === 'PREVISTO' 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }
            >
              {transaction.status === 'PREVISTO' ? 'Previsto' : 'Realizado'}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">Valor</p>
              <p className={`text-lg font-bold ${transactionType.nature === 'GANHO' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {transactionType.nature === 'PERDA' ? '-' : '+'}
                {transaction.amount.toLocaleString('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                })}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Data</p>
              <p className="font-medium text-white">
                {formatDate(transaction.date)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Natureza</p>
              <Badge 
                variant="outline"
                className={transactionType.nature === 'GANHO' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }
              >
                {transactionType.nature}
              </Badge>
            </div>
          </div>
          
          {/* Seção de dados associados com links */}
          {(associatedData.client || associatedData.policy || associatedData.company) && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <p className="text-sm text-zinc-500 mb-2">Associado a:</p>
              <div className="flex flex-wrap gap-2">
                {associatedData.client && (
                  <button
                    onClick={() => handleClientClick(associatedData.client.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-md text-xs hover:bg-sky-500/20 transition-colors"
                  >
                    <span>Cliente: {associatedData.client.name}</span>
                    <ExternalLink size={12} />
                  </button>
                )}
                
                {associatedData.policy && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md text-xs">
                    <span>
                      Apólice: {associatedData.policy.policyNumber} - {associatedData.policy.ramos?.nome || associatedData.policy.type} ({associatedData.policy.companies?.name || 'Seguradora'})
                    </span>
                  </div>
                )}
                
                {associatedData.company && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 rounded-md text-xs">
                    <span>Seguradora: {associatedData.company.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {transaction.status === 'PREVISTO' && (
          <div className="ml-4">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onMarkAsRealized(transaction.id, 'REALIZADO')}
              className="flex items-center gap-2"
            >
              <Check size={14} />
              Marcar como Realizado
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
