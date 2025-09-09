import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { AppCard } from '@/components/ui/app-card';
import { Rocket, Bug, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Changelog } from '@/hooks/useChangelogs';

interface ChangelogCardProps {
  changelog: Changelog;
  isNew?: boolean;
  onView?: () => void;
}

const categoryConfig = {
  feature: {
    icon: Rocket,
    label: 'Nova Funcionalidade',
    variant: 'default' as const,
    className: 'border-primary/20 bg-primary/5'
  },
  bugfix: {
    icon: Bug,
    label: 'Correção',
    variant: 'destructive' as const,
    className: 'border-destructive/20 bg-destructive/5'
  },
  improvement: {
    icon: Zap,
    label: 'Melhoria',
    variant: 'secondary' as const,
    className: 'border-secondary/20 bg-secondary/5'
  },
  breaking: {
    icon: AlertTriangle,
    label: 'Mudança Importante',
    variant: 'outline' as const,
    className: 'border-orange-500/20 bg-orange-500/5'
  }
};

const priorityColors = {
  low: 'text-muted-foreground',
  medium: 'text-foreground',
  high: 'text-orange-500',
  critical: 'text-destructive'
};

export function ChangelogCard({ changelog, isNew = false, onView }: ChangelogCardProps) {
  const config = categoryConfig[changelog.category];
  const Icon = config.icon;

  const handleClick = () => {
    onView?.();
  };

  return (
    <AppCard 
      className={cn(
        'cursor-pointer transition-all duration-200 hover:scale-[1.02]',
        config.className,
        isNew && 'ring-2 ring-primary/20 shadow-lg shadow-primary/10'
      )}
      onClick={handleClick}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <Badge variant={config.variant} className="text-xs">
              {config.label}
            </Badge>
            {isNew && (
              <Badge variant="destructive" className="text-xs animate-pulse">
                NOVO
              </Badge>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-muted-foreground">
              {changelog.version}
            </div>
            <div className={cn('text-xs', priorityColors[changelog.priority])}>
              Prioridade: {changelog.priority}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground leading-tight">
            {changelog.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {changelog.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/10">
          <time className="text-xs text-muted-foreground">
            {format(new Date(changelog.created_at), "dd 'de' MMMM 'de' yyyy", {
              locale: ptBR
            })}
          </time>
          {isNew && (
            <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          )}
        </div>
      </div>
    </AppCard>
  );
}