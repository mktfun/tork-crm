
import { cn } from "@/lib/utils";
import { ReactNode, HTMLAttributes } from "react";
import { useGlassEffect } from "@/hooks/useGlassEffect";

interface AppCardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: ReactNode;
}

// OPERAÇÃO AQUÁRIO - VIDRO LÍQUIDO ATIVADO
export function AppCard({ className, children, ...props }: AppCardProps) {
  const glassRef = useGlassEffect<HTMLDivElement>();

  return (
    <div
      ref={glassRef}
      className={cn(
        "glass-component p-4 shadow-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
