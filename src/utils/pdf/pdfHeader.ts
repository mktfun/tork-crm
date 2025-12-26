import jsPDF from 'jspdf';
import { format } from 'date-fns';

export interface PDFHeaderConfig {
  title: string;
  subtitle?: string;
  period?: { from: Date | undefined; to: Date | undefined };
  brokerName?: string;
}

// Design System Colors (compartilhado)
export const PDF_COLORS = {
  text: { 
    primary: '#0f172a',   // Slate-900
    secondary: '#64748b', // Slate-500
    muted: '#94a3b8'      // Slate-400
  },
  border: '#e2e8f0',       // Slate-200
  tableHeader: '#334155',  // Slate-700
  tableAlt: '#f8fafc',     // Slate-50
  values: { 
    positive: '#047857',   // Emerald-700
    negative: '#b91c1c',   // Red-700
    pending: '#ca8a04'     // Yellow-600
  }
};

/**
 * Desenha o cabeçalho padrão do PDF Tork CRM
 * @returns posição Y após o cabeçalho (para continuar renderizando)
 */
export function drawPDFHeader(doc: jsPDF, config: PDFHeaderConfig): number {
  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;
  
  let yPos = 18;
  
  // Logo placeholder (círculo azul com "T")
  doc.setFillColor(59, 130, 246); // blue-500
  doc.circle(margin + 5, yPos, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('T', margin + 5, yPos + 2.5, { align: 'center' });
  
  // Nome da corretora
  doc.setTextColor(PDF_COLORS.text.primary);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(config.brokerName || 'Tork CRM', margin + 14, yPos + 1);
  
  doc.setFontSize(7);
  doc.setTextColor(PDF_COLORS.text.secondary);
  doc.setFont('helvetica', 'normal');
  doc.text('Gestão Inteligente de Seguros', margin + 14, yPos + 6);
  
  // Lado direito - título do relatório
  doc.setFontSize(8);
  doc.setTextColor(PDF_COLORS.text.muted);
  doc.text(config.subtitle?.toUpperCase() || 'RELATÓRIO', pageWidth - margin, yPos - 2, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(PDF_COLORS.text.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(config.title.substring(0, 40), pageWidth - margin, yPos + 5, { align: 'right' });
  
  // Período selecionado
  const periodoTexto = config.period?.from && config.period?.to 
    ? `${format(config.period.from, 'dd/MM/yyyy')} a ${format(config.period.to, 'dd/MM/yyyy')}`
    : 'Período Total';
  doc.setFontSize(8);
  doc.setTextColor(PDF_COLORS.text.secondary);
  doc.setFont('helvetica', 'normal');
  doc.text(periodoTexto, pageWidth - margin, yPos + 11, { align: 'right' });

  // Linha separadora
  yPos += 18;
  doc.setDrawColor(PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  return yPos;
}

/**
 * Desenha o rodapé padrão em todas as páginas
 */
export function drawPDFFooter(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    doc.setDrawColor(PDF_COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    
    doc.setFontSize(6);
    doc.setTextColor(PDF_COLORS.text.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} via Tork CRM • Este documento não tem valor fiscal`,
      margin,
      pageHeight - 8
    );
    
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }
}
