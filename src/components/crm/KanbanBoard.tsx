import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { useCRMStages, useCRMDeals, CRMStage, CRMDeal } from '@/hooks/useCRMDeals';
import { KanbanColumn } from './KanbanColumn';
import { DealCard } from './DealCard';
import { DealDetailsModal } from './DealDetailsModal';
import { NewDealModal } from './NewDealModal';
import { NewStageModal } from './NewStageModal';
import { StageEditModal } from './StageEditModal';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Sparkles } from 'lucide-react';

interface KanbanBoardProps {
  pipelineId: string | null;
}

export function KanbanBoard({ pipelineId }: KanbanBoardProps) {
  const { stages, isLoading: stagesLoading, initializeStages, reorderStages, deleteStage } = useCRMStages(pipelineId);
  const { deals, isLoading: dealsLoading, moveDeal } = useCRMDeals(pipelineId);
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'deal' | 'column' | null>(null);
  
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<CRMDeal | null>(null);
  
  const [showNewStageModal, setShowNewStageModal] = useState(false);
  const [editingStage, setEditingStage] = useState<CRMStage | null>(null);

  // Configure sensors with distance constraint for click vs drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement = drag, less = click
      },
    })
  );

  const dealsByStage = useMemo(() => {
    const grouped: Record<string, CRMDeal[]> = {};
    stages.forEach((stage) => {
      grouped[stage.id] = deals
        .filter((deal) => deal.stage_id === stage.id)
        .sort((a, b) => a.position - b.position);
    });
    return grouped;
  }, [deals, stages]);

  const activeDeal = useMemo(() => {
    if (!activeId || activeType !== 'deal') return null;
    return deals.find((deal) => deal.id === activeId);
  }, [activeId, activeType, deals]);

  const activeStage = useMemo(() => {
    if (!activeId || activeType !== 'column') return null;
    const stageId = activeId.replace('column-', '');
    return stages.find((stage) => stage.id === stageId);
  }, [activeId, activeType, stages]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;
    
    if (id.startsWith('column-')) {
      setActiveType('column');
      setActiveId(id);
    } else {
      setActiveType('deal');
      setActiveId(id);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Visual feedback handled by isOver in columns
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setActiveType(null);
      return;
    }

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Handle column reordering
    if (activeIdStr.startsWith('column-') && overIdStr.startsWith('column-')) {
      const activeStageId = activeIdStr.replace('column-', '');
      const overStageId = overIdStr.replace('column-', '');
      
      if (activeStageId !== overStageId) {
        const oldIndex = stages.findIndex(s => s.id === activeStageId);
        const newIndex = stages.findIndex(s => s.id === overStageId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(stages, oldIndex, newIndex);
          reorderStages.mutate(newOrder.map(s => s.id));
        }
      }
      
      setActiveId(null);
      setActiveType(null);
      return;
    }

    // Handle deal movement
    if (!activeIdStr.startsWith('column-')) {
      const dealId = activeIdStr;
      let targetStageId = overIdStr;
      
      // If dropped on another deal, get its stage
      if (!overIdStr.startsWith('column-')) {
        const overDeal = deals.find((d) => d.id === overIdStr);
        if (overDeal) {
          targetStageId = overDeal.stage_id;
        }
      } else {
        targetStageId = overIdStr.replace('column-', '');
      }

      // Validate target stage exists
      const targetStage = stages.find((s) => s.id === targetStageId);
      if (!targetStage) {
        setActiveId(null);
        setActiveType(null);
        return;
      }

      const deal = deals.find((d) => d.id === dealId);
      if (!deal) {
        setActiveId(null);
        setActiveType(null);
        return;
      }

      // Calculate new position
      const dealsInTargetStage = dealsByStage[targetStageId] || [];
      const newPosition = dealsInTargetStage.length;

      if (deal.stage_id !== targetStageId) {
        moveDeal.mutate({
          dealId,
          newStageId: targetStageId,
          newPosition,
        });
      }
    }

    setActiveId(null);
    setActiveType(null);
  };

  const handleAddDeal = (stageId: string) => {
    setSelectedStageId(stageId);
    setShowNewDealModal(true);
  };

  const handleDealClick = (deal: CRMDeal) => {
    setSelectedDeal(deal);
  };

  const handleEditStage = (stage: CRMStage) => {
    setEditingStage(stage);
  };

  const handleDeleteStage = (stageId: string) => {
    deleteStage.mutate(stageId);
  };

  const handleInitializeStages = () => {
    if (pipelineId) {
      initializeStages.mutate(pipelineId);
    }
  };

  if (stagesLoading || dealsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pipelineId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-64 text-center"
      >
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Selecione um Funil
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          Selecione ou crie um funil para começar a gerenciar seus negócios.
        </p>
      </motion.div>
    );
  }

  if (stages.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-64 text-center"
      >
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Configure seu Funil de Vendas
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          Crie as etapas do seu funil para começar a gerenciar seus negócios no Kanban.
        </p>
        <Button onClick={handleInitializeStages} disabled={initializeStages.isPending}>
          {initializeStages.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Criar Etapas Padrão
        </Button>
      </motion.div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-220px)]">
          <SortableContext
            items={stages.map(s => `column-${s.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage[stage.id] || []}
                onAddDeal={() => handleAddDeal(stage.id)}
                onDealClick={handleDealClick}
                onEditStage={handleEditStage}
                onDeleteStage={handleDeleteStage}
              />
            ))}
          </SortableContext>

          {/* New Stage Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-shrink-0 w-80"
          >
            <Button
              variant="ghost"
              onClick={() => setShowNewStageModal(true)}
              className="
                h-24 w-full 
                border-2 border-dashed border-border/50
                hover:border-primary/50 hover:bg-primary/5
                rounded-xl
                flex flex-col items-center justify-center gap-2
                text-muted-foreground hover:text-foreground
                transition-all duration-200
              "
            >
              <Plus className="h-6 w-6" />
              <span>Nova Etapa</span>
            </Button>
          </motion.div>
        </div>

        <DragOverlay dropAnimation={{
          duration: 250,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)'
        }}>
          {activeDeal && (
            <div 
              className="w-80 cursor-grabbing"
              style={{ pointerEvents: 'none' }}
            >
              <DealCard 
                deal={activeDeal} 
                isDragging 
                stageColor={stages.find(s => s.id === activeDeal.stage_id)?.color}
              />
            </div>
          )}
          {activeStage && (
            <div 
              className="w-80 cursor-grabbing"
              style={{ pointerEvents: 'none' }}
            >
              <div 
                className="glass-component rounded-xl p-4"
                style={{ borderTop: `3px solid ${activeStage.color}` }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: activeStage.color }}
                  />
                  <h3 className="font-semibold text-foreground">{activeStage.name}</h3>
                  <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-secondary/50 text-muted-foreground">
                    {dealsByStage[activeStage.id]?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <NewDealModal
        open={showNewDealModal}
        onOpenChange={setShowNewDealModal}
        defaultStageId={selectedStageId}
      />

      <DealDetailsModal
        deal={selectedDeal}
        open={!!selectedDeal}
        onOpenChange={(open) => !open && setSelectedDeal(null)}
      />

      <NewStageModal
        open={showNewStageModal}
        onOpenChange={setShowNewStageModal}
        pipelineId={pipelineId}
      />

      <StageEditModal
        stage={editingStage}
        open={!!editingStage}
        onOpenChange={(open) => !open && setEditingStage(null)}
      />
    </>
  );
}
