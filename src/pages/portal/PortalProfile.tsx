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

  useEffect(() => {
    const clientData = sessionStorage.getItem('portal_client');
    if (clientData) {
      const client = JSON.parse(clientData);
      setClientId(client.id);
      setClientName(client.name || '');
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

  // Format phone as user types
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

  // Format CEP as user types
  const formatCep = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 8) {
      return digits.replace(/(\d{5})(\d)/, '$1-$2');
    }
    return value;
  };

  const handleSave = async () => {
    if (!clientId) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('clientes')
        .update({
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
          state: form.state,
          cep: form.cep,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      if (error) {
        console.error('Error saving:', error);
        toast.error('Erro ao salvar dados');
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
        <Skeleton className="h-8 w-48 bg-slate-700" />
        <Skeleton className="h-64 w-full bg-slate-700" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Meus Dados</h2>

      {/* Profile Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">{clientName}</CardTitle>
              <p className="text-sm text-slate-400">Segurado</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Phone */}
          <div className="space-y-2">
            <Label className="text-slate-300 flex items-center gap-2">
              <Phone className="w-4 h-4" /> Telefone
            </Label>
            <Input
              type="tel"
              placeholder="(00) 00000-0000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
              maxLength={15}
              className="bg-slate-900/50 border-slate-600 text-white"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="text-slate-300 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email
            </Label>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="bg-slate-900/50 border-slate-600 text-white"
            />
          </div>

          {/* CEP */}
          <div className="space-y-2">
            <Label className="text-slate-300">CEP</Label>
            <Input
              type="text"
              placeholder="00000-000"
              value={form.cep || ''}
              onChange={(e) => setForm({ ...form, cep: formatCep(e.target.value) })}
              maxLength={9}
              className="bg-slate-900/50 border-slate-600 text-white"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label className="text-slate-300 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Endereço
            </Label>
            <Input
              type="text"
              placeholder="Rua, número"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="bg-slate-900/50 border-slate-600 text-white"
            />
          </div>

          {/* City / State */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-slate-300">Cidade</Label>
              <Input
                type="text"
                placeholder="Cidade"
                value={form.city || ''}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Estado</Label>
              <Input
                type="text"
                placeholder="UF"
                value={form.state || ''}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                maxLength={2}
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
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
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <Button
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
            onClick={() => navigate('/portal/change-password')}
          >
            <KeyRound className="w-4 h-4 mr-2" />
            Alterar Senha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
