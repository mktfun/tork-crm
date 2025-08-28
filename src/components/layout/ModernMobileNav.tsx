import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { InteractiveMenu, type InteractiveMenuItem } from '@/components/ui/modern-mobile-menu';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Calendar,
  BarChart3
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const navigationItems: InteractiveMenuItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Apólices', icon: FileText },
  { label: 'Clientes', icon: Users },
  { label: 'Agenda', icon: Calendar },
  { label: 'Relatórios', icon: BarChart3 },
];

// Path mapping for navigation
const pathMapping: Record<string, string> = {
  'Dashboard': '/dashboard',
  'Apólices': '/dashboard/policies',
  'Clientes': '/dashboard/clients',
  'Agenda': '/dashboard/appointments',
  'Relatórios': '/dashboard/reports'
};

export function ModernMobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Don't render on desktop
  if (!isMobile) {
    return null;
  }

  // Get current active index based on current path
  const getCurrentActiveIndex = () => {
    const currentPath = location.pathname;
    const activeItem = Object.entries(pathMapping).find(([, path]) => 
      currentPath === path || currentPath.startsWith(path + '/')
    );
    
    if (activeItem) {
      const activeLabel = activeItem[0];
      return navigationItems.findIndex(item => item.label === activeLabel);
    }
    
    return 0; // Default to Dashboard
  };

  const handleItemClick = (index: number, item: InteractiveMenuItem) => {
    const targetPath = pathMapping[item.label];
    if (targetPath) {
      navigate(targetPath);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
      <div className="max-w-sm mx-auto">
        <div className="liquid-glass-dock p-2">
          <InteractiveMenu
            items={navigationItems}
            accentColor="hsl(var(--chart-2))"
            onItemClick={handleItemClick}
          />
        </div>
      </div>
    </div>
  );
}

// Alternative version that can be used as a replacement for MobileFloatingNav
export function EnhancedMobileFloatingNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Don't render on desktop
  if (!isMobile) {
    return null;
  }

  const handleItemClick = (index: number, item: InteractiveMenuItem) => {
    const targetPath = pathMapping[item.label];
    if (targetPath) {
      navigate(targetPath);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="liquid-glass-dock p-3">
        <InteractiveMenu
          items={navigationItems}
          accentColor="#3b82f6"
          onItemClick={handleItemClick}
        />
      </div>
    </div>
  );
}

// Compact version for tight spaces
export function CompactMobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const compactItems: InteractiveMenuItem[] = [
    { label: 'Home', icon: LayoutDashboard },
    { label: 'Agenda', icon: Calendar },
    { label: 'Clientes', icon: Users },
    { label: 'Config', icon: BarChart3 },
  ];

  const compactPathMapping: Record<string, string> = {
    'Home': '/dashboard',
    'Agenda': '/dashboard/appointments',
    'Clientes': '/dashboard/clients',
    'Config': '/dashboard/settings'
  };

  if (!isMobile) {
    return null;
  }

  const handleItemClick = (index: number, item: InteractiveMenuItem) => {
    const targetPath = compactPathMapping[item.label];
    if (targetPath) {
      navigate(targetPath);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="max-w-xs mx-auto">
        <div className="liquid-glass-dock p-2">
          <InteractiveMenu
            items={compactItems}
            accentColor="hsl(var(--accent-foreground))"
            onItemClick={handleItemClick}
          />
        </div>
      </div>
    </div>
  );
}
