import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  Settings,
  ChevronLeft,
  Menu,
  ListTodo,
  RefreshCw,
  BarChart3,
  ShieldAlert,
  LucideIcon,
  Megaphone,
  Kanban,
  Wallet,
  BookOpen
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
      { id: 'financeiro', name: 'Financeiro', icon: Wallet, path: '/dashboard/financeiro' },
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
      { id: 'documentacao', name: 'Documentação', icon: BookOpen, path: '/dashboard/documentacao' },
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
        "bg-zinc-950 border-r border-zinc-800",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header com Logo */}
      <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
        <img 
          src="/tork_symbol_favicon.png" 
          alt="Tork CRM" 
          className="w-8 h-8 rounded-lg flex-shrink-0"
        />
        {!isCollapsed && (
          <h1 className="text-lg font-bold text-white">
            Tork CRM
          </h1>
        )}
        
        <button
          onClick={toggleSidebar}
          className={cn(
            "p-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors ml-auto",
            "text-zinc-400 hover:text-white",
            "focus:outline-none focus:ring-0 focus-visible:ring-0",
            isCollapsed && "mx-auto ml-0"
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
      <nav className="flex-1 p-2 overflow-y-auto">
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
                    "w-full flex items-center justify-center px-3 py-2.5 rounded-lg mx-1 transition-all duration-200 relative",
                    "text-zinc-400 hover:text-white hover:bg-zinc-800/60",
                    "focus:outline-none focus:ring-0 focus-visible:ring-0",
                    isActive && "bg-zinc-800/80 text-white"
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
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
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
                    "px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider",
                    "hover:text-zinc-300 hover:no-underline rounded-md hover:bg-zinc-800/50",
                    "[&[data-state=open]>svg]:rotate-180"
                  )}
                >
                  {section.title}
                </AccordionTrigger>
                <AccordionContent className="pb-0 pt-1">
                  <div className="space-y-1 px-1">
                    {section.items.map((item) => {
                      const isActive = isPathActive(item.path);
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavigation(item.path)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative",
                            "text-zinc-400 hover:text-white hover:bg-zinc-800/60",
                            "focus:outline-none focus:ring-0 focus-visible:ring-0",
                            isActive && "bg-zinc-800/80 text-white font-medium"
                          )}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                          )}
                          <div className="relative">
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {item.id === 'novidades' && unreadCount > 0 && (
                              <ChangelogBadge count={unreadCount} />
                            )}
                          </div>
                          <span className="text-sm font-medium">
                            {item.name}
                          </span>
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
