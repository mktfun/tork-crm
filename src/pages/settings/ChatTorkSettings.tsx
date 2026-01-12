import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppCard } from '@/components/ui/app-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, MessageCircle, ExternalLink, Eye, EyeOff, Loader2, RefreshCw, Wifi } from 'lucide-react';

interface CRMSettings {
  id?: string;
  chatwoot_url: string;
  chatwoot_api_key: string;
  chatwoot_account_id: string;
  chatwoot_webhook_secret: string;
}

export default function ChatwootSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [settings, setSettings] = useState<CRMSettings>({
    chatwoot_url: '',
    chatwoot_api_key: '',
    chatwoot_account_id: '',
    chatwoot_webhook_secret: ''
  });

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          chatwoot_url: data.chatwoot_url || '',
          chatwoot_api_key: data.chatwoot_api_key || '',
          chatwoot_account_id: data.chatwoot_account_id || '',
          chatwoot_webhook_secret: data.chatwoot_webhook_secret || ''
        });
      }
    } catch (error) {
      console.error('Error fetching CRM settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const payload = {
        user_id: user.id,
        chatwoot_url: settings.chatwoot_url || null,
        chatwoot_api_key: settings.chatwoot_api_key || null,
        chatwoot_account_id: settings.chatwoot_account_id || null,
        chatwoot_webhook_secret: settings.chatwoot_webhook_secret || null
      };

      if (settings.id) {
        const { error } = await supabase
          .from('crm_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_settings')
          .insert(payload);
        if (error) throw error;
      }

      toast.success('Configurações salvas com sucesso!');
      fetchSettings();
    } catch (error: any) {
      console.error('Error saving CRM settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.chatwoot_url || !settings.chatwoot_api_key || !settings.chatwoot_account_id) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setTesting(true);
    const toastId = toast.loading('Testando conexão com Chat Tork...');
    
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-sync', {
        body: { action: 'validate' }
      });

      toast.dismiss(toastId);

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || 'Conexão estabelecida!');
      } else {
        toast.error(data?.message || 'Falha na conexão');
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error('Falha na conexão: ' + (error.message || 'Verifique suas credenciais'));
    } finally {
      setTesting(false);
    }
  };

  const handleSyncLabels = async () => {
    if (!settings.chatwoot_url || !settings.chatwoot_api_key || !settings.chatwoot_account_id) {
      toast.error('Configure as credenciais do Chat Tork primeiro');
      return;
    }

    setSyncing(true);
    const toastId = toast.loading('Iniciando sincronização com Chat Tork...');
    
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-sync', {
        body: { action: 'sync_stages' }
      });

      toast.dismiss(toastId);

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || 'Etiquetas sincronizadas!');
      } else {
        toast.error(data?.message || 'Erro ao sincronizar');
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error('Sync error:', error);
      toast.error('Erro ao sincronizar: ' + (error.message || 'Verifique suas credenciais'));
    } finally {
      setSyncing(false);
    }
  };

  const webhookUrl = `https://jaouwhckqqnaxqyfvgyq.supabase.co/functions/v1/chatwoot-webhook`;

  if (loading) {
    return (
      <AppCard className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppCard>
    );
  }

  return (
    <div className="space-y-6">
      <AppCard className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Integração Chat Tork</h2>
            <p className="text-sm text-muted-foreground">
              Configure a sincronização bilateral com o Chat Tork
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="space-y-2">
            <Label htmlFor="chatwoot_url">URL da Instância</Label>
            <Input
              id="chatwoot_url"
              placeholder="https://seu-chat-tork.com"
              value={settings.chatwoot_url}
              onChange={(e) => setSettings({ ...settings, chatwoot_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              URL base da sua instância Chat Tork (sem /api/v1)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chatwoot_account_id">Account ID</Label>
            <Input
              id="chatwoot_account_id"
              placeholder="1"
              value={settings.chatwoot_account_id}
              onChange={(e) => setSettings({ ...settings, chatwoot_account_id: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              ID da conta no Chat Tork (encontre em Settings → Account)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chatwoot_api_key">API Key</Label>
            <div className="relative">
              <Input
                id="chatwoot_api_key"
                type={showApiKey ? 'text' : 'password'}
                placeholder="sua-api-key-aqui"
                value={settings.chatwoot_api_key}
                onChange={(e) => setSettings({ ...settings, chatwoot_api_key: e.target.value })}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Token de acesso da API (Profile → Access Token)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chatwoot_webhook_secret">Webhook Secret</Label>
            <div className="relative">
              <Input
                id="chatwoot_webhook_secret"
                type={showWebhookSecret ? 'text' : 'password'}
                placeholder="seu-webhook-secret"
                value={settings.chatwoot_webhook_secret}
                onChange={(e) => setSettings({ ...settings, chatwoot_webhook_secret: e.target.value })}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              >
                {showWebhookSecret ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Secret para validar webhooks (opcional, mas recomendado)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Configurações
            </Button>

            <Button 
              variant="outline" 
              onClick={handleTestConnection} 
              disabled={testing || !settings.chatwoot_url || !settings.chatwoot_api_key || !settings.chatwoot_account_id}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              Testar Conexão
            </Button>

            <Button 
              variant="outline" 
              onClick={handleSyncLabels} 
              disabled={syncing || !settings.chatwoot_url || !settings.chatwoot_api_key || !settings.chatwoot_account_id}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar Etiquetas
            </Button>
          </div>
        </div>
      </AppCard>

      <AppCard className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Configuração do Webhook</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure este URL no Chat Tork para receber eventos em tempo real:
        </p>
        
        <div className="p-3 rounded-lg bg-secondary/50 border border-border">
          <code className="text-sm text-blue-400 break-all">{webhookUrl}</code>
        </div>
        
        <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <h4 className="text-sm font-medium text-blue-400 mb-2">Como configurar:</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Acesse Settings → Applications → Webhooks no Chat Tork</li>
            <li>Clique em "Add new webhook"</li>
            <li>Cole a URL acima</li>
            <li>Selecione os eventos: conversation_updated, contact_created</li>
            <li>Salve e copie o Secret gerado para o campo acima</li>
          </ol>
        </div>

        <Button variant="outline" className="mt-4" asChild>
          <a 
            href="/dashboard/documentacao" 
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver Documentação
          </a>
        </Button>
      </AppCard>
    </div>
  );
}
