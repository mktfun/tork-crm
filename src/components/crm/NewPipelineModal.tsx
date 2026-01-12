import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useCRMPipelines } from '@/hooks/useCRMPipelines';

interface NewPipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewPipelineModal({ open, onOpenChange }: NewPipelineModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createDefaultStages, setCreateDefaultStages] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const { createPipeline, pipelines } = useCRMPipelines();

  const handleCreate = () => {
    if (!name.trim()) return;
    
    createPipeline.mutate(
      { 
        name: name.trim(), 
        description: description.trim() || undefined,
        is_default: isDefault || pipelines.length === 0, // Primeiro pipeline é sempre default
        createDefaultStages
      },
      {
        onSuccess: () => {
          handleClose();
        }
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setName('');
    setDescription('');
    setCreateDefaultStages(true);
    setIsDefault(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-component border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Funil</DialogTitle>
          <DialogDescription>
            Crie um novo funil para organizar diferentes processos de vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pipeline-name">Nome do Funil</Label>
            <Input
              id="pipeline-name"
              placeholder="Ex: Vendas, Sinistros, Renovações..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary/30"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pipeline-description">Descrição (opcional)</Label>
            <Textarea
              id="pipeline-description"
              placeholder="Descreva o propósito deste funil..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-secondary/30 resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id="create-stages"
                checked={createDefaultStages}
                onCheckedChange={(checked) => setCreateDefaultStages(checked === true)}
              />
              <Label htmlFor="create-stages" className="text-sm cursor-pointer">
                Criar com etapas padrão
              </Label>
            </div>

            {pipelines.length > 0 && (
              <div className="flex items-center gap-3">
                <Checkbox
                  id="is-default"
                  checked={isDefault}
                  onCheckedChange={(checked) => setIsDefault(checked === true)}
                />
                <Label htmlFor="is-default" className="text-sm cursor-pointer">
                  Definir como funil principal
                </Label>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!name.trim() || createPipeline.isPending}
          >
            {createPipeline.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Criar Funil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
