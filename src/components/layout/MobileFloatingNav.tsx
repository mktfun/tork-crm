import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Calendar,
  Building2,
  Menu
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MobileWorkspaceModal } from './MobileWorkspaceModal';

const quickNavItems = [
  { icon: LayoutDashboard, path: '/dashboard', label: 'Home' },
  { icon: FileText, path: '/dashboard/policies', label: 'Apólices' },
  { icon: Users, path: '/dashboard/clients', label: 'Clientes' },
  { icon: Calendar, path: '/dashboard/appointments', label: 'Agenda' },
];

export function MobileFloatingNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/5 rounded-2xl p-2 shadow-xl">
        <div className="flex items-center justify-between">
          {/* Quick Navigation */}
          <div className="flex items-center gap-1">
            {quickNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "p-3 rounded-xl transition-all duration-200",
                    "text-white/70 hover:text-white",
                    isActive 
                      ? "bg-white/20 text-white" 
                      : "hover:bg-white/10"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>

          {/* Workspace Switcher for Mobile */}
          <MobileWorkspaceModal />
        </div>
      </div>
    </div>
  );
}
