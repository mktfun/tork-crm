import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Shield, 
  Users, 
  BarChart3, 
  Calendar, 
  CreditCard,
  ChevronRight,
  Check,
  Star
} from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">SGC Pro</h1>
              <p className="text-sm text-slate-300">Sistema de Gestão de Corretor</p>
            </div>
          </div>
          
          <Link to="/auth">
            <Button 
              variant="outline" 
              className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-500"
            >
              Fazer Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section - Simplified */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600/20 border border-blue-600/30 text-blue-300 text-sm font-medium mb-8">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
              SGC Pro
            </div>
            
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              <span className="block">Transforme Sua</span>
              <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Corretora de Seguros
              </span>
            </h2>
            
            <p className="text-xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              A plataforma mais completa para gestão de corretoras de seguros. 
              Aumente sua produtividade e maximize seus resultados.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link to="/auth">
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
                >
                  Começar Gratuitamente
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline"
                className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 px-8 py-4 text-lg"
              >
                Ver Demonstração
              </Button>
            </div>
          </div>
          
          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center items-center gap-8 text-slate-400 text-sm">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500 fill-current" />
              <span>4.9/5 Avaliação</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>1000+ Corretores</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>100% Seguro</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16 bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-4">
              Funcionalidades Principais
            </h3>
            <p className="text-slate-300 text-lg">
              Tudo que você precisa para gerenciar sua corretora
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: FileText, title: "Gestão de Apólices", desc: "Controle completo das apólices" },
              { icon: Users, title: "CRM Avançado", desc: "Base de dados unificada" },
              { icon: Calendar, title: "Agendamentos", desc: "Sistema inteligente" },
              { icon: BarChart3, title: "Relatórios", desc: "Analytics em tempo real" },
              { icon: CreditCard, title: "Financeiro", desc: "Gestão de comissões" },
              { icon: Shield, title: "Segurança", desc: "Proteção total dos dados" }
            ].map((feature, index) => (
              <div key={index} className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-blue-600/20 border border-blue-600/30">
                    <feature.icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-2">
                      {feature.title}
                    </h4>
                    <p className="text-slate-300 text-sm">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-16 bg-slate-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-12">
            <h3 className="text-3xl font-bold text-white mb-4">
              Pronto para começar?
            </h3>
            <p className="text-slate-300 text-lg mb-8">
              Transforme sua corretora hoje mesmo. Setup em minutos, resultados imediatos.
            </p>
            
            <Link to="/auth">
              <Button 
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
              >
                Criar Conta Gratuita
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            
            <p className="text-slate-400 text-sm mt-4">
              Sem compromisso • Configuração rápida • Suporte completo
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="h-5 w-5 text-blue-400" />
            <span className="text-white font-semibold">SGC Pro</span>
          </div>
          <p className="text-slate-400 text-sm">
            © 2024 SGC Pro. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
