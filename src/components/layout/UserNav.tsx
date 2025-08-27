import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, Settings as SettingsIcon, User } from 'lucide-react';

export function UserNav() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // Extrair iniciais do nome do usuário
  const getInitials = (email: string) => {
    return email.split('@')[0].substring(0, 2).toUpperCase();
  };

  const handleProfile = () => {
    navigate('/dashboard/settings/profile');
  };

  const handleSettings = () => {
    navigate('/dashboard/settings');
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="
          h-8 w-8 cursor-pointer hover:ring-2 hover:ring-white/20 transition-all
          md:h-9 md:w-9
        ">
          <AvatarImage src="" alt="Usuário" />
          <AvatarFallback className="bg-blue-600 text-white text-sm">
            {user?.email ? getInitials(user.email) : 'U'}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-56 bg-slate-900/95 backdrop-blur-lg border-white/20 text-white"
      >
        <DropdownMenuLabel className="text-white/80">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium text-white">
              {user?.email || 'Usuário'}
            </p>
            <p className="text-xs text-white/60">Corretor</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/20" />
        <DropdownMenuItem 
          onClick={handleProfile}
          className="hover:bg-white/10 focus:bg-white/10 cursor-pointer"
        >
          <User className="mr-2 h-4 w-4" />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleSettings}
          className="hover:bg-white/10 focus:bg-white/10 cursor-pointer"
        >
          <SettingsIcon className="mr-2 h-4 w-4" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/20" />
        <DropdownMenuItem 
          onClick={handleLogout}
          className="hover:bg-white/10 focus:bg-white/10 text-red-400 hover:text-red-300 cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
