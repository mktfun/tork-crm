import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Calendar, Building2, Car, Home, Heart, Briefcase, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Policy {
  id: string;
  insured_asset: string | null;
  expiration_date: string;
  start_date: string | null;
  status: string;
  premium_value: number;
  policy_number: string | null;
  insurance_company: string | null;
  type: string | null;
}

interface Company {
  id: string;
  name: string;
}

export default function PortalPolicies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const clientData = sessionStorage.getItem('portal_client');
    if (clientData) {
      const client = JSON.parse(clientData);
      fetchData(client.id, client.user_id);
    }
  }, []);

  const fetchData = async (clientId: string, userId: string) => {
    try {
      // Fetch policies
      const { data: policiesData, error: policiesError } = await supabase
        .from('apolices')
        .select('id, insured_asset, expiration_date, start_date, status, premium_value, policy_number, insurance_company, type')
        .eq('client_id', clientId)
        .order('expiration_date', { ascending: false });

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

  const getTypeIcon = (type: string | null) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('auto') || t.includes('carro')) return <Car className="w-5 h-5" />;
    if (t.includes('resid') || t.includes('casa')) return <Home className="w-5 h-5" />;
    if (t.includes('vida') || t.includes('saúde') || t.includes('saude')) return <Heart className="w-5 h-5" />;
    if (t.includes('empres')) return <Briefcase className="w-5 h-5" />;
    return <Shield className="w-5 h-5" />;
  };

  const getStatusBadge = (status: string, expirationDate: string) => {
    const days = differenceInDays(new Date(expirationDate), new Date());
    
    if (status.toLowerCase() === 'cancelada') {
      return <Badge variant="destructive">Cancelada</Badge>;
    }
    
    if (days < 0) {
      return <Badge variant="destructive">Vencida</Badge>;
    } else if (days <= 30) {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Vence em {days}d</Badge>;
    } else {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativa</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-slate-700" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full bg-slate-700" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Meus Seguros</h2>

      {policies.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">Nenhum seguro encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {policies.map((policy) => (
            <Card key={policy.id} className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 flex-shrink-0">
                    {getTypeIcon(policy.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-white truncate">
                        {policy.insured_asset || policy.type || 'Apólice'}
                      </h3>
                      {getStatusBadge(policy.status, policy.expiration_date)}
                    </div>
                    
                    {policy.policy_number && (
                      <p className="text-sm text-slate-400 mt-1">
                        Nº {policy.policy_number}
                      </p>
                    )}
                    
                    {policy.insurance_company && companies[policy.insurance_company] && (
                      <div className="flex items-center gap-1 text-sm text-slate-400 mt-1">
                        <Building2 className="w-3 h-3" />
                        <span>{companies[policy.insurance_company]}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {policy.start_date && format(new Date(policy.start_date), 'dd/MM/yy', { locale: ptBR })}
                          {' → '}
                          {format(new Date(policy.expiration_date), 'dd/MM/yy', { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
