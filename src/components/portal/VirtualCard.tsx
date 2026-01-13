import React, { useRef } from 'react';
import { Shield, Phone, Calendar, Download, Car, Home, Heart, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatPhoneForTel } from '@/utils/insuranceAssistance';
import { toast } from 'sonner';

interface VirtualCardProps {
  policy: {
    id: string;
    type: string | null;
    policy_number: string | null;
    start_date: string | null;
    expiration_date: string;
    insured_asset: string | null;
  };
  clientName: string;
  clientCpf: string | null;
  companyName: string | null;
  assistancePhone: string | null;
  canDownload: boolean;
}

export function VirtualCard({
  policy,
  clientName,
  clientCpf,
  companyName,
  assistancePhone,
  canDownload,
}: VirtualCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const getTypeIcon = (type: string | null) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('auto') || t.includes('carro')) return <Car className="w-6 h-6" />;
    if (t.includes('resid') || t.includes('casa')) return <Home className="w-6 h-6" />;
    if (t.includes('vida') || t.includes('saúde') || t.includes('saude') || t.includes('odonto')) return <Heart className="w-6 h-6" />;
    if (t.includes('empres')) return <Briefcase className="w-6 h-6" />;
    return <Shield className="w-6 h-6" />;
  };

  const formatCpf = (cpf: string | null) => {
    if (!cpf) return '---';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    }
    return cpf;
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
      // Importação dinâmica do html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = `carteirinha-${policy.policy_number || policy.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast.success('Carteirinha baixada com sucesso!');
    } catch (error) {
      console.error('Error downloading card:', error);
      toast.error('Erro ao baixar carteirinha');
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-850 to-zinc-900 p-5 shadow-2xl border border-white/[0.06]"
        style={{ minHeight: '280px' }}
      >
        {/* Background Pattern - Silver */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-zinc-400/30 blur-xl" />
          <div className="absolute -left-4 -bottom-4 w-32 h-32 rounded-full bg-zinc-500/20 blur-lg" />
          <div className="absolute right-1/4 bottom-1/4 w-24 h-24 rounded-full bg-zinc-400/10 blur-md" />
        </div>

        {/* Card Content */}
        <div className="relative z-10 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-zinc-700/50 rounded-xl flex items-center justify-center text-zinc-300 border border-white/[0.06]">
                {getTypeIcon(policy.type)}
              </div>
              <div>
                <span className="text-white/90 font-light text-sm block">
                  {policy.type || 'Seguro'}
                </span>
                {companyName && (
                  <span className="text-zinc-500 text-xs">{companyName}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-zinc-400 text-xs font-medium tracking-widest">CARTEIRINHA</span>
              <span className="text-zinc-600 text-xs block">DIGITAL</span>
            </div>
          </div>

          {/* Main Info */}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest">Segurado</p>
              <p className="text-white font-light text-lg truncate">{clientName}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest">CPF</p>
                <p className="text-white font-mono text-sm">{formatCpf(clientCpf)}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest">Nº Apólice</p>
                <p className="text-white font-mono text-sm truncate">{policy.policy_number || '---'}</p>
              </div>
            </div>

            <div>
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Vigência
              </p>
              <p className="text-white text-sm font-light">
                {policy.start_date
                  ? format(new Date(policy.start_date), 'dd/MM/yyyy', { locale: ptBR })
                  : '---'}
                {' → '}
                {format(new Date(policy.expiration_date), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            </div>

            {policy.insured_asset && (
              <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                <p className="text-zinc-400 text-xs truncate">{policy.insured_asset}</p>
              </div>
            )}
          </div>

          {/* Assistance Section - Silver */}
          {assistancePhone && (
            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <a
                href={`tel:${formatPhoneForTel(assistancePhone)}`}
                className="flex items-center justify-between p-3 bg-zinc-700/30 hover:bg-zinc-700/50 rounded-xl border border-white/[0.06] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-600/50 rounded-full flex items-center justify-center">
                    <Phone className="w-5 h-5 text-zinc-300" />
                  </div>
                  <div>
                    <p className="text-zinc-400 text-xs font-medium tracking-wide">ASSISTÊNCIA 24H</p>
                    <p className="text-white font-medium">{assistancePhone}</p>
                  </div>
                </div>
                <span className="text-zinc-400 text-xs">LIGAR →</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Download Button - Silver */}
      {canDownload && (
        <Button
          onClick={handleDownload}
          variant="outline"
          className="w-full border-white/[0.06] bg-zinc-900/50 hover:bg-zinc-800/50 text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          Baixar Carteirinha
        </Button>
      )}
    </div>
  );
}
