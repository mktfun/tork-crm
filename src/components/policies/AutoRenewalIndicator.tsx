
import React from 'react';
import { RotateCcw, Calendar, Check, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { differenceInDays } from 'date-fns';
import { RenewalScheduleStatus } from './RenewalScheduleStatus';

interface AutoRenewalIndicatorProps {
  automaticRenewal: boolean;
  expirationDate: string;
  status: string;
  size?: 'sm' | 'md';
}

export function AutoRenewalIndicator({ 
  automaticRenewal, 
  expirationDate,
  status,
  size = 'sm' 
}: AutoRenewalIndicatorProps) {
  const today = new Date();
  const expDate = new Date(expirationDate);
  const daysUntilExpiration = differenceInDays(expDate, today);
  
  if (!automaticRenewal) return null;

  const isOverdue = daysUntilExpiration < 0;
  const isNearExpiration = daysUntilExpiration <= 90 && daysUntilExpiration > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge 
          variant={isOverdue ? "destructive" : isNearExpiration ? "default" : "secondary"} 
          className={`${size === 'md' ? 'px-3 py-1' : 'px-2 py-0.5'} flex items-center gap-1`}
        >
          <RotateCcw className="w-3 h-3" />
          Renovação Automática
        </Badge>
        
        {isOverdue && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Vencida ({Math.abs(daysUntilExpiration)} dias)
          </Badge>
        )}
        
        {isNearExpiration && (
          <Badge variant="outline" className="flex items-center gap-1 text-orange-600 border-orange-300">
            <Calendar className="w-3 h-3" />
            Vence em {daysUntilExpiration} dias
          </Badge>
        )}
      </div>
      
      <RenewalScheduleStatus policy={{ automaticRenewal, expirationDate, status }} />
    </div>
  );
}
