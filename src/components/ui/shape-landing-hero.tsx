import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HeroGeometricProps {
  badge?: string;
  title1: string;
  title2: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
}

export function HeroGeometric({ 
  badge, 
  title1, 
  title2, 
  subtitle,
  children,
  className 
}: HeroGeometricProps) {
  return (
    <section className={cn("relative overflow-hidden py-20 lg:py-32", className)}>
      {/* Geometric Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Animated geometric shapes */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-32 h-32 bg-purple-500/20 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-cyan-500/20 rounded-full blur-xl animate-pulse delay-2000"></div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]"></div>
        
        {/* Gradient overlays */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/5 via-transparent to-purple-600/5"></div>
      </div>

      <div className="relative z-10 container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          {badge && (
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium text-white/90 mb-8">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
              {badge}
            </div>
          )}

          {/* Main Title */}
          <div className="space-y-4 mb-8">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
              <span className="block text-white">{title1}</span>
              <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                {title2}
              </span>
            </h1>
          </div>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}

          {/* Children (buttons, etc.) */}
          {children && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {children}
            </div>
          )}
        </div>
      </div>

      {/* Bottom geometric element */}
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-slate-800 to-transparent"></div>
    </section>
  );
}

// Alternative geometric patterns for different sections
export function GeometricPattern({ variant = "dots", className }: { variant?: "dots" | "lines" | "grid", className?: string }) {
  const patterns = {
    dots: "bg-[radial-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:24px_24px]",
    lines: "bg-[linear-gradient(45deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]",
    grid: "bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"
  };

  return (
    <div className={cn("absolute inset-0", patterns[variant], className)} />
  );
}

// Floating geometric shapes
export function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 left-1/4 w-4 h-4 bg-blue-400/30 rounded-full animate-bounce delay-300"></div>
      <div className="absolute top-3/4 right-1/4 w-6 h-6 bg-purple-400/30 rounded-full animate-bounce delay-700"></div>
      <div className="absolute top-1/2 left-3/4 w-5 h-5 bg-cyan-400/30 rounded-full animate-bounce delay-1000"></div>
      <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-pink-400/30 rounded-full animate-bounce delay-500"></div>
    </div>
  );
}
