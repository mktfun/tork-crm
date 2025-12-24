import { AppCard } from '@/components/ui/app-card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { Policy } from '@/types';
import { useCompanyNames } from '@/hooks/useCompanyNames';
import { Link } from 'react-router-dom';
import { formatDate } from '@/utils/dateUtils';

interface ClientPoliciesHistoryProps {
  policies: Policy[];
}

export function ClientPoliciesHistory({ policies }: ClientPoliciesHistoryProps) {
  const { getCompanyName, loading: companiesLoading } = useCompanyNames();

  return (
    <AppCard className="p-6">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <FileText size={20} />
        Histórico de Apólices ({policies.length})
      </h2>
      
      {policies.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-slate-400 mb-4">
            <FileText size={48} className="mx-auto opacity-50" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            Nenhuma apólice encontrada
          </h3>
          <p className="text-slate-300">
            Este cliente ainda não possui apólices cadastradas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {policies.map(policy => (
            <Link
              to={`/dashboard/policies/${policy.id}`}
              key={policy.id}
              className="block border border-slate-700 rounded-lg p-4 bg-slate-800/50 hover:bg-slate-800/80 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-white">{policy.ramos?.nome || policy.type || 'Tipo não informado'}</h4>
                <Badge variant={policy.status === 'Ativa' ? 'default' : 'secondary'}>
                  {policy.status}
                </Badge>
              </div>
              <div className="text-sm text-slate-300 space-y-1">
                <p><span className="font-medium">Apólice:</span> {policy.policyNumber}</p>
                <p><span className="font-medium">Seguradora:</span> {policy.companies?.name || 'Não especificada'}</p>
                {policy.insuredAsset && (
                  <p><span className="font-medium">Bem Segurado:</span> {policy.insuredAsset}</p>
                )}
                {policy.expirationDate && (
                  <p><span className="font-medium">Vencimento:</span> {formatDate(policy.expirationDate)}</p>
                )}
                {policy.premiumValue > 0 && (
                  <p><span className="font-medium">Prêmio:</span> R$ {policy.premiumValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppCard>
  );
}
