import { useState, useMemo } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import {
  Landmark,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  CreditCard,
  ChevronRight,
  Building2,
  Clock,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { TransactionDetailsSheet } from './TransactionDetailsSheet';
import { useAccountBalances, useAccountStatement, AccountBalance, useTotalPendingReceivablesFrom2026 } from '@/hooks/useCaixaData';
import { parseLocalDate } from '@/utils/dateUtils';

function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

interface CaixaTabProps {
  dateRange: DateRange | undefined;
}

// ============ ACCOUNT BALANCE CARD ============

interface AccountCardProps {
  account: AccountBalance;
  isSelected: boolean;
  onClick: () => void;
}

function AccountCard({ account, isSelected, onClick }: AccountCardProps) {
  const isPositive = account.balance >= 0;
  
  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected 
          ? 'ring-2 ring-primary border-primary bg-primary/5' 
          : 'hover:border-primary/50'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            isPositive ? 'bg-emerald-500/20' : 'bg-rose-500/20'
          )}>
            <Building2 className={cn(
              'w-5 h-5',
              isPositive ? 'text-emerald-500' : 'text-rose-500'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{account.name}</p>
              {isSelected && (
                <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">{account.code}</p>
          </div>
          <div className="text-right">
            <p className={cn(
              'text-lg font-bold',
              isPositive ? 'text-emerald-500' : 'text-rose-500'
            )}>
              {formatCurrency(account.balance)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ TOTAL BALANCE CARD ============

interface TotalBalanceCardProps {
  accounts: AccountBalance[];
  isLoading: boolean;
}

function TotalBalanceCard({ accounts, isLoading }: TotalBalanceCardProps) {
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [accounts]);

  const isPositive = totalBalance >= 0;

  return (
    <Card className={cn(
      'bg-gradient-to-br',
      isPositive 
        ? 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' 
        : 'from-rose-500/10 to-rose-600/5 border-rose-500/20'
    )}>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={cn(
            'p-3 rounded-lg',
            isPositive ? 'bg-emerald-500/20' : 'bg-rose-500/20'
          )}>
            <Wallet className={cn(
              'w-6 h-6',
              isPositive ? 'text-emerald-500' : 'text-rose-500'
            )} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Saldo Total em Caixa</p>
            {isLoading ? (
              <Skeleton className="h-8 w-32 mt-1" />
            ) : (
              <p className={cn(
                'text-2xl font-bold',
                isPositive ? 'text-emerald-500' : 'text-rose-500'
              )}>
                {formatCurrency(totalBalance)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {accounts.length} conta(s) ativa(s)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ PENDING RECEIVABLES CARD ============

interface PendingReceivablesCardProps {
  totalAmount: number;
  pendingCount: number;
  isLoading: boolean;
}

function PendingReceivablesCard({ totalAmount, pendingCount, isLoading }: PendingReceivablesCardProps) {
  return (
    <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-500/20">
            <Clock className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Comissões a Receber</p>
            {isLoading ? (
              <Skeleton className="h-8 w-32 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-amber-500">
                {formatCurrency(totalAmount)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {pendingCount} parcela(s) pendente(s)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ STATEMENT TABLE ============

interface StatementTableProps {
  accountId: string;
  startDate: string;
  endDate: string;
  onViewDetails: (id: string) => void;
}

function StatementTable({ accountId, startDate, endDate, onViewDetails }: StatementTableProps) {
  const { data: statements = [], isLoading } = useAccountStatement(accountId, startDate, endDate);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (statements.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma movimentação no período selecionado.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Data</TableHead>
          <TableHead className="min-w-[300px]">Descrição</TableHead>
          <TableHead className="text-right w-32">Valor</TableHead>
          <TableHead className="text-right w-32">Saldo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {statements.map((stmt, idx) => {
          const isCredit = stmt.amount > 0;
          const displayDate = stmt.transaction_date 
            ? format(parseLocalDate(String(stmt.transaction_date)), 'dd/MM', { locale: ptBR })
            : '-';
          
          return (
            <TableRow 
              key={`${stmt.transaction_id}-${idx}`}
              className={cn(
                "cursor-pointer hover:bg-muted/50",
                stmt.is_reversal && "bg-amber-500/5"
              )}
              onClick={() => onViewDetails(stmt.transaction_id)}
            >
              <TableCell className="font-mono text-sm">
                {displayDate}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {isCredit ? (
                    <ArrowDownLeft className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  )}
                  <span className="truncate">{stmt.description}</span>
                  {stmt.is_reversal && (
                    <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1 flex-shrink-0">
                      <RotateCcw className="w-3 h-3" />
                      Estorno
                    </Badge>
                  )}
                </div>
                {stmt.memo && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {stmt.memo}
                  </p>
                )}
              </TableCell>
              <TableCell className={cn(
                'text-right font-semibold',
                isCredit ? 'text-emerald-500' : 'text-rose-500'
              )}>
                {isCredit ? '+' : ''}{formatCurrency(stmt.amount)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(stmt.running_balance)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ============ MAIN COMPONENT ============

export function CaixaTab({ dateRange }: CaixaTabProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const { data: accounts = [], isLoading: accountsLoading } = useAccountBalances();
  const { data: pendingData, isLoading: pendingLoading } = useTotalPendingReceivablesFrom2026();

  // Datas normalizadas
  const { startDate, endDate } = useMemo(() => {
    const from = dateRange?.from || new Date();
    const to = dateRange?.to || new Date();
    return {
      startDate: format(startOfDay(from), 'yyyy-MM-dd'),
      endDate: format(endOfDay(to), 'yyyy-MM-dd')
    };
  }, [dateRange]);

  // Auto-selecionar primeira conta se nenhuma selecionada
  const effectiveAccountId = selectedAccountId || (accounts.length > 0 ? accounts[0].id : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            Caixa / Internet Banking
          </h2>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de saldos e movimentações bancárias
          </p>
        </div>
      </div>

      {/* Cards de Saldo e Pendentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TotalBalanceCard accounts={accounts} isLoading={accountsLoading} />
        <PendingReceivablesCard 
          totalAmount={pendingData?.total_amount ?? 0}
          pendingCount={pendingData?.pending_count ?? 0}
          isLoading={pendingLoading}
        />
      </div>

      {/* Cards de Contas */}
      {accountsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">
              Nenhuma conta bancária cadastrada.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Vá em Configurações para criar suas contas bancárias.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              isSelected={effectiveAccountId === account.id}
              onClick={() => setSelectedAccountId(account.id)}
            />
          ))}
        </div>
      )}

      {/* Extrato da Conta Selecionada */}
      {effectiveAccountId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base">
                Extrato Bancário
              </CardTitle>
              <CardDescription>
                Movimentações da conta selecionada no período
              </CardDescription>
            </div>
            
            {/* Mobile: Select dropdown */}
            <div className="sm:hidden">
              <Select
                value={effectiveAccountId}
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <StatementTable
                accountId={effectiveAccountId}
                startDate={startDate}
                endDate={endDate}
                onViewDetails={(id) => setDetailsId(id)}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Details Sheet */}
      <TransactionDetailsSheet
        transactionId={detailsId}
        isLegacyId={false}
        open={!!detailsId}
        onClose={() => setDetailsId(null)}
      />
    </div>
  );
}
