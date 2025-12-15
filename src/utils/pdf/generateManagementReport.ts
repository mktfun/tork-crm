import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '../formatCurrency';
import { drawPDFHeader, drawPDFFooter, PDF_COLORS } from './pdfHeader';

// ========================================
// INTERFACES
// ========================================
export interface ManagementReportData {
  period: { from: Date | undefined; to: Date | undefined };
  
  // KPIs da Carteira
  portfolio: {
    valorTotalCarteira: number;
    numeroClientes: number;
    numeroApolices: number;
    ticketMedio: number;
  };
  
  // Resumo Financeiro
  financial: {
    totalGanhos: number;
    totalPerdas: number;
    saldoLiquido: number;
  };
  
  // Distribuição por Ramo
  branchDistribution: Array<{
    ramo: string;
    total: number;
    valor: number;
    valorComissao: number;
  }>;
  
  // Distribuição por Seguradora
  companyDistribution: Array<{
    seguradora: string;
    total: number;
    valor: number;
    valorComissao: number;
  }>;
  
  // Performance por Produtor
  producerPerformance: Array<{
    nome: string;
    totalApolices: number;
    valorTotal: number;
    comissaoTotal: number;
  }>;
}

// ========================================
// CONSTANTES DE LAYOUT
// ========================================
const MARGIN = 14;

// Larguras das tabelas em mm (Total deve ser 180mm para A4 com margens)
const BRANCH_COLUMNS = { ramo: 50, qtd: 25, premio: 40, comissao: 40, percent: 25 }; // = 180
const COMPANY_COLUMNS = { seguradora: 50, qtd: 25, premio: 40, comissao: 40, percent: 25 }; // = 180
const PRODUCER_COLUMNS = { produtor: 50, vendas: 30, premio: 50, comissao: 50 }; // = 180

// ========================================
// FUNÇÕES AUXILIARES
// ========================================
const sanitizeString = (str: string | null | undefined, fallback: string): string => {
  if (!str || str === 'undefined' || str === 'null' || str.trim() === '') {
    return fallback;
  }
  return str.trim();
};

const calculatePercentage = (value: number, total: number): string => {
  if (total === 0) return '0%';
  return ((value / total) * 100).toFixed(1) + '%';
};

// ========================================
// SEÇÕES DO RELATÓRIO
// ========================================
function drawSectionTitle(doc: jsPDF, title: string, yPos: number): number {
  doc.setFontSize(10);
  doc.setTextColor(PDF_COLORS.text.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), MARGIN, yPos);
  
  // Linha decorativa abaixo do título
  doc.setDrawColor(PDF_COLORS.tableHeader);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, yPos + 2, MARGIN + 40, yPos + 2);
  
  return yPos + 10;
}

function drawPortfolioKPIs(doc: jsPDF, portfolio: ManagementReportData['portfolio'], yPos: number): number {
  const pageWidth = doc.internal.pageSize.width;
  const cardWidth = (pageWidth - MARGIN * 2) / 4;
  
  const kpis = [
    { label: 'VALOR TOTAL DA CARTEIRA', value: formatCurrency(portfolio.valorTotalCarteira), color: PDF_COLORS.text.primary },
    { label: 'TOTAL DE CLIENTES', value: portfolio.numeroClientes.toString(), color: PDF_COLORS.text.primary },
    { label: 'TOTAL DE APÓLICES', value: portfolio.numeroApolices.toString(), color: PDF_COLORS.text.primary },
    { label: 'TICKET MÉDIO', value: formatCurrency(portfolio.ticketMedio), color: PDF_COLORS.values.positive }
  ];
  
  kpis.forEach((kpi, index) => {
    const x = MARGIN + (cardWidth * index);
    
    // Label
    doc.setFontSize(6);
    doc.setTextColor(PDF_COLORS.text.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.label, x, yPos);
    
    // Valor
    doc.setFontSize(12);
    doc.setTextColor(kpi.color);
    doc.setFont('courier', 'bold');
    doc.text(kpi.value, x, yPos + 6);
    doc.setFont('helvetica', 'normal');
    
    // Separador vertical (exceto no último)
    if (index < kpis.length - 1) {
      doc.setDrawColor(PDF_COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(x + cardWidth - 2, yPos - 3, x + cardWidth - 2, yPos + 9);
    }
  });
  
  return yPos + 16;
}

function drawFinancialSummary(doc: jsPDF, financial: ManagementReportData['financial'], yPos: number): number {
  const pageWidth = doc.internal.pageSize.width;
  const cardWidth = (pageWidth - MARGIN * 2) / 3;
  
  const items = [
    { label: 'RECEITAS REALIZADAS', value: financial.totalGanhos, color: PDF_COLORS.values.positive },
    { label: 'DESPESAS REALIZADAS', value: financial.totalPerdas, color: PDF_COLORS.values.negative },
    { label: 'SALDO LÍQUIDO', value: financial.saldoLiquido, color: financial.saldoLiquido >= 0 ? PDF_COLORS.values.positive : PDF_COLORS.values.negative }
  ];
  
  items.forEach((item, index) => {
    const x = MARGIN + (cardWidth * index);
    
    // Label
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.text.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, x, yPos);
    
    // Valor
    doc.setFontSize(14);
    doc.setTextColor(item.color);
    doc.setFont('courier', 'bold');
    doc.text(formatCurrency(item.value), x, yPos + 8);
    doc.setFont('helvetica', 'normal');
    
    // Separador vertical (exceto no último)
    if (index < items.length - 1) {
      doc.setDrawColor(PDF_COLORS.border);
      doc.setLineWidth(0.2);
      doc.line(x + cardWidth - 2, yPos - 3, x + cardWidth - 2, yPos + 11);
    }
  });
  
  return yPos + 18;
}

function drawBranchDistributionTable(doc: jsPDF, data: ManagementReportData['branchDistribution'], yPos: number): number {
  if (!data || data.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(PDF_COLORS.text.muted);
    doc.text('Sem dados de distribuição por ramo para o período selecionado.', MARGIN, yPos);
    return yPos + 10;
  }
  
  const totalValor = data.reduce((sum, item) => sum + item.valor, 0);
  const totalComissao = data.reduce((sum, item) => sum + item.valorComissao, 0);
  const totalQtd = data.reduce((sum, item) => sum + item.total, 0);
  
  const tableData = data.map(item => [
    sanitizeString(item.ramo, 'Não informado'),
    item.total.toString(),
    formatCurrency(item.valor),
    formatCurrency(item.valorComissao),
    calculatePercentage(item.valor, totalValor)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['RAMO', 'QTD', 'PRÊMIO (R$)', 'COMISSÃO (R$)', '% TOTAL']],
    body: tableData,
    foot: [['TOTAL', totalQtd.toString(), formatCurrency(totalValor), formatCurrency(totalComissao), '100%']],
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      overflow: 'ellipsize'
    },
    headStyles: {
      fillColor: PDF_COLORS.tableHeader,
      textColor: '#ffffff',
      fontSize: 7,
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: '#f1f5f9',
      textColor: PDF_COLORS.text.primary,
      fontStyle: 'bold',
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: PDF_COLORS.tableAlt
    },
    columnStyles: {
      0: { cellWidth: BRANCH_COLUMNS.ramo, halign: 'left' },
      1: { cellWidth: BRANCH_COLUMNS.qtd, halign: 'center' },
      2: { cellWidth: BRANCH_COLUMNS.premio, halign: 'right', font: 'courier' },
      3: { cellWidth: BRANCH_COLUMNS.comissao, halign: 'right', font: 'courier' },
      4: { cellWidth: BRANCH_COLUMNS.percent, halign: 'center' }
    }
  });
  
  return (doc as any).lastAutoTable?.finalY || yPos + 40;
}

function drawCompanyDistributionTable(doc: jsPDF, data: ManagementReportData['companyDistribution'], yPos: number): number {
  if (!data || data.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(PDF_COLORS.text.muted);
    doc.text('Sem dados de distribuição por seguradora para o período selecionado.', MARGIN, yPos);
    return yPos + 10;
  }
  
  const totalValor = data.reduce((sum, item) => sum + item.valor, 0);
  const totalComissao = data.reduce((sum, item) => sum + item.valorComissao, 0);
  const totalQtd = data.reduce((sum, item) => sum + item.total, 0);
  
  const tableData = data.map(item => [
    sanitizeString(item.seguradora, 'Não informado'),
    item.total.toString(),
    formatCurrency(item.valor),
    formatCurrency(item.valorComissao),
    calculatePercentage(item.valor, totalValor)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['SEGURADORA', 'QTD', 'PRÊMIO (R$)', 'COMISSÃO (R$)', '% TOTAL']],
    body: tableData,
    foot: [['TOTAL', totalQtd.toString(), formatCurrency(totalValor), formatCurrency(totalComissao), '100%']],
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      overflow: 'ellipsize'
    },
    headStyles: {
      fillColor: PDF_COLORS.tableHeader,
      textColor: '#ffffff',
      fontSize: 7,
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: '#f1f5f9',
      textColor: PDF_COLORS.text.primary,
      fontStyle: 'bold',
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: PDF_COLORS.tableAlt
    },
    columnStyles: {
      0: { cellWidth: COMPANY_COLUMNS.seguradora, halign: 'left' },
      1: { cellWidth: COMPANY_COLUMNS.qtd, halign: 'center' },
      2: { cellWidth: COMPANY_COLUMNS.premio, halign: 'right', font: 'courier' },
      3: { cellWidth: COMPANY_COLUMNS.comissao, halign: 'right', font: 'courier' },
      4: { cellWidth: COMPANY_COLUMNS.percent, halign: 'center' }
    }
  });
  
  return (doc as any).lastAutoTable?.finalY || yPos + 40;
}

function drawProducerPerformanceTable(doc: jsPDF, data: ManagementReportData['producerPerformance'], yPos: number): number {
  if (!data || data.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(PDF_COLORS.text.muted);
    doc.text('Sem dados de performance de produtores para o período selecionado.', MARGIN, yPos);
    return yPos + 10;
  }
  
  const totalValor = data.reduce((sum, item) => sum + item.valorTotal, 0);
  const totalComissao = data.reduce((sum, item) => sum + item.comissaoTotal, 0);
  const totalVendas = data.reduce((sum, item) => sum + item.totalApolices, 0);
  
  const tableData = data.map(item => [
    sanitizeString(item.nome, 'Não informado'),
    item.totalApolices.toString(),
    formatCurrency(item.valorTotal),
    formatCurrency(item.comissaoTotal)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['PRODUTOR', 'VENDAS', 'PRÊMIO (R$)', 'COMISSÃO (R$)']],
    body: tableData,
    foot: [['TOTAL', totalVendas.toString(), formatCurrency(totalValor), formatCurrency(totalComissao)]],
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      overflow: 'ellipsize'
    },
    headStyles: {
      fillColor: PDF_COLORS.tableHeader,
      textColor: '#ffffff',
      fontSize: 7,
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: '#f1f5f9',
      textColor: PDF_COLORS.text.primary,
      fontStyle: 'bold',
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: PDF_COLORS.tableAlt
    },
    columnStyles: {
      0: { cellWidth: PRODUCER_COLUMNS.produtor, halign: 'left' },
      1: { cellWidth: PRODUCER_COLUMNS.vendas, halign: 'center' },
      2: { cellWidth: PRODUCER_COLUMNS.premio, halign: 'right', font: 'courier' },
      3: { cellWidth: PRODUCER_COLUMNS.comissao, halign: 'right', font: 'courier' }
    }
  });
  
  return (doc as any).lastAutoTable?.finalY || yPos + 40;
}

// ========================================
// FUNÇÃO PRINCIPAL
// ========================================
export async function generateManagementReport(data: ManagementReportData): Promise<void> {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  
  // ========================================
  // 1. CABEÇALHO
  // ========================================
  let yPos = drawPDFHeader(doc, {
    title: 'Relatório de Gestão',
    subtitle: 'RELATÓRIO GERENCIAL',
    period: data.period
  });
  
  // ========================================
  // 2. SEÇÃO: VISÃO GERAL DA CARTEIRA (KPIs)
  // ========================================
  yPos += 10;
  yPos = drawSectionTitle(doc, '1. Visão Geral da Carteira', yPos);
  yPos = drawPortfolioKPIs(doc, data.portfolio, yPos);
  
  // Linha separadora
  doc.setDrawColor(PDF_COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, yPos, doc.internal.pageSize.width - MARGIN, yPos);
  
  // ========================================
  // 3. SEÇÃO: RESUMO FINANCEIRO
  // ========================================
  yPos += 8;
  yPos = drawSectionTitle(doc, '2. Resumo Financeiro', yPos);
  yPos = drawFinancialSummary(doc, data.financial, yPos);
  
  // Linha separadora
  doc.setDrawColor(PDF_COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, yPos, doc.internal.pageSize.width - MARGIN, yPos);
  
  // ========================================
  // 4. SEÇÃO: DISTRIBUIÇÃO POR RAMO
  // ========================================
  yPos += 8;
  yPos = drawSectionTitle(doc, '3. Distribuição por Ramo', yPos);
  yPos = drawBranchDistributionTable(doc, data.branchDistribution, yPos);
  
  // Verificar se precisa nova página
  if (yPos > pageHeight - 80) {
    doc.addPage();
    yPos = 20;
  }
  
  // ========================================
  // 5. SEÇÃO: DISTRIBUIÇÃO POR SEGURADORA
  // ========================================
  yPos += 10;
  yPos = drawSectionTitle(doc, '4. Distribuição por Seguradora', yPos);
  yPos = drawCompanyDistributionTable(doc, data.companyDistribution, yPos);
  
  // Verificar se precisa nova página
  if (yPos > pageHeight - 80) {
    doc.addPage();
    yPos = 20;
  }
  
  // ========================================
  // 6. SEÇÃO: PERFORMANCE POR PRODUTOR
  // ========================================
  yPos += 10;
  yPos = drawSectionTitle(doc, '5. Performance por Produtor', yPos);
  yPos = drawProducerPerformanceTable(doc, data.producerPerformance, yPos);
  
  // ========================================
  // 7. RODAPÉ EM TODAS AS PÁGINAS
  // ========================================
  drawPDFFooter(doc);
  
  // ========================================
  // 8. SALVAR ARQUIVO
  // ========================================
  const monthYear = data.period?.from 
    ? format(data.period.from, 'MMM_yyyy', { locale: ptBR }).toUpperCase()
    : 'GERAL';
  const fileName = `Relatorio_Gestao_${monthYear}.pdf`;
  
  doc.save(fileName);
  
  console.log('✅ Relatório de Gestão gerado:', fileName);
}
