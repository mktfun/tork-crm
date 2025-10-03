
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ptBR } from 'date-fns/locale';

interface VisaoSemanaProps {
  appointments: any[];
  onDateClick: (dateStr: string) => void;
  onEventClick: (eventId: string) => void;
}

export function VisaoSemana({ appointments, onDateClick, onEventClick }: VisaoSemanaProps) {
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

  const handleDateClick = (arg: any) => {
    onDateClick(arg.dateStr);
  };

  const handleEventClick = (arg: any) => {
    onEventClick(arg.event.id);
  };

  return (
    <div className="fullcalendar-container">
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        events={events}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        locale={ptBR}
        height="auto"
        headerToolbar={false}
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
        allDaySlot={false}
        eventColor="#3b82f6"
        eventTextColor="#ffffff"
      />
      
      {/* Estilos customizados para visão de semana */}
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
        
        .fullcalendar-container .fc-col-header-cell {
          background: rgba(30, 41, 59, 0.8);
          color: #94a3b8;
          font-weight: 600;
        }
        
        .fullcalendar-container .fc-timegrid-slot {
          border-top: 1px solid #1e293b;
        }
        
        .fullcalendar-container .fc-timegrid-slot-label {
          color: #64748b;
        }
        
        .fullcalendar-container .fc-day-today {
          background: rgba(59, 130, 246, 0.1) !important;
        }
        
        .fullcalendar-container .fc-event {
          background: #3b82f6;
          border: 1px solid #2563eb;
          color: #ffffff;
        }
        
        .fullcalendar-container .fc-event:hover {
          background: #2563eb;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
