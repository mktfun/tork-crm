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
      // Fetch active policies
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

      // Fetch companies for names
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

  const getCardGradient = (index: number) => {
    const gradients = [
      'from-purple-600 to-blue-600',
      'from-emerald-600 to-teal-600',
      'from-orange-600 to-red-600',
      'from-pink-600 to-purple-600',
      'from-blue-600 to-cyan-600',
    ];
    return gradients[index % gradients.length];
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-slate-700" />
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-48 w-full bg-slate-700 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Minhas Carteirinhas</h2>

      {policies.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-8 text-center">
            <CreditCard className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">Nenhuma carteirinha disponível.</p>
            <p className="text-slate-500 text-sm mt-1">
              Suas carteirinhas aparecerão aqui quando houver seguros ativos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {policies.map((policy, index) => (
            <div
              key={policy.id}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getCardGradient(index)} p-5 shadow-lg`}
            >
              {/* Card Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/20" />
                <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-white/10" />
              </div>

              {/* Card Content */}
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-6 h-6 text-white/80" />
                    <span className="font-semibold text-white/90 text-sm">
                      {policy.type || 'Seguro'}
                    </span>
                  </div>
                  <CreditCard className="w-8 h-8 text-white/60" />
                </div>

                {/* Client Name */}
                <div className="mb-4">
                  <p className="text-white/60 text-xs uppercase tracking-wide">Segurado</p>
                  <p className="text-white font-bold text-lg truncate">{clientName}</p>
                </div>

                {/* Policy Number */}
                {policy.policy_number && (
                  <div className="mb-4">
                    <p className="text-white/60 text-xs uppercase tracking-wide">Nº Apólice</p>
                    <p className="text-white font-mono text-sm">{policy.policy_number}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Vigência
                    </p>
                    <p className="text-white text-sm font-medium">
                      {policy.start_date && format(new Date(policy.start_date), 'dd/MM/yy', { locale: ptBR })}
                      {' - '}
                      {format(new Date(policy.expiration_date), 'dd/MM/yy', { locale: ptBR })}
                    </p>
                  </div>
                  
                  {policy.insurance_company && companies[policy.insurance_company] && (
                    <div className="text-right">
                      <p className="text-white/60 text-xs uppercase tracking-wide flex items-center gap-1 justify-end">
                        <Building2 className="w-3 h-3" /> Seguradora
                      </p>
                      <p className="text-white text-sm font-medium truncate max-w-[120px]">
                        {companies[policy.insurance_company]}
                      </p>
                    </div>
                  )}
                </div>

                {/* Assistance Phone */}
                <div className="mt-4 pt-3 border-t border-white/20">
                  <div className="flex items-center gap-2 text-white/80">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm">Assistência 24h: Consulte sua apólice</span>
                  </div>
                </div>

                {/* Insured Asset */}
                {policy.insured_asset && (
                  <div className="mt-2 p-2 bg-white/10 rounded-lg">
                    <p className="text-white/80 text-xs">
                      {policy.insured_asset}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">
                Apresente esta carteirinha digital em caso de sinistro ou quando solicitado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
