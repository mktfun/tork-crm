import { useSupabaseAppointments } from '@/hooks/useSupabaseAppointments';
import { useSupabaseClients } from '@/hooks/useSupabaseClients';
import { useSupabaseTasks } from '@/hooks/useSupabaseTasks';
import { Calendar, Coffee, Clock, User, Loader2, ExternalLink, CheckSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export function ListaAgendamentosDia() {
  const { appointments, loading: appointmentsLoading } = useSupabaseAppointments();
  const { clients, loading: clientsLoading } = useSupabaseClients();
  const { tasks, loading: tasksLoading } = useSupabaseTasks();
  const navigate = useNavigate();

  // Função para verificar se uma data é hoje
  const isToday = (dateString: string): boolean => {
    const targetDate = new Date(dateString);
    const today = new Date();
    
    targetDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    return targetDate.getTime() === today.getTime();
  };

  // Função para verificar se uma data é futura (incluindo hoje)
  const isFutureOrToday = (dateString: string): boolean => {
    const targetDate = new Date(dateString);
    const today = new Date();
    // Resetar horas para comparar apenas datas
    targetDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return targetDate >= today;
  };

  // Filtrar próximos agendamentos
  const upcomingAppointments = appointments
    .filter(appointment => 
      appointment.status === 'Pendente' && 
      isFutureOrToday(appointment.date)
    )
    .sort((a, b) => {
      const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateComparison !== 0) return dateComparison;
      return a.time.localeCompare(b.time);
    });

  // Filtrar tarefas pendentes do dia de hoje
  const todayTasks = tasks
    .filter(task => 
      task.status === 'Pendente' && 
      isToday(task.dueDate)
    )
    .sort((a, b) => a.title.localeCompare(b.title));

  // Combinar agendamentos e tarefas, limitando o total
  const combinedItems = [
    ...upcomingAppointments.slice(0, 3),
    ...todayTasks.slice(0, 2)
  ].slice(0, 5);

  // Função para obter nome do cliente
  const getClientName = (clientId: string | null) => {
    if (!clientId) return 'Cliente não especificado';
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente não encontrado';
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Resetar horas para comparação
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);

    if (targetDate.getTime() === today.getTime()) {
      return 'Hoje';
    } else if (targetDate.getTime() === tomorrow.getTime()) {
      return 'Amanhã';
    } else {
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    }
  };

  // Função para navegar para detalhes do agendamento
  const handleAppointmentClick = (appointmentId: string) => {
    navigate(`/dashboard/appointments?highlight=${appointmentId}`);
  };

  // Função para navegar para tarefas
  const handleTaskClick = (taskId: string) => {
    navigate(`/tasks?highlight=${taskId}`);
  };

  if (appointmentsLoading || clientsLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        <span className="ml-2 text-slate-300">Carregando compromissos...</span>
      </div>
    );
  }

  if (combinedItems.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-slate-800 rounded-full">
            <Coffee className="w-6 h-6 text-slate-400" />
          </div>
        </div>
        <p className="text-slate-300 mb-1">Nenhum compromisso à vista</p>
        <p className="text-slate-500 text-sm">Que tal um café? ☕️</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {upcomingAppointments.slice(0, 3).map((appointment) => (
        <div 
          key={`appointment-${appointment.id}`}
          className="rounded-md border border-slate-700 bg-slate-800/50 p-3 hover:bg-slate-800/70 transition-all cursor-pointer group"
          onClick={() => handleAppointmentClick(appointment.id)}
        >
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="font-medium text-blue-400 text-sm">
              {formatDate(appointment.date)} às {appointment.time}
            </span>
            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors ml-auto" />
          </div>
          
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-white text-sm">{getClientName(appointment.client_id)}</span>
          </div>
          
          <p className="text-sm text-slate-400 truncate">{appointment.title}</p>
        </div>
      ))}

      {todayTasks.slice(0, 2).map((task) => (
        <div 
          key={`task-${task.id}`}
          className="rounded-md border border-orange-600/50 bg-orange-900/30 p-3 hover:bg-orange-900/40 transition-all cursor-pointer group"
          onClick={() => handleTaskClick(task.id)}
        >
          <div className="flex items-center gap-3 mb-2">
            <CheckSquare className="w-4 h-4 text-orange-400" />
            <span className="font-medium text-orange-400 text-sm">
              Tarefa - {formatDate(task.dueDate)}
            </span>
            <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors ml-auto" />
          </div>
          
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-white text-sm">
              {task.clientId ? getClientName(task.clientId) : 'Sem cliente'}
            </span>
          </div>
          
          <p className="text-sm text-slate-400 truncate">{task.title}</p>
        </div>
      ))}
      
      {(upcomingAppointments.length > 3 || todayTasks.length > 2) && (
        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            + {Math.max(0, upcomingAppointments.length - 3) + Math.max(0, todayTasks.length - 2)} item(s) adicional(is)
          </p>
        </div>
      )}
    </div>
  );
}
