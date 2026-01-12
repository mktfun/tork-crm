import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CRMDeal, useCRMDeals, useCRMStages } from '@/hooks/useCRMDeals';
import { formatCurrency } from '@/utils/formatCurrency';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ExternalLink, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  MessageCircle,
  Save,
  Loader2,
  Trash2
} from 'lucide-react';

interface DealDetailsModalProps {
  deal: CRMDeal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ChatTorkConfig {
  chatwoot_url: string;
  chatwoot_account_id: string;
}

export function DealDetailsModal({ deal, open, onOpenChange }: DealDetailsModalProps) {
  const { user } = useAuth();
  const { updateDeal, deleteDeal } = useCRMDeals();
  const { stages } = useCRMStages();
  const [chatTorkConfig, setChatTorkConfig] = useState<ChatTorkConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    value: '',
    expected_close_date: '',
    notes: '',
    stage_id: ''
  });

  // Fetch Chat Tork config
  useEffect(() => {
    if (user && open) {
      fetchChatTorkConfig();
    }
  }, [user, open]);

  // Populate form when deal changes
  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title || '',
        value: deal.value?.toString() || '',
        expected_close_date: deal.expected_close_date || '',
        notes: deal.notes || '',
        stage_id: deal.stage_id || ''
      });
      setIsEditing(false);
    }
  }, [deal]);

  const fetchChatTorkConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_settings')
        .select('chatwoot_url, chatwoot_account_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!error && data?.chatwoot_url && data?.chatwoot_account_id) {
        setChatTorkConfig(data as ChatTorkConfig);
      }
    } catch (error) {
      console.error('Error fetching Chat Tork config:', error);
    }
  };

  const chatTorkUrl = deal?.chatwoot_conversation_id && chatTorkConfig
    ? `${chatTorkConfig.chatwoot_url}/app/accounts/${chatTorkConfig.chatwoot_account_id}/conversations/${deal.chatwoot_conversation_id}`
    : null;

  const handleSave = async () => {
    if (!deal) return;
    setSaving(true);
    try {
      await updateDeal.mutateAsync({
        id: deal.id,
        title: formData.title,
        value: parseFloat(formData.value) || 0,
        expected_close_date: formData.expected_close_date || null,
        notes: formData.notes || null,
        stage_id: formData.stage_id
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating deal:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deal) return;
    if (confirm('Tem certeza que deseja excluir este negócio?')) {
      await deleteDeal.mutateAsync({
        id: deal.id,
        title: deal.title,
        client_id: deal.client_id
      });
      onOpenChange(false);
    }
  };

  const currentStage = stages.find(s => s.id === deal?.stage_id);

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentStage && (
              <div 
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: currentStage.color }}
              />
            )}
            {isEditing ? 'Editar Negócio' : deal.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Info */}
          {deal.client && (
            <div className="p-3 rounded-lg bg-secondary/30 space-y-2">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{deal.client.name}</span>
              </div>
              {deal.client.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{deal.client.phone}</span>
                </div>
              )}
              {deal.client.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{deal.client.email}</span>
                </div>
              )}
            </div>
          )}

          {isEditing ? (
            <>
              {/* Edit Form */}
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-stage">Etapa</Label>
                <Select
                  value={formData.stage_id}
                  onValueChange={(value) => setFormData({ ...formData, stage_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-value">Valor (R$)</Label>
                  <Input
                    id="edit-value"
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Previsão</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={formData.expected_close_date}
                    onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Observações</Label>
                <Textarea
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <>
              {/* View Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  <span className="font-semibold text-foreground">
                    {formatCurrency(deal.value || 0)}
                  </span>
                </div>
                {deal.expected_close_date && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(deal.expected_close_date), "dd 'de' MMMM", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>

              {currentStage && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Etapa:</span>
                  <div 
                    className="px-2 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: currentStage.color }}
                  >
                    {currentStage.name}
                  </div>
                </div>
              )}

              {deal.notes && (
                <div className="p-3 rounded-lg bg-secondary/20">
                  <p className="text-sm text-muted-foreground">{deal.notes}</p>
                </div>
              )}

              {/* Sync Indicator */}
              {deal.chatwoot_conversation_id && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-green-400" />
                  <span>Sincronizado com Tork</span>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4 border-t border-border">
            {/* Tork Button */}
            {chatTorkUrl && (
              <Button asChild variant="outline" className="w-full">
                <a href={chatTorkUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Abrir no Tork
                  <ExternalLink className="h-3.5 w-3.5 ml-2" />
                </a>
              </Button>
            )}

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                  <Button className="flex-1" onClick={() => setIsEditing(true)}>
                    Editar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
