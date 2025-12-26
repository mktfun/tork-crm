// src/components/layout/PageTitle.tsx
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageStore } from '@/store/pageStore';

// MAPA COMPLETO E CORRETO DE ROTAS
const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/dashboard/policies': 'Apólices e Orçamentos',
  '/dashboard/clients': 'Clientes',
  '/dashboard/appointments': 'Agendamentos',
  '/dashboard/tasks': 'Tarefas',
  '/dashboard/renovacoes': 'Renovações',
  '/dashboard/sinistros': 'Sinistros',
  '/dashboard/reports': 'Relatórios Gerenciais',
  '/dashboard/financeiro': 'Financeiro',
  '/dashboard/settings': 'Configurações',
  '/dashboard/settings/profile': 'Perfil e Acesso',
  '/dashboard/settings/brokerages': 'Corretoras',
  '/dashboard/settings/producers': 'Produtores',
  '/dashboard/settings/companies': 'Seguradoras',
  '/dashboard/settings/transactions': 'Tipos de Transação',
  // Legacy mappings for backward compatibility
  '/policies': 'Apólices e Orçamentos',
  '/clients': 'Clientes',
  '/appointments': 'Agendamentos',
  '/tasks': 'Tarefas',
  '/renovacoes': 'Renovações',
  '/sinistros': 'Sinistros',
  '/reports': 'Relatórios Gerenciais',
  '/financeiro': 'Financeiro',
  '/settings': 'Configurações',
  '/settings/profile': 'Perfil e Acesso',
  '/settings/brokerages': 'Corretoras',
  '/settings/producers': 'Produtores',
  '/settings/companies': 'Seguradoras',
  '/settings/transactions': 'Tipos de Transação'
};

const getTitleFromPath = (pathname: string): string => {
  // Tenta encontrar o match exato primeiro
  if (routeTitles[pathname]) {
    return routeTitles[pathname];
  }
  // Se não achar, tenta achar um match parcial (para rotas com ID)
  // Ex: /clients/123-abc vai dar match com /clients
  const baseRoute = '/' + pathname.split('/')[1];
  return routeTitles[baseRoute] || 'Tork CRM'; // Fallback final
};

export const PageTitle = () => {
  const location = useLocation();
  const manualTitle = usePageStore((state) => state.currentTitle);
  const [title, setTitle] = useState('');

  useEffect(() => {
    // Título manual via Zustand (se definido) tem prioridade máxima.
    if (manualTitle && manualTitle !== 'Dashboard') {
      setTitle(manualTitle);
    } else {
      // Se não, usa a lógica automática baseada na rota.
      setTitle(getTitleFromPath(location.pathname));
    }
  }, [location.pathname, manualTitle]);

  return <h1 className="text-xl font-semibold text-white">{title}</h1>;
};

export default PageTitle;
