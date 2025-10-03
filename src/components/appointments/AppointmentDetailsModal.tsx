
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, FileText, CheckCircle, X, Repeat } from 'lucide-react';
import { useSupabaseAppointments } from '@/hooks/useSupabaseAppointments';
import { useClients } from '@/hooks/useAppData';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AppCard } from '@/components/ui/app-card';
import { supabase } from '@/integrations/supabase/client';
import RecurrenceConfig from './RecurrenceConfig';

interface AppointmentDetailsModalProps {
  appointment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppointmentDetailsModal({ appointment, open, onOpenChange }: AppointmentDetailsModalProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isEditingRecurrence, setIsEditingRecurrence] = useState(false);
  const [newRecurrenceRule, setNewRecurrenceRule] = useState<string | null>(null);
  const [isSavingRecurrence, setIsSavingRecurrence] = useState(false);
  const { updateAppointment } = useSupabaseAppointments();
  const { clients } = useClients();
  const { toast } = useToast();

  if (!appointment) return null;

  const client = clients.find(c => c.id === appointment.client_id);
  const isCompleted = appointment.status === 'Realizado';
  const isCanceled = appointment.status === 'Cancelado';
  const isPending = appointment.status === 'Pendente';

  const handleConcluirAgendamento = async () => {
    if (!isPending) return;

    setIsCompleting(true);
    try {
      await updateAppointment(appointment.id, {
        status: 'Realizado'
      });

      // Se o agendamento tem regra de recorrência, criar próximo agendamento
      if (appointment.recurrence_rule) {
        try {
          const { error: functionError } = await supabase.functions.invoke('create-next-appointment', {
            body: { appointmentId: appointment.id }
          });

          if (functionError) {
            console.error('Erro ao criar próximo agendamento:', functionError);
            toast({
              title: "Agendamento Concluído",
              description: "Agendamento marcado como realizado, mas houve um problema ao criar a próxima ocorrência.",
              variant: "default"
            });
          } else {
            toast({
              title: "Concluído e próxima ocorrência criada",
              description: "Agendamento marcado como realizado e a próxima ocorrência foi criada automaticamente."
            });
          }
        } catch (err) {
          console.error('Erro ao invocar Edge Function:', err);
          toast({
            title: "Agendamento Concluído",
            description: "Agendamento marcado como realizado, mas houve um problema ao criar a próxima ocorrência.",
            variant: "default"
          });
        }
      } else {
        toast({
          title: "Concluído",
          description: "Agendamento marcado como realizado (não há próxima ocorrência porque não é recorrente)."
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao concluir agendamento:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar agendamento",
        variant: "destructive"
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCancelarAgendamento = async () => {
    if (!isPending) return;

    setIsCanceling(true);
    try {
      await updateAppointment(appointment.id, {
        status: 'Cancelado'
      });

      toast({
        title: "Sucesso",
        description: "Agendamento cancelado com sucesso!"
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      toast({
        title: "Erro",
        description: "Falha ao cancelar agendamento",
        variant: "destructive"
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Realizado':
        return 'bg-green-600 text-green-100';
      case 'Cancelado':
        return 'bg-red-600 text-red-100';
      case 'Pendente':
        return 'bg-blue-600 text-blue-100';
      default:
        return 'bg-gray-600 text-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Realizado':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'Cancelado':
        return <X className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const handleSaveRecurrence = async () => {
    setIsSavingRecurrence(true);
    try {
      await updateAppointment(appointment.id, {
        recurrence_rule: newRecurrenceRule
      });

      toast({
        title: "Recorrência configurada",
        description: newRecurrenceRule 
          ? "Agendamento agora é recorrente. Ao concluí-lo, a próxima ocorrência será criada automaticamente." 
          : "Recorrência removida do agendamento."
      });

      setIsEditingRecurrence(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao configurar recorrência:', error);
      toast({
        title: "Erro",
        description: "Falha ao configurar recorrência",
        variant: "destructive"
      });
    } finally {
      setIsSavingRecurrence(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-transparent border-none p-0">
        <AppCard className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Calendar className="h-5 w-5" />
              Detalhes do Agendamento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex justify-between items-start">
              <div className="flex gap-2">
                <Badge className={getStatusColor(appointment.status)}>
                  {appointment.status}
                </Badge>
                {appointment.recurrence_rule ? (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Repeat className="h-3 w-3" />
                    Recorrente
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    Único
                  </Badge>
                )}
              </div>
              {getStatusIcon(appointment.status)}
            </div>

            {/* Título do Agendamento */}
            <div>
              <h3 className="text-lg font-semibold text-white">{appointment.title}</h3>
            </div>

            {/* Informações de Data e Hora */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-slate-300">
                  {format(new Date(appointment.date), 'PPP', { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-slate-300">{appointment.time}</span>
              </div>
            </div>

            {/* Cliente */}
            {client && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-slate-300">{client.name}</span>
              </div>
            )}

            {/* Observações */}
            {appointment.notes && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-slate-300">Observações:</span>
                </div>
                <p className="text-sm text-slate-400 pl-6">
                  {appointment.notes}
                </p>
              </div>
            )}

            {/* Configurar Recorrência (apenas para pendentes) */}
            {isPending && (
              <div className="space-y-3 border-t border-slate-700 pt-4">
                {!isEditingRecurrence ? (
                  <Button
                    variant="outline"
                    onClick={() => setIsEditingRecurrence(true)}
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Repeat className="h-4 w-4" />
                    {appointment.recurrence_rule ? 'Editar Recorrência' : 'Tornar Recorrente'}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <RecurrenceConfig onRecurrenceChange={setNewRecurrenceRule} />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingRecurrence(false)}
                        className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleSaveRecurrence}
                        disabled={isSavingRecurrence}
                        className="flex-1 bg-primary hover:bg-primary/90"
                      >
                        {isSavingRecurrence ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ações */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Fechar
              </Button>
              {isPending && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancelarAgendamento}
                    disabled={isCanceling}
                    className="border-red-600 text-red-400 hover:bg-red-600/20"
                  >
                    {isCanceling ? 'Cancelando...' : 'Cancelar'}
                  </Button>
                  <Button
                    onClick={handleConcluirAgendamento}
                    disabled={isCompleting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isCompleting ? 'Concluindo...' : 'Concluir Agendamento'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </AppCard>
      </DialogContent>
    </Dialog>
  );
}
