import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, FileText, CreditCard, User, LogOut } from 'lucide-react';

interface PortalClient {
  id: string;
  name: string;
  cpf_cnpj: string | null;
  portal_password: string | null;
  portal_first_access: boolean;
  user_id: string;
}

export function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [client, setClient] = useState<PortalClient | null>(null);

  useEffect(() => {
    const clientData = sessionStorage.getItem('portal_client');
    if (clientData) {
      setClient(JSON.parse(clientData));
    }
  }, []);

  if (!client) {
    return <Navigate to="/portal" replace />;
  }

  const handleLogout = () => {
    sessionStorage.removeItem('portal_client');
    navigate('/portal');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-20">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 p-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold">
              Olá, {client.name?.split(' ')[0]}
            </h1>
            <p className="text-slate-400 text-xs">Portal do Segurado</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout}
            className="text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="p-4 max-w-lg mx-auto">
        <Outlet />
      </main>
      
      {/* Bottom Navigation - Mobile First */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800/95 backdrop-blur-sm border-t border-slate-700 safe-area-pb">
        <div className="max-w-lg mx-auto flex justify-around py-2">
          <Button 
            variant="ghost" 
            className={`flex flex-col items-center gap-1 h-auto py-2 px-4 ${
              isActive('/portal/home') 
                ? 'text-purple-400' 
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => navigate('/portal/home')}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">Início</span>
          </Button>
          
          <Button 
            variant="ghost" 
            className={`flex flex-col items-center gap-1 h-auto py-2 px-4 ${
              isActive('/portal/policies') 
                ? 'text-purple-400' 
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => navigate('/portal/policies')}
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs">Seguros</span>
          </Button>
          
          <Button 
            variant="ghost" 
            className={`flex flex-col items-center gap-1 h-auto py-2 px-4 ${
              isActive('/portal/cards') 
                ? 'text-purple-400' 
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => navigate('/portal/cards')}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-xs">Carteirinhas</span>
          </Button>
          
          <Button 
            variant="ghost" 
            className={`flex flex-col items-center gap-1 h-auto py-2 px-4 ${
              isActive('/portal/profile') 
                ? 'text-purple-400' 
                : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => navigate('/portal/profile')}
          >
            <User className="w-5 h-5" />
            <span className="text-xs">Perfil</span>
          </Button>
        </div>
      </nav>
    </div>
  );
}
