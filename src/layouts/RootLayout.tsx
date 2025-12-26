import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { GlassSidebar } from '@/components/layout/GlassSidebar';
import { Header } from '@/components/layout/Header';
import { SearchCommand } from '@/components/SearchCommand';
import { ModernMobileNav } from '@/components/layout/ModernMobileNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRealtimeClients } from '@/hooks/useRealtimeClients';
import { cn } from '@/lib/utils';

export function RootLayout() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // 🚀 **REALTIME GLOBAL** - Ativo em toda a aplicação
  useRealtimeClients();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950">
      {/* Gradiente radial sutil para profundidade - estilo fintech */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ 
          background: 'radial-gradient(ellipse at 50% 0%, rgba(39, 39, 42, 0.5) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(24, 24, 27, 0.3) 0%, transparent 40%)'
        }}
      />
      
      {/* Content Container */}
      <div className="relative z-10 flex h-full w-full">
        {/* SIDEBAR APENAS NO DESKTOP */}
        {!isMobile && <GlassSidebar />}

        {/* RESTO DA TELA - HEADER + CONTEÚDO */}
        <div className="flex flex-1 flex-col min-w-0">
          
          {/* HEADER CONTAINER */}
          <div className="flex-shrink-0 w-full">
            <Header onSearchClick={() => setIsSearchOpen(true)} />
          </div>

          {/* ÁREA PRINCIPAL ONDE AS PÁGINAS VÃO APARECER */}
          <main className={cn(
            "flex-1 overflow-y-auto p-4 md:p-6",
            isMobile && "pb-20" // Espaço para o floating nav
          )}>
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* NAVEGAÇÃO MODERNA APENAS NO MOBILE */}
      {isMobile && <ModernMobileNav />}

      {/* BUSCA UNIVERSAL */}
      <SearchCommand open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </div>
  );
}
