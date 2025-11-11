import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatCurrency';
import { format, differenceInDays, isToday } from 'date-fns';
import { Cake, FileText, DollarSign } from 'lucide-react';

interface ClientRowCardProps {
  client: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    cpfCnpj?: string;
    birthDate?: string;
    status: string;
    createdAt: string;
  };
  activePoliciesCount: number;
  totalPremium: number;
  onClick: () => void;
}

export function ClientRowCard({ 
  client, 
  activePoliciesCount, 
  totalPremium, 
  onClick 
}: ClientRowCardProps) {
  // Verificar se é aniversário hoje
  const isBirthdayToday = client.birthDate && isToday(new Date(client.birthDate));
  
  // Calcular dias como cliente
  const daysAsClient = differenceInDays(new Date(), new Date(client.createdAt));

  // Cores do status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ativo':
        return 'bg-green-600/20 text-green-400 border-green-600/50';
      case 'Inativo':
        return 'bg-slate-600/20 text-slate-400 border-slate-600/50';
      default:
        return 'bg-slate-600/20 text-slate-400 border-slate-600/50';
    }
  };

  return (
    <div 
      className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:bg-slate-750 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Lado esquerdo: Nome, badges, dados */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-white">{client.name}</h3>
            
            <Badge className={getStatusColor(client.status)}>
              {client.status}
            </Badge>
            
            {isBirthdayToday && (
              <Badge className="bg-pink-600/20 text-pink-400 border-pink-600/50 animate-pulse">
                <Cake className="w-3 h-3 mr-1" />
                Aniversário hoje!
              </Badge>
            )}
            
            {activePoliciesCount === 0 && (
              <Badge variant="outline" className="text-yellow-400 border-yellow-600/50">
                Sem apólices
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-400">Email</p>
              <p className="text-white">{client.email || '-'}</p>
            </div>
            
            <div>
              <p className="text-slate-400">Telefone</p>
              <p className="text-white">{client.phone || '-'}</p>
            </div>
            
            <div>
              <p className="text-slate-400">CPF/CNPJ</p>
              <p className="text-white">{client.cpfCnpj || '-'}</p>
            </div>
            
            <div>
              <p className="text-slate-400">Cliente desde</p>
              <p className="text-white">{format(new Date(client.createdAt), 'dd/MM/yyyy')}</p>
              <p className="text-slate-500 text-xs">
                {daysAsClient} dias
              </p>
            </div>
          </div>
        </div>
        
        {/* Lado direito: Estatísticas e ações */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-right">
            <p className="text-slate-400 text-sm flex items-center justify-end gap-1">
              <FileText className="w-3 h-3" />
              Apólices Ativas
            </p>
            <p className="text-white font-semibold text-lg">{activePoliciesCount}</p>
          </div>
          
          <div className="text-right">
            <p className="text-slate-400 text-sm flex items-center justify-end gap-1">
              <DollarSign className="w-3 h-3" />
              Valor Total
            </p>
            <p className="text-green-400 font-semibold text-lg">
              {formatCurrency(totalPremium)}
            </p>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            Ver Detalhes
          </Button>
        </div>
      </div>
    </div>
  );
}
