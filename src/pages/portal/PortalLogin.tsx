import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, User, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
}

export default function PortalLogin() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!identifier || !password) {
      setError('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    setError('');

    console.log('🔐 Tentando login via RPC...');

    try {
      const { data, error: rpcError } = await supabase.rpc('verify_portal_login', {
        p_identifier: identifier.trim(),
        p_password: password
      });

      if (rpcError) {
        console.error('Erro RPC:', rpcError);
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

      console.log('✅ Login bem-sucedido:', response.client?.name);
      sessionStorage.setItem('portal_client', JSON.stringify(response.client));
      
      if (response.first_access) {
        toast.success('Primeiro acesso! Complete seu cadastro.');
        setTimeout(() => navigate('/portal/onboarding', { replace: true }), 100);
      } else {
        toast.success(`Bem-vindo, ${response.client?.name?.split(' ')[0]}!`);
        setTimeout(() => navigate('/portal/home', { replace: true }), 100);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-4">
      <Card className="w-full max-w-md bg-zinc-900/40 border-white/5 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-600/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl text-white font-light tracking-wide">Portal do Segurado</CardTitle>
            <CardDescription className="text-zinc-500">
              Acesse suas apólices e informações
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
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
                className="bg-zinc-950/50 border-white/10 text-white placeholder:text-zinc-600 pl-10 focus:border-yellow-600/50 focus:ring-yellow-600/20 h-12"
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
                className="bg-zinc-950/50 border-white/10 text-white placeholder:text-zinc-600 pl-10 focus:border-yellow-600/50 focus:ring-yellow-600/20 h-12"
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
            className="w-full bg-white text-black font-medium hover:bg-zinc-200 h-12 text-base transition-all"
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
              Primeiro acesso? Use a senha <span className="text-yellow-600 font-medium">123456</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
