import React from 'react';
import { InteractiveMenu, type InteractiveMenuItem } from '@/components/ui/modern-mobile-menu';
import { 
  Home, 
  Briefcase, 
  Calendar, 
  Shield, 
  Settings,
  LayoutDashboard,
  FileText,
  Users,
  DollarSign,
  BarChart3
} from 'lucide-react';

// Demo items matching your app's navigation
const appMenuItems: InteractiveMenuItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Apólices', icon: FileText },
  { label: 'Clientes', icon: Users },
  { label: 'Agenda', icon: Calendar },
  { label: 'Relatórios', icon: BarChart3 },
];

const financeMenuItems: InteractiveMenuItem[] = [
  { label: 'Dashboard', icon: Home },
  { label: 'Faturamento', icon: DollarSign },
  { label: 'Relatórios', icon: BarChart3 },
  { label: 'Configurações', icon: Settings },
];

const lucideDemoMenuItems: InteractiveMenuItem[] = [
  { label: 'home', icon: Home },
  { label: 'strategy', icon: Briefcase },
  { label: 'period', icon: Calendar },
  { label: 'security', icon: Shield },
  { label: 'settings', icon: Settings },
];

const customAccentColor = 'hsl(var(--chart-2))';
const blueAccentColor = '#3b82f6';
const greenAccentColor = '#10b981';

// Default demo
const Default = () => {
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold text-white mb-2">Default Menu</h3>
      <InteractiveMenu />
    </div>
  );
};

// Customized with your app's navigation
const AppNavigation = () => {
  const handleItemClick = (index: number, item: InteractiveMenuItem) => {
    console.log(`Navigating to: ${item.label}`);
    // Here you could add navigation logic
    // navigate(`/dashboard/${item.label.toLowerCase()}`);
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold text-white mb-2">App Navigation</h3>
      <InteractiveMenu 
        items={appMenuItems} 
        accentColor={blueAccentColor}
        onItemClick={handleItemClick}
      />
    </div>
  );
};

// Customized with chart colors
const CustomizedWithChartColor = () => {
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold text-white mb-2">Custom Accent Color</h3>
      <InteractiveMenu 
        items={lucideDemoMenuItems} 
        accentColor={customAccentColor} 
      />
    </div>
  );
};

// Finance themed
const FinanceTheme = () => {
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold text-white mb-2">Finance Theme</h3>
      <InteractiveMenu 
        items={financeMenuItems} 
        accentColor={greenAccentColor}
      />
    </div>
  );
};

// Mobile optimized version
const MobileOptimized = () => {
  const mobileItems: InteractiveMenuItem[] = [
    { label: 'Home', icon: Home },
    { label: 'Agenda', icon: Calendar },
    { label: 'Clientes', icon: Users },
    { label: 'Config', icon: Settings },
  ];

  return (
    <div className="p-2 space-y-4">
      <h3 className="text-sm font-semibold text-white mb-2">Mobile Optimized</h3>
      <div className="max-w-xs mx-auto">
        <InteractiveMenu 
          items={mobileItems} 
          accentColor={blueAccentColor}
        />
      </div>
    </div>
  );
};

export { 
  Default, 
  CustomizedWithChartColor, 
  AppNavigation, 
  FinanceTheme, 
  MobileOptimized 
};

// Export a demo page component
export const ModernMobileMenuDemoPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Modern Mobile Menu</h1>
          <p className="text-slate-300">Interactive mobile navigation component</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700">
            <Default />
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700">
            <AppNavigation />
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700">
            <CustomizedWithChartColor />
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700">
            <FinanceTheme />
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700">
          <MobileOptimized />
        </div>
      </div>
    </div>
  );
};
