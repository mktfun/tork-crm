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

export default function PortalHome() {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    const clientData = sessionStorage.getItem('portal_client');
    if (clientData) {
      const client = JSON.parse(clientData);
      setClientName(client.name || '');
      fetchPolicies(client.id);
    }
  }, []);

  const fetchPolicies = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('apolices')
        .select('id, insured_asset, expiration_date, status, premium_value, insurance_company')
        .eq('client_id', clientId)
        .in('status', ['Ativa', 'active'])
        .order('expiration_date', { ascending: true });

      if (error) {
        console.error('Error fetching policies:', error);
        return;
      }

      setPolicies(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getExpirationBadge = (expirationDate: string) => {
    const days = differenceInDays(new Date(expirationDate), new Date());
    
    if (days < 0) {
      return <Badge variant="destructive">Vencida</Badge>;
    } else if (days <= 30) {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Vence em {days} dias</Badge>;
    } else {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Vigente</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Welcome Card */}
      <Card className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Bem-vindo(a)!</h2>
              <p className="text-slate-400 text-sm">{clientName}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col items-center gap-2 bg-slate-800/50 border-slate-700 hover:bg-slate-700"
          onClick={() => navigate('/portal/policies')}
        >
          <FileText className="w-6 h-6 text-purple-400" />
          <span className="text-sm text-white">Meus Seguros</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col items-center gap-2 bg-slate-800/50 border-slate-700 hover:bg-slate-700"
          onClick={() => navigate('/portal/cards')}
        >
          <CreditCard className="w-6 h-6 text-blue-400" />
          <span className="text-sm text-white">Carteirinhas</span>
        </Button>
      </div>

      {/* Active Policies */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Seguros Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : policies.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400">Nenhum seguro ativo encontrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {policies.slice(0, 3).map((policy) => (
                <div 
                  key={policy.id} 
                  className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {policy.insured_asset || 'Apólice'}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
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
                  className="w-full text-purple-400 hover:text-purple-300"
                  onClick={() => navigate('/portal/policies')}
                >
                  Ver todos ({policies.length})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-white">Precisa de ajuda?</h3>
              <p className="text-sm text-slate-400 mt-1">
                Entre em contato com sua corretora para dúvidas sobre suas apólices ou sinistros.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
