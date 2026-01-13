import { useState } from 'react';
import { Loader2, Landmark, Check, AlertCircle } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useAssetAccounts } from '@/hooks/useCaixaData';
import { useSettleCommission } from '@/hooks/useFinanceiro';

interface SettleTransactionModalProps {
  open: boolean;
  onClose: () => void;
  transactionIds: string[];
  totalAmount: number;
  onSuccess?: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function SettleTransactionModal({
  open,
  onClose,
  transactionIds,
  totalAmount,
  onSuccess
}: SettleTransactionModalProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isSettling, setIsSettling] = useState(false);

  const { data: accounts = [], isLoading: accountsLoading } = useAssetAccounts();
  const settleCommission = useSettleCommission();

  const handleSettle = async () => {
    console.log('🏦 SETTLE MODAL - Iniciando baixa:', {
      transactionIds,
      selectedAccountId,
      totalAmount
    });

    if (!selectedAccountId) {
      toast.error('Selecione uma conta de destino');
      return;
    }

    setIsSettling(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const transactionId of transactionIds) {
        console.log('🏦 SETTLE MODAL - Processando transação:', transactionId);
        try {
          const result = await settleCommission.mutateAsync({
            transactionId,
            bankAccountId: selectedAccountId,
          });
          console.log('✅ SETTLE MODAL - Sucesso:', { transactionId, result });
          successCount++;
        } catch (error: any) {
          console.error('❌ SETTLE MODAL - Erro:', {
            transactionId,
            errorMessage: error?.message || error,
            errorDetails: error
          });
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} receita(s) confirmada(s) com sucesso!`);
        onSuccess?.();
        onClose();
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} receita(s) não puderam ser confirmadas.`);
      }
    } finally {
      setIsSettling(false);
      setSelectedAccountId('');
    }
  };

  const handleClose = () => {
    if (!isSettling) {
      setSelectedAccountId('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            Confirmar Recebimento
          </DialogTitle>
          <DialogDescription>
            Selecione a conta bancária para registrar a entrada do valor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumo */}
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {transactionIds.length} transação(ões)
              </span>
              <span className="text-lg font-bold text-emerald-600">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Seleção de conta */}
          <div className="space-y-2">
            <Label htmlFor="account">Conta de Destino *</Label>
            {accountsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando contas...
              </div>
            ) : accounts.length === 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma conta bancária cadastrada. Vá em Configurações para criar uma conta.
                </AlertDescription>
              </Alert>
            ) : (
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
                disabled={isSettling}
              >
                <SelectTrigger id="account">
                  <SelectValue placeholder="Selecione a conta bancária" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {account.code}
                        </span>
                        <span>{account.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            A baixa será registrada como entrada na conta selecionada e a comissão será 
            marcada como recebida.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSettling}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSettle}
            disabled={!selectedAccountId || isSettling || accounts.length === 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {isSettling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Confirmar Recebimento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
