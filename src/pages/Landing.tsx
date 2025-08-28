import { HeroGeometric, FeaturesSection, BenefitsSection, FinalCTASection } from "@/components/ui/shape-landing-hero";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

function Landing() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#030303]">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
                    <p className="text-white/80">Carregando...</p>
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
                badge="SGC Sistema Gestor de Corretor"
                title1="Nunca Mais Perca"
                title2="Uma Renovação"
                description="Sistema completo de gestão para corretoras de seguros. Gerencie clientes, apólices, renovações e comissões em uma única plataforma inteligente."
                showActions={true}
            />
            <FeaturesSection />
            <BenefitsSection />
            <FinalCTASection />
        </div>
    );
}

export default Landing;
