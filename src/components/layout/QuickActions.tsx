import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

export function QuickActions() {
  const navigate = useNavigate();

  const handleNewClient = () => {
    navigate('/dashboard/clients');
    console.log('Abrir modal de novo cliente');
  };

  const handleNewPolicy = () => {
    navigate('/dashboard/policies');
    console.log('Abrir modal de nova apólice');
  };

  const handleNewAppointment = () => {
    navigate('/dashboard/appointments');
    console.log('Abrir modal de novo agendamento');
  };

  const handleNewQuote = () => {
    console.log('Abrir modal de nova cotação');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="secondary" 
          size="sm"
          className="
            bg-white/10 hover:bg-white/20 border border-white/20 text-white 
            h-8 w-8 p-0 md:h-9 md:w-9
          "
        >
          <Plus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-56 bg-zinc-900/95 backdrop-blur-lg border-zinc-700 text-white z-50"
      >
        <DropdownMenuLabel className="text-white/80">
          Ações Rápidas
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/20" />
        
        <DropdownMenuItem 
          onClick={handleNewClient}
          className="hover:bg-white/10 focus:bg-white/10 cursor-pointer"
        >
          Novo Cliente
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={handleNewQuote}
          className="hover:bg-white/10 focus:bg-white/10 cursor-pointer"
        >
          Nova Cotação
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={handleNewPolicy}
          className="hover:bg-white/10 focus:bg-white/10 cursor-pointer"
        >
          Nova Apólice
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-white/20" />
        
        <DropdownMenuItem 
          onClick={handleNewAppointment}
          className="hover:bg-white/10 focus:bg-white/10 cursor-pointer"
        >
          Novo Agendamento
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
