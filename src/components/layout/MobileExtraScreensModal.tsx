import { useState } from 'react';
import { Grid3X3, Settings, CreditCard, Shield, UserCog, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNavigate } from 'react-router-dom';

const extraScreens = [
  {
    title: 'Financeiro',
    icon: CreditCard,
    path: '/dashboard/financeiro',
    description: 'Gestão financeira e receitas'
  },
  {
    title: 'Configurações',
    icon: Settings,
    path: '/dashboard/settings',
    description: 'Configurações do sistema'
  },
  {
    title: 'Sinistros',
    icon: Shield,
    path: '/dashboard/sinistros',
    description: 'Gestão de sinistros'
  },
  {
    title: 'Perfil',
    icon: UserCog,
    path: '/dashboard/settings/profile',
    description: 'Dados do usuário'
  },
  {
    title: 'Analytics',
    icon: PieChart,
    path: '/dashboard/reports',
    description: 'Análises avançadas'
  },
];

export function MobileExtraScreensModal() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleScreenClick = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          className="text-white hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-200"
        >
          <Grid3X3 className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="mobile-extra-screens-content rounded-t-2xl"
      >
        <div className="py-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-semibold text-white text-center">
              Todas as Telas
            </SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
            {extraScreens.map((screen) => {
              const IconComponent = screen.icon;
              return (
                <Button
                  key={screen.path}
                  variant="ghost"
                  className="mobile-extra-screen-item h-auto p-4 flex flex-col items-center gap-3 rounded-xl"
                  onClick={() => handleScreenClick(screen.path)}
                >
                  <div className="mobile-extra-screen-icon p-3 rounded-full">
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-center">
                    <div className="text-white font-medium text-sm">{screen.title}</div>
                    <div className="text-white/60 text-xs mt-1">{screen.description}</div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
