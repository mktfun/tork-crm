import { useState } from 'react';
import { motion } from 'framer-motion';
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
import { useCRMStages, PRESET_COLORS } from '@/hooks/useCRMDeals';

interface NewStageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId?: string | null;
}

export function NewStageModal({ open, onOpenChange, pipelineId }: NewStageModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const { createStage } = useCRMStages(pipelineId);

  const handleCreate = () => {
    if (!name.trim()) return;
    
    createStage.mutate(
      { name: name.trim(), color, pipeline_id: pipelineId || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          setName('');
          setColor(PRESET_COLORS[0]);
        }
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setName('');
    setColor(PRESET_COLORS[0]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-component border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Etapa do Funil</DialogTitle>
          <DialogDescription>
            Adicione uma nova etapa ao seu funil de vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="stage-name">Nome da Etapa</Label>
            <Input
              id="stage-name"
              placeholder="Ex: Qualificação, Proposta, Fechamento..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary/30"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <motion.button
                  key={c}
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`
                    h-9 w-9 rounded-full transition-all duration-200
                    ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-110' : 'hover:opacity-80'}
                  `}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          {name && (
            <div className="pt-2">
              <Label className="text-muted-foreground text-xs">Preview</Label>
              <div 
                className="mt-2 glass-component rounded-lg p-3 border-t-4"
                style={{ borderTopColor: color }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium text-foreground">{name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">0</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!name.trim() || createStage.isPending}
          >
            {createStage.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Criar Etapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
