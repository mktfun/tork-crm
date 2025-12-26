import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  X, 
  Calendar, 
  FileText, 
  User, 
  FileCheck, 
  ArrowUpDown,
  ExternalLink,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useTransactionDetails } from '@/hooks/useFinanceiro';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

interface TransactionDetailsSheetProps {
  transactionId: string | null;
  open: boolean;
  onClose: () => void;
}

export function TransactionDetailsSheet({ transactionId, open, onClose }: TransactionDetailsSheetProps) {
  const { data: transaction, isLoading, error } = useTransactionDetails(transactionId);

  // Calcular valor total (soma dos valores positivos)
  const totalAmount = transaction?.ledgerEntries
    .filter(e => e.amount > 0)
    .reduce((sum, e) => sum + e.amount, 0) ?? 0;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="flex flex-row items-center justify-between pb-4">
          <SheetTitle>Detalhes da Transação</SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
            <p>Erro ao carregar transação</p>
          </div>
        )}

        {transaction && (
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="space-y-6 pr-4">
              {/* Valor em Destaque */}
              <div className="text-center p-6 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20">
                <p className="text-3xl font-bold text-emerald-500">
                  {formatCurrency(totalAmount)}
                </p>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {transaction.description}
                </p>
                {transaction.isVoid && (
                  <Badge variant="destructive" className="mt-2">
                    Transação Anulada
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Metadados Básicos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="w-4 h-4" />
                    Data
                  </div>
                  <p className="font-medium">
                    {format(new Date(transaction.transactionDate), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <FileText className="w-4 h-4" />
                    Referência
                  </div>
                  <p className="font-medium">
                    {transaction.referenceNumber || 'Sem referência'}
                  </p>
                </div>
              </div>

              {/* Links Rápidos (se houver dados legados) */}
              {transaction.legacyData && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Links Rápidos
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {transaction.legacyData.clientId && (
                        <Button asChild variant="outline" size="sm" className="gap-2">
                          <Link to={`/dashboard/clientes/${transaction.legacyData.clientId}`}>
                            <User className="w-4 h-4" />
                            {transaction.legacyData.clientName || 'Ver Cliente'}
                          </Link>
                        </Button>
                      )}
                      {transaction.legacyData.policyId && (
                        <Button asChild variant="outline" size="sm" className="gap-2">
                          <Link to={`/dashboard/apolices/${transaction.legacyData.policyId}`}>
                            <FileCheck className="w-4 h-4" />
                            {transaction.legacyData.policyNumber 
                              ? `Apólice #${transaction.legacyData.policyNumber.slice(0, 10)}`
                              : 'Ver Apólice'}
                          </Link>
                        </Button>
                      )}
                    </div>

                    {/* Dados Adicionais do Legado */}
                    <div className="grid grid-cols-2 gap-3 text-sm p-3 rounded-lg bg-muted/30">
                      {transaction.legacyData.ramo && (
                        <div>
                          <p className="text-muted-foreground">Ramo</p>
                          <p className="font-medium">{transaction.legacyData.ramo}</p>
                        </div>
                      )}
                      {transaction.legacyData.company && (
                        <div>
                          <p className="text-muted-foreground">Seguradora</p>
                          <p className="font-medium">{transaction.legacyData.company}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Movimentos no Ledger */}
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  Movimentos Contábeis
                </h4>
                <div className="space-y-2">
                  {transaction.ledgerEntries.map((entry) => (
                    <div 
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={entry.amount > 0 ? "default" : "secondary"}
                          className="text-xs font-mono"
                        >
                          {entry.amount > 0 ? 'D' : 'C'}
                        </Badge>
                        <span className="text-sm">{entry.accountName}</span>
                      </div>
                      <span className={`font-medium ${entry.amount > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadados Técnicos */}
              <Separator />
              <div className="space-y-2 text-xs text-muted-foreground">
                <p><strong>Criado em:</strong> {format(new Date(transaction.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                <p><strong>Origem:</strong> {transaction.relatedEntityType || 'manual'}</p>
                <p className="font-mono break-all"><strong>ID:</strong> {transaction.id}</p>
                {transaction.isVoid && transaction.voidReason && (
                  <p className="text-destructive"><strong>Motivo anulação:</strong> {transaction.voidReason}</p>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
