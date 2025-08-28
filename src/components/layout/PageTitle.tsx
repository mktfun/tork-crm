// src/components/layout/PageTitle.tsx
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageStore } from '@/store/pageStore';

// MAPA COMPLETO E CORRETO DE ROTAS
const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/policies': 'Apólices e Orçamentos',
  '/clients': 'Clientes',
  '/appointments': 'Agendamentos',
  '/tasks': 'Tarefas',
  '/renovacoes': 'Renovações',
  '/sinistros': 'Sinistros',
  '/reports': 'Relatórios Gerenciais',
  '/faturamento': 'Faturamento',
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
  return routeTitles[baseRoute] || 'SGC Pro'; // Fallback final
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
