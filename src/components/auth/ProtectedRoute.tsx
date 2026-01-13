import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Premium BLACK & SILVER loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        {/* Gradiente radial sutil */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(39,39,42,0.2)_0%,_transparent_60%)]" />
        
        {/* Textura de linhas diagonais */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
            backgroundSize: '8px 8px'
          }}
        />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 text-center"
        >
          {/* Logo com brilho prateado */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <img 
              src="/tork_symbol_favicon.png" 
              alt="Tork"
              className="h-12 w-12"
              style={{ filter: 'brightness(0) invert(1) drop-shadow(0 0 8px rgba(255,255,255,0.3))' }}
            />
            <h1 className="text-3xl font-semibold text-zinc-100 tracking-tight">
              Tork CRM
            </h1>
          </div>
          
          {/* Barra de progresso metálica */}
          <div className="w-48 mx-auto mb-6">
            <div className="h-[2px] bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full w-full progress-metallic" />
            </div>
          </div>
          
          {/* Texto espaçado */}
          <p className="text-zinc-500 text-xs font-medium tracking-[0.2em] uppercase">
            Aguarde...
          </p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    // Salva a localização atual para redirecionar após o login
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
