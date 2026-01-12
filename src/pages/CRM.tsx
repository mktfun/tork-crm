import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { KanbanBoard } from '@/components/crm/KanbanBoard';
import { PipelineSelector } from '@/components/crm/PipelineSelector';
import { PipelineManagerModal } from '@/components/crm/PipelineManagerModal';
import { useCRMPipelines } from '@/hooks/useCRMPipelines';
import { Button } from '@/components/ui/button';
import { RefreshCw, MessageCircle, Loader2, Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export default function CRM() {
  const navigate = useNavigate();
  const { pipelines, isLoading, createPipeline } = useCRMPipelines();
  const [selectedPipelineId, setSelectedPipelineId] = useLocalStorage<string | null>('crm-selected-pipeline', null);
  const [showPipelineManager, setShowPipelineManager] = useState(false);

  // Auto-selecionar pipeline default se nenhum selecionado
  useEffect(() => {
    if (!isLoading && pipelines.length > 0 && !selectedPipelineId) {
      const defaultPipeline = pipelines.find(p => p.is_default) || pipelines[0];
      setSelectedPipelineId(defaultPipeline.id);
    }
  }, [pipelines, selectedPipelineId, isLoading, setSelectedPipelineId]);

  // Se o pipeline selecionado foi deletado, selecionar outro
  useEffect(() => {
    if (!isLoading && selectedPipelineId && pipelines.length > 0) {
      const exists = pipelines.some(p => p.id === selectedPipelineId);
      if (!exists) {
        const defaultPipeline = pipelines.find(p => p.is_default) || pipelines[0];
        setSelectedPipelineId(defaultPipeline.id);
      }
    }
  }, [pipelines, selectedPipelineId, isLoading, setSelectedPipelineId]);

  const handleCreateFirstPipeline = () => {
    createPipeline.mutate({
      name: 'Funil de Vendas',
      description: 'Pipeline principal de vendas',
      is_default: true,
      createDefaultStages: true
    }, {
      onSuccess: (data) => {
        setSelectedPipelineId(data.id);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Estado inicial: sem pipelines
  if (pipelines.length === 0) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground">CRM</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie seus leads e negócios no funil de vendas
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center h-64 text-center"
        >
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Comece seu CRM
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Crie seu primeiro funil para começar a gerenciar seus negócios no Kanban.
          </p>
          <Button onClick={handleCreateFirstPipeline} disabled={createPipeline.isPending}>
            {createPipeline.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Criar Primeiro Funil
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus leads e negócios no funil de vendas
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <PipelineSelector
            pipelines={pipelines}
            selectedId={selectedPipelineId}
            onSelect={setSelectedPipelineId}
            onManage={() => setShowPipelineManager(true)}
          />
          
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sincronizar
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/dashboard/settings/chat-tork')}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Chat Tork
          </Button>
        </div>
      </motion.div>

      {/* Kanban Board */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <KanbanBoard pipelineId={selectedPipelineId} />
      </motion.div>

      {/* Pipeline Manager Modal */}
      <PipelineManagerModal
        open={showPipelineManager}
        onOpenChange={setShowPipelineManager}
      />
    </div>
  );
}
