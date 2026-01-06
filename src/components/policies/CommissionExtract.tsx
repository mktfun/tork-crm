import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Policy } from '@/types';
import { useTransactions, useClients } from '@/hooks/useAppData';
import { supabase } from '@/integrations/supabase/client';
import { AppCard } from '@/components/ui/app-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Eye, EyeOff, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/utils/dateUtils';
import { toast } from 'sonner';

interface CommissionExtractProps {
  policy: Policy;
}

type CommissionItem = {
  id: string;
  description: string;
  date: string;
  amount: number;
  status: string;
  source: 'legacy' | 'erp';
};

export function CommissionExtract({ policy }: CommissionExtractProps) {
  const [showExtract, setShowExtract] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { transactions } = useTransactions();
  const { clients } = useClients();
  const queryClient = useQueryClient();

  // Comissões da tabela legada
  const legacyCommissions = useMemo(() => 
    transactions.filter(t => 
      t.policyId === policy.id && 
      t.nature === 'RECEITA'
    ), 
    [transactions, policy.id]
  );

  // 🆕 Função para gerar comissão manualmente
  const handleGenerateCommission = async () => {
    setGenerating(true);
    try {
      const client = clients.find(c => c.id === policy.clientId);
      const commissionAmount = policy.premiumValue * (policy.commissionRate / 100);

      const { data, error } = await supabase.rpc('register_policy_commission', {
        p_policy_id: policy.id, // TEXT - a RPC faz o cast
        p_client_name: client?.name || 'Cliente',
        p_ramo_name: policy.type || 'Seguro',
        p_policy_number: policy.policyNumber || '',
        p_commission_amount: commissionAmount,
        p_transaction_date: policy.startDate || new Date().toISOString().split('T')[0],
        p_status: 'pending'
      });

      if (error) throw error;

      const result = data?.[0];
      if (result?.success) {
        toast.success('Comissão gerada com sucesso!', {
          description: `Referência: ${result.reference_number}`
        });
        // Invalida cache para recarregar
        queryClient.invalidateQueries({ queryKey: ['erp-commissions', policy.id] });
      } else {
        toast.error('Erro ao gerar comissão');
      }
    } catch (error: any) {
      console.error('Erro ao gerar comissão:', error);
      toast.error('Erro ao gerar comissão', {
        description: error.message || 'Tente novamente'
      });
    } finally {
      setGenerating(false);
    }
  };

  // 🆕 Query para buscar comissões do ERP moderno
  const { data: erpCommissions = [] } = useQuery({
    queryKey: ['erp-commissions', policy.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select(`
          id,
          description,
          transaction_date,
          reference_number,
          is_void,
          financial_ledger (
            amount,
            account_id
          )
        `)
        .eq('related_entity_id', policy.id)
        .eq('related_entity_type', 'policy')
        .eq('is_void', false);

      if (error) {
        console.error('Erro ao buscar comissões ERP:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!policy.id && showExtract
  });

  // Combinar e deduplificar comissões
  const allCommissions = useMemo((): CommissionItem[] => {
    const legacy: CommissionItem[] = legacyCommissions.map(t => ({
      id: t.id,
      description: t.description,
      date: t.date,
      amount: t.amount,
      status: t.status,
      source: 'legacy' as const
    }));

    const erp: CommissionItem[] = erpCommissions.map((t: any) => {
      // Pegar o valor do primeiro lançamento positivo (débito em ativo)
      const debitEntry = t.financial_ledger?.find((e: any) => e.amount > 0);
      return {
        id: t.id,
        description: t.description,
        date: t.transaction_date,
        amount: Math.abs(debitEntry?.amount || 0),
        status: 'pending', // ERP usa status diferente
        source: 'erp' as const
      };
    });

    // Deduplificar: se existe no ERP, preferir ERP
    const erpIds = new Set(erp.map(e => e.id));
    const uniqueLegacy = legacy.filter(l => {
      // Verificar se já existe uma comissão ERP para mesma apólice
      // Comparar por descrição similar
      return !erp.some(e => e.description.includes(policy.policyNumber || ''));
    });

    return [...erp, ...uniqueLegacy];
  }, [legacyCommissions, erpCommissions, policy.policyNumber]);

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
        <h3 className="text-lg font-semibold text-foreground">Extrato de Comissões</h3>
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
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Apólice</p>
            <p className="font-medium text-foreground">{policy.policyNumber}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-medium text-foreground">{client?.name || 'Cliente não encontrado'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Prêmio</p>
            <p className="font-medium text-green-500">
              {policy.premiumValue.toLocaleString('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
              })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Taxa (%)</p>
            <p className="font-medium text-foreground">{policy.commissionRate}%</p>
          </div>
        </div>

        {/* Comissão Total */}
        <div className="p-4 bg-green-500/20 rounded-lg border border-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            <h4 className="font-semibold text-green-500">Comissão Total</h4>
          </div>
          <p className="text-2xl font-bold text-green-500">
            {totalCommission.toLocaleString('pt-BR', { 
              style: 'currency', 
              currency: 'BRL' 
            })}
          </p>
        </div>

        {/* Transações de Comissão */}
        <div>
          <h4 className="font-semibold text-foreground mb-3">Transações no Faturamento</h4>
          {allCommissions.length === 0 ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Nenhuma transação de comissão encontrada para esta apólice.
              </p>
              {policy.status === 'Ativa' && (
                <Button
                  onClick={handleGenerateCommission}
                  disabled={generating}
                  className="gap-2"
                  variant="default"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {generating ? 'Gerando...' : '✨ Gerar Comissão Financeira'}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {allCommissions.map(commission => (
                <Link
                  to={
                    commission.source === 'erp' 
                      ? `/dashboard/financeiro?txnId=${commission.id}`
                      : `/dashboard/financeiro?legacyId=${commission.id}`
                  }
                  key={`${commission.source}-${commission.id}`}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/60 transition-colors group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{commission.description}</p>
                      {commission.source === 'erp' && (
                        <Badge variant="outline" className="text-xs">
                          ERP
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(commission.date)}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="font-bold text-green-500">
                        {commission.amount.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        })}
                      </p>
                      <Badge
                        variant={commission.status === 'PENDENTE' || commission.status === 'pending' ? 'outline' : 'default'}
                        className={
                          commission.status === 'PENDENTE' || commission.status === 'pending'
                            ? 'text-yellow-500 border-yellow-500' 
                            : 'text-green-500 border-green-500'
                        }
                      >
                        {commission.status === 'pending' ? 'PENDENTE' : commission.status}
                      </Badge>
                    </div>
                    <ExternalLink size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
