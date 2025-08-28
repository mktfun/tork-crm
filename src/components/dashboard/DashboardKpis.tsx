
import { KpiCard } from '@/components/dashboard/KpiCard';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { BirthdayGreetingsModal } from '@/components/dashboard/BirthdayGreetingsModal';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { 
  Users, 
  AlertTriangle, 
  DollarSign, 
  FileText, 
  Cake,
  Loader2
} from 'lucide-react';

export function DashboardKpis() {
  const { user } = useAuth();
  const metrics = useDashboardMetrics();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0 
    });
  };

  const handleRenovacoesClick = () => {
    navigate('/renovacoes');
  };

  const handlePropostasClick = () => {
    navigate('/policies');
  };

  const handleAniversariantesClick = () => {
    setBirthdayModalOpen(true);
  };

  const handleGreetingSent = () => {
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({
      queryKey: ['birthday-greetings', user?.id, new Date().getFullYear()]
    });
  };

  // Show loading state while data is being fetched
  if (metrics.isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* KPIs ESTRATÉGICOS - GRID RESPONSIVO APRIMORADO */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {/* KPI 1: Total de Clientes - DADOS CORRIGIDOS */}
        <KpiCard
          title="Total de Clientes"
          value={metrics.activeClients.toString()}
          icon={<Users className="h-5 w-5 text-blue-400" />}
          onClick={() => navigate('/clients')}
        />

        {/* KPI 2: Renovações Críticas (30 dias) - DADOS CORRIGIDOS */}
        <KpiCard
          title="Renovações (30 dias)"
          value={metrics.renewals30Days.toString()}
          colorVariant={metrics.renewals30Days > 0 ? "warning" : "default"}
          icon={<AlertTriangle className="h-5 w-5" />}
          onClick={handleRenovacoesClick}
        />

        {/* KPI 3: Comissão do Mês - DADOS CORRIGIDOS */}
        <KpiCard
          title="Comissão (Mês)"
          value={formatCurrency(metrics.comissaoMesAtual)}
          comparison={metrics.comissaoMesAnterior > 0 ? 
            `${((metrics.comissaoMesAtual - metrics.comissaoMesAnterior) / metrics.comissaoMesAnterior * 100).toFixed(0)}% vs. mês anterior` : 
            undefined
          }
          icon={<DollarSign className="h-5 w-5 text-green-400" />}
          onClick={() => navigate('/faturamento')}
        />

        {/* KPI 4: Apólices Novas do Mês - DADOS CORRIGIDOS */}
        <KpiCard
          title="Apólices Novas (Mês)"
          value={metrics.apolicesNovasMes.toString()}
          icon={<FileText className="h-5 w-5 text-purple-400" />}
          onClick={handlePropostasClick}
        />

        {/* KPI 5: Aniversariantes de Hoje - INTELIGENTE COM CONTROLE */}
        <KpiCard
          title="Aniversariantes Hoje"
          value={metrics.aniversariantesHoje.length.toString()}
          colorVariant={metrics.aniversariantesHoje.length > 0 ? "warning" : "default"}
          icon={<Cake className="h-5 w-5 text-pink-400" />}
          onClick={handleAniversariantesClick}
        />
      </div>

      {/* Modal de Saudações Inteligente */}
      <BirthdayGreetingsModal
        open={birthdayModalOpen}
        onOpenChange={setBirthdayModalOpen}
        clients={metrics.aniversariantesHoje}
        onGreetingSent={handleGreetingSent}
      />
    </>
  );
}
