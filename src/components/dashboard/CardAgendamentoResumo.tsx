import { Clock, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';

interface CardAgendamentoResumoProps {
  id: string;
  clientName: string;
  time: string;
  title: string;
  status: 'Pendente' | 'Realizado';
}

export function CardAgendamentoResumo({ 
  id, 
  clientName, 
  time, 
  title, 
  status 
}: CardAgendamentoResumoProps) {
  return (
    <Link to={`/dashboard/appointments?highlight=${id}`} className="block">
      <Card className="p-4 hover:shadow-md transition-all duration-200 hover:scale-[1.02] cursor-pointer border-l-4 border-l-blue-500">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-600">{time}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                status === 'Pendente' 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {status}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-gray-500" />
              <span className="font-medium text-gray-900">{clientName}</span>
            </div>
            <p className="text-sm text-gray-600 truncate">{title}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
