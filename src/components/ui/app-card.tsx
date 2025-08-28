import { cn } from "@/lib/utils";
import { ReactNode, HTMLAttributes } from "react";

interface AppCardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: ReactNode;
}

// Card padrão usando o sistema glass limpo
export function AppCard({ className, children, ...props }: AppCardProps) {
  return (
    <div
      className={cn(
        // Glass effect limpo sem bordas transparentes
        "rounded-xl border border-white/10 bg-white/10 backdrop-blur-lg shadow-lg p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
