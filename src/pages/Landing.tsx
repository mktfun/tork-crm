import { HeroGeometric } from "@/components/ui/shape-landing-hero";
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

    return <HeroGeometric
        badge="Corretora Control"
        title1="Nunca Mais Perca"
        title2="Uma Renovação"
    />;
}

export default Landing;
