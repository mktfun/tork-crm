import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Phone, Mail, MapPin, Loader2, Check, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ClientProfile {
  phone: string;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
}

interface UpdateProfileResponse {
  success: boolean;
  error?: string;
}

export default function PortalProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ClientProfile>({
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    cep: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    const clientData = sessionStorage.getItem('portal_client');
    const storedSlug = sessionStorage.getItem('portal_brokerage_slug');
    
    if (clientData && storedSlug) {
      const client = JSON.parse(clientData);
      setClientId(client.id);
      setClientName(client.name || '');
      setCurrentPassword(client.portal_password || '');
      setSlug(storedSlug);
      fetchClientData(client.id);
    }
  }, []);

  const fetchClientData = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('phone, email, address, city, state, cep')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching client:', error);
        return;
      }

      if (data) {
        setForm({
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          cep: data.cep || '',
        });
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
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

  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 8) {
      return digits.replace(/(\d{5})(\d)/, '$1-$2');
    }
    return value;
  };

  const handleSave = async () => {
    if (!clientId || !currentPassword) {
      toast.error('Sessão inválida. Faça login novamente.');
      return;
    }

    setIsSaving(true);

    try {
      const { data: result, error: rpcError } = await supabase.rpc('update_portal_profile', {
        p_client_id: clientId,
        p_verify_password: currentPassword,
        p_new_password: null,
        p_new_data: {
          phone: form.phone.replace(/\D/g, ''),
          email: form.email,
          address: form.address,
          city: form.city,
          state: form.state,
          cep: form.cep?.replace(/\D/g, '')
        }
      });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        toast.error('Erro ao salvar dados');
        return;
      }

      const response = result as unknown as UpdateProfileResponse;

      if (!response?.success) {
        toast.error(response?.error || 'Erro ao salvar dados');
        return;
      }

      toast.success('Dados atualizados com sucesso!');
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <Skeleton className="h-64 w-full bg-zinc-800" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-light text-white tracking-wide">Meus Dados</h2>

      {/* Profile Card */}
      <Card className="bg-[#0A0A0A] border-white/5 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#D4AF37] to-[#C5A028] rounded-full flex items-center justify-center shadow-lg shadow-[#D4AF37]/20">
              <User className="w-6 h-6 text-black" />
            </div>
            <div>
              <CardTitle className="text-lg text-white font-light">{clientName}</CardTitle>
              <p className="text-sm text-zinc-500">Segurado</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Phone */}
          <div className="space-y-2">
            <Label className="text-zinc-400 text-sm font-light flex items-center gap-2">
              <Phone className="w-4 h-4" /> Telefone
            </Label>
            <Input
              type="tel"
              placeholder="(00) 00000-0000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
              maxLength={15}
              className="bg-zinc-950/50 border-white/10 text-white focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-11"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="text-zinc-400 text-sm font-light flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email
            </Label>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="bg-zinc-950/50 border-white/10 text-white focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-11"
            />
          </div>

          {/* CEP */}
          <div className="space-y-2">
            <Label className="text-zinc-400 text-sm font-light">CEP</Label>
            <Input
              type="text"
              placeholder="00000-000"
              value={form.cep || ''}
              onChange={(e) => setForm({ ...form, cep: formatCep(e.target.value) })}
              maxLength={9}
              className="bg-zinc-950/50 border-white/10 text-white focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-11"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label className="text-zinc-400 text-sm font-light flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Endereço
            </Label>
            <Input
              type="text"
              placeholder="Rua, número"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="bg-zinc-950/50 border-white/10 text-white focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-11"
            />
          </div>

          {/* City / State */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-zinc-400 text-sm font-light">Cidade</Label>
              <Input
                type="text"
                placeholder="Cidade"
                value={form.city || ''}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="bg-zinc-950/50 border-white/10 text-white focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400 text-sm font-light">Estado</Label>
              <Input
                type="text"
                placeholder="UF"
                value={form.state || ''}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                maxLength={2}
                className="bg-zinc-950/50 border-white/10 text-white focus:border-[#D4AF37]/50 focus:ring-[#D4AF37]/20 h-11"
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-white text-black font-medium hover:bg-zinc-200 h-12"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="bg-[#0A0A0A] border-white/5 backdrop-blur-xl">
        <CardContent className="p-4">
          <Button
            variant="outline"
            className="w-full border-white/10 text-zinc-400 hover:bg-zinc-800 hover:text-white h-12"
            onClick={() => navigate(`/${slug}/portal/change-password`)}
          >
            <KeyRound className="w-4 h-4 mr-2" />
            Alterar Senha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
