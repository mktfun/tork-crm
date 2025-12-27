import { useState, useMemo } from 'react';
import { Policy } from '@/types';
import { useTransactions, useClients } from '@/hooks/useAppData';
import { AppCard } from '@/components/ui/app-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/utils/dateUtils';

interface CommissionExtractProps {
  policy: Policy;
}

export function CommissionExtract({ policy }: CommissionExtractProps) {
  const [showExtract, setShowExtract] = useState(false);
  const { transactions } = useTransactions();
  const { clients } = useClients();

  // Usar useMemo ao invés de useEffect para evitar loop infinito
  const commissionTransactions = useMemo(() => 
    transactions.filter(t => 
      t.policyId === policy.id && 
      t.nature === 'RECEITA'
    ), 
    [transactions, policy.id]
  );

  const client = clients.find(c => c.id === policy.clientId);
  const totalCommission = policy.premiumValue * (policy.commissionRate / 100);

  if (!showExtract) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowExtract(true)}
        className="flex items-center gap-2"
      >
        <Eye size={16} />
        Ver Extrato de Comissões
      </Button>
    );
  }

  return (
    <AppCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Extrato de Comissões</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowExtract(false)}
        >
          <EyeOff size={16} />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Resumo da Apólice */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
          <div>
            <p className="text-sm text-slate-400">Apólice</p>
            <p className="font-medium text-white">{policy.policyNumber}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Cliente</p>
            <p className="font-medium text-white">{client?.name || 'Cliente não encontrado'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Prêmio</p>
            <p className="font-medium text-green-400">
              {policy.premiumValue.toLocaleString('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
              })}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Taxa (%)</p>
            <p className="font-medium text-white">{policy.commissionRate}%</p>
          </div>
        </div>

        {/* Comissão Total */}
        <div className="p-4 bg-green-500/20 rounded-lg border border-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <h4 className="font-semibold text-green-400">Comissão Total</h4>
          </div>
          <p className="text-2xl font-bold text-green-400">
            {totalCommission.toLocaleString('pt-BR', { 
              style: 'currency', 
              currency: 'BRL' 
            })}
          </p>
        </div>

        {/* Transações de Comissão */}
        <div>
          <h4 className="font-semibold text-white mb-3">Transações no Faturamento</h4>
          {commissionTransactions.length === 0 ? (
            <p className="text-slate-400 text-sm">
              Nenhuma transação de comissão encontrada para esta apólice.
            </p>
          ) : (
            <div className="space-y-2">
              {commissionTransactions.map(transaction => (
                <Link
                  to={`/dashboard/financeiro?legacyId=${transaction.id}`}
                  key={transaction.id}
                  className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/60 transition-colors"
                >
                  <div>
                    <p className="font-medium text-white">{transaction.description}</p>
                    <p className="text-sm text-slate-400">
                      {formatDate(transaction.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-400">
                      {transaction.amount.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </p>
                    <Badge
                      variant={transaction.status === 'PENDENTE' ? 'outline' : 'default'}
                      className={transaction.status === 'PENDENTE' ? 'text-yellow-400 border-yellow-500' : 'text-green-400 border-green-500'}
                    >
                      {transaction.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppCard>
  );
}
