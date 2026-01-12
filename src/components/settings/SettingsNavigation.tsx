
import { NavLink } from 'react-router-dom';
import { User, Building, Users, Shield, Tag, MessageCircle, Globe } from 'lucide-react';
import { AppCard } from '@/components/ui/app-card';

const navItems = [
  {
    name: 'Meu Perfil',
    path: '/dashboard/settings/profile',
    icon: User,
    description: 'Informações pessoais'
  },
  {
    name: 'Corretoras',
    path: '/dashboard/settings/brokerages',
    icon: Building,
    description: 'Empresas representadas'
  },
  {
    name: 'Produtores',
    path: '/dashboard/settings/producers',
    icon: Users,
    description: 'Equipe de vendas'
  },
  {
    name: 'Seguradoras',
    path: '/dashboard/settings/companies',
    icon: Shield,
    description: 'Parceiros seguradoras'
  },
  {
    name: 'Ramos',
    path: '/dashboard/settings/ramos',
    icon: Tag,
    description: 'Ramos de seguro'
  },
  {
    name: 'Chat Tork',
    path: '/dashboard/settings/chat-tork',
    icon: MessageCircle,
    description: 'Integração CRM'
  },
  {
    name: 'Portal do Cliente',
    path: '/dashboard/settings/portal',
    icon: Globe,
    description: 'Acesso dos segurados'
  }
];

export function SettingsNavigation() {
  return (
    <AppCard className="p-4">
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-start gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`
            }
          >
            <item.icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="font-medium">{item.name}</span>
              <span className={`text-xs ${
                navItems.find(nav => nav.path === item.path) ? 'text-slate-200' : 'text-slate-400'
              }`}>
                {item.description}
              </span>
            </div>
          </NavLink>
        ))}
      </nav>
    </AppCard>
  );
}
