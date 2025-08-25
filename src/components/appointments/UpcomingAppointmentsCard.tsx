import { Calendar, Clock, User, Eye, Check, X, FileText, AlertTriangle, Zap } from 'lucide-react';
import { AppCard } from '@/components/ui/app-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSupabaseAppointments } from '@/hooks/useSupabaseAppointments';
import { useToast } from '@/hooks/use-toast';

interface UpcomingAppointment {
  id: string;
  title: string;
  date: string;
  time: string;
  status: string;
  priority?: string;
  client_id?: string;
  notes?: string;
  client?: {
    name: string;
  };
}

interface UpcomingAppointmentsCardProps {
  appointments: UpcomingAppointment[];
  onViewDetails: (appointmentId: string) => void;
  isLoading?: boolean;
}

export function UpcomingAppointmentsCard({ 
  appointments, 
  onViewDetails,
  isLoading 
}: UpcomingAppointmentsCardProps) {
  const { updateAppointment, isUpdating } = useSupabaseAppointments();
  const { toast } = useToast();

  const handleMarkAsCompleted = async (appointmentId: string) => {
    try {
      await updateAppointment(appointmentId, { status: 'Realizado' });
      toast({
        title: "Sucesso",
        description: "Agendamento marcado como realizado!"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar agendamento",
        variant: "destructive"
      });
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      await updateAppointment(appointmentId, { status: 'Cancelado' });
      toast({
        title: "Sucesso",
        description: "Agendamento cancelado com sucesso!"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao cancelar agendamento",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <AppCard className="h-fit">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-10 h-10 rounded-lg bg-white/10" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32 bg-white/10" />
            <Skeleton className="h-4 w-40 bg-white/5" />
          </div>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-3 rounded-lg bg-white/5">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-20 bg-white/10" />
                  <Skeleton className="h-4 w-full bg-white/5" />
                  <Skeleton className="h-3 w-24 bg-white/5" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="w-8 h-8 rounded bg-white/10" />
                  <Skeleton className="w-8 h-8 rounded bg-white/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </AppCard>
    );
  }

  return (
    <TooltipProvider>
      <AppCard className="h-fit">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Foco Imediato</h3>
            <p className="text-sm text-white/60">Atrasados, hoje e prioritários</p>
          </div>
        </div>

        {appointments.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-white/40" />
            </div>
            <p className="text-white/60 text-sm">Nenhum compromisso urgente</p>
            <p className="text-white/40 text-xs mt-1">Sem atrasados, hoje ou prioritários</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
            {appointments.map((appointment, index) => {
              const appointmentDate = new Date(appointment.date);
              const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
              const now = new Date();
              const isToday = format(new Date(), 'yyyy-MM-dd') === appointment.date;
              const isOverdue = appointmentDateTime < now;
              const isPriority = appointment.priority === 'Alta' || appointment.priority === 'Urgente';
              const dayName = format(appointmentDate, 'EEEE', { locale: ptBR });
              const timeFormatted = appointment.time.slice(0, 5);
              const clientName = appointment.client?.name || 'Sem cliente';

              // Definir cor e estilo baseado no tipo
              let borderColor = 'border-white/10';
              let bgColor = 'bg-white/5';
              let statusIcon = null;
              let statusLabel = dayName;

              if (isOverdue) {
                borderColor = 'border-red-500/50';
                bgColor = 'bg-red-500/10';
                statusIcon = <AlertTriangle className="w-3 h-3 text-red-400" />;
                statusLabel = 'Atrasado';
              } else if (isToday) {
                borderColor = 'border-blue-500/50';
                bgColor = 'bg-blue-500/10';
                statusLabel = 'Hoje';
              } else if (isPriority) {
                borderColor = 'border-yellow-500/50';
                bgColor = 'bg-yellow-500/10';
                statusIcon = <Zap className="w-3 h-3 text-yellow-400" />;
                statusLabel = `${dayName} - Prioritário`;
              }

              return (
                <div
                  key={appointment.id}
                  className={`group p-3 rounded-lg border hover:bg-white/10 transition-all duration-200 ${bgColor} ${borderColor}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="secondary"
                          className={`text-xs flex items-center gap-1 ${
                            isOverdue ? 'bg-red-500/20 text-red-300' :
                            isToday ? 'bg-blue-500/20 text-blue-300' :
                            isPriority ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-white/10 text-white/70'
                          }`}
                        >
                          {statusIcon}
                          {statusLabel}
                        </Badge>
                        <div className="flex items-center gap-1 text-white/60">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs font-medium">{timeFormatted}</span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-white/90 mb-1">
                        <span className="font-medium text-blue-300">{timeFormatted}</span>
                        <span className="text-white/60"> - </span>
                        <span className="font-medium">{appointment.title}</span>
                        <span className="text-white/60"> - </span>
                        <span className="text-white/50">({clientName})</span>
                      </div>
                      
                      {appointment.client_id && (
                        <div className="flex items-center gap-1 text-white/40 mb-1">
                          <User className="w-3 h-3" />
                          <span className="text-xs">{clientName}</span>
                        </div>
                      )}

                      {appointment.notes && (
                        <div className="flex items-start gap-1 text-white/40 mt-2">
                          <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="text-xs leading-relaxed">{appointment.notes}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onViewDetails(appointment.id)}
                            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ver detalhes</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      {appointment.status === 'Pendente' && (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCancelAppointment(appointment.id)}
                                disabled={isUpdating}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 w-8 p-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Cancelar agendamento</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleMarkAsCompleted(appointment.id)}
                                disabled={isUpdating}
                                className="text-green-400 hover:text-green-300 hover:bg-green-500/20 h-8 w-8 p-0"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Marcar como realizado</p>
                            </TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {index < appointments.length - 1 && (
                    <div className="mt-3 h-px bg-white/10" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AppCard>
    </TooltipProvider>
  );
}
