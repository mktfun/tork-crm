import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AppCard } from '@/components/ui/app-card';

/**
 * 🔒 COMPONENTE PROTEGIDO - CARDS KPI DASHBOARD 🔒
 *
 * ⚠️ ATENÇÃO: COMPONENTE CRÍTICO DO DASHBOARD
 * ❌ NÃO ALTERAR AS CLASSES CORE (hover:scale-105, flex, etc)
 * ❌ NÃO REMOVER O AppCard como base
 * ❌ NÃO ALTERAR A ESTRUTURA HTML
 *
 * ESTRUTURA PROTEGIDA:
 * - AppCard como container principal
 * - Flex layout com justify-between
 * - Classes de cores definidas (default/warning/danger)
 * - Efeitos hover controlados
 *
 * ALTERAÇÕES SEGURAS:
 * ✅ Adicionar novas variantes de cor seguindo o padrão
 * ✅ Modificar ícones e textos
 * ✅ Adicionar props opcionais
 * ❌ NÃO quebrar a estrutura visual estabelecida
 */

interface KpiCardProps {
  title: string;
  value: string;
  comparison?: string;
  icon: ReactNode;
  colorVariant?: 'default' | 'warning' | 'danger';
  onClick?: () => void;
  className?: string;
}

export function KpiCard({
  title,
  value,
  comparison,
  icon,
  colorVariant = 'default',
  onClick,
  className
}: KpiCardProps) {
  const colorClasses = {
    default: 'flex flex-col justify-between transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer border-zinc-800 bg-zinc-900 hover:bg-zinc-800/70',
    warning: 'flex flex-col justify-between transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer border-yellow-500/50 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/40',
    danger: 'flex flex-col justify-between transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer border-red-500/60 bg-red-900/40 text-red-300 hover:bg-red-900/50'
  };

  return (
    <AppCard
      className={cn(
        colorClasses[colorVariant],
        className
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-sm font-medium text-zinc-400">{title}</span>
        <div className={cn(
          "p-2 rounded-lg bg-white/10",
          colorVariant !== 'default' ? 'text-current' : ''
        )}>
          {icon}
        </div>
      </div>

      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white break-words mb-1">
          {value}
        </h2>
        {comparison && (
          <p className="text-xs text-zinc-500 line-clamp-2">{comparison}</p>
        )}
      </div>
    </AppCard>
  );
}
