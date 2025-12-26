import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  DollarSign,
  Settings,
  ChevronLeft,
  Menu,
  ListTodo,
  RefreshCw,
  BarChart3,
  ShieldAlert,
  LucideIcon,
  Megaphone,
  Kanban
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChangelogs } from '@/hooks/useChangelogs';
import { ChangelogBadge } from '@/components/changelog/ChangelogBadge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const menuSections = [
  {
    id: 'visao-geral',
    title: 'Visão Geral',
    items: [
      { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { id: 'reports', name: 'Relatórios', icon: BarChart3, path: '/dashboard/reports' },
      { id: 'billing', name: 'Faturamento', icon: DollarSign, path: '/dashboard/faturamento' },
    ]
  },
  {
    id: 'comercial',
    title: 'Comercial',
    items: [
      { id: 'crm', name: 'CRM', icon: Kanban, path: '/dashboard/crm' },
    ]
  },
  {
    id: 'operacional',
    title: 'Operacional',
    items: [
      { id: 'policies', name: 'Apólices', icon: FileText, path: '/dashboard/policies' },
      { id: 'clients', name: 'Clientes', icon: Users, path: '/dashboard/clients' },
      { id: 'appointments', name: 'Agendamentos', icon: Calendar, path: '/dashboard/appointments' },
      { id: 'tasks', name: 'Tarefas', icon: ListTodo, path: '/dashboard/tasks' },
      { id: 'renovacoes', name: 'Renovações', icon: RefreshCw, path: '/dashboard/renovacoes' },
      { id: 'sinistros', name: 'Sinistros', icon: ShieldAlert, path: '/dashboard/sinistros' },
    ]
  },
  {
    id: 'sistema',
    title: 'Sistema',
    items: [
      { id: 'novidades', name: 'Novidades', icon: Megaphone, path: '/dashboard/novidades' },
      { id: 'settings', name: 'Configurações', icon: Settings, path: '/dashboard/settings' },
    ]
  }
];

export function GlassSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useChangelogs();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Helper function to check if current path is active
  const isPathActive = (itemPath: string) => {
    if (itemPath === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/dashboard/';
    }
    return location.pathname.startsWith(itemPath);
  };

  // Find which section contains the active route
  const getActiveSections = () => {
    return menuSections
      .filter(section => section.items.some(item => isPathActive(item.path)))
      .map(section => section.id);
  };

  return (
    <div 
      className={cn(
        "h-full transition-all duration-300 ease-out flex-shrink-0 relative",
        "bg-black/20 backdrop-blur-xl border-r border-white/10",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        {!isCollapsed && (
          <h1 className="text-lg font-semibold text-white">
            Tork CRM
          </h1>
        )}
        
        <button
          onClick={toggleSidebar}
          className={cn(
            "p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors",
            "text-white/80 hover:text-white",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? (
            <Menu className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {isCollapsed ? (
          // Collapsed mode - show only icons
          <div className="space-y-1">
            {menuSections.flatMap(section => section.items).map((item) => {
              const isActive = isPathActive(item.path);
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    "w-full flex items-center justify-center p-3 rounded-lg transition-all duration-200 relative",
                    "text-white/80 hover:text-white hover:bg-white/10",
                    "focus:outline-none focus:ring-2 focus:ring-white/20",
                    isActive && "bg-white/15 text-white"
                  )}
                  title={item.name}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {item.id === 'novidades' && unreadCount > 0 && (
                      <ChangelogBadge count={unreadCount} />
                    )}
                  </div>
                  {isActive && (
                    <div className="absolute right-0 w-1 h-8 bg-blue-400 rounded-l-full" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          // Expanded mode - show accordion groups
          <Accordion 
            type="multiple" 
            defaultValue={getActiveSections()}
            className="space-y-2"
          >
            {menuSections.map((section) => (
              <AccordionItem 
                key={section.id} 
                value={section.id} 
                className="border-none"
              >
                <AccordionTrigger 
                  className={cn(
                    "px-3 py-2 text-xs font-semibold text-white/50 uppercase tracking-wider",
                    "hover:text-white/70 hover:no-underline rounded-lg hover:bg-white/5",
                    "[&[data-state=open]>svg]:rotate-180"
                  )}
                >
                  {section.title}
                </AccordionTrigger>
                <AccordionContent className="pb-0 pt-1">
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = isPathActive(item.path);
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavigation(item.path)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 relative",
                            "text-white/80 hover:text-white hover:bg-white/10",
                            "focus:outline-none focus:ring-2 focus:ring-white/20",
                            isActive && "bg-white/15 text-white font-medium"
                          )}
                        >
                          <div className="relative">
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {item.id === 'novidades' && unreadCount > 0 && (
                              <ChangelogBadge count={unreadCount} />
                            )}
                          </div>
                          <span className="text-sm font-medium">
                            {item.name}
                          </span>
                          {isActive && (
                            <div className="absolute right-0 w-1 h-8 bg-blue-400 rounded-l-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </nav>
    </div>
  );
}
