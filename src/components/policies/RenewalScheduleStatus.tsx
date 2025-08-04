
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Policy } from '@/types';
import { differenceInDays } from 'date-fns';

interface RenewalScheduleStatusProps {
  policy: Policy;
}

export function RenewalScheduleStatus({ policy }: RenewalScheduleStatusProps) {
  if (!policy.automaticRenewal || policy.status !== 'Ativa') {
    return null;
  }

  const today = new Date();
  const expirationDate = new Date(policy.expirationDate);
  const daysUntilExpiration = differenceInDays(expirationDate, today);
  
  // Data do agendamento (15 dias antes do vencimento)
  const scheduledDate = new Date(expirationDate);
  scheduledDate.setDate(scheduledDate.getDate() - 15);
  
  const isScheduleActive = daysUntilExpiration <= 90 && daysUntilExpiration > 0;
  const isOverdue = daysUntilExpiration < 0;

  if (isOverdue) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Vencida - Renovação pendente</span>
      </div>
    );
  }

  if (!isScheduleActive) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="flex items-center gap-1 text-blue-600 border-blue-300">
        <Calendar className="w-3 h-3" />
        Renovação agendada
      </Badge>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Clock className="w-3 h-3" />
        {scheduledDate.toLocaleDateString('pt-BR')}
      </div>
    </div>
  );
}
