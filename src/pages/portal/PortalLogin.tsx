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
      // Chamar RPC segura (bypassa RLS)
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

      // Login bem-sucedido
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-2xl text-white">Portal do Segurado</CardTitle>
            <CardDescription className="text-slate-400">
              Acesse suas apólices e informações
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier" className="text-slate-300">CPF ou Nome</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="identifier"
                type="text"
                placeholder="Digite seu CPF ou nome completo"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                onKeyPress={handleKeyPress}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pl-10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                onKeyPress={handleKeyPress}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pl-10"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <Button 
            onClick={handleLogin} 
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
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

          <div className="text-center pt-4 border-t border-slate-700">
            <p className="text-slate-400 text-sm">
              Primeiro acesso? Use a senha <strong className="text-purple-400">123456</strong>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
