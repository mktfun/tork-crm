
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, DollarSign, ExternalLink } from 'lucide-react';
import { Transaction } from '@/types';
import { useTransactionTypes, useClients, usePolicies, useCompanies } from '@/hooks/useAppData';
import { useNavigate } from 'react-router-dom';

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
            <div className={`p-2 rounded-lg ${transactionType.nature === 'GANHO' ? 'bg-green-100' : 'bg-red-100'}`}>
              <DollarSign className={`w-4 h-4 ${transactionType.nature === 'GANHO' ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{transaction.description}</h3>
              <p className="text-sm text-gray-600">{transactionType.name}</p>
            </div>
            <Badge 
              variant={transaction.status === 'PREVISTO' ? 'outline' : 'default'}
              className={transaction.status === 'PREVISTO' ? 'text-yellow-600 border-yellow-500' : 'text-green-600 border-green-500'}
            >
              {transaction.status === 'PREVISTO' ? 'Previsto' : 'Realizado'}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Valor</p>
              <p className={`text-lg font-bold ${transactionType.nature === 'GANHO' ? 'text-green-600' : 'text-red-600'}`}>
                {transactionType.nature === 'PERDA' ? '-' : '+'}
                {transaction.amount.toLocaleString('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Data</p>
              <p className="font-medium">
                {new Date(transaction.date).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Natureza</p>
              <Badge variant={transactionType.nature === 'GANHO' ? 'default' : 'destructive'}>
                {transactionType.nature}
              </Badge>
            </div>
          </div>
          
          {/* Seção de dados associados com links */}
          {(associatedData.client || associatedData.policy || associatedData.company) && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500 mb-2">Associado a:</p>
              <div className="flex flex-wrap gap-2">
                {associatedData.client && (
                  <button
                    onClick={() => handleClientClick(associatedData.client.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-md text-xs hover:bg-blue-100 transition-colors"
                  >
                    <span>Cliente: {associatedData.client.name}</span>
                    <ExternalLink size={12} />
                  </button>
                )}
                
                {associatedData.policy && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-md text-xs">
                    <span>
                      Apólice: {associatedData.policy.policyNumber} - {associatedData.policy.ramos?.nome || associatedData.policy.type} ({associatedData.policy.insuranceCompany})
                    </span>
                  </div>
                )}
                
                {associatedData.company && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-gray-50 text-gray-700 rounded-md text-xs">
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
