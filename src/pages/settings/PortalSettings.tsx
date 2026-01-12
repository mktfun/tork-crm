import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Globe, Copy, Check, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsPanel } from '@/components/settings/SettingsPanel';

interface PortalConfig {
  portal_enabled: boolean;
  portal_show_policies: boolean;
  portal_allow_policy_download: boolean;
  portal_show_cards: boolean;
  portal_allow_card_download: boolean;
  portal_allow_profile_edit: boolean;
}

export default function PortalSettings() {
  const { user } = useAuth();
  const [brokerageId, setBrokerageId] = useState<number | null>(null);
  const [brokerageSlug, setBrokerageSlug] = useState<string | null>(null);
  const [settings, setSettings] = useState<PortalConfig>({
    portal_enabled: false,
    portal_show_policies: true,
    portal_allow_policy_download: true,
    portal_show_cards: true,
    portal_allow_card_download: true,
    portal_allow_profile_edit: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Link de produção hardcoded com slug dinâmico
  const baseUrl = 'https://crm.tork.services';
  const portalLink = brokerageSlug ? `${baseUrl}/${brokerageSlug}/portal` : null;

  useEffect(() => {
    const fetchBrokerage = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('brokerages')
          .select('id, slug, portal_enabled, portal_show_policies, portal_allow_policy_download, portal_show_cards, portal_allow_card_download, portal_allow_profile_edit')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching brokerage:', error);
          return;
        }

        if (data) {
          setBrokerageId(data.id);
          setBrokerageSlug(data.slug);
          setSettings({
            portal_enabled: data.portal_enabled ?? false,
            portal_show_policies: data.portal_show_policies ?? true,
            portal_allow_policy_download: data.portal_allow_policy_download ?? true,
            portal_show_cards: data.portal_show_cards ?? true,
            portal_allow_card_download: data.portal_allow_card_download ?? true,
            portal_allow_profile_edit: data.portal_allow_profile_edit ?? true,
          });
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBrokerage();
  }, [user]);

  const handleSave = async () => {
    if (!brokerageId) {
      toast.error('Nenhuma corretora cadastrada. Cadastre uma corretora primeiro.');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('brokerages')
        .update({
          portal_enabled: settings.portal_enabled,
          portal_show_policies: settings.portal_show_policies,
          portal_allow_policy_download: settings.portal_allow_policy_download,
          portal_show_cards: settings.portal_show_cards,
          portal_allow_card_download: settings.portal_allow_card_download,
          portal_allow_profile_edit: settings.portal_allow_profile_edit,
        })
        .eq('id', brokerageId);

      if (error) {
        console.error('Error saving settings:', error);
        toast.error('Erro ao salvar configurações');
        return;
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const copyLink = async () => {
    if (!portalLink) {
      toast.error('Configure um slug para a corretora primeiro');
      return;
    }
    try {
      await navigator.clipboard.writeText(portalLink);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar link');
    }
  };

  const updateSetting = (key: keyof PortalConfig, value: boolean) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      
      // Se desabilitar a exibição, desabilita o download também
      if (key === 'portal_show_policies' && !value) {
        newSettings.portal_allow_policy_download = false;
      }
      if (key === 'portal_show_cards' && !value) {
        newSettings.portal_allow_card_download = false;
      }
      
      return newSettings;
    });
  };

  if (isLoading) {
    return (
      <SettingsPanel
        title="Portal do Cliente"
        description="Configure o acesso dos seus clientes ao portal"
        icon={Globe}
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </SettingsPanel>
    );
  }

  if (!brokerageId) {
    return (
      <SettingsPanel
        title="Portal do Cliente"
        description="Configure o acesso dos seus clientes ao portal"
        icon={Globe}
      >
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6 text-center">
            <p className="text-slate-400">
              Você precisa cadastrar uma corretora antes de configurar o Portal do Cliente.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.href = '/dashboard/settings/brokerages'}
            >
              Ir para Corretoras
            </Button>
          </CardContent>
        </Card>
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel
      title="Portal do Cliente"
      description="Configure o acesso dos seus clientes ao portal"
      icon={Globe}
    >
      <div className="space-y-6">
        {/* Link de Acesso */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg text-white">Link de Acesso</CardTitle>
            <CardDescription className="text-slate-400">
              Envie este link para seus clientes acessarem o portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            {portalLink ? (
              <>
                <div className="flex gap-2">
                  <Input
                    value={portalLink}
                    readOnly
                    className="bg-slate-900/50 border-slate-600 text-white font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyLink}
                    className="shrink-0 border-slate-600 hover:bg-slate-700"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Dica: Envie este link via WhatsApp junto com a senha padrão (123456) para primeiro acesso.
                </p>
              </>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-amber-400 text-sm">
                  ⚠️ Configure um Slug (identificador) nas configurações da corretora para gerar o link do portal.
                </p>
                <Button
                  variant="link"
                  className="text-amber-400 p-0 h-auto mt-2"
                  onClick={() => window.location.href = '/dashboard/settings/brokerages'}
                >
                  Ir para Configurações da Corretora →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Master Switch */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg text-white">Ativação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-white font-medium">Ativar Portal do Cliente</Label>
                <p className="text-sm text-slate-400">
                  Permite que clientes acessem suas apólices e carteirinhas
                </p>
              </div>
              <Switch
                checked={settings.portal_enabled}
                onCheckedChange={(v) => updateSetting('portal_enabled', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Módulos */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg text-white">Módulos Visíveis</CardTitle>
            <CardDescription className="text-slate-400">
              Escolha quais funcionalidades estarão disponíveis no portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Apólices */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-white font-medium">Exibir Apólices</Label>
                  <p className="text-sm text-slate-400">
                    Mostra a lista de seguros do cliente
                  </p>
                </div>
                <Switch
                  checked={settings.portal_show_policies}
                  onCheckedChange={(v) => updateSetting('portal_show_policies', v)}
                  disabled={!settings.portal_enabled}
                />
              </div>
              
              {/* Sub-opção de download */}
              <div className="ml-8 flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg border border-slate-700/50">
                <Checkbox
                  id="allow_policy_download"
                  checked={settings.portal_allow_policy_download}
                  onCheckedChange={(v) => updateSetting('portal_allow_policy_download', !!v)}
                  disabled={!settings.portal_enabled || !settings.portal_show_policies}
                  className="border-slate-500"
                />
                <div>
                  <Label htmlFor="allow_policy_download" className="text-slate-300 text-sm cursor-pointer">
                    Permitir Download do PDF
                  </Label>
                  <p className="text-xs text-slate-500">
                    Cliente pode baixar o PDF da apólice
                  </p>
                </div>
              </div>
            </div>

            {/* Carteirinhas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-white font-medium">Exibir Carteirinhas</Label>
                  <p className="text-sm text-slate-400">
                    Mostra carteirinhas digitais de saúde/odonto
                  </p>
                </div>
                <Switch
                  checked={settings.portal_show_cards}
                  onCheckedChange={(v) => updateSetting('portal_show_cards', v)}
                  disabled={!settings.portal_enabled}
                />
              </div>
              
              {/* Sub-opção de download */}
              <div className="ml-8 flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg border border-slate-700/50">
                <Checkbox
                  id="allow_card_download"
                  checked={settings.portal_allow_card_download}
                  onCheckedChange={(v) => updateSetting('portal_allow_card_download', !!v)}
                  disabled={!settings.portal_enabled || !settings.portal_show_cards}
                  className="border-slate-500"
                />
                <div>
                  <Label htmlFor="allow_card_download" className="text-slate-300 text-sm cursor-pointer">
                    Permitir Download da Carteirinha
                  </Label>
                  <p className="text-xs text-slate-500">
                    Cliente pode baixar a carteirinha como imagem
                  </p>
                </div>
              </div>
            </div>

            {/* Edição de Perfil */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-white font-medium">Permitir Edição de Perfil</Label>
                <p className="text-sm text-slate-400">
                  Cliente pode atualizar telefone, email e endereço
                </p>
              </div>
              <Switch
                checked={settings.portal_allow_profile_edit}
                onCheckedChange={(v) => updateSetting('portal_allow_profile_edit', v)}
                disabled={!settings.portal_enabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
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
              <Save className="w-4 h-4 mr-2" />
              Salvar Configurações
            </>
          )}
        </Button>
      </div>
    </SettingsPanel>
  );
}
