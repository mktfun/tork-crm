import { useState } from 'react';
import { 
  Landmark, 
  Tags, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Wrench,
  CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { AccountFormModal } from './AccountFormModal';
import { DeleteAccountModal } from './DeleteAccountModal';
import { 
  useFinancialAccountsWithDefaults, 
  usePendingLegacyCount,
  useBackfillLegacy,
  useLedgerEntryCount,
  useProblematicDescriptionsCount,
  useFixLedgerDescriptions,
  useWrongDatesCount,
  useFixBackfillDates
} from '@/hooks/useFinanceiro';
import { FinancialAccount, FinancialAccountType, ACCOUNT_TYPE_LABELS } from '@/types/financeiro';

// ============ ACCOUNT LIST SECTION ============

interface AccountListProps {
  title: string;
  description: string;
  icon: React.ElementType;
  accounts: FinancialAccount[];
  accountType: FinancialAccountType;
  onEdit: (account: FinancialAccount) => void;
  onDelete: (account: FinancialAccount) => void;
  isLoading: boolean;
}

function AccountListSection({ 
  title, 
  description, 
  icon: Icon, 
  accounts, 
  accountType,
  onEdit, 
  onDelete,
  isLoading 
}: AccountListProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <Card className="flex-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma conta cadastrada.</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px]">
            <div className="space-y-2">
              {accounts.map((account) => (
                <div 
                  key={account.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{account.name}</p>
                      {account.isSystem && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Sistema
                        </Badge>
                      )}
                    </div>
                    {account.code && (
                      <p className="text-xs text-muted-foreground">{account.code}</p>
                    )}
                  </div>
                  
                  {!account.isSystem && (
                    <div className="flex items-center gap-1 ml-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => onEdit(account)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(account)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      
      <AccountFormModal
        open={showModal}
        onOpenChange={setShowModal}
        accountType={accountType}
      />
    </Card>
  );
}

// ============ BACKFILL CARD ============

function BackfillCard() {
  const { data: pendingCount = 0, isLoading: countLoading } = usePendingLegacyCount();
  const backfillMutation = useBackfillLegacy();
  
  const handleBackfill = async () => {
    try {
      const result = await backfillMutation.mutateAsync();
      
      if (result.successCount > 0) {
        toast.success(`${result.successCount} transações foram migradas com sucesso!`);
      } else if (result.errorCount > 0) {
        toast.error(`Ocorreram ${result.errorCount} erros durante a migração.`);
      } else {
        toast.info('Nenhuma transação pendente para migrar.');
      }
    } catch (error: any) {
      console.error('Erro no backfill:', error);
      toast.error(error.message || 'Erro ao sincronizar histórico');
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">Sincronizar Histórico</CardTitle>
        </div>
        <CardDescription>
          Sincronize transações do sistema antigo (Faturamento) para o módulo Financeiro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {countLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verificando...
          </div>
        ) : pendingCount > 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm">
              <span className="font-semibold text-amber-500">{pendingCount}</span>{' '}
              transações pagas ainda não foram migradas.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-600">
              Todas as transações estão sincronizadas!
            </p>
          </div>
        )}
        
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={handleBackfill}
          disabled={backfillMutation.isPending || pendingCount === 0}
        >
          {backfillMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Sincronizar Histórico
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============ FIX DESCRIPTIONS CARD ============

function FixDescriptionsCard() {
  const { data: problemCount = 0, isLoading: countLoading } = useProblematicDescriptionsCount();
  const fixMutation = useFixLedgerDescriptions();
  
  const handleFix = async () => {
    try {
      const result = await fixMutation.mutateAsync();
      
      if (result.fixedCount > 0) {
        toast.success(`${result.fixedCount} descrições foram corrigidas!`);
      } else {
        toast.info('Nenhuma descrição precisava de correção.');
      }
    } catch (error: any) {
      console.error('Erro ao corrigir descrições:', error);
      toast.error(error.message || 'Erro ao corrigir descrições');
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">Correção de Dados</CardTitle>
        </div>
        <CardDescription>
          Corrige descrições "undefined" ou vazias nas transações financeiras.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {countLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verificando...
          </div>
        ) : problemCount > 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm">
              <span className="font-semibold text-amber-500">{problemCount}</span>{' '}
              descrições precisam ser corrigidas.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-600">
              Todas as descrições estão corretas!
            </p>
          </div>
        )}
        
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={handleFix}
          disabled={fixMutation.isPending || problemCount === 0}
        >
          {fixMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Corrigindo...
            </>
          ) : (
            <>
              <Wrench className="w-4 h-4" />
              Corrigir Descrições
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============ FIX DATES CARD (FASE 10) ============

function FixDatesCard() {
  const { data: wrongDatesCount = 0, isLoading: countLoading } = useWrongDatesCount();
  const fixMutation = useFixBackfillDates();
  
  const handleFix = async () => {
    try {
      const result = await fixMutation.mutateAsync();
      
      if (result.updated_count > 0) {
        toast.success(`${result.updated_count} datas foram corrigidas!`);
      } else {
        toast.info('Nenhuma data precisava de correção.');
      }
    } catch (error: any) {
      console.error('Erro ao corrigir datas:', error);
      toast.error(error.message || 'Erro ao corrigir datas');
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">Corrigir Datas Históricas</CardTitle>
        </div>
        <CardDescription>
          Corrige datas de transações importadas que estão divergentes da origem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {countLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verificando...
          </div>
        ) : wrongDatesCount > 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm">
              <span className="font-semibold text-amber-500">{wrongDatesCount}</span>{' '}
              transações com datas incorretas.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-600">
              Todas as datas estão corretas!
            </p>
          </div>
        )}
        
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={handleFix}
          disabled={fixMutation.isPending || wrongDatesCount === 0}
        >
          {fixMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Corrigindo...
            </>
          ) : (
            <>
              <CalendarClock className="w-4 h-4" />
              Corrigir Datas Históricas
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============ MAIN COMPONENT ============

export function ConfiguracoesTab() {
  const { data: accounts = [], isLoading } = useFinancialAccountsWithDefaults();
  
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<FinancialAccount | null>(null);
  
  // Filtrar contas por tipo
  const assetAccounts = accounts.filter(a => a.type === 'asset');
  const expenseAccounts = accounts.filter(a => a.type === 'expense');
  const revenueAccounts = accounts.filter(a => a.type === 'revenue');
  const categoryAccounts = [...expenseAccounts, ...revenueAccounts];

  const handleEdit = (account: FinancialAccount) => {
    setEditingAccount(account);
  };

  const handleDelete = (account: FinancialAccount) => {
    setDeleteAccount(account);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Configurações Financeiras</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie seu plano de contas e sincronize dados do sistema antigo
        </p>
      </div>

      {/* Contas Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccountListSection
          title="Contas Bancárias"
          description="Caixas, bancos e contas de pagamento"
          icon={Landmark}
          accounts={assetAccounts}
          accountType="asset"
          onEdit={handleEdit}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
        
        <AccountListSection
          title="Categorias"
          description="Despesas e receitas para classificação"
          icon={Tags}
          accounts={categoryAccounts}
          accountType="expense"
          onEdit={handleEdit}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      </div>

      <Separator />

      {/* Maintenance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BackfillCard />
        <FixDescriptionsCard />
        <FixDatesCard />
      </div>

      {/* Edit Modal */}
      {editingAccount && (
        <AccountFormModal
          open={!!editingAccount}
          onOpenChange={(open) => !open && setEditingAccount(null)}
          account={editingAccount}
          accountType={editingAccount.type}
        />
      )}

      {/* Delete Modal with Safe Migration */}
      <DeleteAccountModal
        open={!!deleteAccount}
        onOpenChange={(open) => !open && setDeleteAccount(null)}
        account={deleteAccount}
      />
    </div>
  );
}
