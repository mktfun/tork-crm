import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, User, Phone, Lock, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClientData {
  id: string;
  name: string;
  cpf_cnpj: string | null;
  email: string;
  phone: string;
  birth_date: string | null;
  user_id: string;
  portal_password?: string;
}

interface UpdateProfileResponse {
  success: boolean;
  error?: string;
}

export default function PortalOnboarding() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [client, setClient] = useState<ClientData | null>(null);
  const [currentPassword, setCurrentPassword] = useState('123456');
  const [slug, setSlug] = useState('');
  
  // Form data
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    const storedClient = sessionStorage.getItem('portal_client');
    const storedSlug = sessionStorage.getItem('portal_brokerage_slug');
    
    if (!storedClient || !storedSlug) {
      navigate('/');
      return;
    }
    
    setSlug(storedSlug);
    const clientData = JSON.parse(storedClient);
    setClient(clientData);
    
    // Store current password for RPC validation
    setCurrentPassword(clientData.portal_password || '123456');
    
    // Pre-fill existing data
    if (clientData.cpf_cnpj) setCpf(formatCpf(clientData.cpf_cnpj));
    if (clientData.birth_date) setBirthDate(clientData.birth_date);
    if (clientData.phone) setPhone(formatPhone(clientData.phone));
    if (clientData.email) setEmail(clientData.email);
  }, [navigate]);

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

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
    }
    return value;
  };

  const validateCpf = (cpf: string): boolean => {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return false;
    if (/^(\d)\1+$/.test(digits)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
    let check = 11 - (sum % 11);
    if (check >= 10) check = 0;
    if (check !== parseInt(digits[9])) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
    check = 11 - (sum % 11);
    if (check >= 10) check = 0;
    return check === parseInt(digits[10]);
  };

  const handleNext = () => {
    setError('');
    
    if (step === 1) {
      const normalizedCpf = cpf.replace(/\D/g, '');
      if (!normalizedCpf || normalizedCpf.length < 11) {
        setError('CPF é obrigatório');
        return;
      }
      if (!validateCpf(cpf)) {
        setError('CPF inválido');
        return;
      }
    }
    
    if (step === 2) {
      if (!phone || phone.replace(/\D/g, '').length < 10) {
        setError('Telefone é obrigatório');
        return;
      }
      if (!email || !email.includes('@')) {
        setError('E-mail válido é obrigatório');
        return;
      }
    }
    
    setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    setError('');
    
    if (!password || password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }
    if (!client) return;

    setIsLoading(true);

    try {
      const normalizedCpf = cpf.replace(/\D/g, '');
      
      // Check if CPF already exists in another client
      const { data: existingClients, error: checkError } = await supabase
        .from('clientes')
        .select('id, name')
        .eq('user_id', client.user_id)
        .neq('id', client.id)
        .or(`cpf_cnpj.ilike.%${normalizedCpf}%`);

      if (checkError) throw checkError;

      if (existingClients && existingClients.length > 0) {
        setError(`Este CPF já está cadastrado para "${existingClients[0].name}". Entre em contato com a corretora.`);
        setIsLoading(false);
        return;
      }

      // Use RPC to update (bypasses RLS)
      const { data: result, error: rpcError } = await supabase.rpc('update_portal_profile', {
        p_client_id: client.id,
        p_verify_password: currentPassword,
        p_new_password: password,
        p_new_data: {
          cpf_cnpj: normalizedCpf,
          birth_date: birthDate || null,
          phone: phone.replace(/\D/g, ''),
          email: email
        }
      });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        throw rpcError;
      }

      const response = result as unknown as UpdateProfileResponse;
      
      if (!response?.success) {
        setError(response?.error || 'Erro ao salvar dados');
        setIsLoading(false);
        return;
      }

      // Update session storage with new data
      const updatedClient = {
        ...client,
        cpf_cnpj: normalizedCpf,
        birth_date: birthDate,
        phone: phone.replace(/\D/g, ''),
        email: email,
        portal_first_access: false,
        portal_password: password
      };
      sessionStorage.setItem('portal_client', JSON.stringify(updatedClient));

      toast.success('Cadastro atualizado com sucesso!');
      navigate(`/${slug}/portal/home`);
      
    } catch (err) {
      console.error('Onboarding error:', err);
      setError('Erro ao salvar dados. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Identificação', icon: User },
    { number: 2, title: 'Contato', icon: Phone },
    { number: 3, title: 'Segurança', icon: Lock },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
      <Card className="w-full max-w-lg bg-[#0A0A0A] border-white/5 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-br from-[#D4AF37] to-[#C5A028] rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-[#D4AF37]/20">
            <Shield className="w-8 h-8 text-black" />
          </div>
          <CardTitle className="text-2xl text-white font-light tracking-wide">Atualize seus dados</CardTitle>
          <CardDescription className="text-zinc-500">
            Complete seu cadastro para continuar
          </CardDescription>
          
          {/* Progress Steps */}
          <div className="flex justify-center gap-2 pt-4">
            {steps.map((s) => (
              <div key={s.number} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step >= s.number 
                    ? 'bg-gradient-to-br from-[#D4AF37] to-[#C5A028] text-black shadow-lg shadow-[#D4AF37]/20' 
                    : 'bg-zinc-800 text-zinc-500 border border-white/10'
                }`}>
                  {step > s.number ? <Check className="w-4 h-4" /> : s.number}
                </div>
                {s.number < 3 && (
                  <div className={`w-8 h-0.5 mx-1 ${step > s.number ? 'bg-[#D4AF37]' : 'bg-zinc-800'}`} />
                )}
              </div>
            ))}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Step 1: Identification */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-zinc-400 text-sm font-light">CPF *</Label>
                <Input
                  id="cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => { setCpf(formatCpf(e.target.value)); setError(''); }}
                  maxLength={14}
                  className="bg-zinc-950/50 border-white/10 text-white placeholder:text-zinc-600 focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate" className="text-zinc-400 text-sm font-light">Data de Nascimento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="bg-zinc-950/50 border-white/10 text-white focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-12"
                />
              </div>
            </div>
          )}

          {/* Step 2: Contact */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-zinc-400 text-sm font-light">Celular (WhatsApp) *</Label>
                <Input
                  id="phone"
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => { setPhone(formatPhone(e.target.value)); setError(''); }}
                  maxLength={15}
                  className="bg-zinc-950/50 border-white/10 text-white placeholder:text-zinc-600 focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-400 text-sm font-light">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className="bg-zinc-950/50 border-white/10 text-white placeholder:text-zinc-600 focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-12"
                />
              </div>
            </div>
          )}

          {/* Step 3: Security */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-400 text-sm font-light">Nova Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="bg-zinc-950/50 border-white/10 text-white placeholder:text-zinc-600 focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-zinc-400 text-sm font-light">Confirmar Senha *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  className="bg-zinc-950/50 border-white/10 text-white placeholder:text-zinc-600 focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-12"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <Button 
                variant="outline" 
                onClick={handleBack}
                className="flex-1 border-white/10 text-zinc-400 hover:bg-zinc-800 hover:text-white h-12"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            )}
            
            {step < 3 ? (
              <Button 
                onClick={handleNext}
                className="flex-1 bg-white text-black font-medium hover:bg-zinc-200 h-12"
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#C5A028] text-black hover:from-[#E5C048] hover:to-[#D4AF37] h-12 font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Finalizar Cadastro
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
