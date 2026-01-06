import { useState, useEffect } from 'react';
import { 
  Landmark, 
  Tags, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  ShieldCheck,
  Zap,
  Target
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { AccountFormModal } from './AccountFormModal';
import { DeleteAccountModal } from './DeleteAccountModal';
import { useFinancialAccountsWithDefaults } from '@/hooks/useFinanceiro';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useSupabaseBrokerages } from '@/hooks/useSupabaseBrokerages';
import { FinancialAccount, FinancialAccountType } from '@/types/financeiro';
import { toast } from '@/hooks/use-toast';

// ============ AUTOMATION SECTION ============

function AutomationSection() {
  const { data: profile, isLoading } = useProfile();
  const updateProfileMutation = useUpdateProfile();

  const handleUpdate = (field: string, value: any) => {
    updateProfileMutation.mutate(
      { [field]: value },
      {
        onSuccess: () => {
          const fieldNames: Record<string, string> = {
            settle_commissions_automatically: "Automação de comissões",
            commission_settlement_days: "Dias para baixa",
            commission_settlement_strategy: "Estratégia de parcelas",
            commission_settlement_installments: "Quantidade de parcelas"
          };
          toast({
            title: "Configuração atualizada",
            description: `${fieldNames[field]} atualizada com sucesso.`,
          });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível atualizar a configuração.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Automação de Recebimentos</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-muted animate-pulse rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Automação de Recebimentos</CardTitle>
        </div>
        <CardDescription>
          Configure a baixa automática de comissões para reduzir trabalho manual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="automatic-commission" className="font-medium">Baixa Automática Diária</Label>
          <Switch
            id="automatic-commission"
            checked={profile?.settle_commissions_automatically || false}
            onCheckedChange={(isChecked) => handleUpdate('settle_commissions_automatically', isChecked)}
            disabled={updateProfileMutation.isPending}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Quando ativado, o sistema marcará automaticamente como 'Pagas' as comissões cujas datas de recebimento coincidam com o dia atual.
        </p>

        {profile?.settle_commissions_automatically && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <Label htmlFor="settlement-days">Dar baixa após (dias da emissão)</Label>
              <Input
                id="settlement-days"
                type="number"
                min="1"
                max="365"
                value={profile?.commission_settlement_days || 7}
                onChange={(e) => handleUpdate('commission_settlement_days', parseInt(e.target.value, 10))}
                disabled={updateProfileMutation.isPending}
                className="mt-1 w-24"
              />
              <p className="text-sm text-muted-foreground mt-1">
                A comissão será marcada como 'Paga' X dias após a data de criação.
              </p>
            </div>
            <div>
              <Label htmlFor="strategy">Estratégia de Parcelas</Label>
              <Select
                value={profile?.commission_settlement_strategy || 'all'}
                onValueChange={(value) => handleUpdate('commission_settlement_strategy', value)}
                disabled={updateProfileMutation.isPending}
              >
                <SelectTrigger id="strategy" className="mt-1">
                  <SelectValue placeholder="Selecione a estratégia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">Primeira parcela apenas</SelectItem>
                  <SelectItem value="all">Todas as parcelas</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Define quais parcelas das comissões serão processadas automaticamente.
              </p>
            </div>
            {profile?.commission_settlement_strategy === 'custom' && (
              <div>
                <Label htmlFor="installments-count">Quantidade de parcelas</Label>
                <Input
                  id="installments-count"
                  type="number"
                  min="1"
                  max="24"
                  value={profile?.commission_settlement_installments || 1}
                  onChange={(e) => handleUpdate('commission_settlement_installments', parseInt(e.target.value, 10))}
                  disabled={updateProfileMutation.isPending}
                  className="mt-1 w-24"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Número de parcelas que serão processadas automaticamente.
                </p>
              </div>
            )}
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Como funciona:</strong> Todo dia às 3h da manhã, o sistema verifica as comissões 
                pendentes e as marca como pagas conforme suas configurações.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ COMMISSION TARGET SECTION ============

function CommissionTargetSection({ assetAccounts }: { assetAccounts: FinancialAccount[] }) {
  const { brokerages, updateBrokerage, addBrokerage, loading } = useSupabaseBrokerages();
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);
  
  // Auto-criar corretora se não existir
  useEffect(() => {
    const initBrokerage = async () => {
      if (!loading && brokerages.length === 0 && !initializing) {
        setInitializing(true);
        try {
          await addBrokerage({ name: 'Minha Corretora' });
        } catch (e) {
          console.error('Erro ao criar corretora:', e);
        } finally {
          setInitializing(false);
        }
      }
    };
    initBrokerage();
  }, [loading, brokerages.length, initializing, addBrokerage]);
  
  const brokerage = brokerages[0];
  const settings = brokerage?.financial_settings || {};

  const handleUpdateSetting = async (key: string, value: string) => {
    if (!brokerage) return;
    setSaving(true);
    try {
      await updateBrokerage(brokerage.id, {
        financial_settings: { ...settings, [key]: value }
      });
      toast({ title: "Configuração salva", description: "Preferência atualizada com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || initializing) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-4 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Destino das Comissões</CardTitle>
        </div>
        <CardDescription>
          Configure em qual conta as comissões automáticas serão registradas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="commission-account">Conta Padrão para Comissões</Label>
          <Select
            value={settings.default_commission_asset_account_id || ''}
            onValueChange={(v) => handleUpdateSetting('default_commission_asset_account_id', v)}
            disabled={saving}
          >
            <SelectTrigger id="commission-account" className="mt-1">
              <SelectValue placeholder="Selecione uma conta" />
            </SelectTrigger>
            <SelectContent 
              className="z-50 bg-popover border shadow-lg"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {assetAccounts.map((acc) => (
                <SelectItem 
                  key={acc.id} 
                  value={acc.id}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-1">
            Conta onde as comissões de novas apólices serão lançadas.
          </p>
        </div>
        <div>
          <Label htmlFor="commission-status">Status Inicial</Label>
          <Select
            value={settings.commission_initial_status || 'pending'}
            onValueChange={(v) => handleUpdateSetting('commission_initial_status', v)}
            disabled={saving}
          >
            <SelectTrigger id="commission-status" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendente (provisão)</SelectItem>
              <SelectItem value="completed">Confirmado (já recebido)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-1">
            Define se a comissão inicia como pendente ou já confirmada.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

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
          Gerencie seu plano de contas e automações
        </p>
      </div>

      {/* Automação */}
      <AutomationSection />

      {/* Destino das Comissões */}
      <CommissionTargetSection assetAccounts={assetAccounts} />

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
