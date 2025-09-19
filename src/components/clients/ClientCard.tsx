
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, User, TrendingUp, FileText } from 'lucide-react';
import { generateWhatsAppUrl } from '@/utils/whatsapp';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/utils/formatCurrency';
import { usePrivacyStore } from '@/stores/usePrivacyStore';

interface ClientWithStats {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  cpf_cnpj?: string;
  total_policies: number;
  total_premium: number;
  total_commission: number;
  active_policies: number;
  budget_policies: number;
}

interface ClientCardProps {
  client: ClientWithStats;
}

export function ClientCard({ client }: ClientCardProps) {
  const navigate = useNavigate();
  const { showValues } = usePrivacyStore();
  const maskedValue = 'R$ •••••••';

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const message = `Olá ${client.name}! Como posso ajudá-lo hoje?`;
    const url = generateWhatsAppUrl(client.phone, message);
    window.open(url, '_blank');
  };

  const handleCardClick = () => {
    navigate(`/clients/${client.id}`);
  };

  return (
    <GlassCard 
      className="p-6 hover:bg-white/10 transition-all duration-200 cursor-pointer" 
      onClick={handleCardClick}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
          <User size={20} className="text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white truncate">{client.name}</h3>
          <p className="text-sm text-white/60 truncate">{client.email || client.phone}</p>
        </div>
      </div>

      {/* Estatísticas de valor de negócio */}
      <div className="space-y-3 mb-4">
        {/* Linha 1: Apólices */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <FileText size={14} />
            <span>Apólices</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-blue-400/30 text-blue-400 bg-blue-500/10 text-xs">
              {client.active_policies} ativas
            </Badge>
            {client.budget_policies > 0 && (
              <Badge variant="outline" className="border-yellow-400/30 text-yellow-400 bg-yellow-500/10 text-xs">
                {client.budget_policies} orçamentos
              </Badge>
            )}
          </div>
        </div>

        {/* Linha 2: Prêmio Total */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Prêmio Total</span>
          <span className="font-semibold text-white">{showValues ? formatCurrency(client.total_premium) : maskedValue}</span>
        </div>

        {/* Linha 3: Comissão Total (Destaque) */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-emerald-400">
            <TrendingUp size={14} />
            <span className="font-medium">Comissão Total</span>
          </div>
          <span className="font-bold text-emerald-400">{showValues ? formatCurrency(client.total_commission) : maskedValue}</span>
        </div>
      </div>

      {/* Contato WhatsApp */}
      {client.phone && (
        <div className="flex justify-end">
          <button
            onClick={handleWhatsAppClick}
            className="text-green-400 hover:text-green-300 transition-colors p-2 rounded-full hover:bg-green-500/10"
            title="Enviar WhatsApp"
          >
            <MessageCircle size={18} />
          </button>
        </div>
      )}
    </GlassCard>
  );
}
