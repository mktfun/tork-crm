import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../formatCurrency';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TransactionRow {
  date: string;
  description: string;
  clientName: string;
  typeName: string;
  policyNumber: string;
  status: string;
  amount: number;
  nature: 'GANHO' | 'PERDA';
}

interface ReportMetrics {
  totalGanhos: number;
  totalPerdas: number;
  saldoLiquido: number;
  totalPrevisto: number;
}

interface ReportPeriod {
  from: Date | undefined;
  to: Date | undefined;
}

interface ReportData {
  transactions: TransactionRow[];
  metrics: ReportMetrics;
  period: ReportPeriod;
}

export const generateBillingReport = async ({ transactions, metrics, period }: ReportData): Promise<void> => {
  const doc = new jsPDF();
  
  // Cores do design system
  const primaryColor: [number, number, number] = [124, 58, 237]; // Violet-600
  const secondaryColor = '#1e293b'; // Slate-800
  const zebraColor: [number, number, number] = [248, 250, 252]; // Slate-50
  
  // 1. Cabeçalho
  doc.setFontSize(22);
  doc.setTextColor(secondaryColor);
  doc.text('Relatório de Faturamento', 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  const periodoTexto = period.from && period.to 
    ? `${format(period.from, 'dd/MM/yyyy')} a ${format(period.to, 'dd/MM/yyyy')}`
    : 'Período Total';
    
  doc.text(`Período: ${periodoTexto}`, 14, 28);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 33);

  // Logo/Brand
  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('SGC Pro', 196, 20, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Sistema de Gestão de Corretora', 196, 25, { align: 'right' });

  // 2. Resumo Financeiro (Cards)
  const startY = 45;
  const boxWidth = 44;
  const boxHeight = 22;
  const gap = 4;
  
  const drawMetricBox = (x: number, title: string, value: number, textColor: string) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220);
    doc.roundedRect(x, startY, boxWidth, boxHeight, 2, 2, 'FD');
    
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(title, x + 3, startY + 7);
    
    doc.setFontSize(10);
    doc.setTextColor(textColor);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(value), x + 3, startY + 16);
    doc.setFont('helvetica', 'normal');
  };

  drawMetricBox(14, 'Receitas', metrics.totalGanhos, '#16a34a');
  drawMetricBox(14 + boxWidth + gap, 'Despesas', metrics.totalPerdas, '#dc2626');
  drawMetricBox(14 + (boxWidth + gap) * 2, 'Saldo Líquido', metrics.saldoLiquido, metrics.saldoLiquido >= 0 ? '#16a34a' : '#dc2626');
  drawMetricBox(14 + (boxWidth + gap) * 3, 'Previsto', metrics.totalPrevisto, '#2563eb');

  // 3. Tabela de Transações
  const tableData = transactions.map(t => [
    t.date,
    t.description,
    t.clientName,
    t.typeName,
    t.status,
    `${t.nature === 'GANHO' ? '+' : '-'} ${formatCurrency(Math.abs(t.amount))}`
  ]);

  autoTable(doc, {
    startY: startY + boxHeight + 12,
    head: [['Data', 'Descrição', 'Cliente', 'Tipo', 'Status', 'Valor']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: '#ffffff',
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7,
      textColor: '#334155',
      cellPadding: 2
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 35 },
      3: { cellWidth: 28 },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: zebraColor
    },
    didParseCell: function(data) {
      // Colorir valores
      if (data.section === 'body' && data.column.index === 5) {
        const rawValue = String(data.cell.raw);
        if (rawValue.startsWith('-')) {
          data.cell.styles.textColor = '#dc2626';
        } else {
          data.cell.styles.textColor = '#16a34a';
        }
      }
      // Colorir Status
      if (data.section === 'body' && data.column.index === 4) {
        const status = String(data.cell.raw);
        if (status === 'Pago') {
          data.cell.styles.textColor = '#16a34a';
        } else if (status === 'Parcial') {
          data.cell.styles.textColor = '#2563eb';
        } else {
          data.cell.styles.textColor = '#ca8a04';
        }
      }
    },
    foot: [[
      '', '', '', '',
      'TOTAL:',
      formatCurrency(metrics.saldoLiquido)
    ]],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: '#1e293b',
      fontStyle: 'bold',
      halign: 'right',
      fontSize: 9
    }
  });

  // 4. Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} • Gerado por SGC Pro`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Nome do arquivo semântico
  const monthYear = period.from 
    ? format(period.from, 'MMM_yyyy', { locale: ptBR }).toUpperCase()
    : 'GERAL';
  const fileName = `Relatorio_Faturamento_${monthYear}.pdf`;
  
  doc.save(fileName);
};
