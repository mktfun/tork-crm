
import FullCalendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { ptBR } from 'date-fns/locale';

interface VisaoAgendaProps {
  appointments: any[];
  onEventClick: (eventId: string) => void;
}

export function VisaoAgenda({ appointments, onEventClick }: VisaoAgendaProps) {
  // DIRETRIZ DE DADOS: Mapeamento perfeito e inteligente
  const events = appointments.map(apt => ({
    id: apt.id,
    title: apt.title,
    start: `${apt.date}T${apt.time}`,
    extendedProps: {
      clientId: apt.client_id,
      policyId: apt.policy_id,
      status: apt.status,
      recurrenceRule: apt.recurrence_rule,
      notes: apt.notes,
      time: apt.time
    }
  }));

  const handleEventClick = (arg: any) => {
    onEventClick(arg.event.id);
  };

  return (
    <div className="fullcalendar-container">
      <FullCalendar
        plugins={[listPlugin, interactionPlugin]}
        initialView="listWeek"
        events={events}
        eventClick={handleEventClick}
        locale={ptBR}
        height="auto"
        headerToolbar={false}
        eventColor="#3b82f6"
        eventTextColor="#ffffff"
        listDayFormat={{ weekday: 'long' }}
        listDaySideFormat={{ day: 'numeric', month: 'short' }}
      />
      
      {/* Estilos customizados para visão de agenda */}
      <style>{`
        .fullcalendar-container .fc {
          background: transparent;
          color: #ffffff;
        }
        
        .fullcalendar-container .fc-theme-standard td,
        .fullcalendar-container .fc-theme-standard th {
          border: 1px solid #334155;
          background: rgba(15, 23, 42, 0.5);
        }
        
        .fullcalendar-container .fc-list-day-cushion {
          background: rgba(30, 41, 59, 0.8);
          color: #94a3b8;
          font-weight: 600;
        }
        
        .fullcalendar-container .fc-list-event-title {
          color: #e2e8f0;
        }
        
        .fullcalendar-container .fc-list-event-time {
          color: #64748b;
        }
        
        .fullcalendar-container .fc-list-event:hover {
          background: rgba(51, 65, 85, 0.5);
          cursor: pointer;
        }
        
        .fullcalendar-container .fc-event-dot {
          background: #3b82f6;
        }
      `}</style>
    </div>
  );
}
