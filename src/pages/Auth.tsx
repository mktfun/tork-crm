import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

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

  // Premium BLACK & SILVER loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        {/* Gradiente radial sutil */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(39,39,42,0.2)_0%,_transparent_60%)]" />
        
        {/* Textura de linhas diagonais */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
            backgroundSize: '8px 8px'
          }}
        />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 text-center"
        >
          {/* Logo com brilho prateado */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <img 
              src="/tork_symbol_favicon.png" 
              alt="Tork"
              className="h-12 w-12"
              style={{ filter: 'brightness(0) invert(1) drop-shadow(0 0 8px rgba(255,255,255,0.3))' }}
            />
            <h1 className="text-3xl font-semibold text-zinc-100 tracking-tight">
              Tork CRM
            </h1>
          </div>
          
          {/* Barra de progresso metálica */}
          <div className="w-48 mx-auto mb-6">
            <div className="h-[2px] bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full w-full progress-metallic" />
            </div>
          </div>
          
          {/* Texto espaçado */}
          <p className="text-zinc-500 text-xs font-medium tracking-[0.2em] uppercase">
            Aguarde...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black">
      {/* Gradiente radial cinza */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(39,39,42,0.25)_0%,_transparent_55%)]" />
      
      {/* Textura de linhas diagonais sutis */}
      <div 
        className="absolute inset-0 opacity-[0.012]"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
          backgroundSize: '8px 8px'
        }}
      />
      
      <div className="relative z-10 w-full max-w-md">
        {/* Premium Glass Card - Black & Silver */}
        <div className="relative">
          {/* Glow prateado atrás */}
          <div className="absolute -inset-[1px] bg-gradient-to-br from-white/8 via-transparent to-white/4 rounded-2xl blur-sm" />
          
          <div 
            className="relative bg-black/70 backdrop-blur-2xl border border-white/[0.06] rounded-2xl"
            style={{
              boxShadow: `
                0 0 60px -15px rgba(255,255,255,0.07),
                inset 0 1px 0 0 rgba(255,255,255,0.05),
                inset 1px 0 0 0 rgba(255,255,255,0.03)
              `
            }}
          >
            <CardHeader className="text-center pt-8 pb-6">
              <div className="flex items-center justify-center gap-3 mb-6">
                <img 
                  src="/tork_symbol_favicon.png" 
                  alt="Tork"
                  className="h-10 w-10"
                  style={{ filter: 'brightness(0) invert(1) drop-shadow(0 0 8px rgba(255,255,255,0.3))' }}
                />
                <h1 className="text-3xl font-bold text-white tracking-tight">Tork CRM</h1>
              </div>
              <CardTitle className="text-white text-xl font-semibold">
                {showResetForm ? 'Recuperar Senha' : 'Bem-vindo'}
              </CardTitle>
              <CardDescription className="text-zinc-500 text-sm font-medium mt-2">
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
                    <Label htmlFor="reset-email" className="text-zinc-400 text-sm font-medium">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="bg-black/60 border-zinc-700/50 text-white placeholder:text-zinc-600 h-12 rounded-xl focus:border-zinc-400/60 focus:ring-1 focus:ring-zinc-400/20 focus:bg-black/80 transition-all"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    <Button
                      type="submit"
                      className="w-full h-12 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)] transition-all duration-300"
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
                      className="w-full text-zinc-500 hover:text-white hover:bg-white/[0.06] rounded-xl h-11"
                      onClick={() => setShowResetForm(false)}
                    >
                      Voltar ao Login
                    </Button>
                  </div>
                </form>
              ) : (
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1 h-12">
                    <TabsTrigger 
                      value="login" 
                      className="text-zinc-500 data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg font-medium transition-all"
                    >
                      Login
                    </TabsTrigger>
                    <TabsTrigger 
                      value="signup"
                      className="text-zinc-500 data-[state=active]:bg-zinc-800 data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg font-medium transition-all"
                    >
                      Cadastro
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-5 mt-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-zinc-400 text-sm font-medium">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="bg-black/60 border-zinc-700/50 text-white placeholder:text-zinc-600 h-12 rounded-xl focus:border-zinc-400/60 focus:ring-1 focus:ring-zinc-400/20 focus:bg-black/80 transition-all"
                          placeholder="seu@email.com"
                          required
                          autoComplete="email"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-zinc-400 text-sm font-medium">Senha</Label>
                        <div className="relative">
                          <Input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="bg-black/60 border-zinc-700/50 text-white placeholder:text-zinc-600 pr-12 h-12 rounded-xl focus:border-zinc-400/60 focus:ring-1 focus:ring-zinc-400/20 focus:bg-black/80 transition-all"
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
                              <EyeOff className="h-4 w-4 text-zinc-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-zinc-500" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-12 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-xl shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.5)] transition-all duration-300"
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
                        className="w-full text-zinc-600 hover:text-zinc-400 hover:bg-transparent text-sm"
                        onClick={() => setShowResetForm(true)}
                      >
                        Esqueci minha senha
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-5 mt-8">
                    <form onSubmit={handleSignup} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="nome-completo" className="text-zinc-400 text-sm font-medium">Nome Completo</Label>
                        <Input
                          id="nome-completo"
                          type="text"
                          value={nomeCompleto}
                          onChange={(e) => setNomeCompleto(e.target.value)}
                          className="bg-black/60 border-zinc-700/50 text-white placeholder:text-zinc-600 h-12 rounded-xl focus:border-zinc-400/60 focus:ring-1 focus:ring-zinc-400/20 focus:bg-black/80 transition-all"
                          placeholder="Seu nome completo"
                          required
                          autoComplete="name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className="text-zinc-400 text-sm font-medium">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="bg-black/60 border-zinc-700/50 text-white placeholder:text-zinc-600 h-12 rounded-xl focus:border-zinc-400/60 focus:ring-1 focus:ring-zinc-400/20 focus:bg-black/80 transition-all"
                          placeholder="seu@email.com"
                          required
                          autoComplete="email"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className="text-zinc-400 text-sm font-medium">Senha</Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            type={showPassword ? 'text' : 'password'}
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            className="bg-black/60 border-zinc-700/50 text-white placeholder:text-zinc-600 pr-12 h-12 rounded-xl focus:border-zinc-400/60 focus:ring-1 focus:ring-zinc-400/20 focus:bg-black/80 transition-all"
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
                              <EyeOff className="h-4 w-4 text-zinc-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-zinc-500" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirm-password" className="text-zinc-400 text-sm font-medium">Confirmar Senha</Label>
                        <div className="relative">
                          <Input
                            id="confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="bg-black/60 border-zinc-700/50 text-white placeholder:text-zinc-600 pr-12 h-12 rounded-xl focus:border-zinc-400/60 focus:ring-1 focus:ring-zinc-400/20 focus:bg-black/80 transition-all"
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
                              <EyeOff className="h-4 w-4 text-zinc-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-zinc-500" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-12 bg-transparent border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold rounded-xl transition-all duration-300"
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
        <p className="text-center text-zinc-600 text-xs mt-6">
          Ao continuar, você concorda com os Termos de Uso e Política de Privacidade
        </p>
      </div>
    </div>
  );
}
