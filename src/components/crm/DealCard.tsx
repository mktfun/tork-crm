import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { User, Phone, Calendar, DollarSign, GripVertical } from 'lucide-react';
import { CRMDeal } from '@/hooks/useCRMDeals';
import { formatCurrency } from '@/utils/formatCurrency';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DealCardProps {
  deal: CRMDeal;
  isDragging?: boolean;
  onClick?: () => void;
}

export function DealCard({ deal, isDragging, onClick }: DealCardProps) {
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
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      whileHover={{ scale: isDragging ? 1 : 1.02 }}
      className={`
        glass-component rounded-xl p-4 relative
        transition-all duration-200
        ${isDragging ? 'shadow-2xl ring-2 ring-primary/50' : 'shadow-lg'}
        ${isSortableDragging ? 'opacity-50' : ''}
      `}
    >
      {/* Drag Handle - Only this area triggers drag */}
      <div 
        {...listeners}
        className="absolute top-2 left-2 p-1.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-secondary/50 transition-colors"
        title="Arrastar"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Clickable Content Area */}
      <div 
        onClick={onClick}
        className="cursor-pointer pl-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <h4 className="font-medium text-foreground line-clamp-2 flex-1 pr-2">
            {deal.title}
          </h4>
        </div>

        {/* Client Info */}
        {deal.client && (
          <div className="mb-3 p-2 rounded-lg bg-secondary/30">
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
          <div className="mt-2 flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="text-xs text-muted-foreground">Sincronizado</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
