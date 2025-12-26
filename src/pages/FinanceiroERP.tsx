import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wallet, TrendingDown, TrendingUp, Loader2, ArrowRightLeft } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

import { NovaDespesaModal } from '@/components/financeiro/NovaDespesaModal';
import { useFinancialAccountsWithDefaults, useRecentTransactions } from '@/hooks/useFinanceiro';
import { FinancialAccount, ACCOUNT_TYPE_LABELS } from '@/types/financeiro';
import { usePageTitle } from '@/hooks/usePageTitle';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function AccountBalanceCard({ account, balance }: { account: FinancialAccount; balance: number }) {
  const isPositive = balance >= 0;
  
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{account.name}</p>
            <p className={`text-lg font-semibold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {formatCurrency(balance)}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {ACCOUNT_TYPE_LABELS[account.type]}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionsList() {
  const { data: transactions = [], isLoading } = useRecentTransactions();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma transação registrada ainda.</p>
        <p className="text-sm">Use o botão "Nova Despesa" para começar.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2">
        {transactions.map((tx) => (
          <Card key={tx.id} className="bg-card/30 border-border/30 hover:bg-card/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{format(new Date(tx.transaction_date), "dd 'de' MMM", { locale: ptBR })}</span>
                    {tx.reference_number && (
                      <>
                        <span>•</span>
                        <span className="truncate">{tx.reference_number}</span>
                      </>
                    )}
                  </div>
                  {tx.account_names && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {tx.account_names}
                    </p>
                  )}
                </div>
                <div className="text-right ml-4">
                  <p className="font-semibold text-rose-500">
                    {formatCurrency(tx.total_amount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

function VisaoGeral() {
  const { data: accounts = [], isLoading, isEnsuring } = useFinancialAccountsWithDefaults();

  if (isLoading || isEnsuring) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">
          {isEnsuring ? 'Configurando contas...' : 'Carregando...'}
        </span>
      </div>
    );
  }

  const assetAccounts = accounts.filter(a => a.type === 'asset');
  const expenseAccounts = accounts.filter(a => a.type === 'expense');
  const revenueAccounts = accounts.filter(a => a.type === 'revenue');

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-lg">
                <Wallet className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contas Bancárias</p>
                <p className="text-2xl font-bold">{assetAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-500/20 rounded-lg">
                <TrendingDown className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Categorias Despesa</p>
                <p className="text-2xl font-bold">{expenseAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Categorias Receita</p>
                <p className="text-2xl font-bold">{revenueAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Últimos movimentos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Últimos Movimentos</CardTitle>
            <CardDescription>Transações registradas no sistema</CardDescription>
          </div>
          <NovaDespesaModal />
        </CardHeader>
        <CardContent>
          <TransactionsList />
        </CardContent>
      </Card>
    </div>
  );
}

function DespesasTab() {
  const { data: transactions = [], isLoading } = useRecentTransactions('expense');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Despesas</h2>
          <p className="text-sm text-muted-foreground">Gerencie suas saídas financeiras</p>
        </div>
        <NovaDespesaModal />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingDown className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma despesa registrada.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <Card key={tx.id} className="bg-card/30 border-border/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{tx.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(tx.transaction_date), "dd/MM/yyyy")}
                            {tx.reference_number && ` • ${tx.reference_number}`}
                          </p>
                        </div>
                        <p className="font-semibold text-rose-500">
                          - {formatCurrency(tx.total_amount)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LegadoTab() {
  return (
    <div className="text-center py-12">
      <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
      <h3 className="text-lg font-medium mb-2">Módulo Legado</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        As comissões e receitas do sistema antigo de faturamento serão integradas aqui em breve.
        Por enquanto, continue usando a página de Faturamento para gerenciar comissões.
      </p>
    </div>
  );
}

export default function FinanceiroERP() {
  usePageTitle('Financeiro');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Wallet className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Controle de despesas e receitas com partidas dobradas
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visao-geral" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="legado">Receitas (Legado)</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <VisaoGeral />
        </TabsContent>

        <TabsContent value="despesas">
          <DespesasTab />
        </TabsContent>

        <TabsContent value="legado">
          <LegadoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
