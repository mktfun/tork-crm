import { AppCard } from '@/components/ui/app-card';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';
import { Transaction, TransactionType } from '@/types';
import { Link } from 'react-router-dom';
import { formatDate } from '@/utils/dateUtils';

interface ClientFinancialHistoryProps {
  transactions: Transaction[];
  transactionTypes: TransactionType[];
}

export function ClientFinancialHistory({ transactions, transactionTypes }: ClientFinancialHistoryProps) {
  return (
    <AppCard className="p-6">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <DollarSign size={20} />
        Histórico Financeiro ({transactions.length})
      </h2>
      
      {transactions.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-slate-400 mb-4">
            <DollarSign size={48} className="mx-auto opacity-50" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            Nenhuma transação encontrada
          </h3>
          <p className="text-slate-300">
            Este cliente ainda não possui transações associadas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map(transaction => {
              const transactionType = transactionTypes.find(t => t.id === transaction.typeId);
              return (
                <Link
                  to={`/dashboard/financeiro?transactionId=${transaction.id}`}
                  key={transaction.id}
                  className="block border border-slate-700 rounded-lg p-4 bg-slate-800/50 hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">{transaction.description}</h4>
                    <Badge variant={transaction.status === 'REALIZADO' ? 'default' : 'outline'}>
                      {transaction.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-300 space-y-1">
                    <p><span className="font-medium">Tipo:</span> {transactionType?.name}</p>
                    <p><span className="font-medium">Data:</span> {formatDate(transaction.date)}</p>
                    <p>
                      <span className="font-medium">Valor:</span>
                      <span className={`ml-1 font-bold ${transactionType?.nature === 'GANHO' ? 'text-green-400' : 'text-red-400'}`}>
                        {transactionType?.nature === 'GANHO' ? '+' : '-'}
                        {transaction.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </p>
                  </div>
                </Link>
              );
            })}
        </div>
      )}
    </AppCard>
  );
}
