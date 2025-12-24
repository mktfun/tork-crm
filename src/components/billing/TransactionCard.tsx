
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, History } from 'lucide-react';
import { Transaction } from '@/types';
import { useTransactionTypes } from '@/hooks/useAppData';
import { ModalBaixaParcial } from '@/components/faturamento/ModalBaixaParcial';
import { HistoricoPagamentos } from '@/components/faturamento/HistoricoPagamentos';
import { useState } from 'react';
import { formatDate } from '@/utils/dateUtils';

interface TransactionCardProps {
  transaction: Transaction;
  onMarkAsRealized: (id: string) => void;
}

export function TransactionCard({ transaction, onMarkAsRealized }: TransactionCardProps) {
  const { transactionTypes } = useTransactionTypes();
  const [showHistory, setShowHistory] = useState(false);
  
  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'PREVISTO':
        return <Badge variant="outline" className="text-yellow-400 border-yellow-500/50 bg-yellow-500/10">Previsto</Badge>;
      case 'REALIZADO':
        return <Badge variant="outline" className="text-green-400 border-green-500/50 bg-green-500/10">Realizado</Badge>;
      case 'PENDENTE':
        return <Badge variant="outline" className="text-orange-400 border-orange-500/50 bg-orange-500/10">Pendente</Badge>;
      case 'PAGO':
        return <Badge variant="outline" className="text-green-400 border-green-500/50 bg-green-500/10">Pago</Badge>;
      case 'PARCIALMENTE_PAGO':
        return <Badge variant="outline" className="text-blue-400 border-blue-500/50 bg-blue-500/10">Parcialmente Pago</Badge>;
      case 'ATRASADO':
        return <Badge variant="outline" className="text-red-400 border-red-500/50 bg-red-500/10">Atrasado</Badge>;
      case 'CANCELADO':
        return <Badge variant="outline" className="text-gray-400 border-gray-500/50 bg-gray-500/10">Cancelado</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-400 border-gray-500/50 bg-gray-500/10">Desconhecido</Badge>;
    }
  };

  const getTransactionType = () => {
    const type = transactionTypes.find(t => t.id === transaction.typeId);
    return type ? type.name : 'Não informado';
  };

  const getTypeColor = () => {
    const type = transactionTypes.find(t => t.id === transaction.typeId);
    if (!type) return 'text-white/60';
    
    return type.nature === 'GANHO' ? 'text-green-400' : 'text-red-400';
  };

  const canMakePartialPayment = () => {
    return ['PENDENTE', 'PARCIALMENTE_PAGO'].includes(transaction.status);
  };

  const canMarkAsRealized = () => {
    return transaction.status === 'PREVISTO';
  };

  const hasPaymentHistory = () => {
    return transaction.status === 'PARCIALMENTE_PAGO' || transaction.status === 'PAGO';
  };

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-white">{transaction.description}</h3>
            {getStatusBadge(transaction.status)}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-white/60">Tipo</p>
              <p className={`font-medium ${getTypeColor()}`}>
                {getTransactionType()}
              </p>
            </div>
            <div>
              <p className="text-white/60">Valor</p>
              <p className="font-medium text-white">
                {transaction.amount.toLocaleString('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                })}
              </p>
            </div>
            <div>
              <p className="text-white/60">Vencimento</p>
              <p className="font-medium text-white">
                {formatDate(transaction.dueDate)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="ml-4 flex items-center gap-2">
          {hasPaymentHistory() && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={(e) => {
                e.stopPropagation();
                setShowHistory(true);
              }}
              className="flex items-center gap-2 border-white/20 text-white hover:bg-white/10"
            >
              <History size={14} />
              Histórico
            </Button>
          )}
          
          {canMakePartialPayment() && (
            <ModalBaixaParcial 
              transaction={transaction}
              onSuccess={() => {
                // O refetch será automatico devido ao React Query
              }}
            />
          )}
          
          {canMarkAsRealized() && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRealized(transaction.id);
              }}
              className="flex items-center gap-2 border-white/20 text-white hover:bg-white/10"
            >
              <Check size={14} />
              Marcar como Realizado
            </Button>
          )}
        </div>
      </div>

      {/* Modal de Histórico de Pagamentos */}
      {showHistory && (
        <HistoricoPagamentos 
          transaction={transaction}
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </GlassCard>
  );
}
