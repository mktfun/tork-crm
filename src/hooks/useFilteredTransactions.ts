
import { useMemo } from 'react';
import { Transaction } from '@/types';
import { useTransactions, useTransactionTypes, usePolicies } from '@/hooks/useAppData';

export function useFilteredTransactions(period: string, companyId: string) {
  const { transactions } = useTransactions();
  const { transactionTypes } = useTransactionTypes();
  const { policies } = usePolicies();

  // Debug log
  console.log('🔍 Filtered Transactions Debug:', {
    totalTransactions: transactions.length,
    totalTransactionTypes: transactionTypes.length,
    totalPolicies: policies.length,
    period,
    companyId,
    transactionTypes: transactionTypes.map(t => ({ id: t.id, name: t.name, nature: t.nature }))
  });

  // 🚀 **MEMOIZAÇÃO OTIMIZADA** - Só recalcula quando necessário
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filtro por período
    if (period !== 'all') {
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);
      const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);

      filtered = filtered.filter(transaction => {
        const transactionDate = new Date(transaction.date);

        switch (period) {
          case 'current-month':
            return transactionDate >= startOfCurrentMonth;
          case 'last-month':
            return transactionDate >= startOfLastMonth && transactionDate <= endOfLastMonth;
          case 'current-year':
            return transactionDate >= startOfCurrentYear;
          case 'last-year':
            return transactionDate >= startOfLastYear && transactionDate <= endOfLastYear;
          default:
            return true;
        }
      });
    }

    // 🎯 FILTRO POR SEGURADORA - A LÓGICA NOVA
    if (companyId !== 'all') {
      console.log('🏢 Filtrando por seguradora:', companyId);
      
      filtered = filtered.filter(transaction => {
        // Primeiro, verifica se a transação tem companyId direto
        if (transaction.companyId === companyId) {
          console.log(`✅ Transação ${transaction.id} aprovada por companyId direto`);
          return true;
        }
        
        // Se a transação está associada a uma apólice, verifica a seguradora da apólice
        if (transaction.policyId) {
          const policy = policies.find(p => p.id === transaction.policyId);
          if (policy?.insuranceCompany === companyId) {
            console.log(`✅ Transação ${transaction.id} aprovada por apólice ${policy.policyNumber}`);
            return true;
          }
        }
        
        console.log(`❌ Transação ${transaction.id} rejeitada - não relacionada à seguradora`);
        return false;
      });
      
      console.log(`🏢 Transações filtradas por seguradora ${companyId}: ${filtered.length}`);
    }

    console.log('📊 Transações filtradas (total):', filtered.length);
    return filtered;
  }, [transactions, period, companyId, policies]);

  // 🚀 **MEMOIZAÇÃO OTIMIZADA** - Métricas só recalculam quando filtros mudam
  const metrics = useMemo(() => {
    console.log('💰 Calculando métricas financeiras com NOVO MÓDULO...');
    
    // Separar transações realizadas e previstas
    const realizadas = filteredTransactions.filter(t => 
      t.status === 'REALIZADO' || t.status === 'PAGO'
    );
    const previstas = filteredTransactions.filter(t => 
      t.status === 'PREVISTO' || t.status === 'PENDENTE' || t.status === 'PARCIALMENTE_PAGO'
    );

    console.log(`📈 Transações realizadas: ${realizadas.length}, previstas: ${previstas.length}`);

    // ✅ CÁLCULO ATUALIZADO USANDO O CAMPO 'nature' DA TABELA
    let totalGanhos = 0;
    let totalPerdas = 0;

    console.log('🔍 === PROCESSANDO TRANSAÇÕES REALIZADAS COM NATURE ===');
    realizadas.forEach(transaction => {
      console.log(`🔍 REALIZADA ${transaction.id}:`);
      console.log(`  - Nature: ${transaction.nature}`);
      console.log(`  - Valor: ${transaction.amount}`);
      console.log(`  - Status: ${transaction.status}`);
      
      if (['GANHO', 'RECEITA'].includes(transaction.nature)) {
        totalGanhos += transaction.amount;
        console.log(`➕ Adicionado aos ganhos: ${transaction.amount}, Total ganhos: ${totalGanhos}`);
      } else if (['PERDA', 'DESPESA'].includes(transaction.nature)) {
        totalPerdas += transaction.amount;
        console.log(`➖ Adicionado às perdas: ${transaction.amount}, Total perdas: ${totalPerdas}`);
      }
    });

    // Calcular total previsto (considera nature para somar ou subtrair)
    let totalPrevisto = 0;
    
    console.log('🔍 === PROCESSANDO TRANSAÇÕES PREVISTAS COM NATURE ===');
    previstas.forEach(transaction => {
      console.log(`🔮 PREVISTA ${transaction.id}:`);
      console.log(`  - Nature: ${transaction.nature}`);
      console.log(`  - Valor: ${transaction.amount}`);
      console.log(`  - Status: ${transaction.status}`);
      
      if (['GANHO', 'RECEITA'].includes(transaction.nature)) {
        totalPrevisto += transaction.amount;
        console.log(`➕ Somando ao previsto: ${transaction.amount}, Total previsto: ${totalPrevisto}`);
      } else if (['PERDA', 'DESPESA'].includes(transaction.nature)) {
        totalPrevisto -= transaction.amount;
        console.log(`➖ Subtraindo do previsto: ${transaction.amount}, Total previsto: ${totalPrevisto}`);
      }
    });

    // Saldo líquido = ganhos - perdas (apenas realizadas)
    const saldoLiquido = totalGanhos - totalPerdas;

    console.log('💰 === MÉTRICAS FINAIS COM NOVO MÓDULO ===');
    console.log(`Total Ganhos (Realizadas): R$ ${totalGanhos}`);
    console.log(`Total Perdas (Realizadas): R$ ${totalPerdas}`);
    console.log(`Total Previsto: R$ ${totalPrevisto}`);
    console.log(`Saldo Líquido: R$ ${saldoLiquido}`);

    return {
      totalGanhos,
      totalPerdas,
      totalPrevisto,
      saldoLiquido
    };
  }, [filteredTransactions]);

  return {
    transactions: filteredTransactions,
    metrics
  };
}
