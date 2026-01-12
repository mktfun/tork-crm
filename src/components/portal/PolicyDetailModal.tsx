import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  ExternalLink,
  FileText,
  Calendar,
  Building2,
  Shield,
  AlertTriangle,
  Car,
  Home,
  Heart,
  Briefcase,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PolicyHistoryTimeline } from './PolicyHistoryTimeline';
import { toast } from 'sonner';

interface Policy {
  id: string;
  insured_asset: string | null;
  expiration_date: string;
  start_date: string | null;
  status: string;
  premium_value: number;
  policy_number: string | null;
  insurance_company: string | null;
  type: string | null;
  pdf_attached_data: string | null;
  pdf_url: string | null;
  ramo_id: string | null;
}

interface PolicyDetailModalProps {
  policy: Policy | null;
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientCpf: string | null;
  clientId: string;
  userId: string;
  companyName: string | null;
  canViewPdf: boolean;
  canDownloadPdf: boolean;
}

export function PolicyDetailModal({
  policy,
  isOpen,
  onClose,
  clientName,
  clientCpf,
  clientId,
  userId,
  companyName,
  canViewPdf,
  canDownloadPdf,
}: PolicyDetailModalProps) {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);

  // Criar URL do PDF a partir do Base64
  useEffect(() => {
    if (policy?.pdf_attached_data && canViewPdf) {
      try {
        // Verificar se é Base64 válido
        const base64Data = policy.pdf_attached_data;
        
        // Extrair a parte do Base64 se tiver prefixo data:
        let pureBase64 = base64Data;
        if (base64Data.includes(',')) {
          pureBase64 = base64Data.split(',')[1];
        }

        // Converter Base64 para Blob
        const byteCharacters = atob(pureBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setPdfLoadError(false);
      } catch (error) {
        console.error('Error creating PDF blob:', error);
        setPdfLoadError(true);
      }
    } else {
      setPdfBlobUrl(null);
    }

    // Cleanup
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [policy?.pdf_attached_data, canViewPdf]);

  const handleDownload = () => {
    if (!policy?.pdf_attached_data && !policy?.pdf_url) {
      toast.error('PDF não disponível');
      return;
    }

    if (policy.pdf_url) {
      // PDF externo - abrir em nova aba
      window.open(policy.pdf_url, '_blank');
      return;
    }

    if (pdfBlobUrl) {
      const link = document.createElement('a');
      link.href = pdfBlobUrl;
      link.download = `apolice-${policy.policy_number || policy.id}.pdf`;
      link.click();
      toast.success('Download iniciado!');
    }
  };

  const handleOpenExternal = () => {
    if (policy?.pdf_url) {
      window.open(policy.pdf_url, '_blank');
    }
  };

  const getTypeIcon = (type: string | null) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('auto') || t.includes('carro')) return <Car className="w-5 h-5" />;
    if (t.includes('resid') || t.includes('casa')) return <Home className="w-5 h-5" />;
    if (t.includes('vida') || t.includes('saúde') || t.includes('saude')) return <Heart className="w-5 h-5" />;
    if (t.includes('empres')) return <Briefcase className="w-5 h-5" />;
    return <Shield className="w-5 h-5" />;
  };

  const getStatusBadge = (status: string, expirationDate: string) => {
    const days = differenceInDays(new Date(expirationDate), new Date());

    if (status.toLowerCase() === 'cancelada') {
      return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Cancelada</Badge>;
    }
    if (days < 0) {
      return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Vencida</Badge>;
    } else if (days <= 30) {
      return (
        <Badge className="bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20">
          Vence em {days}d
        </Badge>
      );
    }
    return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Ativa</Badge>;
  };

  // Determinar modo de visualização
  const hasPdf = !!(policy?.pdf_attached_data || policy?.pdf_url);
  const isExternalPdf = !!(policy?.pdf_url && !policy?.pdf_attached_data);
  const showPdfPreview = hasPdf && canViewPdf && !pdfLoadError;
  const showDetailCard = !showPdfPreview || pdfLoadError;

  if (!policy) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#0A0A0A] border-white/10 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#D4AF37]/10 rounded-lg flex items-center justify-center text-[#D4AF37] border border-[#D4AF37]/20">
              {getTypeIcon(policy.type)}
            </div>
            <div>
              <span className="block">{policy.insured_asset || policy.type || 'Apólice'}</span>
              <span className="text-sm text-zinc-500 font-normal">
                {policy.policy_number || 'Sem número'}
              </span>
            </div>
            {getStatusBadge(policy.status, policy.expiration_date)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* PDF Preview Section */}
          {showPdfPreview && (
            <div className="space-y-3">
              {isExternalPdf ? (
                // PDF externo - mostrar botão para abrir
                <Card className="bg-zinc-800/50 border-zinc-700">
                  <CardContent className="p-6 text-center">
                    <FileText className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
                    <p className="text-white mb-2">PDF disponível em link externo</p>
                    <Button onClick={handleOpenExternal} className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir PDF
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                // PDF Base64 - mostrar preview
                <div
                  className="relative rounded-lg overflow-hidden border border-zinc-700"
                  onContextMenu={(e) => {
                    if (!canDownloadPdf) {
                      e.preventDefault();
                    }
                  }}
                >
                  <iframe
                    src={pdfBlobUrl || ''}
                    className="w-full h-[400px] bg-zinc-900"
                    title="Preview do PDF"
                  />
                  {!canDownloadPdf && (
                    <div className="absolute inset-0 pointer-events-none" />
                  )}
                </div>
              )}

              {/* Download Button */}
              {canDownloadPdf && hasPdf && (
                <Button
                  onClick={handleDownload}
                  className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF da Apólice
                </Button>
              )}

              {!canDownloadPdf && hasPdf && (
                <p className="text-center text-zinc-500 text-sm">
                  Download desabilitado pelo corretor
                </p>
              )}
            </div>
          )}

          {/* Detail Card Section */}
          {showDetailCard && (
            <div className="space-y-4">
              {pdfLoadError && (
                <Card className="bg-amber-500/10 border-amber-500/20">
                  <CardContent className="p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <p className="text-amber-400 text-sm">
                      Não foi possível carregar o PDF. Veja os detalhes abaixo.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Dados Principais */}
              <Card className="bg-zinc-800/50 border-zinc-700">
                <CardContent className="p-4 space-y-4">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#D4AF37]" />
                    Dados da Apólice
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-zinc-500 text-xs uppercase tracking-wide">Segurado</p>
                      <p className="text-white">{clientName}</p>
                    </div>
                    {clientCpf && (
                      <div>
                        <p className="text-zinc-500 text-xs uppercase tracking-wide">CPF/CNPJ</p>
                        <p className="text-white font-mono text-sm">{clientCpf}</p>
                      </div>
                    )}
                    {companyName && (
                      <div>
                        <p className="text-zinc-500 text-xs uppercase tracking-wide flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> Seguradora
                        </p>
                        <p className="text-white">{companyName}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-zinc-500 text-xs uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Vigência
                      </p>
                      <p className="text-white text-sm">
                        {policy.start_date
                          ? format(new Date(policy.start_date), 'dd/MM/yyyy', { locale: ptBR })
                          : '---'}
                        {' → '}
                        {format(new Date(policy.expiration_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  {policy.insured_asset && (
                    <div>
                      <p className="text-zinc-500 text-xs uppercase tracking-wide">Bem Segurado</p>
                      <p className="text-white">{policy.insured_asset}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timeline de Histórico */}
              {policy.ramo_id && (
                <Card className="bg-zinc-800/50 border-zinc-700">
                  <CardContent className="p-4">
                    <PolicyHistoryTimeline
                      clientId={clientId}
                      ramoId={policy.ramo_id}
                      currentPolicyId={policy.id}
                      userId={userId}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
