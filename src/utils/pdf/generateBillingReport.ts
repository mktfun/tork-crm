import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../formatCurrency';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { drawPDFHeader, drawPDFFooter, PDF_COLORS } from './pdfHeader';

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
  status: string; // 'Pago' | 'Pendente' | 'Parcial'
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

// ========================================
// LARGURAS FIXAS EM MM (Total = 180mm para caber em A4 com margens)
// ========================================
const COLUMN_CONFIG: Record<ColumnKey, { header: string; width: number; align: 'left' | 'center' | 'right' }> = {
  date: { header: 'DATA', width: 20, align: 'center' },
  description: { header: 'DESCRIÇÃO', width: 50, align: 'left' },
  client: { header: 'CLIENTE', width: 38, align: 'left' },
  type: { header: 'TIPO', width: 24, align: 'left' },
  status: { header: 'STATUS', width: 18, align: 'center' },
  value: { header: 'VALOR (R$)', width: 30, align: 'right' },
};

// SANITIZAÇÃO + TRUNCAMENTO - NUNCA retornar "undefined"
const sanitizeDescription = (
  desc: string | null | undefined, 
  typeName: string | null | undefined, 
  policyNumber: string | null | undefined,
  maxLength: number = 45
): string => {
  let result = '';
  
  // Limpar undefined/null da descrição
  const cleanDesc = desc?.replace(/undefined/gi, '').replace(/null/gi, '').trim();
  
  if (!cleanDesc || cleanDesc === '') {
    // Fallback 1: Usar número da apólice
    if (policyNumber && policyNumber !== 'undefined' && policyNumber !== 'null') {
      result = `Comissão Apólice ${policyNumber}`;
    }
    // Fallback 2: Usar nome do tipo
    else if (typeName && typeName !== 'undefined' && typeName !== 'null') {
      result = typeName;
    }
    // Fallback 3: Texto genérico
    else {
      result = 'Lançamento Manual';
    }
  } else {
    result = cleanDesc;
  }
  
  // Truncar se muito longo
  if (result.length > maxLength) {
    result = result.substring(0, maxLength - 3) + '...';
  }
  
  return result;
};

// Sanitizar strings genéricas
const sanitizeString = (str: string | null | undefined, fallback: string): string => {
  if (!str || str === 'undefined' || str === 'null' || str.trim() === '') {
    return fallback;
  }
  return str.replace(/undefined/gi, '').replace(/null/gi, '').trim() || fallback;
};

// ========================================
// PARSING SEGURO DE VALORES
// ========================================
const parseValue = (val: unknown): number => {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    // Remove formatação brasileira (R$, pontos de milhar)
    const cleaned = val.replace(/[R$\s.]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const generateBillingReport = async ({ 
  transactions, 
  metrics: _ignoredMetrics, // IGNORAMOS métricas recebidas - recalculamos aqui
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
  // 1. FILTRAR BASEADO NAS OPÇÕES DO MODAL
  // ========================================
  const rowsToPrint = transactions.filter(t => {
    if (statusFilter === 'paid') return t.status === 'Pago';
    if (statusFilter === 'pending') return t.status === 'Pendente' || t.status === 'Parcial';
    return true;
  });

  // ========================================
  // 2. RECÁLCULO CONTÁBIL PRECISO (usando parseValue)
  // ========================================
  // REGRA DE OURO:
  // - Receitas = Apenas GANHOS que foram PAGOS
  // - Despesas = Apenas PERDAS que foram PAGAS  
  // - Saldo Líquido = Receitas - Despesas (SOMENTE valores já realizados)
  // - Previsto/A Receber = GANHOS pendentes (não inclui despesas pendentes)
  
  const metricasCalculadas = rowsToPrint.reduce((acc, t) => {
    const valor = Math.abs(parseValue(t.amount));
    const isPago = t.status === 'Pago';
    const isPendente = t.status === 'Pendente' || t.status === 'Parcial';
    const isGanho = t.nature === 'GANHO';
    const isPerda = t.nature === 'PERDA';

    if (isPago) {
      // Soma nos totais REALIZADOS
      if (isGanho) {
        acc.receitas += valor;
      } else if (isPerda) {
        acc.despesas += valor;
      }
    } else if (isPendente) {
      // Soma nos PREVISTOS (apenas receitas futuras)
      if (isGanho) {
        acc.previsto += valor;
      }
      // Despesas pendentes NÃO somam no previsto - são obrigações futuras
    }
    
    return acc;
  }, { receitas: 0, despesas: 0, previsto: 0 });

  // SALDO LÍQUIDO = Apenas valores já PAGOS/RECEBIDOS
  const saldoLiquido = metricasCalculadas.receitas - metricasCalculadas.despesas;

  // DEBUG LOG - Verificar no console do navegador (F12)
  console.log('📊 PDF Generation Debug:', {
    totalLinhas: rowsToPrint.length,
    filtroStatus: statusFilter,
    metricas: {
      receitas: metricasCalculadas.receitas.toFixed(2),
      despesas: metricasCalculadas.despesas.toFixed(2),
      saldoLiquido: saldoLiquido.toFixed(2),
      previsto: metricasCalculadas.previsto.toFixed(2)
    }
  });

  // ========================================
  // 3. INICIALIZAR PDF
  // ========================================
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;
  
  // Usar cores do design system compartilhado
  const colors = PDF_COLORS;

  // ========================================
  // 4. CABEÇALHO (usando função compartilhada)
  // ========================================
  let yPos = drawPDFHeader(doc, {
    title,
    subtitle: 'RELATÓRIO DE FATURAMENTO',
    period
  });

  // ========================================
  // 5. CARDS DE MÉTRICAS (RECALCULADOS)
  // ========================================
  yPos += 10;
  const cardWidth = 43;
  const cardGap = 3;
  
  const drawMetricCard = (x: number, label: string, value: number, textColor: string) => {
    // Label
    doc.setFontSize(7);
    doc.setTextColor(colors.text.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(label.toUpperCase(), x, yPos);
    
    // Valor - usar Courier para alinhamento monospace
    doc.setFontSize(13);
    doc.setTextColor(textColor);
    doc.setFont('courier', 'bold');
    doc.text(formatCurrency(value), x, yPos + 7);
    doc.setFont('helvetica', 'normal');
  };

  drawMetricCard(margin, 'Receitas (Pagas)', metricasCalculadas.receitas, colors.values.positive);
  drawMetricCard(margin + cardWidth + cardGap, 'Despesas (Pagas)', metricasCalculadas.despesas, colors.values.negative);
  drawMetricCard(margin + (cardWidth + cardGap) * 2, 'Saldo Líquido', saldoLiquido, saldoLiquido >= 0 ? colors.values.positive : colors.values.negative);
  drawMetricCard(margin + (cardWidth + cardGap) * 3, 'A Receber', metricasCalculadas.previsto, colors.values.pending);

  // Separadores verticais entre métricas
  doc.setDrawColor(colors.border);
  doc.setLineWidth(0.2);
  for (let i = 1; i < 4; i++) {
    const xSep = margin + (cardWidth + cardGap) * i - cardGap / 2;
    doc.line(xSep, yPos - 4, xSep, yPos + 10);
  }

  // Linha separadora após métricas
  yPos += 16;
  doc.setDrawColor(colors.border);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  // ========================================
  // 6. TABELA COM LARGURAS FIXAS
  // ========================================
  const orderedColumns = selectedColumns.filter(col => COLUMN_CONFIG[col]);
  const headers = orderedColumns.map(col => COLUMN_CONFIG[col].header);
  
  const getColumnValue = (t: TransactionRow, col: ColumnKey): string => {
    switch (col) {
      case 'date': 
        return sanitizeString(t.date, 'N/A');
      case 'description': 
        return sanitizeDescription(t.description, t.typeName, t.policyNumber);
      case 'client': 
        const clientName = sanitizeString(t.clientName, 'Não informado');
        return clientName.length > 30 ? clientName.substring(0, 27) + '...' : clientName;
      case 'type': 
        return sanitizeString(t.typeName, 'Transação');
      case 'status': 
        return t.status || 'Pendente';
      case 'value': 
        // Formato alinhável: sem sinal no texto, cor indica direção
        return formatCurrency(Math.abs(t.amount));
      default: 
        return '-';
    }
  };

  const tableData = rowsToPrint.map(t => 
    orderedColumns.map(col => getColumnValue(t, col))
  );

  // Column styles com LARGURAS FIXAS em mm
  const columnStyles: Record<number, { 
    cellWidth: number; 
    halign: 'left' | 'center' | 'right';
    overflow?: 'ellipsize' | 'linebreak';
    font?: string;
    fontStyle?: 'normal' | 'bold';
  }> = {};
  
  orderedColumns.forEach((col, index) => {
    const config = COLUMN_CONFIG[col];
    columnStyles[index] = {
      cellWidth: config.width,
      halign: config.align,
      overflow: col === 'description' || col === 'client' ? 'ellipsize' : undefined,
      ...(col === 'value' ? { font: 'courier', fontStyle: 'bold' as const } : {})
    };
  });

  const valueColumnIndex = orderedColumns.indexOf('value');
  const statusColumnIndex = orderedColumns.indexOf('status');

  autoTable(doc, {
    startY: yPos + 6,
    head: [headers],
    body: tableData,
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      overflow: 'ellipsize',
      lineColor: colors.border,
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: colors.tableHeader,
      textColor: '#ffffff',
      fontSize: 7,
      fontStyle: 'bold',
      cellPadding: { top: 4, bottom: 4, left: 2, right: 2 }
    },
    bodyStyles: {
      textColor: colors.text.primary
    },
    alternateRowStyles: {
      fillColor: colors.tableAlt
    },
    columnStyles,
    didParseCell: function(data) {
      // Colorir valores baseado na nature da transação
      if (data.section === 'body' && valueColumnIndex >= 0 && data.column.index === valueColumnIndex) {
        const rowIndex = data.row.index;
        const transaction = rowsToPrint[rowIndex];
        if (transaction) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.font = 'courier';
          if (transaction.nature === 'PERDA') {
            data.cell.styles.textColor = colors.values.negative;
          } else {
            data.cell.styles.textColor = colors.values.positive;
          }
        }
      }
      
      // Colorir status
      if (data.section === 'body' && statusColumnIndex >= 0 && data.column.index === statusColumnIndex) {
        const status = String(data.cell.raw);
        if (status === 'Pago') {
          data.cell.styles.textColor = colors.values.positive;
          data.cell.styles.fontStyle = 'bold';
        } else if (status === 'Parcial') {
          data.cell.styles.textColor = '#2563eb';
        } else {
          data.cell.styles.textColor = colors.values.pending;
        }
      }
    },
    // Rodapé da tabela com total
    foot: rowsToPrint.length > 0 ? [
      orderedColumns.map((col, idx) => {
        if (idx === orderedColumns.length - 2) return 'TOTAL REALIZADO:';
        if (idx === orderedColumns.length - 1) return formatCurrency(saldoLiquido);
        return '';
      })
    ] : undefined,
    footStyles: {
      fillColor: '#f1f5f9',
      textColor: colors.text.primary,
      fontStyle: 'bold',
      fontSize: 9,
      font: 'courier',
      cellPadding: { top: 5, bottom: 5, left: 2, right: 2 }
    }
  });

  // ========================================
  // 7. OBSERVAÇÕES (se houver)
  // ========================================
  if (notes && notes.trim()) {
    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    
    doc.setDrawColor(colors.border);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY + 8, pageWidth - margin, finalY + 8);
    
    doc.setFontSize(7);
    doc.setTextColor(colors.text.secondary);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES', margin, finalY + 14);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text.primary);
    doc.setFontSize(8);
    const splitNotes = doc.splitTextToSize(notes.trim(), pageWidth - margin * 2);
    doc.text(splitNotes, margin, finalY + 20);
  }

  // ========================================
  // 8. RODAPÉ EM TODAS AS PÁGINAS (usando função compartilhada)
  // ========================================
  drawPDFFooter(doc);

  // ========================================
  // 9. SALVAR ARQUIVO
  // ========================================
  const monthYear = period.from 
    ? format(period.from, 'MMM_yyyy', { locale: ptBR }).toUpperCase()
    : 'GERAL';
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
  const fileName = `${safeTitle}_${monthYear}.pdf`;
  
  doc.save(fileName);
};
