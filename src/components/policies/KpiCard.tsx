import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  variant?: 'default' | 'warning' | 'success';
  isLoading?: boolean;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  subtitle,
  variant = 'default',
  isLoading = false,
}: KpiCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return 'border-yellow-600/50 bg-yellow-600/10';
      case 'success':
        return 'border-green-600/50 bg-green-600/10';
      default:
        return 'border-slate-700 bg-slate-800/50';
    }
  };

  if (isLoading) {
    return (
      <Card className="border-slate-700 bg-slate-800/50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col space-y-2 flex-1">
            <Skeleton className="h-4 w-32 bg-slate-700" />
            <Skeleton className="h-8 w-24 bg-slate-700" />
            <Skeleton className="h-3 w-20 bg-slate-700" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full bg-slate-700 flex-shrink-0" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={`${getVariantStyles()} p-6 transition-all hover:border-slate-600`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col space-y-1 flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-white break-words">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        <div className="rounded-full bg-slate-700/50 p-3 flex-shrink-0">
          <Icon className="h-5 w-5 text-slate-300" />
        </div>
      </div>
    </Card>
  );
}
