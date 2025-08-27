import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
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
  const features = [
    {
      icon: FileText,
      title: "Gestão de Apólices",
      description: "Controle completo das apólices com renovações automáticas e alertas."
    },
    {
      icon: Users,
      title: "Gestão de Clientes",
      description: "Base de dados unificada com histórico completo e acompanhamento."
    },
    {
      icon: Calendar,
      title: "Agendamentos",
      description: "Sistema inteligente de agendamentos com lembretes automáticos."
    },
    {
      icon: BarChart3,
      title: "Relatórios",
      description: "Analytics em tempo real com insights sobre seu negócio."
    },
    {
      icon: CreditCard,
      title: "Financeiro",
      description: "Gestão completa de comissões e fluxo de caixa."
    },
    {
      icon: Shield,
      title: "Segurança",
      description: "Proteção de dados com criptografia avançada."
    }
  ];

  const benefits = [
    "Aumento na produtividade",
    "Redução no tempo de processos",
    "Controle total das renovações",
    "Relatórios automáticos",
    "Suporte técnico especializado",
    "Atualizações constantes"
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">SGC Pro</h1>
              <p className="text-sm text-slate-400">Sistema de Gestão de Corretor</p>
            </div>
          </div>
          
          <Link to="/auth">
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-500">
              Fazer Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Sistema Completo para
            <span className="text-blue-400"> Corretores de Seguro</span>
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Gerencie clientes, apólices, renovações e relatórios em uma única plataforma. 
            Simplifique sua operação e aumente seus resultados.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/auth">
              <Button 
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
              >
                Começar Agora
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline"
              className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 px-8 py-3"
            >
              Ver Demonstração
            </Button>
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
            {features.map((feature, index) => (
              <div key={index} className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-blue-600/20 border border-blue-600/30">
                    <feature.icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-2">
                      {feature.title}
                    </h4>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold text-white mb-6">
                Por que escolher o SGC Pro?
              </h3>
              <p className="text-slate-300 text-lg mb-8">
                Nossa plataforma foi desenvolvida especificamente para corretores, 
                com funcionalidades que realmente fazem a diferença no dia a dia.
              </p>
              
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-green-600/20 border border-green-600/30">
                      <Check className="h-3 w-3 text-green-400" />
                    </div>
                    <span className="text-slate-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <GlassCard className="p-8 bg-slate-800 border-slate-700">
              <div className="text-center">
                <h4 className="text-2xl font-bold text-white mb-6">
                  Resultados Comprovados
                </h4>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-3xl font-bold text-blue-400 mb-2">40%</div>
                    <div className="text-slate-400 text-sm">Aumento na Produtividade</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-green-400 mb-2">60%</div>
                    <div className="text-slate-400 text-sm">Redução de Tempo</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-purple-400 mb-2">95%</div>
                    <div className="text-slate-400 text-sm">Satisfação</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-yellow-400 mb-2">24/7</div>
                    <div className="text-slate-400 text-sm">Suporte</div>
                  </div>
                </div>
              </div>
            </GlassCard>
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
