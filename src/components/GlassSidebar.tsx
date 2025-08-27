import { useState } from 'react';
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
  LucideIcon,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlassEffect } from '@/hooks/useGlassEffect';

export function GlassSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sidebarRef = useGlassEffect<HTMLDivElement>();

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'policies', name: 'Apólices', icon: FileText, path: '/policies' },
    { id: 'clients', name: 'Clientes', icon: Users, path: '/clients' },
    { id: 'appointments', name: 'Agendamentos', icon: Calendar, path: '/appointments' },
    { id: 'tasks', name: 'Tarefas', icon: ListTodo, path: '/tasks' },
    { id: 'renovacoes', name: 'Renovações', icon: RefreshCw, path: '/renovacoes' },
    { id: 'reports', name: 'Relatórios', icon: BarChart3, path: '/reports' },
    { id: 'billing', name: 'Faturamento', icon: DollarSign, path: '/faturamento' },
    { id: 'settings', name: 'Configurações', icon: Settings, path: '/settings' },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div 
      ref={sidebarRef}
      className={cn(
        "h-full transition-all duration-500 ease-out flex-shrink-0 relative",
        "glass-sidebar-premium",
        isCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* HEADER PREMIUM */}
      <div className="glass-sidebar-header">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white/20 animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  SGC Pro
                </h1>
                <p className="text-xs text-white/50 font-medium">Liquid Glass</p>
              </div>
            </div>
          )}
          
          <button
            onClick={toggleSidebar}
            className={cn(
              "glass-toggle-btn group",
              isCollapsed && "mx-auto"
            )}
          >
            {isCollapsed ? (
              <Menu className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-white/80 group-hover:text-white transition-colors" />
            )}
          </button>
        </div>
      </div>

      {/* NAVIGATION PREMIUM */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-hidden">
        {menuItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <PremiumMenuItem
              key={item.id}
              onClick={() => handleNavigation(item.path)}
              isActive={isActive}
              isCollapsed={isCollapsed}
              icon={Icon}
              name={item.name}
              index={index}
            />
          );
        })}
      </nav>

      {/* FOOTER PREMIUM */}
      {!isCollapsed && (
        <div className="glass-sidebar-footer">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-white/90">
                SGC Pro v2.0
              </span>
            </div>
            <p className="text-xs text-white/60 font-medium">
              Liquid Glass Edition
            </p>
            <div className="mt-3 flex justify-center">
              <div className="w-12 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// COMPONENTE PREMIUM MENU ITEM
interface PremiumMenuItemProps {
  onClick: () => void;
  isActive: boolean;
  isCollapsed: boolean;
  icon: LucideIcon;
  name: string;
  index: number;
}

function PremiumMenuItem({ 
  onClick, 
  isActive, 
  isCollapsed, 
  icon: Icon, 
  name, 
  index 
}: PremiumMenuItemProps) {
  const itemRef = useGlassEffect<HTMLButtonElement>();

  return (
    <button
      ref={itemRef}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300",
        "glass-menu-item group relative",
        "text-white/80 hover:text-white",
        "focus:outline-none focus:ring-2 focus:ring-white/20",
        { 'active': isActive },
        isCollapsed && "justify-center p-3"
      )}
      title={isCollapsed ? name : undefined}
      style={{
        animationDelay: `${index * 0.05}s`
      }}
    >
      <div className="relative">
        <Icon 
          className={cn(
            "glass-icon",
            isCollapsed ? "w-6 h-6" : "w-5 h-5",
            "flex-shrink-0"
          )} 
        />
        {isActive && (
          <div className="absolute -inset-2 bg-blue-400/20 rounded-lg blur-sm animate-pulse"></div>
        )}
      </div>
      
      {!isCollapsed && (
        <div className="flex-1 text-left">
          <span className={cn(
            "font-medium text-sm tracking-wide transition-all duration-300",
            isActive && "text-white font-semibold"
          )}>
            {name}
          </span>
          {isActive && (
            <div className="w-full h-0.5 bg-gradient-to-r from-blue-400/50 to-purple-400/50 rounded-full mt-1 animate-pulse"></div>
          )}
        </div>
      )}

      {/* HOVER INDICATOR */}
      <div className={cn(
        "absolute right-2 w-1 h-8 bg-gradient-to-b from-blue-400 to-purple-500 rounded-full",
        "opacity-0 group-hover:opacity-60 transition-opacity duration-300",
        isCollapsed && "hidden"
      )}></div>

      {/* RIPPLE EFFECT */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-active:opacity-20 bg-white transition-opacity duration-150"></div>
    </button>
  );
}
