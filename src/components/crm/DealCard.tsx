import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { User, Phone, Calendar, DollarSign } from 'lucide-react';
import { CRMDeal } from '@/hooks/useCRMDeals';
import { formatCurrency } from '@/utils/formatCurrency';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DealCardProps {
  deal: CRMDeal;
  isDragging?: boolean;
  onClick?: () => void;
  stageColor?: string;
}

export function DealCard({ deal, isDragging, onClick, stageColor = '#3B82F6' }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: stageColor,
    // Fixed width to prevent stretching during drag
    width: '100%',
    minWidth: '288px',
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      // Disable layout animation during drag to prevent "stretching" effect
      layout={!isSortableDragging}
      layoutId={isSortableDragging ? undefined : deal.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: isSortableDragging ? 0.5 : 1, 
        scale: 1,
      }}
      whileHover={{ scale: isDragging ? 1 : 1.02, y: -2 }}
      onClick={onClick}
      className={`
        glass-component rounded-xl p-4 cursor-pointer
        transition-all duration-200
        border-l-4
        ${isDragging ? 'shadow-2xl ring-2 ring-primary/50 cursor-grabbing' : 'shadow-lg hover:shadow-xl'}
        ${isSortableDragging ? 'opacity-50' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-medium text-foreground line-clamp-2 flex-1 pr-2">
          {deal.title}
        </h4>
      </div>

      {/* Client Info */}
      {deal.client && (
        <div className="mb-3 p-2.5 rounded-lg bg-secondary/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-foreground mb-1">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium truncate">{deal.client.name}</span>
          </div>
          {deal.client.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{deal.client.phone}</span>
            </div>
          )}
        </div>
      )}

      {/* Value & Date */}
      <div className="flex items-center justify-between text-sm">
        {deal.value > 0 && (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <DollarSign className="h-3.5 w-3.5" />
            <span className="font-semibold">{formatCurrency(deal.value)}</span>
          </div>
        )}
        {deal.expected_close_date && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs">
              {format(new Date(deal.expected_close_date), 'dd MMM', { locale: ptBR })}
            </span>
          </div>
        )}
      </div>

      {/* Notes Preview */}
      {deal.notes && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
          {deal.notes}
        </p>
      )}

      {/* Sync Indicator */}
      {deal.chatwoot_conversation_id && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-muted-foreground">Sincronizado com Tork</span>
        </div>
      )}
    </motion.div>
  );
}
