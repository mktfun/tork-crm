import { useEffect, useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppCard } from '@/components/ui/app-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para redefinição de senha
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const confirmUser = async () => {
      try {
        const token_hash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        
        if (!token_hash || !type) {
          setError('Link inválido ou expirado');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
        });

        if (error) {
          console.error('Erro na confirmação:', error);
          setError('Erro ao confirmar. Link pode estar expirado.');
          setLoading(false);
          return;
        }

        if (type === 'recovery') {
          setIsPasswordReset(true);
          toast.success('Email confirmado! Agora defina sua nova senha.');
        } else {
          setConfirmed(true);
          toast.success('Email confirmado com sucesso! Redirecionando...');
          // Redirecionar após alguns segundos
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 2000);
        }
      } catch (err) {
        console.error('Erro inesperado:', err);
        setError('Erro inesperado durante a confirmação');
      } finally {
        setLoading(false);
      }
    };

    confirmUser();
  }, [searchParams]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        toast.error('Erro ao redefinir senha: ' + error.message);
        return;
      }

      toast.success('Senha redefinida com sucesso! Redirecionando...');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      toast.error('Erro inesperado ao redefinir senha');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-900">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <FileText className="h-8 w-8 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Tork CRM</h1>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-blue-400 mx-auto" />
          <p className="text-white/80 text-sm">Confirmando email...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-900">
        <div className="relative z-10 w-full max-w-md">
          <AppCard className="bg-black/20 backdrop-blur-lg border-white/10 shadow-2xl">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <FileText className="h-8 w-8 text-blue-400" />
                <h1 className="text-2xl font-bold text-white">Tork CRM</h1>
              </div>
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <CardTitle className="text-white">Erro na Confirmação</CardTitle>
              <CardDescription className="text-white/60">
                {error}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => window.location.href = '/auth'}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Voltar ao Login
              </Button>
            </CardContent>
          </AppCard>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-900">
        <div className="relative z-10 w-full max-w-md">
          <AppCard className="bg-black/20 backdrop-blur-lg border-white/10 shadow-2xl">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <FileText className="h-8 w-8 text-blue-400" />
                <h1 className="text-2xl font-bold text-white">Tork CRM</h1>
              </div>
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <CardTitle className="text-white">Email Confirmado!</CardTitle>
              <CardDescription className="text-white/60">
                Sua conta foi ativada com sucesso. Você será redirecionado em instantes.
              </CardDescription>
            </CardHeader>
          </AppCard>
        </div>
      </div>
    );
  }

  if (isPasswordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-900">
        <div className="relative z-10 w-full max-w-md">
          <AppCard className="bg-black/20 backdrop-blur-lg border-white/10 shadow-2xl">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <FileText className="h-8 w-8 text-blue-400" />
                <h1 className="text-2xl font-bold text-white">Tork CRM</h1>
              </div>
              <CardTitle className="text-white">Redefinir Senha</CardTitle>
              <CardDescription className="text-white/60">
                Digite sua nova senha
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-white">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 pr-10"
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-white/60" />
                      ) : (
                        <Eye className="h-4 w-4 text-white/60" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password" className="text-white">Confirmar Nova Senha</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redefinindo...
                    </>
                  ) : (
                    'Redefinir Senha'
                  )}
                </Button>
              </form>
            </CardContent>
          </AppCard>
        </div>
      </div>
    );
  }

  return <Navigate to="/auth" replace />;
}