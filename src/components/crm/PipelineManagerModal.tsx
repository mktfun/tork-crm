import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Trash2, Plus, Star, GripVertical, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CRMPipeline, useCRMPipelines } from '@/hooks/useCRMPipelines';
import { NewPipelineModal } from './NewPipelineModal';
import { PipelineEditModal } from './PipelineEditModal';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface PipelineManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PipelineManagerModal({ open, onOpenChange }: PipelineManagerModalProps) {
  const { pipelines, deletePipeline } = useCRMPipelines();
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<CRMPipeline | null>(null);
  const [deletingPipeline, setDeletingPipeline] = useState<CRMPipeline | null>(null);

  // Query para contar stages e deals por pipeline
  const { data: pipelineStats } = useQuery({
    queryKey: ['pipeline-stats', pipelines.map(p => p.id)],
    queryFn: async () => {
      const stats: Record<string, { stagesCount: number; dealsCount: number }> = {};

      for (const pipeline of pipelines) {
        // Contar stages
        const { data: stages } = await supabase
          .from('crm_stages')
          .select('id')
          .eq('pipeline_id', pipeline.id);

        const stagesCount = stages?.length || 0;

        // Contar deals
        let dealsCount = 0;
        if (stages && stages.length > 0) {
          const stageIds = stages.map(s => s.id);
          const { count } = await supabase
            .from('crm_deals')
            .select('*', { count: 'exact', head: true })
            .in('stage_id', stageIds);
          dealsCount = count || 0;
        }

        stats[pipeline.id] = { stagesCount, dealsCount };
      }

      return stats;
    },
    enabled: open && pipelines.length > 0
  });

  const handleDelete = () => {
    if (!deletingPipeline) return;
    deletePipeline.mutate(deletingPipeline.id, {
      onSuccess: () => setDeletingPipeline(null)
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-component border-border/50 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Funis</DialogTitle>
            <DialogDescription>
              Crie e organize seus funis de vendas para diferentes processos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {pipelines.map((pipeline) => {
                const stats = pipelineStats?.[pipeline.id];
                
                return (
                  <motion.div
                    key={pipeline.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="group glass-component rounded-lg p-4 border border-border/50 hover:border-border transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 opacity-0 group-hover:opacity-50 cursor-grab">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {pipeline.is_default && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                          )}
                          <h4 className="font-medium text-foreground truncate">
                            {pipeline.name}
                          </h4>
                        </div>
                        
                        {pipeline.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {pipeline.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{stats?.stagesCount || 0} etapas</span>
                          <span>•</span>
                          <span>{stats?.dealsCount || 0} negócios</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setEditingPipeline(pipeline)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => setDeletingPipeline(pipeline)}
                          disabled={pipeline.is_default}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {pipelines.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum funil criado ainda.
              </div>
            )}
          </div>

          <Button 
            onClick={() => setShowNewModal(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Funil
          </Button>
        </DialogContent>
      </Dialog>

      <NewPipelineModal
        open={showNewModal}
        onOpenChange={setShowNewModal}
      />

      <PipelineEditModal
        pipeline={editingPipeline}
        open={!!editingPipeline}
        onOpenChange={(open) => !open && setEditingPipeline(null)}
      />

      <AlertDialog open={!!deletingPipeline} onOpenChange={(open) => !open && setDeletingPipeline(null)}>
        <AlertDialogContent className="glass-component border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir Funil
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o funil "{deletingPipeline?.name}"?
              <br />
              <strong>Esta ação irá remover todas as etapas associadas e não pode ser desfeita.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePipeline.isPending}
            >
              {deletePipeline.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
