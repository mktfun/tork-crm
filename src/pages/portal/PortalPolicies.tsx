import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Calendar, Building2, Car, Home, Heart, Briefcase, AlertCircle, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PolicyDetailModal } from '@/components/portal/PolicyDetailModal';

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
  pdf_attached_data: string | null;
  pdf_url: string | null;
  ramo_id: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface PortalConfig {
  canViewPdf: boolean;
  canDownloadPdf: boolean;
}

interface ClientData {
  id: string;
  name: string;
  cpf_cnpj: string | null;
  email: string | null;
  user_id: string;
}

export default function PortalPolicies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [portalConfig, setPortalConfig] = useState<PortalConfig>({ canViewPdf: true, canDownloadPdf: true });

  useEffect(() => {
    const storedClient = sessionStorage.getItem('portal_client');
    if (storedClient) {
      const client: ClientData = JSON.parse(storedClient);
      setClientData(client);
      // Busca híbrida: client_id + CPF + email
      fetchDataHybrid(client);
      fetchPortalConfig(client.user_id);
    }
  }, []);

  const fetchPortalConfig = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('brokerages')
        .select('portal_allow_policy_download')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (data) {
        setPortalConfig({
          canViewPdf: true, // Sempre pode ver se tem acesso ao portal
          canDownloadPdf: data.portal_allow_policy_download ?? true,
        });
      }
    } catch (err) {
      console.error('Error fetching portal config:', err);
    }
  };

  // BUSCA HÍBRIDA: client_id + CPF + email (resolve problema de clientes sem CPF)
  const fetchDataHybrid = async (client: ClientData) => {
    try {
      const { data: policiesData, error: policiesError } = await supabase
        .rpc('get_portal_policies_hybrid' as any, {
          p_user_id: client.user_id,
          p_client_id: client.id,
          p_cpf: client.cpf_cnpj || null,
          p_email: client.email || null
        });

      if (policiesError) {
        console.error('Error fetching policies hybrid:', policiesError);
        return;
      }

      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', client.user_id);

      const companiesMap: Record<string, string> = {};
      companiesData?.forEach((c: Company) => {
        companiesMap[c.id] = c.name;
      });

      setCompanies(companiesMap);
      setPolicies((policiesData as Policy[]) || []);
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
      return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Cancelada</Badge>;
    }
    if (days < 0) {
      return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Vencida</Badge>;
    } else if (days <= 30) {
      return <Badge className="bg-zinc-400/10 text-zinc-300 border-zinc-400/20">Vence em {days}d</Badge>;
    } else {
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Ativa</Badge>;
    }
  };

  const handlePolicyClick = (policy: Policy) => {
    setSelectedPolicy(policy);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full bg-zinc-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-light text-white tracking-wide">Meus Seguros</h2>

      {policies.length === 0 ? (
        <Card className="bg-black/70 border-white/[0.06] backdrop-blur-2xl">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 font-light">Nenhum seguro encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {policies.map((policy) => (
            <Card 
              key={policy.id} 
              className="bg-black/70 border-white/[0.06] backdrop-blur-2xl cursor-pointer hover:bg-zinc-900/50 transition-colors"
              onClick={() => handlePolicyClick(policy)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-zinc-800/80 rounded-lg flex items-center justify-center text-zinc-400 flex-shrink-0 border border-white/[0.06]">
                    {getTypeIcon(policy.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-light text-white truncate">
                        {policy.insured_asset || policy.type || 'Apólice'}
                      </h3>
                      {getStatusBadge(policy.status, policy.expiration_date)}
                    </div>
                    
                    {policy.policy_number && (
                      <p className="text-sm text-zinc-500 mt-1">Nº {policy.policy_number}</p>
                    )}
                    
                    {policy.insurance_company && companies[policy.insurance_company] && (
                      <div className="flex items-center gap-1 text-sm text-zinc-500 mt-1">
                        <Building2 className="w-3 h-3" />
                        <span>{companies[policy.insurance_company]}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-zinc-600">
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
                  <ChevronRight className="w-5 h-5 text-zinc-600 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Detalhes */}
      {clientData && (
        <PolicyDetailModal
          policy={selectedPolicy}
          isOpen={!!selectedPolicy}
          onClose={() => setSelectedPolicy(null)}
          clientName={clientData.name}
          clientCpf={clientData.cpf_cnpj}
          clientId={clientData.id}
          userId={clientData.user_id}
          companyName={selectedPolicy?.insurance_company ? companies[selectedPolicy.insurance_company] || null : null}
          canViewPdf={portalConfig.canViewPdf}
          canDownloadPdf={portalConfig.canDownloadPdf}
        />
      )}
    </div>
  );
}
