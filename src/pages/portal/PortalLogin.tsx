import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, User, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BrokerageData {
  id: number;
  name: string;
  logo_url: string | null;
  slug: string;
}

interface GetBrokerageResponse {
  success: boolean;
  brokerage?: BrokerageData;
  error?: string;
}

interface PortalLoginResponse {
  success: boolean;
  error?: string;
  is_first_access?: boolean;
  client?: {
    id: string;
    name: string;
    cpf_cnpj: string | null;
    email: string | null;
    phone: string | null;
    user_id: string;
  };
  brokerage?: BrokerageData;
}

export default function PortalLogin() {
  const { brokerageSlug } = useParams<{ brokerageSlug: string }>();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBrokerage, setIsLoadingBrokerage] = useState(true);
  const [brokerage, setBrokerage] = useState<BrokerageData | null>(null);
  const [isValidBrokerage, setIsValidBrokerage] = useState(true);
  const navigate = useNavigate();

  // Fetch brokerage data on mount
  useEffect(() => {
    const fetchBrokerage = async () => {
      if (!brokerageSlug) {
        setIsValidBrokerage(false);
        setIsLoadingBrokerage(false);
        return;
      }

      try {
        const { data, error: rpcError } = await supabase.rpc('get_brokerage_by_slug', {
          p_slug: brokerageSlug
        });

        if (rpcError) {
          console.error('Error fetching brokerage:', rpcError);
          setIsValidBrokerage(false);
          setIsLoadingBrokerage(false);
          return;
        }

        const response = data as unknown as GetBrokerageResponse;

        if (response?.success && response?.brokerage) {
          setBrokerage(response.brokerage);
          setIsValidBrokerage(true);
        } else {
          setIsValidBrokerage(false);
        }
      } catch (err) {
        console.error('Error:', err);
        setIsValidBrokerage(false);
      } finally {
        setIsLoadingBrokerage(false);
      }
    };

    fetchBrokerage();
  }, [brokerageSlug]);

  const handleLogin = async () => {
    if (!identifier || !password) {
      setError('Preencha todos os campos');
      return;
    }

    if (!brokerageSlug) {
      setError('Corretora não identificada');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('verify_portal_login_scoped' as any, {
        p_brokerage_slug: brokerageSlug,
        p_identifier: identifier.trim(),
        p_password: password
      });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        setError('Erro ao realizar login');
        setIsLoading(false);
        return;
      }

      const response = data as unknown as PortalLoginResponse;

      if (!response?.success) {
        setError(response?.error || 'Credenciais inválidas');
        setIsLoading(false);
        return;
      }

      // Save client and brokerage data to session
      sessionStorage.setItem('portal_client', JSON.stringify(response.client));
      sessionStorage.setItem('portal_brokerage_slug', brokerageSlug);
      if (response.brokerage) {
        sessionStorage.setItem('portal_brokerage', JSON.stringify(response.brokerage));
      }
      
      if (response.is_first_access) {
        toast.success('Primeiro acesso! Complete seu cadastro.');
        navigate(`/${brokerageSlug}/portal/onboarding`, { replace: true });
      } else {
        toast.success(`Bem-vindo, ${response.client?.name?.split(' ')[0]}!`);
        navigate(`/${brokerageSlug}/portal/home`, { replace: true });
      }

    } catch (err) {
      console.error('Login error:', err);
      setError('Erro ao realizar login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  // Loading state - Black & Silver
  if (isLoadingBrokerage) {
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

  // Invalid brokerage - Black & Silver
  if (!isValidBrokerage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(39,39,42,0.25)_0%,_transparent_55%)]" />
        <Card 
          className="relative w-full max-w-md bg-black/70 backdrop-blur-2xl border border-white/[0.06]"
          style={{ boxShadow: '0 0 60px -15px rgba(255,255,255,0.07)' }}
        >
          <CardContent className="p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-white/[0.06]">
              <Shield className="w-8 h-8 text-zinc-600" />
            </div>
            <h2 className="text-xl text-white font-light tracking-wide mb-2">Portal não encontrado</h2>
            <p className="text-zinc-500 font-light">
              O portal solicitado não existe ou não está disponível.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      {/* Subtle radial gradient - Silver */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(39,39,42,0.25)_0%,_transparent_55%)] pointer-events-none" />
      
      <Card 
        className="relative w-full max-w-md bg-black/70 backdrop-blur-2xl border border-white/[0.06]"
        style={{ boxShadow: '0 0 60px -15px rgba(255,255,255,0.07)' }}
      >
        <CardContent className="p-8 space-y-6">
          {/* Brokerage Logo/Name */}
          <div className="text-center space-y-4">
            {brokerage?.logo_url ? (
              <img 
                src={brokerage.logo_url} 
                alt={brokerage.name} 
                className="h-16 object-contain mx-auto"
              />
            ) : (
              <h1 className="text-3xl font-light tracking-widest text-white">
                {brokerage?.name || 'PORTAL'}
              </h1>
            )}
            <p className="text-zinc-500 text-sm tracking-wide font-light">
              Acesse suas apólices e informações
            </p>
          </div>

          {/* Login Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-zinc-400 text-sm font-light tracking-wide">
                CPF, E-mail ou Nome
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Digite seu CPF, e-mail ou nome"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                  onKeyPress={handleKeyPress}
                  className="bg-black/60 border-zinc-700/50 text-white placeholder:text-zinc-600 pl-10 h-12 rounded-xl focus:border-zinc-400/60 focus:ring-1 focus:ring-zinc-400/20"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-400 text-sm font-light tracking-wide">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onKeyPress={handleKeyPress}
                  className="bg-black/60 border-zinc-700/50 text-white placeholder:text-zinc-600 pl-10 h-12 rounded-xl focus:border-zinc-400/60 focus:ring-1 focus:ring-zinc-400/20"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-red-400 text-sm text-center font-light">{error}</p>
              </div>
            )}

            {/* Silver Metallic Button */}
            <Button 
              onClick={handleLogin} 
              className="w-full h-12 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl text-base tracking-wide transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>

            <div className="text-center pt-4 border-t border-white/[0.06]">
              <p className="text-zinc-500 text-sm font-light">
                Primeiro acesso? Use seu <span className="text-zinc-300">CPF</span> como senha
              </p>
              <p className="text-zinc-600 text-xs mt-1">
                Sem CPF? Use <span className="text-zinc-400">123456</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
