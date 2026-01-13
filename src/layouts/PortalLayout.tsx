import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, FileText, CreditCard, User, LogOut, Loader2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PortalClient {
  id: string;
  name: string;
  cpf_cnpj: string | null;
  email: string | null;
  portal_password: string | null;
  portal_first_access: boolean;
  user_id: string;
}

interface PortalBrokerage {
  id: number;
  name: string;
  logo_url: string | null;
  slug: string;
}

interface PortalConfig {
  show_policies: boolean;
  show_cards: boolean;
  allow_profile_edit: boolean;
}

interface GetBrokerageResponse {
  success: boolean;
  brokerage?: PortalBrokerage;
}

export function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { brokerageSlug } = useParams<{ brokerageSlug: string }>();
  const [client, setClient] = useState<PortalClient | null>(null);
  const [brokerage, setBrokerage] = useState<PortalBrokerage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [portalConfig, setPortalConfig] = useState<PortalConfig>({
    show_policies: true,
    show_cards: true,
    allow_profile_edit: true,
  });

  useEffect(() => {
    const loadData = async () => {
      const clientData = sessionStorage.getItem('portal_client');
      const storedSlug = sessionStorage.getItem('portal_brokerage_slug');
      const brokerageData = sessionStorage.getItem('portal_brokerage');
      
      if (clientData && storedSlug === brokerageSlug) {
        setClient(JSON.parse(clientData));
        
        // Load brokerage from session or fetch it
        if (brokerageData) {
          setBrokerage(JSON.parse(brokerageData));
        } else if (brokerageSlug) {
          // Fetch brokerage data if not in session
          try {
            const { data } = await supabase.rpc('get_brokerage_by_slug', {
              p_slug: brokerageSlug
            });
            const response = data as unknown as GetBrokerageResponse;
            if (response?.success && response?.brokerage) {
              setBrokerage(response.brokerage);
              sessionStorage.setItem('portal_brokerage', JSON.stringify(response.brokerage));
            }
          } catch (err) {
            console.error('Error fetching brokerage:', err);
          }
        }
      }
      setIsLoading(false);
    };

    loadData();
  }, [brokerageSlug]);

  // Loading state - Black & Silver
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(39,39,42,0.25)_0%,_transparent_55%)]" />
        <div className="relative flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
          <p className="text-zinc-500 tracking-widest text-sm font-light">CARREGANDO</p>
        </div>
      </div>
    );
  }

  // Redirect if not logged in or wrong brokerage
  if (!client) {
    return <Navigate to={`/${brokerageSlug}/portal`} replace />;
  }

  const handleLogout = () => {
    sessionStorage.removeItem('portal_client');
    sessionStorage.removeItem('portal_brokerage_slug');
    sessionStorage.removeItem('portal_brokerage');
    navigate(`/${brokerageSlug}/portal`);
  };

  const isActive = (path: string) => location.pathname === `/${brokerageSlug}/portal/${path}`;

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header - Black & Silver */}
      <header className="bg-black/80 backdrop-blur-2xl border-b border-white/[0.06] p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Brokerage Logo */}
            {brokerage?.logo_url ? (
              <img 
                src={brokerage.logo_url} 
                alt={brokerage.name} 
                className="h-10 object-contain"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/[0.06] flex items-center justify-center">
                <Shield className="w-5 h-5 text-zinc-400" />
              </div>
            )}
            <div>
              <h1 className="text-zinc-200 font-light tracking-wide">
                Olá, {client.name?.split(' ')[0]}
              </h1>
              <p className="text-zinc-600 text-xs tracking-wide">
                {brokerage?.name || 'Portal do Segurado'}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout}
            className="text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="p-4 max-w-lg mx-auto">
        <Outlet />
      </main>
      
      {/* Bottom Navigation - Black & Silver */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-2xl border-t border-white/[0.06] safe-area-pb">
        <div className="max-w-lg mx-auto flex justify-around py-3">
          <Button 
            variant="ghost" 
            className={`flex flex-col items-center gap-1 h-auto py-2 px-4 ${
              isActive('home') 
                ? 'text-zinc-100' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            onClick={() => navigate(`/${brokerageSlug}/portal/home`)}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs tracking-wide">Início</span>
          </Button>
          
          {portalConfig.show_policies && (
            <Button 
              variant="ghost" 
              className={`flex flex-col items-center gap-1 h-auto py-2 px-4 ${
                isActive('policies') 
                  ? 'text-zinc-100' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => navigate(`/${brokerageSlug}/portal/policies`)}
            >
              <FileText className="w-5 h-5" />
              <span className="text-xs tracking-wide">Seguros</span>
            </Button>
          )}
          
          {portalConfig.show_cards && (
            <Button 
              variant="ghost" 
              className={`flex flex-col items-center gap-1 h-auto py-2 px-4 ${
                isActive('cards') 
                  ? 'text-zinc-100' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => navigate(`/${brokerageSlug}/portal/cards`)}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-xs tracking-wide">Carteirinhas</span>
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            className={`flex flex-col items-center gap-1 h-auto py-2 px-4 ${
              isActive('profile') 
                ? 'text-zinc-100' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            onClick={() => navigate(`/${brokerageSlug}/portal/profile`)}
          >
            <User className="w-5 h-5" />
            <span className="text-xs tracking-wide">Perfil</span>
          </Button>
        </div>
      </nav>
    </div>
  );
}
