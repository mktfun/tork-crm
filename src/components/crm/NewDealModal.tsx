import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useCRMDeals, useCRMStages } from '@/hooks/useCRMDeals';
import type { CRMStage } from '@/hooks/useCRMDeals';
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
import { Loader2, Save } from 'lucide-react';

interface NewDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStageId?: string | null;
}

interface ClientOption {
  id: string;
  name: string;
  phone: string;
}

export function NewDealModal({ open, onOpenChange, defaultStageId }: NewDealModalProps) {
  const { user } = useAuth();
  const { stages, isLoading: loadingStages } = useCRMStages();
  const { createDeal, deals } = useCRMDeals();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    stage_id: '',
    value: '',
    expected_close_date: '',
    notes: ''
  });

  useEffect(() => {
    if (open && defaultStageId) {
      setFormData(prev => ({ ...prev, stage_id: defaultStageId }));
    }
  }, [open, defaultStageId]);

  useEffect(() => {
    if (open && user) {
      fetchClients();
    }
  }, [open, user]);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, name, phone')
        .eq('user_id', user!.id)
        .order('name', { ascending: true })
        .limit(100);

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.stage_id) return;

    setLoading(true);
    try {
      // Calculate position for new deal
      const dealsInStage = deals.filter(d => d.stage_id === formData.stage_id);
      const position = dealsInStage.length;

      await createDeal.mutateAsync({
        title: formData.title,
        client_id: formData.client_id || null,
        stage_id: formData.stage_id,
        value: parseFloat(formData.value) || 0,
        expected_close_date: formData.expected_close_date || null,
        notes: formData.notes || null,
        position
      });

      onOpenChange(false);
      setFormData({
        title: '',
        client_id: '',
        stage_id: '',
        value: '',
        expected_close_date: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error creating deal:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-component border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Negócio</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ex: Renovação Auto - João Silva"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Cliente</Label>
            <Select
              value={formData.client_id}
              onValueChange={(value) => setFormData({ ...formData, client_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingClients ? "Carregando..." : "Selecione um cliente"} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">Etapa *</Label>
            <Select
              value={formData.stage_id}
              onValueChange={(value) => setFormData({ ...formData, stage_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingStages ? "Carregando..." : "Selecione a etapa"} />
              </SelectTrigger>
              <SelectContent>
                {loadingStages ? (
                  <SelectItem value="loading" disabled>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando etapas...
                    </div>
                  </SelectItem>
                ) : !stages || stages.length === 0 ? (
                  <SelectItem value="empty" disabled>
                    Nenhuma etapa encontrada
                  </SelectItem>
                ) : (
                  stages.map((stage: CRMStage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">Valor (R$)</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Previsão Fechamento</Label>
              <Input
                id="date"
                type="date"
                value={formData.expected_close_date}
                onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Anotações sobre o negócio..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || loadingStages || !formData.title || !formData.stage_id}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Criar Negócio
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
