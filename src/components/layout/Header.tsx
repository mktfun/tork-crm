import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserNav } from './UserNav';
import { NotificationPanel } from './NotificationPanel';
import { QuickActions } from './QuickActions';
import { MobileExtraScreensModal } from './MobileExtraScreensModal';
import { useIsMobile } from '@/hooks/use-mobile';

interface HeaderProps {
  onSearchClick: () => void;
}

export function Header({ onSearchClick }: HeaderProps) {
  const isMobile = useIsMobile();

  return (
    <header className="h-16 bg-zinc-950/95 backdrop-blur-lg border-b border-zinc-800">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        {/* Menu Button - apenas no mobile */}
        {isMobile && (
          <MobileExtraScreensModal />
        )}

        {/* Área central - busca e ações rápidas */}
        <div className="flex items-center gap-2 flex-1 justify-center md:justify-start">
          {!isMobile && <QuickActions />}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onSearchClick}
            className="text-white/70 hover:text-white hover:bg-zinc-800 gap-2 focus-visible:ring-0"
          >
            <Search className="h-4 w-4" />
            {!isMobile && <span>Buscar...</span>}
          </Button>
        </div>

        {/* Área direita - notificações e perfil */}
        <div className="flex items-center gap-2">
          <NotificationPanel />
          <UserNav />
        </div>
      </div>
    </header>
  );
}
