import { cn } from "@/lib/utils";
import { ReactNode, HTMLAttributes } from "react";
import { useGlassEffect } from "@/hooks/useGlassEffect";

/**
 * 🔒 COMPONENTE PROTEGIDO - OPERAÇÃO AQUÁRIO 🔒
 *
 * ⚠️ ATENÇÃO: ESTE É O COMPONENTE BASE DO SISTEMA LIQUID GLASS
 * ❌ NÃO ALTERAR A ESTRUTURA DESTE COMPONENTE
 * ❌ NÃO REMOVER A CLASSE "glass-component"
 * ❌ NÃO ALTERAR O useGlassEffect
 *
 * FUNCIONALIDADES CRÍTICAS:
 * - Aplica classe glass-component (CSS crítico)
 * - Hook useGlassEffect para rastreamento do mouse
 * - Base para todos os cards do sistema
 *
 * USO SEGURO:
 * ✅ Adicionar classes via className prop
 * ✅ Modificar conteúdo via children
 * ❌ NÃO alterar a estrutura base
 */

interface AppCardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: ReactNode;
}

// 🌟 OPERAÇÃO AQUÁRIO - VIDRO LÍQUIDO ATIVADO 🌟
export function AppCard({ className, children, ...props }: AppCardProps) {
  // 🎯 CRÍTICO: Hook que rastreia mouse para efeito liquid glass
  const glassRef = useGlassEffect<HTMLDivElement>();

  return (
    <div
      ref={glassRef}
      className={cn(
        // 🔒 CLASSE PROTEGIDA - NÃO REMOVER
        "glass-component p-4 shadow-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
