import { useState, useEffect } from 'react';
import { Save, Loader2, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CRMPipeline, useCRMPipelines } from '@/hooks/useCRMPipelines';

interface PipelineEditModalProps {
  pipeline: CRMPipeline | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PipelineEditModal({ pipeline, open, onOpenChange }: PipelineEditModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const { updatePipeline, setDefaultPipeline } = useCRMPipelines();

  useEffect(() => {
    if (pipeline) {
      setName(pipeline.name);
      setDescription(pipeline.description || '');
      setIsDefault(pipeline.is_default);
    }
  }, [pipeline]);

  const handleSave = () => {
    if (!pipeline || !name.trim()) return;

    const updates: Partial<CRMPipeline> & { id: string } = {
      id: pipeline.id,
      name: name.trim(),
      description: description.trim() || null
    };

    // Se mudou o status de default
    if (isDefault && !pipeline.is_default) {
      setDefaultPipeline.mutate(pipeline.id, {
        onSuccess: () => {
          // Atualizar nome/descrição após definir como default
          updatePipeline.mutate(updates, {
            onSuccess: () => onOpenChange(false)
          });
        }
      });
    } else {
      updatePipeline.mutate(updates, {
        onSuccess: () => onOpenChange(false)
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const isPending = updatePipeline.isPending || setDefaultPipeline.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-component border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Funil</DialogTitle>
          <DialogDescription>
            Atualize as informações do funil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-pipeline-name">Nome do Funil</Label>
            <Input
              id="edit-pipeline-name"
              placeholder="Ex: Vendas, Sinistros, Renovações..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary/30"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-pipeline-description">Descrição (opcional)</Label>
            <Textarea
              id="edit-pipeline-description"
              placeholder="Descreva o propósito deste funil..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-secondary/30 resize-none"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between pt-2 p-4 rounded-lg bg-secondary/20 border border-border/30">
            <div className="flex items-center gap-2">
              <Star className={`h-4 w-4 ${isDefault ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
              <Label htmlFor="edit-is-default" className="cursor-pointer">
                Funil principal
              </Label>
            </div>
            <Switch
              id="edit-is-default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
              disabled={pipeline?.is_default} // Não pode desmarcar se já é default
            />
          </div>
          
          {pipeline?.is_default && (
            <p className="text-xs text-muted-foreground">
              Este é o funil principal. Para alterá-lo, defina outro funil como principal.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
