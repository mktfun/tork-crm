import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { drawPDFHeader, drawPDFFooter, PDF_COLORS } from './pdfHeader';

// ============================================
// INTERFACES
// ============================================

export interface PolicyReportData {
  numero: string | null;
  cliente: {
    nome: string;
    telefone: string | null;
    email: string | null;
  };
  seguradora: string | null;
  ramo: string | null;
  vigencia: {
    inicio: string | null;
    fim: string;
  };
  premio: number;
  comissao: number;
  comissaoPercentual: number;
  status: string;
}

export interface PolicyReportOptions {
  title: string;
  filters: {
    status?: string;
    seguradora?: string;
    produtor?: string;
    periodo?: string;
  };
  columns: {
    clienteContato: boolean;
    apoliceSeguradora: boolean;
    vigencia: boolean;
    ramo: boolean;
    premio: boolean;
    comissao: boolean;
  };
  sortBy: 'vencimento' | 'cliente' | 'seguradora' | 'premio';
}

// ============================================
// HELPERS
// ============================================

/**
 * Formata telefone brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
const formatPhone = (phone: string | null): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

/**
 * Formata moeda brasileira
 */
const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Ordena as apólices conforme opção selecionada
 */
const sortPolicies = (policies: PolicyReportData[], sortBy: PolicyReportOptions['sortBy']): PolicyReportData[] => {
  return [...policies].sort((a, b) => {
    switch (sortBy) {
      case 'vencimento':
        return new Date(a.vigencia.fim).getTime() - new Date(b.vigencia.fim).getTime();
      case 'cliente':
        return a.cliente.nome.localeCompare(b.cliente.nome);
      case 'seguradora':
        return (a.seguradora || '').localeCompare(b.seguradora || '');
      case 'premio':
        return b.premio - a.premio;
      default:
        return 0;
    }
  });
};

// ============================================
// GERADOR PDF PRINCIPAL
// ============================================

export async function generatePoliciesReport(
  policies: PolicyReportData[],
  options: PolicyReportOptions
): Promise<void> {
  console.log('📄 [PDF] Gerando relatório de apólices...', {
    totalPolicies: policies.length,
    options
  });

  // 🎯 LANDSCAPE MODE - Essencial para tabela com muitas colunas
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Dimensões: 297mm x 210mm (largura x altura em landscape)
  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2); // 269mm

  // ========================================
  // CABEÇALHO
  // ========================================
  let yPos = drawPDFHeader(doc, {
    title: options.title,
    subtitle: 'Relatório Operacional',
    brokerName: 'Tork CRM'
  });

  yPos += 6;

  // ========================================
  // FILTROS ATIVOS (se houver)
  // ========================================
  const activeFilters: string[] = [];
  if (options.filters.status && options.filters.status !== 'todos') {
    activeFilters.push(`Status: ${options.filters.status}`);
  }
  if (options.filters.seguradora) {
    activeFilters.push(`Seguradora: ${options.filters.seguradora}`);
  }
  if (options.filters.produtor) {
    activeFilters.push(`Produtor: ${options.filters.produtor}`);
  }
  if (options.filters.periodo) {
    activeFilters.push(`Período: ${options.filters.periodo}`);
  }

  if (activeFilters.length > 0) {
    doc.setFontSize(8);
    doc.setTextColor(PDF_COLORS.text.secondary);
    doc.text(`Filtros: ${activeFilters.join(' • ')}`, margin, yPos);
    yPos += 5;
  }

  // ========================================
  // RESUMO
  // ========================================
  const totalPremio = policies.reduce((sum, p) => sum + p.premio, 0);
  const totalComissao = policies.reduce((sum, p) => sum + p.comissao, 0);
  const hoje = new Date();
  const vencendo30dias = policies.filter(p => {
    const dataFim = new Date(p.vigencia.fim);
    const diffDays = Math.ceil((dataFim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length;

  doc.setFontSize(9);
  doc.setTextColor(PDF_COLORS.text.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${policies.length} apólices`, margin, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Prêmio Total: R$ ${formatCurrency(totalPremio)}`, margin + 50, yPos);
  
  if (options.columns.comissao) {
    doc.text(`Comissão Total: R$ ${formatCurrency(totalComissao)}`, margin + 120, yPos);
  }
  
  doc.setTextColor(PDF_COLORS.values.pending);
  doc.text(`Vencendo em 30 dias: ${vencendo30dias}`, margin + 190, yPos);

  yPos += 8;

  // ========================================
  // ORDENAÇÃO
  // ========================================
  const sortedPolicies = sortPolicies(policies, options.sortBy);

  // ========================================
  // CONFIGURAÇÃO DAS COLUNAS
  // ========================================
  const columns: { header: string; dataKey: string; width: number }[] = [];
  
  if (options.columns.clienteContato) {
    columns.push({ header: 'CLIENTE', dataKey: 'cliente', width: 70 });
  }
  if (options.columns.apoliceSeguradora) {
    columns.push({ header: 'APÓLICE / SEGURADORA', dataKey: 'apolice', width: 55 });
  }
  if (options.columns.vigencia) {
    columns.push({ header: 'VIGÊNCIA', dataKey: 'vigencia', width: 35 });
  }
  if (options.columns.ramo) {
    columns.push({ header: 'RAMO', dataKey: 'ramo', width: 35 });
  }
  if (options.columns.premio) {
    columns.push({ header: 'PRÊMIO (R$)', dataKey: 'premio', width: 37 });
  }
  if (options.columns.comissao) {
    columns.push({ header: 'COMISSÃO (R$)', dataKey: 'comissao', width: 37 });
  }

  // Ajustar larguras proporcionalmente para preencher contentWidth
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const scaleFactor = contentWidth / totalWidth;
  columns.forEach(col => {
    col.width = Math.floor(col.width * scaleFactor);
  });

  // ========================================
  // PREPARAR DADOS DA TABELA
  // ========================================
  const tableData = sortedPolicies.map(policy => {
    const row: Record<string, string> = {};
    const dataFim = new Date(policy.vigencia.fim);
    const isVencida = dataFim < hoje;

    if (options.columns.clienteContato) {
      const telefoneFormatado = formatPhone(policy.cliente.telefone);
      const email = policy.cliente.email || '';
      row.cliente = `${policy.cliente.nome}\n${telefoneFormatado}${email ? `\n${email}` : ''}`;
    }

    if (options.columns.apoliceSeguradora) {
      row.apolice = `${policy.numero || 'S/N'}\n${policy.seguradora || '-'}`;
    }

    if (options.columns.vigencia) {
      const inicio = policy.vigencia.inicio 
        ? format(new Date(policy.vigencia.inicio), 'dd/MM/yyyy')
        : '-';
      const fim = format(dataFim, 'dd/MM/yyyy');
      row.vigencia = `${fim}\n(Início: ${inicio})`;
      row._isVencida = isVencida ? 'true' : 'false';
    }

    if (options.columns.ramo) {
      row.ramo = policy.ramo || '-';
    }

    if (options.columns.premio) {
      row.premio = formatCurrency(policy.premio);
    }

    if (options.columns.comissao) {
      row.comissao = `${formatCurrency(policy.comissao)}\n(${policy.comissaoPercentual.toFixed(1)}%)`;
    }

    return row;
  });

  // ========================================
  // RENDERIZAR TABELA
  // ========================================
  autoTable(doc, {
    startY: yPos,
    head: [columns.map(col => col.header)],
    body: tableData.map(row => columns.map(col => row[col.dataKey] || '')),
    columns: columns.map(col => ({
      dataKey: col.dataKey,
      cellWidth: col.width
    })),
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: PDF_COLORS.border,
      lineWidth: 0.1,
      textColor: PDF_COLORS.text.primary,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: PDF_COLORS.tableHeader,
      textColor: '#ffffff',
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: PDF_COLORS.tableAlt
    },
    columnStyles: {
      premio: { halign: 'right' },
      comissao: { halign: 'right' }
    },
    // Destacar linhas vencidas em vermelho na coluna de vigência
    didParseCell: (data) => {
      if (data.column.dataKey === 'vigencia' && data.section === 'body') {
        const rowData = tableData[data.row.index];
        if (rowData && rowData._isVencida === 'true') {
          data.cell.styles.textColor = PDF_COLORS.values.negative;
          data.cell.styles.fontStyle = 'bold';
        }
      }
      // Nome do cliente em negrito
      if (data.column.dataKey === 'cliente' && data.section === 'body') {
        const cellText = data.cell.text.join('');
        if (cellText && data.row.index >= 0) {
          // Primeira linha (nome) em negrito
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: margin, right: margin }
  });

  // ========================================
  // RODAPÉ
  // ========================================
  drawPDFFooter(doc);

  // ========================================
  // SALVAR ARQUIVO
  // ========================================
  const dataAtual = format(new Date(), 'yyyy-MM-dd');
  const fileName = `Relatorio_Apolices_${dataAtual}.pdf`;
  
  doc.save(fileName);
  console.log(`✅ [PDF] Relatório de apólices gerado: ${fileName}`);
}
