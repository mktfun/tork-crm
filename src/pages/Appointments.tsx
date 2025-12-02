import { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { AppointmentModal } from '@/components/appointments/AppointmentModal';
import { AppointmentDetailsModal } from '@/components/appointments/AppointmentDetailsModal';
import { AppointmentsDashboard } from '@/components/appointments/AppointmentsDashboard';
import { StatsBar } from '@/components/appointments/StatsBar';
import { AppCard } from '@/components/ui/app-card';
import { useAppointments } from '@/hooks/useAppData';
import { useSupabaseAppointments } from '@/hooks/useSupabaseAppointments';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { ptBR } from 'date-fns/locale';

const STATUS_COLORS = {
  Realizado: { backgroundColor: '#16a34a', borderColor: '#15803d' },
  Cancelado: { backgroundColor: '#dc2626', borderColor: '#b91c1c' },
  Pendente: { backgroundColor: '#2563eb', borderColor: '#1d4ed8' },
  Overdue: { backgroundColor: '#ea580c', borderColor: '#c2410c' },
  Default: { backgroundColor: '#475569', borderColor: '#334155' }
};

interface Appointment {
  id: string;
  status: string;
  date: string;
  time: string;
  [key: string]: any;
}

export default function Appointments() {
  const [modoDeVisao, setModoDeVisao] = useState('mes');
  const [dataDeReferencia, setDataDeReferencia] = useState(new Date());
  const [isModalAberto, setIsModalAberto] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [tituloAtual, setTituloAtual] = useState('Julho 2025');
  const [modalInitialDate, setModalInitialDate] = useState<Date | undefined>();
  const calendarRef = useRef<FullCalendar>(null);

  const { appointments } = useAppointments();
  const {
    upcomingAppointments,
    scheduleGaps,
    weeklyStats,
    isLoadingUpcoming,
    isLoadingGaps,
    isLoadingStats
  } = useSupabaseAppointments();

  const getAppointmentColor = (appointment: any) => {
    const now = new Date();
    const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
    const isOverdue = appointmentDateTime < now && appointment.status === 'Pendente';

    switch (appointment.status) {
      case 'Realizado':
        return {
          backgroundColor: '#16a34a',
          borderColor: '#15803d'
        };
      case 'Cancelado':
        return {
          backgroundColor: '#dc2626',
          borderColor: '#b91c1c'
        };
      case 'Pendente':
        if (isOverdue) {
          return {
            backgroundColor: '#dc2626',
            borderColor: '#b91c1c'
          };
        }
        return {
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb'
        };
      default:
        return {
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb'
        };
    }
  };

  const eventsParaCalendario = useMemo(() => {
    if (!appointments) return [];
    return appointments.map(apt => {
      const colors = getAppointmentColor(apt);

      return {
        id: apt.id,
        title: apt.title,
        start: `${apt.date}T${apt.time}`,
        allDay: false,
        extendedProps: {
          time: apt.time,
          status: apt.status,
          client_id: apt.client_id,
          policy_id: apt.policy_id,
          notes: apt.notes,
          recurrence_rule: apt.recurrence_rule,
          parent_appointment_id: apt.parent_appointment_id
        },
        backgroundColor: colors.backgroundColor,
        borderColor: colors.borderColor,
        textColor: '#ffffff'
      };
    });
  }, [appointments]);

  const irParaAnterior = () => {
    calendarRef.current?.getApi().prev();
    atualizarTitulo();
  };

  const irParaProximo = () => {
    calendarRef.current?.getApi().next();
    atualizarTitulo();
  };

  const irParaHoje = () => {
    calendarRef.current?.getApi().today();
    atualizarTitulo();
  };

  const atualizarTitulo = () => {
    setTimeout(() => {
      const api = calendarRef.current?.getApi();
      if (api) {
        const currentDate = api.view.title;
        setTituloAtual(currentDate);
      }
    }, 100);
  };

  const handleDateClick = (arg: { dateStr: string }) => {
    setDataAgendamento(arg.dateStr);
    setIsModalAberto(true);
  };

  const handleEventClick = (clickInfo: { event: { id: string } }) => {
    const appointmentId = clickInfo.event.id;
    const appointment = appointments.find(a => a.id === appointmentId);
    if (appointment) {
      setAgendamentoSelecionado(appointment);
      setIsDetailsModalOpen(true);
    }
  };

  const handleViewAppointmentDetails = (appointmentId: string) => {
    const appointment = appointments.find(a => a.id === appointmentId);
    if (appointment) {
      setAgendamentoSelecionado(appointment);
      setIsDetailsModalOpen(true);
    }
  };

  const handleScheduleAtDate = (date: Date) => {
    setModalInitialDate(date);
    setIsModalAberto(true);
  };

  const handleViewChange = (view: string) => {
    if (view) {
      setModoDeVisao(view);
      const api = calendarRef.current?.getApi();
      if (api) {
        api.changeView(
          view === 'mes' ? 'dayGridMonth' :
            view === 'semana' ? 'timeGridWeek' : 'listWeek'
        );
        atualizarTitulo();
      }
    }
  };

  const handleNovoAgendamento = () => {
    setModalInitialDate(undefined);
    setIsModalAberto(true);
  };

  return (
    <div className="space-y-6">
      {/* Barra de Ferramentas */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={irParaAnterior}
            className="h-9 px-3"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={irParaHoje}
            className="h-9 px-4"
          >
            Hoje
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={irParaProximo}
            className="h-9 px-3"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-xl font-semibold text-white">
            {tituloAtual}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <ToggleGroup
            type="single"
            value={modoDeVisao}
            onValueChange={handleViewChange}
            className="bg-slate-800/50 rounded-lg p-1"
          >
            <ToggleGroupItem
              value="mes"
              className="text-sm px-3 py-1 data-[state=on]:bg-blue-600 data-[state=on]:text-white"
            >
              Mês
            </ToggleGroupItem>
            <ToggleGroupItem
              value="semana"
              className="text-sm px-3 py-1 data-[state=on]:bg-blue-600 data-[state=on]:text-white"
            >
              Semana
            </ToggleGroupItem>
            <ToggleGroupItem
              value="agenda"
              className="text-sm px-3 py-1 data-[state=on]:bg-blue-600 data-[state=on]:text-white"
            >
              Agenda
            </ToggleGroupItem>
          </ToggleGroup>

          <Button onClick={handleNovoAgendamento} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Barra de Estatísticas com Loading */}
      <StatsBar weeklyStats={weeklyStats} isLoading={isLoadingStats} />

      {/* Layout Principal: Calendário + Painel de Comando */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr,auto] gap-6">
        <div className="min-w-0">
          <AppCard className="p-4">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={eventsParaCalendario}
              locale={ptBR}
              headerToolbar={false}
              height="70vh"
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              datesSet={atualizarTitulo}

              dayMaxEvents={3}
              eventDisplay="block"

              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              allDaySlot={false}
              slotDuration="00:30:00"
              slotLabelInterval="01:00:00"

              listDayFormat={{ weekday: 'long' }}
              listDaySideFormat={{ day: 'numeric', month: 'short' }}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: false
              }}

              nowIndicator={true}
              selectMirror={true}
              dayHeaderFormat={{ weekday: 'short' }}

              eventMouseEnter={(info) => {
                info.el.style.cursor = 'pointer';
              }}

              aspectRatio={1.35}
              handleWindowResize={true}
            />
          </AppCard>
        </div>

        {/* Painel de Comando com Loading States */}
        <div className="xl:block">
          <AppointmentsDashboard
            upcomingAppointments={upcomingAppointments || []}
            scheduleGaps={scheduleGaps || []}
            onViewAppointmentDetails={handleViewAppointmentDetails}
            onScheduleAtDate={handleScheduleAtDate}
            isLoadingUpcoming={isLoadingUpcoming}
            isLoadingGaps={isLoadingGaps}
            className="h-full"
          />
        </div>
      </div>

      {/* Modais */}
      <AppointmentModal
        initialDate={modalInitialDate}
        isOpen={isModalAberto}
        onOpenChange={(open) => {
          setIsModalAberto(open);
          if (!open) {
            setModalInitialDate(undefined);
          }
        }}
        triggerButton={null}
      />

      <AppointmentDetailsModal
        appointment={agendamentoSelecionado}
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
      />
    </div>
  );
}
