
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, DollarSign, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { TransactionPayment, Transaction } from '@/types';
import { useTransactions } from '@/hooks/useAppData';
import { GlassCard } from '@/components/ui/glass-card';

interface HistoricoPagamentosProps {
  transaction: Transaction;
  isOpen: boolean;
  onClose: () => void;
}

export function HistoricoPagamentos({ transaction, isOpen, onClose }: HistoricoPagamentosProps) {
  const [payments, setPayments] = useState<TransactionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const { getTransactionPayments } = useTransactions();

  useEffect(() => {
    if (isOpen && transaction.id) {
      loadPayments();
    }
  }, [isOpen, transaction.id]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const paymentsData = await getTransactionPayments(transaction.id);
      setPayments(paymentsData);
    } catch (error) {
      console.error('Erro ao carregar histórico de pagamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CÁLCULOS INTELIGENTES
  const totalPago = payments.reduce((sum, payment) => sum + payment.amountPaid, 0);
  const saldoDevedor = transaction.amount - totalPago;

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Pagamentos</DialogTitle>
          </DialogHeader>
          <div className="p-8 text-center">
            <div className="text-white/60">Carregando histórico...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de Pagamentos</DialogTitle>
        </DialogHeader>
        
        {/* ✅ RESUMO FINANCEIRO COMPLETO */}
        <div className="space-y-4 mb-6">
          {/* Valor Total */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign size={20} className="text-sky-400" />
                <span className="text-white font-medium">Valor Total da Transação:</span>
              </div>
              <Badge variant="outline" className="bg-sky-500/10 text-sky-400 border-sky-500/20 text-lg px-3 py-1">
                {transaction.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Badge>
            </div>
          </GlassCard>

          {/* Total Pago */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-400" />
                <span className="text-white font-medium">Total Pago:</span>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-lg px-3 py-1">
                {totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Badge>
            </div>
            <div className="text-sm text-white/60 mt-2">
              {payments.length} pagamento{payments.length !== 1 ? 's' : ''} registrado{payments.length !== 1 ? 's' : ''}
            </div>
          </GlassCard>

          {/* Saldo Devedor */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown size={20} className={saldoDevedor > 0 ? "text-rose-400" : "text-emerald-400"} />
                <span className="text-white font-medium">Saldo Devedor:</span>
              </div>
              <Badge 
                variant="outline" 
                className={`text-lg px-3 py-1 ${
                  saldoDevedor > 0 
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                }`}
              >
                {saldoDevedor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Badge>
            </div>
            <div className="text-sm text-white/60 mt-2">
              {saldoDevedor <= 0 ? "✅ Transação totalmente quitada" : "⚠️ Pagamento pendente"}
            </div>
          </GlassCard>
        </div>

        {/* Lista de Pagamentos */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Detalhamento dos Pagamentos</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {payments.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                Nenhum pagamento registrado ainda.
              </div>
            ) : (
              payments.map((payment) => (
                <GlassCard key={payment.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <CalendarDays size={16} className="text-blue-400" />
                          <span className="text-white font-medium">
                            {new Date(payment.paymentDate).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {payment.amountPaid.toLocaleString('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          })}
                        </Badge>
                      </div>
                      
                      {payment.description && (
                        <div className="flex items-start gap-2 mt-2">
                          <FileText size={14} className="text-white/60 mt-0.5" />
                          <p className="text-sm text-white/80">
                            {payment.description}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-white/50">
                      {new Date(payment.createdAt).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
