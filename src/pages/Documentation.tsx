import { BookOpen, Kanban, Wallet, Settings, Tag, Building, Users, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { AppCard } from '@/components/ui/app-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function Documentation() {
  usePageTitle('Documentação');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Documentação</h1>
          <p className="text-sm text-muted-foreground">
            Guia completo de uso do Tork CRM
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="crm" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="crm" className="flex items-center gap-2">
            <Kanban className="h-4 w-4" />
            CRM
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* CRM Tab */}
        <TabsContent value="crm" className="space-y-4">
          <AppCard className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Kanban className="h-5 w-5 text-primary" />
              Funil de Vendas
            </h2>
            <p className="text-muted-foreground mb-4">
              O CRM do Tork utiliza um sistema de Kanban para gerenciar seus negócios em diferentes etapas.
            </p>
            
            <div className="space-y-4">
              <Section title="Como funciona o funil">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    Cada coluna representa uma etapa do seu processo de vendas
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    Arraste os cards entre colunas para atualizar o status
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    Clique em um card para ver detalhes e editar informações
                  </li>
                </ul>
              </Section>

              <Section title="Criando negócios">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Clique no botão "Novo Negócio" no topo da página
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Preencha o título, valor estimado e cliente
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Selecione a etapa inicial do funil
                  </li>
                </ul>
              </Section>

              <Section title="Personalizando etapas">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Clique no ícone de engrenagem ao lado do nome da etapa
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Altere nome, cor ou exclua etapas existentes
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Adicione novas etapas conforme seu fluxo de trabalho
                  </li>
                </ul>
              </Section>

              <Section title="Integração Tork">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-muted-foreground">
                    Configure a integração em <strong>Configurações &gt; Chat Tork</strong> para sincronizar 
                    conversas e etiquetas automaticamente com seu sistema de chat.
                  </p>
                </div>
              </Section>
            </div>
          </AppCard>
        </TabsContent>

        {/* Financeiro Tab */}
        <TabsContent value="financeiro" className="space-y-4">
          <AppCard className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Módulo Financeiro
            </h2>
            <p className="text-muted-foreground mb-4">
              O sistema financeiro do Tork utiliza o conceito de partidas dobradas para garantir precisão contábil.
            </p>

            <div className="space-y-4">
              <Section title="O que é o Ledger (Livro Razão)">
                <p className="text-sm text-muted-foreground mb-2">
                  O Ledger é o registro central de todas as transações financeiras. 
                  Cada movimentação cria lançamentos duplos que sempre se equilibram:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <strong>Débito:</strong> Entrada de recurso em uma conta
                  </li>
                  <li className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <strong>Crédito:</strong> Saída de recurso de uma conta
                  </li>
                </ul>
              </Section>

              <Section title="Aba Caixa">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    Visualize o saldo atual de cada conta bancária
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    Acompanhe o fluxo de caixa em tempo real
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    Crie novas contas conforme necessário
                  </li>
                </ul>
              </Section>

              <Section title="Receitas e Baixas">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Receitas são geradas automaticamente com base nas comissões das apólices
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Para registrar o recebimento, clique no botão "Baixar"
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Selecione a conta bancária de destino
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    O sistema criará o lançamento contábil automaticamente
                  </li>
                </ul>
              </Section>

              <Section title="Despesas">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Registre despesas operacionais, impostos e outros custos
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Categorize por tipo de despesa para relatórios
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Acompanhe a margem líquida no dashboard
                  </li>
                </ul>
              </Section>
            </div>
          </AppCard>
        </TabsContent>

        {/* Configurações Tab */}
        <TabsContent value="configuracoes" className="space-y-4">
          <AppCard className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Configurações do Sistema
            </h2>

            <div className="space-y-4">
              <Section title="Ramos de Seguro" icon={<Tag className="h-4 w-4 text-amber-400" />}>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Cadastre os ramos de seguro que você trabalha (Auto, Vida, Residencial, etc.)
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Os ramos são utilizados para categorizar apólices e gerar relatórios
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Acesse em: Configurações &gt; Ramos
                  </li>
                </ul>
              </Section>

              <Section title="Seguradoras" icon={<Building className="h-4 w-4 text-blue-400" />}>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Cadastre as seguradoras parceiras
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Vincule ramos específicos a cada seguradora
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Acesse em: Configurações &gt; Seguradoras
                  </li>
                </ul>
              </Section>

              <Section title="Produtores" icon={<Users className="h-4 w-4 text-emerald-400" />}>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Gerencie sua equipe de vendas e produtores externos
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Associe produtores a apólices para rastrear performance
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    Acesse em: Configurações &gt; Produtores
                  </li>
                </ul>
              </Section>

              <Section title="Integração Tork">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-muted-foreground mb-2">
                    Em <strong>Configurações &gt; Chat Tork</strong> você pode:
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Configurar URL e credenciais da sua instância</li>
                    <li>• Testar conexão com o serviço</li>
                    <li>• Sincronizar etiquetas com etapas do CRM</li>
                    <li>• Configurar webhook para receber eventos em tempo real</li>
                  </ul>
                </div>
              </Section>
            </div>
          </AppCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper component for sections
function Section({ 
  title, 
  children,
  icon 
}: { 
  title: string; 
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-primary/30 pl-4">
      <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}
