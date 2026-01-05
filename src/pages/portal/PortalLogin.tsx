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
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Detect if input is CPF (numeric) or Name (text)
  const isNumericInput = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    // If more than 50% digits and at least 6 chars, treat as CPF
    return digitsOnly.length >= 6 && digitsOnly.length / value.replace(/\s/g, '').length > 0.5;
  };

  const handleLogin = async () => {
    if (!identifier || !password) {
      setError('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    setError('');

    const rawInput = identifier.trim();
    const cleanInput = rawInput.replace(/\D/g, ''); // Numbers only

    console.log('🔐 Tentando login:', { rawInput, cleanInput, isNumeric: cleanInput.length >= 6 });

    try {
      let clients;
      let fetchError;

      if (cleanInput.length >= 6) {
        // CPF Search: Try both with/without punctuation
        // Use OR to match: exact clean, or contains clean digits
        const result = await supabase
          .from('clientes')
          .select('id, name, cpf_cnpj, portal_password, portal_first_access, user_id, email, phone')
          .or(`cpf_cnpj.eq.${cleanInput},cpf_cnpj.ilike.%${cleanInput}%`)
          .limit(5);
        
        clients = result.data;
        fetchError = result.error;
        
        console.log('🔍 Busca por CPF:', { cleanInput, results: clients?.length });
      } else {
        // Name Search: Case-insensitive partial match
        const result = await supabase
          .from('clientes')
          .select('id, name, cpf_cnpj, portal_password, portal_first_access, user_id, email, phone')
          .ilike('name', `%${rawInput}%`)
          .limit(5);
        
        clients = result.data;
        fetchError = result.error;
        
        console.log('🔍 Busca por Nome:', { rawInput, results: clients?.length });
      }

      if (fetchError) {
        console.error('Error fetching client:', fetchError);
        setError('Erro ao buscar cliente');
        return;
      }

      if (!clients || clients.length === 0) {
        setError('Cliente não encontrado');
        return;
      }

      // If multiple clients found by name, show error
      if (clients.length > 1 && cleanInput.length < 6) {
        setError('Nome duplicado encontrado. Por favor, entre em contato com a corretora ou tente com seu CPF.');
        return;
      }

      const client = clients[0];
      console.log('✅ Cliente encontrado:', client.name);

      // Check if it's first access (default password: 123456)
      if (client.portal_first_access && password === '123456') {
        sessionStorage.setItem('portal_client', JSON.stringify(client));
        toast.success('Primeiro acesso! Complete seu cadastro.');
        setTimeout(() => {
          navigate('/portal/onboarding', { replace: true });
        }, 100);
        return;
      }

      // Verify password
      if (client.portal_password !== password) {
        setError('Senha incorreta');
        return;
      }

      // Login successful
      console.log('✅ Login bem-sucedido para:', client.name);
      sessionStorage.setItem('portal_client', JSON.stringify(client));
      toast.success(`Bem-vindo, ${client.name?.split(' ')[0]}!`);
      
      // Force navigation with timeout for robustness
      setTimeout(() => {
        navigate('/portal/home', { replace: true });
      }, 100);
      
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
            <Label htmlFor="identifier" className="text-slate-300">CPF ou Nome Completo</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="Digite seu CPF ou nome completo"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
              onKeyPress={handleKeyPress}
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