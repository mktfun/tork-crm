
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VisaoMesProps {
  appointments: any[];
  onDateClick: (dateStr: string) => void;
  onEventClick: (eventId: string) => void;
}

export function VisaoMes({ appointments, onDateClick, onEventClick }: VisaoMesProps) {
  // DIRETRIZ DE DADOS: Mapeamento perfeito e inteligente
  const events = appointments.map(apt => ({
    id: apt.id,
    title: apt.title,
    start: apt.date,
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
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        locale={ptBR}
        height="auto"
        headerToolbar={false} // Vamos usar nosso próprio cabeçalho
        dayMaxEvents={3}
        eventDisplay="block"
        eventTextColor="#ffffff"
        eventColor="#3b82f6"
        // DIRETRIZ DE ESTILO: Customização completa
        dayCellClassNames="bg-slate-900/50 border-slate-800 hover:bg-slate-800/50"
        eventClassNames="bg-blue-600 text-white border-blue-500 rounded-md"
      />
      
      {/* Estilos customizados para alinhar ao nosso tema */}
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
        
        .fullcalendar-container .fc-theme-standard .fc-scrollgrid {
          border: 1px solid #334155;
        }
        
        .fullcalendar-container .fc-col-header-cell {
          background: rgba(30, 41, 59, 0.8);
          color: #94a3b8;
          font-weight: 600;
        }
        
        .fullcalendar-container .fc-daygrid-day-number {
          color: #e2e8f0;
        }
        
        .fullcalendar-container .fc-day-today {
          background: rgba(59, 130, 246, 0.1) !important;
        }
        
        .fullcalendar-container .fc-day-today .fc-daygrid-day-number {
          color: #3b82f6;
          font-weight: bold;
        }
        
        .fullcalendar-container .fc-event {
          background: #3b82f6;
          border: 1px solid #2563eb;
          color: #ffffff;
          font-size: 0.75rem;
        }
        
        .fullcalendar-container .fc-event:hover {
          background: #2563eb;
          cursor: pointer;
        }
        
        .fullcalendar-container .fc-daygrid-day:hover {
          background: rgba(51, 65, 85, 0.5);
        }
      `}</style>
    </div>
  );
}
