import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { CRMStage, CRMDeal } from '@/hooks/useCRMDeals';
import { DealCard } from './DealCard';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatCurrency';

interface KanbanColumnProps {
  stage: CRMStage;
  deals: CRMDeal[];
  onAddDeal: () => void;
  onDealClick?: (deal: CRMDeal) => void;
}

export function KanbanColumn({ stage, deals, onAddDeal, onDealClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0 w-80"
    >
      {/* Column Header */}
      <div 
        className="glass-component rounded-xl p-4 mb-3"
        style={{ borderTopColor: stage.color, borderTopWidth: '3px' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div 
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="font-semibold text-foreground">{stage.name}</h3>
          </div>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-secondary/50 text-muted-foreground">
            {deals.length}
          </span>
        </div>
        {totalValue > 0 && (
          <p className="text-sm text-muted-foreground">
            {formatCurrency(totalValue)}
          </p>
        )}
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={`
          min-h-[400px] rounded-xl p-2 transition-colors duration-200
          ${isOver ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-transparent'}
        `}
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {deals.map((deal) => (
              <DealCard 
                key={deal.id} 
                deal={deal} 
                onClick={() => onDealClick?.(deal)}
              />
            ))}
          </div>
        </SortableContext>

        {/* Add Deal Button */}
        <Button
          variant="ghost"
          className="w-full mt-3 border border-dashed border-border/50 hover:border-primary/50 hover:bg-primary/5"
          onClick={onAddDeal}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Negócio
        </Button>
      </div>
    </motion.div>
  );
}
