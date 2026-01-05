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
}

export default function PortalOnboarding() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [client, setClient] = useState<ClientData | null>(null);
  
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
    if (!storedClient) {
      navigate('/portal/login');
      return;
    }
    const clientData = JSON.parse(storedClient);
    setClient(clientData);
    
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
        // CPF already exists - show error (simplified approach)
        setError(`Este CPF já está cadastrado para "${existingClients[0].name}". Entre em contato com a corretora.`);
        setIsLoading(false);
        return;
      }

      // Update client data
      const { error: updateError } = await supabase
        .from('clientes')
        .update({
          cpf_cnpj: normalizedCpf,
          birth_date: birthDate || null,
          phone: phone.replace(/\D/g, ''),
          email: email,
          portal_password: password,
          portal_first_access: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id);

      if (updateError) throw updateError;

      // Update session storage
      const updatedClient = {
        ...client,
        cpf_cnpj: normalizedCpf,
        birth_date: birthDate,
        phone: phone.replace(/\D/g, ''),
        email: email,
        portal_first_access: false
      };
      sessionStorage.setItem('portal_client', JSON.stringify(updatedClient));

      toast.success('Cadastro atualizado com sucesso!');
      navigate('/portal/home');
      
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-lg bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl text-white">Atualize seus dados</CardTitle>
          <CardDescription className="text-slate-400">
            Complete seu cadastro para continuar
          </CardDescription>
          
          {/* Progress Steps */}
          <div className="flex justify-center gap-2 pt-4">
            {steps.map((s) => (
              <div key={s.number} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step >= s.number 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {step > s.number ? <Check className="w-4 h-4" /> : s.number}
                </div>
                {s.number < 3 && (
                  <div className={`w-8 h-0.5 mx-1 ${step > s.number ? 'bg-purple-600' : 'bg-slate-700'}`} />
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
                <Label htmlFor="cpf" className="text-slate-300">CPF *</Label>
                <Input
                  id="cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => { setCpf(formatCpf(e.target.value)); setError(''); }}
                  maxLength={14}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate" className="text-slate-300">Data de Nascimento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="bg-slate-900/50 border-slate-600 text-white"
                />
              </div>
            </div>
          )}

          {/* Step 2: Contact */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">Celular (WhatsApp) *</Label>
                <Input
                  id="phone"
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => { setPhone(formatPhone(e.target.value)); setError(''); }}
                  maxLength={15}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
          )}

          {/* Step 3: Security */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Nova Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300">Confirmar Senha *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <Button 
                variant="outline" 
                onClick={handleBack}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            )}
            
            {step < 3 ? (
              <Button 
                onClick={handleNext}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
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
