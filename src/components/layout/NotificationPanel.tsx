import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSupabaseNotifications } from '@/hooks/useSupabaseNotifications';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function NotificationPanel() {
  const { notifications, unreadCount, loading, markAsRead } = useSupabaseNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = async (notification: any) => {
    // Marcar como lida se não estiver
    if (!notification.is_read) {
      try {
        await markAsRead(notification.id);
      } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
      }
    }

    // Redirecionar para agendamentos se houver appointment_id
    if (notification.appointment_id) {
      navigate(`/dashboard/appointments?highlight=${notification.appointment_id}`);
    }
  };

  const hasUnreadNotifications = unreadCount > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-zinc-800 relative focus-visible:ring-0"
        >
          <Bell className="h-4 w-4" />
          {/* Badge de notificação */}
          {hasUnreadNotifications && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-80 bg-zinc-900/95 backdrop-blur-lg border-zinc-700 text-white"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Notificações</h3>
            {hasUnreadNotifications && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                {unreadCount} nova{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {loading ? (
            <div className="text-white/60 text-sm">Carregando...</div>
          ) : notifications.length === 0 ? (
            <div className="text-white/60 text-sm text-center py-4">
              🔔 Nenhuma notificação ainda
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    notification.is_read 
                      ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                      : 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20'
                  }`}
                >
                  <div className={`font-medium text-sm ${
                    notification.is_read ? 'text-white/80' : 'text-white'
                  }`}>
                    {notification.message}
                  </div>
                  <div className="text-xs text-white/60 mt-1">
                    {format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 bg-blue-400 rounded-full absolute top-2 right-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
