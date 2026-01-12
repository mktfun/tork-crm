import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function Auth() {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados para Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Estados para Cadastro
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nomeCompleto, setNomeCompleto] = useState('');

  // Estado para Recuperação de Senha
  const [resetEmail, setResetEmail] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);

  // Se já estiver logado, redirecionar
  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword || !confirmPassword || !nomeCompleto) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (signupPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (signupPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, nomeCompleto);
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Digite seu email');
      return;
    }

    setIsLoading(true);
    const { error } = await resetPassword(resetEmail);
    
    if (!error) {
      setShowResetForm(false);
      setResetEmail('');
    }
    setIsLoading(false);
  };

  // Premium loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030303]">
        {/* Mesh gradient background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-slate-950 to-indigo-950/40" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="relative z-10 text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/30 rounded-xl blur-lg animate-pulse" />
              <Shield className="relative h-10 w-10 text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Tork CRM</h1>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-blue-400 mx-auto" />
          <p className="text-white/60 text-sm font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#030303]">
      {/* Premium mesh gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-slate-950 to-indigo-950/40" />
        
        {/* Floating gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-indigo-600/15 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-1/4 left-1/3 w-[450px] h-[450px] bg-slate-600/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
        
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>
      
      <div className="relative z-10 w-full max-w-md">
        {/* Premium Glass Card */}
        <div className="relative">
          {/* Glow effect behind card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-slate-600/20 rounded-2xl blur-xl" />
          
          <div className="relative bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.05]">
            <CardHeader className="text-center pt-8 pb-6">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/30 rounded-xl blur-lg" />
                  <Shield className="relative h-10 w-10 text-blue-400" />
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Tork CRM</h1>
              </div>
              <CardTitle className="text-white text-xl font-semibold">
                {showResetForm ? 'Recuperar Senha' : 'Bem-vindo'}
              </CardTitle>
              <CardDescription className="text-white/50 text-sm font-medium mt-2">
                {showResetForm 
                  ? 'Digite seu email para recuperar sua senha'
                  : 'Gestão Inteligente para Corretoras de Elite'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="px-8 pb-8">
              {showResetForm ? (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-white/80 text-sm font-medium">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/30 h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar Email de Recuperação'
                      )}
                    </Button>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-white/60 hover:text-white hover:bg-white/[0.06] rounded-xl h-11"
                      onClick={() => setShowResetForm(false)}
                    >
                      Voltar ao Login
                    </Button>
                  </div>
                </form>
              ) : (
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-white/[0.06] border border-white/[0.08] rounded-xl p-1 h-12">
                    <TabsTrigger 
                      value="login" 
                      className="text-white/70 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-medium transition-all"
                    >
                      Login
                    </TabsTrigger>
                    <TabsTrigger 
                      value="signup"
                      className="text-white/70 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-medium transition-all"
                    >
                      Cadastro
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-5 mt-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-white/80 text-sm font-medium">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/30 h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
                          placeholder="seu@email.com"
                          required
                          autoComplete="email"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-white/80 text-sm font-medium">Senha</Label>
                        <div className="relative">
                          <Input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/30 pr-12 h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-4 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-white/40" />
                            ) : (
                              <Eye className="h-4 w-4 text-white/40" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 glow-button"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Entrando...
                          </>
                        ) : (
                          'Entrar'
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full text-white/50 hover:text-white/80 hover:bg-transparent text-sm"
                        onClick={() => setShowResetForm(true)}
                      >
                        Esqueci minha senha
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-5 mt-8">
                    <form onSubmit={handleSignup} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="nome-completo" className="text-white/80 text-sm font-medium">Nome Completo</Label>
                        <Input
                          id="nome-completo"
                          type="text"
                          value={nomeCompleto}
                          onChange={(e) => setNomeCompleto(e.target.value)}
                          className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/30 h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
                          placeholder="Seu nome completo"
                          required
                          autoComplete="name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className="text-white/80 text-sm font-medium">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/30 h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
                          placeholder="seu@email.com"
                          required
                          autoComplete="email"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className="text-white/80 text-sm font-medium">Senha</Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            type={showPassword ? 'text' : 'password'}
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/30 pr-12 h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
                            placeholder="••••••••"
                            required
                            autoComplete="new-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-4 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-white/40" />
                            ) : (
                              <Eye className="h-4 w-4 text-white/40" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirm-password" className="text-white/80 text-sm font-medium">Confirmar Senha</Label>
                        <div className="relative">
                          <Input
                            id="confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="bg-white/[0.06] border-white/[0.08] text-white placeholder:text-white/30 pr-12 h-12 rounded-xl focus:border-blue-500/50 focus:ring-blue-500/20 transition-all"
                            placeholder="••••••••"
                            required
                            autoComplete="new-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-4 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-white/40" />
                            ) : (
                              <Eye className="h-4 w-4 text-white/40" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Cadastrando...
                          </>
                        ) : (
                          'Criar Conta'
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </div>
        </div>
        
        {/* Footer text */}
        <p className="text-center text-white/30 text-xs mt-6">
          Ao continuar, você concorda com os Termos de Uso e Política de Privacidade
        </p>
      </div>
    </div>
  );
}
