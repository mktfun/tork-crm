import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppCard } from '@/components/ui/app-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { DollarSign, TrendingUp, TrendingDown, Calendar, Check, ExternalLink, History } from 'lucide-react';
import { ModalNovaTransacao } from '@/components/faturamento/ModalNovaTransacao';
import { ModalBaixaParcial } from '@/components/faturamento/ModalBaixaParcial';
import { HistoricoPagamentos } from '@/components/faturamento/HistoricoPagamentos';
import { FiltrosFaturamento } from '@/components/faturamento/FiltrosFaturamento';
import { TransactionTableSkeleton } from '@/components/faturamento/TransactionTableSkeleton';
import { MetricsSkeleton } from '@/components/faturamento/MetricsSkeleton';
import { useSupabaseTransactionsPaginated } from '@/hooks/useSupabaseTransactionsPaginated';
import { useClients, usePolicies, useTransactionTypes } from '@/hooks/useAppData';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/hooks/use-toast';
import { Transaction } from '@/types';

export default function Faturamento() {
  usePageTitle('Faturamento');
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  const pageSize = 20;

  const {
    transactions,
    totalCount,
    metrics,
    loading,
    updateTransaction
  } = useSupabaseTransactionsPaginated({
    period: selectedPeriod,
    companyId: selectedCompany,
    page: currentPage,
    pageSize
  });

  const { clients } = useClients();
  const { policies } = usePolicies();
  const { transactionTypes } = useTransactionTypes();

  const handleMarkAsPaid = async (transactionId: string) => {
    try {
      await updateTransaction(transactionId, { status: 'PAGO' });
      toast({
        title: "Sucesso!",
        description: "Transação marcada como paga.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar transação.",
        variant: "destructive"
      });
    }
  };

  const handleFilterChange = (newPeriod: string, newCompany: string) => {
    setSelectedPeriod(newPeriod);
    setSelectedCompany(newCompany);
    setCurrentPage(1);
  };

  const handleOpenHistorico = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setHistoricoModalOpen(true);
  };

  const handleCloseHistorico = () => {
    setHistoricoModalOpen(false);
    setSelectedTransaction(null);
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Faturamento</h1>
            <p className="text-slate-400">Acompanhe todas as transações financeiras da corretora</p>
          </div>
          <div className="flex gap-4">
            <ModalNovaTransacao />
          </div>
        </div>

        <FiltrosFaturamento 
          selectedPeriod={selectedPeriod} 
          selectedCompany={selectedCompany} 
          onPeriodChange={(period) => handleFilterChange(period, selectedCompany)}
          onCompanyChange={(company) => handleFilterChange(selectedPeriod, company)}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {loading ? (
            <MetricsSkeleton />
          ) : (
            <>
              <AppCard className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/20 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Total de Ganhos</p>
                    <p className="text-2xl font-bold text-green-400">
                      {metrics.totalGanhos.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </p>
                  </div>
                </div>
              </AppCard>

              <AppCard className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-500/20 rounded-lg">
                    <TrendingDown className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Total de Perdas</p>
                    <p className="text-2xl font-bold text-red-400">
                      {metrics.totalPerdas.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </p>
                  </div>
                </div>
              </AppCard>

              <AppCard className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <DollarSign className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Saldo Líquido</p>
                    <p className={`text-2xl font-bold ${metrics.saldoLiquido >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {metrics.saldoLiquido.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </p>
                  </div>
                </div>
              </AppCard>

              <AppCard className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-500/20 rounded-lg">
                    <Calendar className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">Total Previsto</p>
                    <p className="text-2xl font-bold text-white">
                      {metrics.totalPrevisto.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </p>
                  </div>
                </div>
              </AppCard>
            </>
          )}
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            Transações ({totalCount} total)
          </h2>
          {!loading && totalCount > 0 && (
            <span className="text-sm text-slate-400">
              Mostrando {startItem} a {endItem} de {totalCount} transações
            </span>
          )}
        </div>

        {loading ? (
          <TransactionTableSkeleton />
        ) : transactions.length === 0 ? (
          <AppCard className="p-8 text-center">
            <div className="text-slate-600 mb-4">
              <DollarSign size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Nenhuma transação encontrada
            </h3>
            <p className="text-slate-400 mb-4">
              {selectedPeriod !== 'all' || selectedCompany !== 'all' 
                ? 'Nenhuma transação encontrada para os filtros selecionados.' 
                : 'Comece adicionando sua primeira transação manual.'}
            </p>
            <ModalNovaTransacao />
          </AppCard>
        ) : (
          <div className="overflow-x-auto">
            <AppCard className="p-0 min-w-[800px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-white/10 hover:bg-white/5">
                    <TableHead className="text-white">Descrição</TableHead> 
                    <TableHead className="text-white">Tipo</TableHead>
                    <TableHead className="text-white">Data</TableHead>
                    <TableHead className="text-white">Status</TableHead>
                    <TableHead className="text-right text-white">Valor</TableHead>
                    <TableHead className="text-white">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(transaction => {
                    const client = clients.find(c => c.id === transaction.clientId);
                    const policy = policies.find(p => p.id === transaction.policyId);
                    const transactionType = transactionTypes.find(tt => tt.id === transaction.typeId);
                    const isGanho = transactionType?.nature === 'GANHO';

                    return (
                      <TableRow 
                        key={transaction.id} 
                        className="border-b-white/10 hover:bg-white/5 cursor-pointer group"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('a, button')) return;
                          if (transaction.policyId) {
                            navigate(`/policies/${transaction.policyId}`);
                          }
                        }}
                      >
                        <TableCell className="font-medium text-slate-200">
                          <div className="flex flex-col">
                            <span className="font-bold group-hover:text-white transition-colors">
                              {transaction.description}
                            </span>
                            
                            <div className="text-xs text-slate-400 space-x-2 mt-1 flex items-center gap-2">
                              <span>Associado a:</span>
                              {client && (
                                <Link 
                                  to={`/dashboard/clients/${client.id}`} 
                                  className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {client.name}
                                  <ExternalLink size={10} />
                                </Link>
                              )}
                              {policy && (
                                <Link 
                                  to={`/dashboard/policies/${policy.id}`} 
                                  className="text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  (Apólice #{policy.policyNumber})
                                  <ExternalLink size={10} />
                                </Link>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge variant={isGanho ? 'default' : 'destructive'}>
                            {transactionType?.name || (isGanho ? 'GANHO' : 'PERDA')}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-slate-400">
                          {new Date(transaction.date).toLocaleDateString('pt-BR')}
                        </TableCell>

                        <TableCell>
                          <Badge 
                            variant={
                              transaction.status === 'PAGO' ? 'default' : 
                              transaction.status === 'PARCIALMENTE_PAGO' ? 'secondary' : 'outline'
                            } 
                            className={
                              transaction.status === 'PAGO' ? 'text-green-400 border-green-500' : 
                              transaction.status === 'PARCIALMENTE_PAGO' ? 'text-blue-400 border-blue-500' : 
                              'text-yellow-400 border-yellow-500'
                            }
                          >
                            {transaction.status === 'PAGO' ? 'Pago' : 
                             transaction.status === 'PARCIALMENTE_PAGO' ? 'Parcial' : 'Pendente'}
                          </Badge>
                        </TableCell>

                        <TableCell className={`text-right font-bold font-mono ${isGanho ? 'text-green-400' : 'text-red-400'}`}>
                          {isGanho ? '+' : '-'} {Math.abs(transaction.amount).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            {transaction.status === 'PENDENTE' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsPaid(transaction.id);
                                  }}
                                  className="flex items-center gap-2 bg-white/10 border-white/20 text-slate-200 hover:bg-white/20"
                                >
                                  <Check size={14} />
                                  Pagar Total
                                </Button>
                                
                                <ModalBaixaParcial 
                                  transaction={transaction} 
                                  onSuccess={() => {
                                    toast({
                                      title: "Sucesso!",
                                      description: "Pagamento parcial registrado.",
                                    });
                                  }} 
                                />
                              </>
                            )}
                            
                            {transaction.status === 'PARCIALMENTE_PAGO' && (
                              <>
                                <ModalBaixaParcial 
                                  transaction={transaction} 
                                  onSuccess={() => {
                                    toast({
                                      title: "Sucesso!",
                                      description: "Pagamento parcial registrado.",
                                    });
                                  }} 
                                />
                                
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenHistorico(transaction);
                                  }}
                                  className="flex items-center gap-2 bg-white/10 border-white/20 text-slate-200 hover:bg-white/20"
                                >
                                  <History size={14} />
                                  Histórico
                                </Button>
                              </>
                            )}
                            
                            {transaction.status === 'PAGO' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenHistorico(transaction);
                                }}
                                className="flex items-center gap-2 bg-white/10 border-white/20 text-slate-200 hover:bg-white/20"
                              >
                                <History size={14} />
                                Histórico
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AppCard>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = i + 1;
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNumber)}
                        isActive={currentPage === pageNumber}
                        className="cursor-pointer"
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {selectedTransaction && (
          <HistoricoPagamentos 
            transaction={selectedTransaction} 
            isOpen={historicoModalOpen} 
            onClose={handleCloseHistorico} 
          />
        )}
      </div>
    </div>
  );
}
