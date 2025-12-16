import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { drawPDFHeader, drawPDFFooter, PDF_COLORS } from './pdfHeader';

export interface RenewalReportRow {
  id: string;
  policyNumber: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  insuranceCompany: string;
  companyName?: string;
  expirationDate: string;
  renewalStatus: string;
  premiumValue: number;
  diasParaVencer: number;
}

export interface RenewalReportOptions {
  title: string;
  filters?: {
    renewalStatus?: string;
    period?: string;
    producer?: string;
  };
  columns: {
    vencimento: boolean;
    clienteContato: boolean;
    apoliceSeguradora: boolean;
    statusRenovacao: boolean;
    premio: boolean;
  };
  notes?: string;
}

const formatPhone = (phone: string | null): string => {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Converter hex para RGB
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
};

export async function generateRenewalsReport(
  renewals: RenewalReportRow[],
  options: RenewalReportOptions
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Ordenar por dias para vencer (mais urgentes primeiro)
  const sortedRenewals = [...renewals].sort((a, b) => a.diasParaVencer - b.diasParaVencer);

  // Header
  const headerY = drawPDFHeader(doc, {
    title: options.title,
    subtitle: `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`,
  });

  let currentY = headerY + 8;

  // Filtros ativos
  const activeFilters: string[] = [];
  if (options.filters?.renewalStatus && options.filters.renewalStatus !== 'todos') {
    activeFilters.push(`Status: ${options.filters.renewalStatus}`);
  }
  if (options.filters?.period) {
    activeFilters.push(`Período: ${options.filters.period}`);
  }
  if (options.filters?.producer) {
    activeFilters.push(`Produtor: ${options.filters.producer}`);
  }

  if (activeFilters.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(PDF_COLORS.text.muted);
    doc.text(`Filtros: ${activeFilters.join(' | ')}`, margin, currentY);
    currentY += 6;
  }

  // Resumo
  const totalPremio = sortedRenewals.reduce((sum, r) => sum + r.premiumValue, 0);
  const vencidas = sortedRenewals.filter(r => r.diasParaVencer < 0).length;
  const criticas = sortedRenewals.filter(r => r.diasParaVencer >= 0 && r.diasParaVencer <= 30).length;
  const normais = sortedRenewals.filter(r => r.diasParaVencer > 30).length;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, currentY, contentWidth, 14, 2, 2, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(PDF_COLORS.text.primary);
  doc.text(`Total: ${sortedRenewals.length} renovações`, margin + 4, currentY + 6);
  
  doc.setTextColor(220, 38, 38); // red
  doc.text(`Vencidas: ${vencidas}`, margin + 60, currentY + 6);
  
  doc.setTextColor(234, 179, 8); // yellow
  doc.text(`Críticas (≤30d): ${criticas}`, margin + 100, currentY + 6);
  
  doc.setTextColor(34, 197, 94); // green
  doc.text(`Normais: ${normais}`, margin + 155, currentY + 6);
  
  doc.setTextColor(PDF_COLORS.text.primary);
  doc.text(`Prêmio Total: ${formatCurrency(totalPremio)}`, margin + 200, currentY + 6);

  currentY += 20;

  // Construir colunas dinamicamente
  const headers: string[] = [];
  const columnWidths: number[] = [];

  if (options.columns.vencimento) {
    headers.push('VENCIMENTO');
    columnWidths.push(35);
  }
  if (options.columns.clienteContato) {
    headers.push('CLIENTE & CONTATO');
    columnWidths.push(70);
  }
  if (options.columns.apoliceSeguradora) {
    headers.push('APÓLICE & SEGURADORA');
    columnWidths.push(55);
  }
  if (options.columns.statusRenovacao) {
    headers.push('STATUS RENOVAÇÃO');
    columnWidths.push(38);
  }
  if (options.columns.premio) {
    headers.push('PRÊMIO');
    columnWidths.push(32);
  }

  // Ajustar larguras para caber no contentWidth (269mm em landscape)
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);
  const scaleFactor = Math.min(1, contentWidth / totalWidth);
  const adjustedWidths = columnWidths.map(w => w * scaleFactor);

  // Preparar dados da tabela
  const tableData = sortedRenewals.map(renewal => {
    const row: (string | { content: string; styles?: any })[] = [];
    
    if (options.columns.vencimento) {
      const dateStr = format(parseISO(renewal.expirationDate), 'dd/MM/yyyy');
      const diasLabel = renewal.diasParaVencer < 0 
        ? `${Math.abs(renewal.diasParaVencer)}d ATRASADO`
        : renewal.diasParaVencer === 0 
          ? 'VENCE HOJE'
          : `${renewal.diasParaVencer} dias`;
      
      let textColor: string = PDF_COLORS.text.primary;
      if (renewal.diasParaVencer < 0) {
        textColor = '#dc2626'; // red-600
      } else if (renewal.diasParaVencer <= 30) {
        textColor = '#ca8a04'; // yellow-600
      }
      
      row.push({
        content: `${dateStr}\n${diasLabel}`,
        styles: { textColor: hexToRgb(textColor), fontStyle: renewal.diasParaVencer < 0 ? 'bold' : 'normal' }
      });
    }
    
    if (options.columns.clienteContato) {
      const phone = formatPhone(renewal.clientPhone);
      const email = renewal.clientEmail || '-';
      row.push({
        content: `${renewal.clientName}\n${phone}\n${email}`,
        styles: { cellPadding: { top: 2, bottom: 2, left: 2, right: 2 } }
      });
    }
    
    if (options.columns.apoliceSeguradora) {
      const policyNum = renewal.policyNumber || 'S/N';
      const company = renewal.companyName || renewal.insuranceCompany || '-';
      row.push(`${policyNum}\n${company}`);
    }
    
    if (options.columns.statusRenovacao) {
      const status = renewal.renewalStatus || 'Pendente';
      let bgColor: [number, number, number] | undefined;
      
      switch (status) {
        case 'Pendente':
          bgColor = [254, 249, 195]; // yellow-100
          break;
        case 'Em Contato':
          bgColor = [219, 234, 254]; // blue-100
          break;
        case 'Proposta Enviada':
          bgColor = [243, 232, 255]; // purple-100
          break;
        case 'Renovada':
          bgColor = [220, 252, 231]; // green-100
          break;
        case 'Não Renovada':
          bgColor = [254, 226, 226]; // red-100
          break;
      }
      
      row.push({
        content: status,
        styles: bgColor ? { fillColor: bgColor } : {}
      });
    }
    
    if (options.columns.premio) {
      row.push(formatCurrency(renewal.premiumValue));
    }
    
    return row;
  });

  // Renderizar tabela
  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: tableData,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 3,
      lineColor: hexToRgb(PDF_COLORS.border),
      lineWidth: 0.1,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: hexToRgb(PDF_COLORS.text.primary),
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
    },
    columnStyles: adjustedWidths.reduce((acc, width, index) => {
      acc[index] = { cellWidth: width };
      return acc;
    }, {} as Record<number, { cellWidth: number }>),
    margin: { left: margin, right: margin },
  });

  // Notas
  if (options.notes) {
    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 50;
    if (finalY + 20 < pageHeight - 20) {
      doc.setFontSize(8);
      doc.setTextColor(PDF_COLORS.text.muted);
      doc.text('Observações:', margin, finalY + 8);
      doc.setFontSize(8);
      doc.setTextColor(PDF_COLORS.text.primary);
      const splitNotes = doc.splitTextToSize(options.notes, contentWidth);
      doc.text(splitNotes, margin, finalY + 13);
    }
  }

  // Footer em todas as páginas
  drawPDFFooter(doc);

  // Salvar
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  doc.save(`Relatorio_Renovacoes_${dateStr}.pdf`);
}
