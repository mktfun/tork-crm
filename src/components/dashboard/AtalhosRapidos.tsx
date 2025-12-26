
import { Button } from '@/components/ui/button';
import { Plus, Users, FileText, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AtalhosRapidos() {
  const navigate = useNavigate();

  const handleNovaApolice = () => {
    navigate('/dashboard/policies');
    console.log('Navegando para apólices');
  };

  const handleNovoCliente = () => {
    navigate('/dashboard/clients');
    console.log('Navegando para clientes');
  };

  const handleLancamentoFinanceiro = () => {
    navigate('/dashboard/financeiro');
    console.log('Navegando para financeiro');
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">Ações Rápidas</h3>
      <div className="grid grid-cols-1 gap-3">
        <Button 
          onClick={handleNovaApolice} 
          className="h-12 justify-start gap-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-white"
        >
          <FileText size={18} />
          <span>Nova Apólice</span>
        </Button>
        
        <Button 
          onClick={handleNovoCliente} 
          className="h-12 justify-start gap-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-white"
        >
          <Users size={18} />
          <span>Novo Cliente</span>
        </Button>
        
        <Button 
          onClick={handleLancamentoFinanceiro} 
          className="h-12 justify-start gap-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-white"
        >
          <DollarSign size={18} />
          <span>Lançamento Financeiro</span>
        </Button>
      </div>
    </div>
  );
}
