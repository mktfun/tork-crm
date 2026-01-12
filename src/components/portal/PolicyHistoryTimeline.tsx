import React, { useState, useEffect } from 'react';
import { Check, Clock, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface PolicyHistoryTimelineProps {
  clientId: string;
  ramoId: string | null;
  currentPolicyId: string;
  userId: string;
}

interface HistoryPolicy {
  id: string;
  policy_number: string | null;
  start_date: string | null;
  expiration_date: string;
  status: string;
}

export function PolicyHistoryTimeline({
  clientId,
  ramoId,
  currentPolicyId,
  userId,
}: PolicyHistoryTimelineProps) {
  const [policies, setPolicies] = useState<HistoryPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!ramoId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('apolices')
          .select('id, policy_number, start_date, expiration_date, status')
          .eq('client_id', clientId)
          .eq('ramo_id', ramoId)
          .eq('user_id', userId)
          .order('start_date', { ascending: false });

        if (error) {
          console.error('Error fetching policy history:', error);
          return;
        }

        setPolicies(data || []);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [clientId, ramoId, userId]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32 bg-zinc-800" />
        <Skeleton className="h-16 w-full bg-zinc-800" />
        <Skeleton className="h-16 w-full bg-zinc-800" />
      </div>
    );
  }

  if (policies.length <= 1) {
    return null; // Não mostrar se só tem a apólice atual
  }

  // Calcular tempo como cliente
  const oldestPolicy = policies[policies.length - 1];
  const oldestDate = oldestPolicy.start_date
    ? new Date(oldestPolicy.start_date)
    : new Date(oldestPolicy.expiration_date);
  const yearsAsClient = differenceInYears(new Date(), oldestDate);

  const getStatusIcon = (status: string, isCurrent: boolean) => {
    if (isCurrent) {
      return <Clock className="w-4 h-4 text-[#D4AF37]" />;
    }
    if (status.toLowerCase() === 'cancelada') {
      return <XCircle className="w-4 h-4 text-red-400" />;
    }
    return <Check className="w-4 h-4 text-emerald-400" />;
  };

  const getStatusColor = (status: string, isCurrent: boolean) => {
    if (isCurrent) return 'border-[#D4AF37] bg-[#D4AF37]/10';
    if (status.toLowerCase() === 'cancelada') return 'border-red-500/20 bg-red-500/5';
    return 'border-emerald-500/20 bg-emerald-500/5';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-[#D4AF37]" />
        <h4 className="text-white font-medium">Histórico de Renovações</h4>
        {yearsAsClient > 0 && (
          <span className="text-xs bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded-full border border-[#D4AF37]/20">
            Cliente há {yearsAsClient} {yearsAsClient === 1 ? 'ano' : 'anos'}
          </span>
        )}
      </div>

      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-4 top-6 bottom-6 w-px bg-zinc-700" />

        {/* Timeline Items */}
        <div className="space-y-3">
          {policies.map((policy, index) => {
            const isCurrent = policy.id === currentPolicyId;
            return (
              <div
                key={policy.id}
                className={`relative pl-10 py-3 px-4 rounded-lg border ${getStatusColor(policy.status, isCurrent)}`}
              >
                {/* Timeline Dot */}
                <div
                  className={`absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isCurrent
                      ? 'border-[#D4AF37] bg-zinc-900'
                      : policy.status.toLowerCase() === 'cancelada'
                      ? 'border-red-400 bg-zinc-900'
                      : 'border-emerald-400 bg-zinc-900'
                  }`}
                >
                  {getStatusIcon(policy.status, isCurrent)}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {isCurrent ? 'Apólice Atual' : `Renovação ${policies.length - index}`}
                    </p>
                    <p className="text-zinc-500 text-xs">
                      {policy.policy_number || 'Sem número'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-400 text-xs">
                      {policy.start_date
                        ? format(new Date(policy.start_date), 'MMM/yyyy', { locale: ptBR })
                        : '---'}
                      {' - '}
                      {format(new Date(policy.expiration_date), 'MMM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
