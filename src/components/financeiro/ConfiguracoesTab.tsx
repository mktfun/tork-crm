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
  ShieldCheck
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
  useLedgerEntryCount
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
          <CardTitle className="text-lg">Manutenção de Dados</CardTitle>
        </div>
        <CardDescription>
          Sincronize transações do sistema antigo (Faturamento) para o módulo Financeiro.
          Isso vai popular o DRE com seu histórico de comissões.
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
              transações pagas ainda não foram migradas para o Financeiro.
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
              Sincronizar Histórico Financeiro
            </>
          )}
        </Button>
        
        <p className="text-xs text-muted-foreground">
          Esta operação é segura e não duplica dados. Pode ser executada múltiplas vezes.
        </p>
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

      {/* Backfill Card */}
      <BackfillCard />

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
