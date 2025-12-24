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
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { useCRMStages, useCRMDeals, CRMStage, CRMDeal } from '@/hooks/useCRMDeals';
import { KanbanColumn } from './KanbanColumn';
import { DealCard } from './DealCard';
import { DealDetailsModal } from './DealDetailsModal';
import { NewDealModal } from './NewDealModal';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Sparkles } from 'lucide-react';

export function KanbanBoard() {
  const { stages, isLoading: stagesLoading, initializeStages } = useCRMStages();
  const { deals, isLoading: dealsLoading, moveDeal } = useCRMDeals();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<CRMDeal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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
    if (!activeId) return null;
    return deals.find((deal) => deal.id === activeId);
  }, [activeId, deals]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over for visual feedback
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const dealId = active.id as string;
    const overId = over.id as string;

    // Find the target stage
    let targetStageId = overId;
    
    // If dropped on another deal, get its stage
    const overDeal = deals.find((d) => d.id === overId);
    if (overDeal) {
      targetStageId = overDeal.stage_id;
    }

    // Validate target stage exists
    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

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
  };

  const handleAddDeal = (stageId: string) => {
    setSelectedStageId(stageId);
    setShowNewDealModal(true);
  };

  const handleDealClick = (deal: CRMDeal) => {
    setSelectedDeal(deal);
  };

  if (stagesLoading || dealsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
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
        <Button onClick={() => initializeStages.mutate()} disabled={initializeStages.isPending}>
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
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              onAddDeal={() => handleAddDeal(stage.id)}
              onDealClick={handleDealClick}
            />
          ))}
        </div>

        <DragOverlay>
          <AnimatePresence>
            {activeDeal && (
              <motion.div
                initial={{ scale: 1.05, opacity: 0.8 }}
                animate={{ scale: 1.05, opacity: 0.9 }}
                exit={{ scale: 1, opacity: 1 }}
                className="rotate-3"
              >
                <DealCard deal={activeDeal} isDragging />
              </motion.div>
            )}
          </AnimatePresence>
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
    </>
  );
}
