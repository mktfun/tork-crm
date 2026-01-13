import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, FileText, CreditCard, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Policy {
  id: string;
  insured_asset: string | null;
  expiration_date: string;
  status: string;
  premium_value: number;
  insurance_company: string | null;
}

interface PortalConfig {
  show_policies: boolean;
  show_cards: boolean;
  allow_profile_edit: boolean;
}

interface ClientData {
  id: string;
  name: string;
  cpf_cnpj: string | null;
  email: string | null;
  user_id: string;
}

export default function PortalHome() {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [slug, setSlug] = useState('');
  const [portalConfig, setPortalConfig] = useState<PortalConfig>({
    show_policies: true,
    show_cards: true,
    allow_profile_edit: true,
  });

  useEffect(() => {
    const clientData = sessionStorage.getItem('portal_client');
    const storedSlug = sessionStorage.getItem('portal_brokerage_slug');
    
    if (clientData && storedSlug) {
      const client: ClientData = JSON.parse(clientData);
      setClientName(client.name || '');
      setSlug(storedSlug);
      // Busca híbrida: client_id + CPF + email
      fetchPoliciesHybrid(client);
      fetchPortalConfig(client.user_id);
    }
  }, []);

  // BUSCA HÍBRIDA: client_id + CPF + email (resolve problema de clientes sem CPF)
  const fetchPoliciesHybrid = async (client: ClientData) => {
    try {
      const { data, error } = await supabase
        .rpc('get_portal_policies_hybrid' as any, {
          p_user_id: client.user_id,
          p_client_id: client.id,
          p_cpf: client.cpf_cnpj || null,
          p_email: client.email || null
        });

      if (error) {
        console.error('Error fetching policies hybrid:', error);
        return;
      }

      setPolicies((data as Policy[]) || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPortalConfig = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('brokerages')
        .select('portal_show_policies, portal_show_cards, portal_allow_profile_edit')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (data) {
        setPortalConfig({
          show_policies: data.portal_show_policies ?? true,
          show_cards: data.portal_show_cards ?? true,
          allow_profile_edit: data.portal_allow_profile_edit ?? true,
        });
      }
    } catch (err) {
      console.error('Error fetching portal config:', err);
    }
  };

  const getExpirationBadge = (expirationDate: string) => {
    const days = differenceInDays(new Date(expirationDate), new Date());
    
    if (days < 0) {
      return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Vencida</Badge>;
    } else if (days <= 30) {
      return <Badge className="bg-zinc-400/10 text-zinc-300 border-zinc-400/20">Vence em {days} dias</Badge>;
    } else {
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Vigente</Badge>;
    }
  };

  const hasQuickActions = portalConfig.show_policies || portalConfig.show_cards;

  return (
    <div className="space-y-4">
      {/* Welcome Card - Black & Silver */}
      <Card className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 border-white/[0.06]">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center shadow-lg border border-white/[0.06]">
              <Shield className="w-6 h-6 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-white font-light text-lg tracking-wide">Bem-vindo(a)!</h2>
              <p className="text-zinc-500 text-sm">{clientName}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions - Black & Silver */}
      {hasQuickActions && (
        <div className="grid grid-cols-2 gap-3">
          {portalConfig.show_policies && (
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 bg-black/70 border-white/[0.06] hover:bg-zinc-900/50 hover:border-zinc-600/30"
              onClick={() => navigate(`/${slug}/portal/policies`)}
            >
              <FileText className="w-6 h-6 text-zinc-400" />
              <span className="text-sm text-white font-light">Meus Seguros</span>
            </Button>
          )}
          {portalConfig.show_cards && (
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center gap-2 bg-black/70 border-white/[0.06] hover:bg-zinc-900/50 hover:border-zinc-600/30"
              onClick={() => navigate(`/${slug}/portal/cards`)}
            >
              <CreditCard className="w-6 h-6 text-zinc-400" />
              <span className="text-sm text-white font-light">Carteirinhas</span>
            </Button>
          )}
        </div>
      )}

      {/* Active Policies - Black & Silver */}
      <Card className="bg-black/70 border-white/[0.06] backdrop-blur-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white font-light flex items-center gap-2 tracking-wide">
            <Shield className="w-5 h-5 text-zinc-400" />
            Seguros Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
            </div>
          ) : policies.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-500 font-light">Nenhum seguro ativo encontrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {policies.slice(0, 3).map((policy) => (
                <div 
                  key={policy.id} 
                  className="flex justify-between items-center p-3 bg-zinc-900/50 rounded-lg border border-white/[0.06]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-light text-white truncate">
                      {policy.insured_asset || 'Apólice'}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <Calendar className="w-3 h-3" />
                      <span>
                        Vence: {format(new Date(policy.expiration_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  {getExpirationBadge(policy.expiration_date)}
                </div>
              ))}
              
              {policies.length > 3 && (
                <Button 
                  variant="ghost" 
                  className="w-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  onClick={() => navigate(`/${slug}/portal/policies`)}
                >
                  Ver todos ({policies.length})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Card - Black & Silver */}
      <Card className="bg-black/70 border-white/[0.06] backdrop-blur-2xl">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/[0.06]">
              <AlertCircle className="w-5 h-5 text-zinc-500" />
            </div>
            <div>
              <h3 className="font-light text-white">Precisa de ajuda?</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Entre em contato com sua corretora para dúvidas sobre suas apólices ou sinistros.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
