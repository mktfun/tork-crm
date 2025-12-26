import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

import { 
  useLedgerEntryCount, 
  useSafeDeleteAccount,
  useFinancialAccountsWithDefaults 
} from '@/hooks/useFinanceiro';
import { FinancialAccount } from '@/types/financeiro';

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: FinancialAccount | null;
}

export function DeleteAccountModal({ open, onOpenChange, account }: DeleteAccountModalProps) {
  const [migrateToId, setMigrateToId] = useState<string>('');
  
  const { data: entryCount = 0, isLoading: countLoading } = useLedgerEntryCount(
    open && account ? account.id : null
  );
  const { data: allAccounts = [] } = useFinancialAccountsWithDefaults();
  const deleteMutation = useSafeDeleteAccount();

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setMigrateToId('');
    }
  }, [open]);

  // Filter compatible accounts (same type, not the target, active)
  const compatibleAccounts = allAccounts.filter(
    (a) => 
      a.type === account?.type && 
      a.id !== account?.id && 
      a.status === 'active'
  );

  const requiresMigration = entryCount > 0;
  const canDelete = !requiresMigration || (requiresMigration && migrateToId);

  const handleDelete = async () => {
    if (!account) return;

    try {
      const result = await deleteMutation.mutateAsync({
        targetAccountId: account.id,
        migrateToAccountId: migrateToId || undefined
      });

      if (result.success) {
        toast.success(result.message || 'Conta excluída com sucesso');
        onOpenChange(false);
      } else {
        toast.error(result.error || 'Erro ao excluir conta');
      }
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      toast.error(error.message || 'Erro ao excluir conta');
    }
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Excluir conta "{account.name}"?
          </DialogTitle>
          <DialogDescription>
            {countLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando lançamentos...
              </span>
            ) : requiresMigration ? (
              <>
                Esta conta possui <strong className="text-amber-500">{entryCount} lançamentos</strong> vinculados.
                Para excluí-la, você precisa migrar os lançamentos para outra conta.
              </>
            ) : (
              'Esta conta não possui lançamentos e pode ser excluída diretamente.'
            )}
          </DialogDescription>
        </DialogHeader>

        {requiresMigration && !countLoading && (
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Os {entryCount} lançamentos serão transferidos para a conta selecionada abaixo.
                Esta operação não pode ser desfeita.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="migrate-to">Migrar lançamentos para:</Label>
              <Select value={migrateToId} onValueChange={setMigrateToId}>
                <SelectTrigger id="migrate-to">
                  <SelectValue placeholder="Selecione uma conta de destino" />
                </SelectTrigger>
                <SelectContent>
                  {compatibleAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                      {acc.code && ` (${acc.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {migrateToId && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium">{account.name}</span>
                <ArrowRight className="w-4 h-4" />
                <span className="font-medium text-emerald-500">
                  {compatibleAccounts.find(a => a.id === migrateToId)?.name}
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || deleteMutation.isPending || countLoading}
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : requiresMigration ? (
              'Excluir e Migrar'
            ) : (
              'Excluir'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
