import { Client } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, isToday } from 'date-fns';
import { Cake } from 'lucide-react';

interface ClientRowCardProps {
  client: Client;
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
  const isBirthday = client.birthDate && isToday(new Date(client.birthDate));

  return (
    <div
      className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:bg-slate-750 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Lado esquerdo: Nome, badges, dados */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-white">
              {client.name}
            </h3>
            <Badge 
              className={client.status === 'Ativo' ? 'bg-green-600 text-white' : 'bg-slate-600 text-white'}
            >
              {client.status}
            </Badge>
            {isBirthday && (
              <Badge className="bg-pink-600 text-white animate-pulse">
                <Cake className="w-3 h-3 mr-1" />
                Aniversário hoje!
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
              <p className="text-white">
                {client.createdAt ? format(new Date(client.createdAt), 'dd/MM/yyyy') : '-'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Lado direito: Estatísticas e ações */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-right">
            <p className="text-slate-400 text-sm">Apólices Ativas</p>
            <p className="text-white font-semibold text-lg">{activePoliciesCount}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-sm">Valor Total</p>
            <p className="text-green-400 font-semibold text-lg">
              {totalPremium.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
          >
            Ver Detalhes
          </Button>
        </div>
      </div>
    </div>
  );
}
