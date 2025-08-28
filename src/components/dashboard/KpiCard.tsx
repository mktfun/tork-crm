import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AppCard } from '@/components/ui/app-card';

interface KpiCardProps {
  title: string;
  value: string;
  comparison?: string;
  icon: ReactNode;
  colorVariant?: 'default' | 'warning' | 'danger';
  onClick?: () => void;
  className?: string;
}

export function KpiCard({
  title,
  value,
  comparison,
  icon,
  colorVariant = 'default',
  onClick,
  className
}: KpiCardProps) {
  // Usar apenas as cores para warning/danger, o resto usa o liquid glass padrão
  const additionalClasses = {
    default: '',
    warning: 'border-yellow-500/50 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/40',
    danger: 'border-red-500/60 bg-red-900/40 text-red-300 hover:bg-red-900/50'
  };

  return (
    <div
      className={cn(
        "glass-component shadow-lg p-4 flex flex-col justify-between transition-all duration-200 hover:scale-105 hover:shadow-lg",
        onClick && "cursor-pointer",
        colorVariant === 'default' ? "border-slate-800 bg-slate-900 hover:bg-slate-800/70" : additionalClasses[colorVariant],
        className
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        <div className={cn(
          "p-2 rounded-lg bg-white/10",
          colorVariant !== 'default' ? 'text-current' : ''
        )}>
          {icon}
        </div>
      </div>

      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white break-words mb-1">
          {value}
        </h2>
        {comparison && (
          <p className="text-xs text-slate-500 line-clamp-2">{comparison}</p>
        )}
      </div>
    </div>
  );
}
