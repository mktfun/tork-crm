import { HeroGeometric, SocialProofSection, FeaturesSection, BenefitsSection, PricingSection, FinalCTASection } from "@/components/ui/shape-landing-hero";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Loader2, Shield } from "lucide-react";

function Landing() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#030303]">
                {/* Mesh gradient background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-slate-950 to-indigo-950/40" />
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
                
                <div className="relative z-10 text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/30 rounded-xl blur-lg animate-pulse" />
                            <Shield className="relative h-10 w-10 text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Tork CRM</h1>
                    </div>
                    <Loader2 className="h-6 w-6 animate-spin text-blue-400 mx-auto mb-3" />
                    <p className="text-white/60 text-sm font-medium">Carregando...</p>
                </div>
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
