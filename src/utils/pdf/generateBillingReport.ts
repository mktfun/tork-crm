import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../formatCurrency';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type ColumnKey = 'date' | 'description' | 'client' | 'type' | 'status' | 'value';

export interface ReportOptions {
  title?: string;
  notes?: string;
  selectedColumns?: ColumnKey[];
  statusFilter?: 'all' | 'paid' | 'pending';
}

interface TransactionRow {
  date: string;
  description: string;
  clientName: string;
  typeName: string;
  policyNumber: string | null;
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
  options?: ReportOptions;
}

// Fixed column widths (total ~182mm usable width)
const COLUMN_CONFIG: Record<ColumnKey, { header: string; widthPercent: number; align: 'left' | 'center' | 'right' }> = {
  date: { header: 'DATA', widthPercent: 12, align: 'center' },
  description: { header: 'DESCRIÇÃO', widthPercent: 30, align: 'left' },
  client: { header: 'CLIENTE', widthPercent: 25, align: 'left' },
  type: { header: 'TIPO', widthPercent: 13, align: 'left' },
  status: { header: 'STATUS', widthPercent: 8, align: 'center' },
  value: { header: 'VALOR', widthPercent: 12, align: 'right' },
};

// SANITIZAÇÃO CRÍTICA - NUNCA retornar "undefined"
const sanitizeDescription = (
  desc: string | null | undefined, 
  typeName: string | null | undefined, 
  policyNumber: string | null | undefined
): string => {
  // Se a descrição contém "undefined" ou está vazia
  const cleanDesc = desc?.replace(/undefined/gi, '').trim();
  
  if (!cleanDesc || cleanDesc === '' || cleanDesc.toLowerCase() === 'null') {
    // Fallback 1: Usar número da apólice
    if (policyNumber && policyNumber !== 'undefined') {
      return `Comissão Apólice ${policyNumber}`;
    }
    // Fallback 2: Usar nome do tipo
    if (typeName && typeName !== 'undefined') {
      return typeName;
    }
    // Fallback 3: Texto genérico
    return 'Lançamento Manual';
  }
  
  return cleanDesc;
};

export const generateBillingReport = async ({ 
  transactions, 
  metrics: _ignoredMetrics, // IGNORAMOS as métricas recebidas - vamos recalcular
  period,
  options = {}
}: ReportData): Promise<void> => {
  const {
    title = 'Relatório de Faturamento',
    notes,
    selectedColumns = ['date', 'description', 'client', 'type', 'status', 'value'],
    statusFilter = 'all'
  } = options;

  // ========================================
  // RECÁLCULO DE MÉTRICAS (BASEADO NO FILTRO!)
  // ========================================
  const filteredTransactions = transactions.filter(t => {
    if (statusFilter === 'paid') return t.status === 'Pago';
    if (statusFilter === 'pending') return t.status === 'Pendente' || t.status === 'Parcial';
    return true;
  });

  // Recalcular totais com base APENAS nas transações filtradas
  const recalculatedMetrics = {
    totalGanhos: filteredTransactions
      .filter(t => t.nature === 'GANHO' && t.status === 'Pago')
      .reduce((acc, t) => acc + Math.abs(t.amount), 0),
    
    totalPerdas: filteredTransactions
      .filter(t => t.nature === 'PERDA' && t.status === 'Pago')
      .reduce((acc, t) => acc + Math.abs(t.amount), 0),
    
    totalPrevisto: filteredTransactions
      .filter(t => t.status === 'Pendente' || t.status === 'Parcial')
      .reduce((acc, t) => acc + Math.abs(t.amount), 0),
    
    saldoLiquido: 0
  };
  
  // Saldo = Receitas pagas - Despesas pagas
  recalculatedMetrics.saldoLiquido = recalculatedMetrics.totalGanhos - recalculatedMetrics.totalPerdas;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const usableWidth = pageWidth - (margin * 2);
  
  // ========================================
  // DESIGN SYSTEM - MINIMALISTA STRIPE-LIKE
  // ========================================
  const colors = {
    text: { primary: '#0f172a', secondary: '#64748b', muted: '#94a3b8' },
    border: '#e2e8f0',
    background: { table: '#f8fafc' },
    values: { positive: '#047857', negative: '#b91c1c', neutral: '#0f172a' }
  };

  // ========================================
  // 1. CABEÇALHO MINIMALISTA (SEM FUNDO COLORIDO)
  // ========================================
  let yPos = 20;
  
  // Logo placeholder (círculo cinza)
  doc.setFillColor(71, 85, 105); // Slate-600
  doc.circle(margin + 6, yPos, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('SGC', margin + 6, yPos + 2.5, { align: 'center' });
  
  // Nome da corretora
  doc.setTextColor(colors.text.primary);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SGC Pro', margin + 16, yPos + 2);
  
  // Subtítulo
  doc.setFontSize(8);
  doc.setTextColor(colors.text.secondary);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestão de Corretora', margin + 16, yPos + 8);
  
  // Lado direito - Título do relatório
  doc.setFontSize(10);
  doc.setTextColor(colors.text.muted);
  doc.setFont('helvetica', 'normal');
  doc.text('RELATÓRIO DE FATURAMENTO', pageWidth - margin, yPos - 2, { align: 'right' });
  
  doc.setFontSize(11);
  doc.setTextColor(colors.text.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth - margin, yPos + 6, { align: 'right' });
  
  // Período
  const periodoTexto = period.from && period.to 
    ? `${format(period.from, 'dd/MM/yyyy')} a ${format(period.to, 'dd/MM/yyyy')}`
    : 'Período Total';
  doc.setFontSize(9);
  doc.setTextColor(colors.text.secondary);
  doc.setFont('helvetica', 'normal');
  doc.text(periodoTexto, pageWidth - margin, yPos + 13, { align: 'right' });

  // Linha separadora fina
  yPos += 22;
  doc.setDrawColor(colors.border);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  // ========================================
  // 2. MÉTRICAS - NÚMEROS GRANDES COM SEPARADORES
  // ========================================
  yPos += 12;
  
  const metricWidth = usableWidth / 4;
  
  const drawMetric = (x: number, label: string, value: number, color: string, showSeparator: boolean = true) => {
    // Label (pequeno, acima)
    doc.setFontSize(8);
    doc.setTextColor(colors.text.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(label.toUpperCase(), x, yPos);
    
    // Valor (grande, abaixo)
    doc.setFontSize(14);
    doc.setTextColor(color);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(value), x, yPos + 8);
    
    // Linha vertical separadora
    if (showSeparator) {
      doc.setDrawColor(colors.border);
      doc.setLineWidth(0.2);
      doc.line(x + metricWidth - 4, yPos - 4, x + metricWidth - 4, yPos + 12);
    }
  };
  
  drawMetric(margin, 'Receitas', recalculatedMetrics.totalGanhos, colors.values.positive, true);
  drawMetric(margin + metricWidth, 'Despesas', recalculatedMetrics.totalPerdas, colors.values.negative, true);
  drawMetric(margin + metricWidth * 2, 'Saldo Líquido', recalculatedMetrics.saldoLiquido, 
    recalculatedMetrics.saldoLiquido >= 0 ? colors.values.positive : colors.values.negative, true);
  drawMetric(margin + metricWidth * 3, 'Previsto', recalculatedMetrics.totalPrevisto, colors.text.primary, false);

  // Linha separadora após métricas
  yPos += 20;
  doc.setDrawColor(colors.border);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  // ========================================
  // 3. TABELA COM LARGURAS FIXAS
  // ========================================
  const orderedColumns = selectedColumns.filter(col => COLUMN_CONFIG[col]);
  const headers = orderedColumns.map(col => COLUMN_CONFIG[col].header);
  
  // Calcular larguras reais das colunas
  const totalPercent = orderedColumns.reduce((sum, col) => sum + COLUMN_CONFIG[col].widthPercent, 0);
  const columnWidths = orderedColumns.map(col => 
    (COLUMN_CONFIG[col].widthPercent / totalPercent) * usableWidth
  );

  const getColumnValue = (t: TransactionRow, col: ColumnKey): string => {
    switch (col) {
      case 'date': 
        return t.date || 'N/A';
      case 'description': 
        return sanitizeDescription(t.description, t.typeName, t.policyNumber);
      case 'client': 
        return t.clientName && t.clientName !== 'undefined' ? t.clientName : 'Não informado';
      case 'type': 
        return t.typeName && t.typeName !== 'undefined' ? t.typeName : 'Transação';
      case 'status': 
        return t.status || 'Pendente';
      case 'value': 
        const sign = t.nature === 'GANHO' ? '+' : '-';
        return `${sign} ${formatCurrency(Math.abs(t.amount))}`;
      default: 
        return '-';
    }
  };

  const tableData = filteredTransactions.map(t => 
    orderedColumns.map(col => getColumnValue(t, col))
  );

  // Column styles com larguras fixas
  const columnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {};
  orderedColumns.forEach((col, index) => {
    columnStyles[index] = {
      cellWidth: columnWidths[index],
      halign: COLUMN_CONFIG[col].align
    };
  });

  const valueColumnIndex = orderedColumns.indexOf('value');
  const statusColumnIndex = orderedColumns.indexOf('status');

  autoTable(doc, {
    startY: yPos + 8,
    head: [headers],
    body: tableData,
    theme: 'plain',
    styles: {
      lineColor: colors.border,
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: colors.background.table,
      textColor: '#475569', // Slate-600
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 }
    },
    bodyStyles: {
      fontSize: 8,
      textColor: colors.text.primary,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }
    },
    columnStyles,
    didParseCell: function(data) {
      // Linha inferior em cada célula do body
      if (data.section === 'body') {
        data.cell.styles.lineWidth = { bottom: 0.1, top: 0, left: 0, right: 0 };
      }
      
      // Colorir valores
      if (data.section === 'body' && valueColumnIndex >= 0 && data.column.index === valueColumnIndex) {
        const rawValue = String(data.cell.raw);
        data.cell.styles.fontStyle = 'bold';
        if (rawValue.startsWith('-')) {
          data.cell.styles.textColor = colors.values.negative;
        } else {
          data.cell.styles.textColor = colors.values.positive;
        }
      }
      
      // Colorir status
      if (data.section === 'body' && statusColumnIndex >= 0 && data.column.index === statusColumnIndex) {
        const status = String(data.cell.raw);
        if (status === 'Pago') {
          data.cell.styles.textColor = colors.values.positive;
        } else if (status === 'Parcial') {
          data.cell.styles.textColor = '#2563eb';
        } else {
          data.cell.styles.textColor = '#ca8a04';
        }
      }
    },
    foot: filteredTransactions.length > 0 ? [
      orderedColumns.map((col, idx) => {
        if (idx === orderedColumns.length - 2) return 'TOTAL';
        if (idx === orderedColumns.length - 1) return formatCurrency(recalculatedMetrics.saldoLiquido);
        return '';
      })
    ] : undefined,
    footStyles: {
      fillColor: '#ffffff',
      textColor: colors.text.primary,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: { top: 5, bottom: 5, left: 3, right: 3 },
      lineWidth: { top: 0.5 }
    }
  });

  // ========================================
  // 4. OBSERVAÇÕES (se houver)
  // ========================================
  if (notes) {
    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    
    doc.setDrawColor(colors.border);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY + 10, pageWidth - margin, finalY + 10);
    
    doc.setFontSize(8);
    doc.setTextColor(colors.text.secondary);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações', margin, finalY + 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.primary);
    const splitNotes = doc.splitTextToSize(notes, usableWidth);
    doc.text(splitNotes, margin, finalY + 24);
  }

  // ========================================
  // 5. RODAPÉ EM TODAS AS PÁGINAS
  // ========================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Linha separadora
    doc.setDrawColor(colors.border);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
    
    // Texto legal
    doc.setFontSize(7);
    doc.setTextColor(colors.text.muted);
    doc.text(
      `Documento gerado eletronicamente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} via SGC Pro`,
      margin,
      pageHeight - 10
    );
    
    // Paginação
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  // ========================================
  // 6. SALVAR ARQUIVO
  // ========================================
  const monthYear = period.from 
    ? format(period.from, 'MMM_yyyy', { locale: ptBR }).toUpperCase()
    : 'GERAL';
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const fileName = `${safeTitle}_${monthYear}.pdf`;
  
  doc.save(fileName);
};
