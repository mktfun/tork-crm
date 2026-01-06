import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, Phone, Calendar, Shield, AlertCircle, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Policy {
  id: string;
  insured_asset: string | null;
  expiration_date: string;
  start_date: string | null;
  policy_number: string | null;
  insurance_company: string | null;
  type: string | null;
  status: string;
}

interface Company {
  id: string;
  name: string;
}

export default function PortalCards() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [clientName, setClientName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const clientData = sessionStorage.getItem('portal_client');
    if (clientData) {
      const client = JSON.parse(clientData);
      setClientName(client.name || '');
      fetchData(client.id, client.user_id);
    }
  }, []);

  const fetchData = async (clientId: string, userId: string) => {
    try {
      const { data: policiesData, error: policiesError } = await supabase
        .from('apolices')
        .select('id, insured_asset, expiration_date, start_date, policy_number, insurance_company, type, status')
        .eq('client_id', clientId)
        .in('status', ['Ativa', 'active'])
        .order('expiration_date', { ascending: true });

      if (policiesError) {
        console.error('Error fetching policies:', policiesError);
        return;
      }

      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', userId);

      const companiesMap: Record<string, string> = {};
      companiesData?.forEach((c: Company) => {
        companiesMap[c.id] = c.name;
      });

      setCompanies(companiesMap);
      setPolicies(policiesData || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-48 w-full bg-zinc-800 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-light text-white tracking-wide">Minhas Carteirinhas</h2>

      {policies.length === 0 ? (
        <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-xl">
          <CardContent className="p-8 text-center">
            <CreditCard className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">Nenhuma carteirinha disponível.</p>
            <p className="text-zinc-600 text-sm mt-1">
              Suas carteirinhas aparecerão aqui quando houver seguros ativos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-5 shadow-2xl border border-white/5"
            >
              {/* Card Background Pattern */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-yellow-600/30" />
                <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-yellow-600/20" />
              </div>

              {/* Card Content */}
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-6 h-6 text-yellow-600" />
                    <span className="font-light text-white/90 text-sm">
                      {policy.type || 'Seguro'}
                    </span>
                  </div>
                  <CreditCard className="w-8 h-8 text-yellow-600/40" />
                </div>

                <div className="mb-4">
                  <p className="text-zinc-500 text-xs uppercase tracking-wide">Segurado</p>
                  <p className="text-white font-medium text-lg truncate">{clientName}</p>
                </div>

                {policy.policy_number && (
                  <div className="mb-4">
                    <p className="text-zinc-500 text-xs uppercase tracking-wide">Nº Apólice</p>
                    <p className="text-white font-mono text-sm">{policy.policy_number}</p>
                  </div>
                )}

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Vigência
                    </p>
                    <p className="text-white text-sm font-light">
                      {policy.start_date && format(new Date(policy.start_date), 'dd/MM/yy', { locale: ptBR })}
                      {' - '}
                      {format(new Date(policy.expiration_date), 'dd/MM/yy', { locale: ptBR })}
                    </p>
                  </div>
                  
                  {policy.insurance_company && companies[policy.insurance_company] && (
                    <div className="text-right">
                      <p className="text-zinc-500 text-xs uppercase tracking-wide flex items-center gap-1 justify-end">
                        <Building2 className="w-3 h-3" /> Seguradora
                      </p>
                      <p className="text-white text-sm font-light truncate max-w-[120px]">
                        {companies[policy.insurance_company]}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm font-light">Assistência 24h: Consulte sua apólice</span>
                  </div>
                </div>

                {policy.insured_asset && (
                  <div className="mt-2 p-2 bg-white/5 rounded-lg border border-white/5">
                    <p className="text-zinc-400 text-xs">{policy.insured_asset}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Card className="bg-zinc-900/40 border-white/5 backdrop-blur-xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/5">
              <AlertCircle className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-500">
              Apresente esta carteirinha digital em caso de sinistro ou quando solicitado.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
