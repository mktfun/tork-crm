import { HeroGeometric, SocialProofSection, FeaturesSection, BenefitsSection, PricingSection, FinalCTASection } from "@/components/ui/shape-landing-hero";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";

function Landing() {
    const { user, loading } = useAuth();

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

    // Se o usuário está logado, redireciona para o dashboard
    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="min-h-screen bg-[#030303]">
            <HeroGeometric
                badge="Tork CRM · Gestão Inteligente"
                title1="Nunca Mais Perca"
                title2="Uma Renovação"
                description="Sistema completo de gestão para corretoras de seguros. Gerencie clientes, apólices, renovações e comissões em uma única plataforma inteligente."
                showActions={true}
            />
            <SocialProofSection />
            <FeaturesSection />
            <BenefitsSection />
            <PricingSection />
            <FinalCTASection />
        </div>
    );
}

export default Landing;
