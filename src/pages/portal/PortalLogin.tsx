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
  message?: string;
  first_access?: boolean;
  client?: {
    id: string;
    name: string;
    cpf_cnpj: string | null;
    email: string | null;
    phone: string | null;
    user_id: string;
    portal_first_access: boolean;
    portal_password: string;
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
      const { data, error: rpcError } = await supabase.rpc('verify_portal_login_scoped', {
        p_slug: brokerageSlug,
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
        setError(response?.message || 'Credenciais inválidas');
        setIsLoading(false);
        return;
      }

      // Save client and brokerage data to session
      sessionStorage.setItem('portal_client', JSON.stringify(response.client));
      sessionStorage.setItem('portal_brokerage_slug', brokerageSlug);
      if (response.brokerage) {
        sessionStorage.setItem('portal_brokerage', JSON.stringify(response.brokerage));
      }
      
      if (response.first_access) {
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

  // Loading state
  if (isLoadingBrokerage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
          <p className="text-zinc-500 tracking-wide">Carregando...</p>
        </div>
      </div>
    );
  }

  // Invalid brokerage
  if (!isValidBrokerage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
        <Card className="w-full max-w-md bg-[#0A0A0A] border-white/5 backdrop-blur-xl shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-zinc-600" />
            </div>
            <h2 className="text-xl text-white font-light mb-2">Portal não encontrado</h2>
            <p className="text-zinc-500">
              O portal solicitado não existe ou não está disponível.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
      {/* Subtle radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/20 via-transparent to-transparent pointer-events-none" />
      
      <Card className="relative w-full max-w-md bg-[#0A0A0A] border-white/5 backdrop-blur-xl shadow-2xl">
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
              <h1 className="text-3xl font-light tracking-wide text-white">
                {brokerage?.name || 'Portal do Segurado'}
              </h1>
            )}
            <p className="text-zinc-500 text-sm tracking-wide">
              Acesse suas apólices e informações
            </p>
          </div>

          {/* Login Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-zinc-400 text-sm font-light">CPF ou Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Digite seu CPF ou nome completo"
                  value={identifier}
                  onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                  onKeyPress={handleKeyPress}
                  className="bg-zinc-950/50 border-white/10 text-white placeholder:text-zinc-600 pl-10 focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-12"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-400 text-sm font-light">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onKeyPress={handleKeyPress}
                  className="bg-zinc-950/50 border-white/10 text-white placeholder:text-zinc-600 pl-10 focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-12"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <Button 
              onClick={handleLogin} 
              className="w-full bg-white text-black font-medium hover:bg-zinc-200 h-12 text-base tracking-wide transition-all"
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

            <div className="text-center pt-4 border-t border-white/5">
              <p className="text-zinc-500 text-sm font-light">
                Primeiro acesso? Use a senha <span className="text-[#D4AF37] font-medium">123456</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
