import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function PortalLogin() {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Mask CPF as user types
  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
    }
    return value;
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCpf(e.target.value));
    setError('');
  };

  const handleLogin = async () => {
    if (!cpf || !password) {
      setError('Preencha o CPF e a senha');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Normalize CPF (remove formatting)
      const normalizedCpf = cpf.replace(/\D/g, '');

      // Search for client by CPF
      const { data: clients, error: fetchError } = await supabase
        .from('clientes')
        .select('id, name, cpf_cnpj, portal_password, portal_first_access, user_id')
        .ilike('cpf_cnpj', `%${normalizedCpf}%`)
        .limit(1);

      if (fetchError) {
        console.error('Error fetching client:', fetchError);
        setError('Erro ao buscar cliente');
        return;
      }

      if (!clients || clients.length === 0) {
        setError('CPF não encontrado');
        return;
      }

      const client = clients[0];

      // Check if it's first access (default password: 123456)
      if (client.portal_first_access && password === '123456') {
        // Save temporary session and redirect to change password
        sessionStorage.setItem('portal_client', JSON.stringify(client));
        toast.success('Primeiro acesso! Por favor, crie uma nova senha.');
        navigate('/portal/change-password');
        return;
      }

      // Verify password (simple comparison for MVP)
      // In production, use bcrypt or similar
      if (client.portal_password !== password) {
        setError('Senha incorreta');
        return;
      }

      // Login successful
      sessionStorage.setItem('portal_client', JSON.stringify(client));
      toast.success(`Bem-vindo, ${client.name?.split(' ')[0]}!`);
      navigate('/portal/home');
      
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
        <CardHeader className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl text-white">Portal do Segurado</CardTitle>
          <CardDescription className="text-slate-400">
            Acesse suas apólices e carteirinhas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cpf" className="text-slate-300">CPF</Label>
            <Input
              id="cpf"
              type="text"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={handleCpfChange}
              onKeyPress={handleKeyPress}
              maxLength={14}
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyPress={handleKeyPress}
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <Button 
            onClick={handleLogin} 
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
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

          <p className="text-slate-500 text-xs text-center">
            Primeiro acesso? Use a senha: <span className="text-slate-400 font-mono">123456</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
