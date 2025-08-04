
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, FileText, CheckCircle, X } from 'lucide-react';
import { useRenewalAppointments } from '@/hooks/useRenewalAppointments';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export function RenewalAppointmentsList() {
  const { appointments, loading, error, updateAppointmentStatus } = useRenewalAppointments();

  const handleStatusUpdate = async (appointmentId: string, newStatus: string) => {
    const success = await updateAppointmentStatus(appointmentId, newStatus);
    
    if (success) {
      toast({
        title: "Status atualizado",
        description: `Agendamento marcado como ${newStatus.toLowerCase()}`,
      });
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do agendamento",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agendamentos de Renovação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agendamentos de Renovação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Erro: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agendamentos de Renovação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Nenhum agendamento de renovação encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agendamentos de Renovação ({appointments.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="font-medium">{appointment.title}</h4>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(appointment.date).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {appointment.time}
                    </div>
                  </div>
                </div>
                <Badge 
                  variant={appointment.status === 'Concluído' ? 'default' : 'secondary'}
                >
                  {appointment.status}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{appointment.clientName}</span>
                </div>
                {appointment.policyNumber && (
                  <div className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    <span>Apólice: {appointment.policyNumber}</span>
                  </div>
                )}
              </div>

              {appointment.notes && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                  {appointment.notes}
                </p>
              )}

              {appointment.status === 'Pendente' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleStatusUpdate(appointment.id, 'Concluído')}
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Marcar como Concluído
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate(appointment.id, 'Cancelado')}
                    className="flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
