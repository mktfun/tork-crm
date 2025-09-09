import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChangelogBadgeProps {
  count: number;
  className?: string;
}

export function ChangelogBadge({ count, className }: ChangelogBadgeProps) {
  if (count === 0) return null;

  return (
    <Badge 
      variant="destructive" 
      className={cn(
        'absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center animate-pulse',
        'min-w-[20px] rounded-full',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
}