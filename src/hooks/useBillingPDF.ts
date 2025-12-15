import { useState } from 'react';
import { generateBillingReport } from '@/utils/pdf/generateBillingReport';
import { useToast } from '@/hooks/use-toast';
import { Transaction, Client, Policy, TransactionType } from '@/types';
import { DateRange } from 'react-day-picker';

interface UseBillingPDFParams {
  transactions: Transaction[];
  metrics: {
    totalGanhos: number;
    totalPerdas: number;
    saldoLiquido: number;
    totalPrevisto: number;
  };
  dateRange: DateRange | undefined;
  clients: Client[];
  policies: Policy[];
  transactionTypes: TransactionType[];
}

export function useBillingPDF() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generatePDF = async ({
    transactions,
    metrics,
    dateRange,
    clients,
    policies,
    transactionTypes
  }: UseBillingPDFParams) => {
    if (!transactions || transactions.length === 0) {
      toast({
        title: "Sem dados para exportar",
        description: "Não há transações no período selecionado para gerar o relatório.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGenerating(true);
      
      // Pequeno delay para UI feedback
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Transformar dados para o formato do relatório
      const reportTransactions = transactions.map(t => {
        const client = clients.find(c => c.id === t.clientId);
        const transactionType = transactionTypes.find(tt => tt.id === t.typeId);
        const policy = policies.find(p => p.id === t.policyId);
        
        return {
          date: new Date(t.date).toLocaleDateString('pt-BR'),
          description: t.description,
          clientName: client?.name || '-',
          typeName: transactionType?.name || 'Transação',
          policyNumber: policy?.policyNumber || '-',
          status: t.status === 'PAGO' ? 'Pago' : t.status === 'PARCIALMENTE_PAGO' ? 'Parcial' : 'Pendente',
          amount: t.amount,
          nature: (transactionType?.nature || 'GANHO') as 'GANHO' | 'PERDA'
        };
      });

      await generateBillingReport({
        transactions: reportTransactions,
        metrics,
        period: {
          from: dateRange?.from,
          to: dateRange?.to
        }
      });

      toast({
        title: "Relatório gerado",
        description: "O download do PDF foi iniciado.",
      });

    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível gerar o relatório. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return { generatePDF, isGenerating };
}
