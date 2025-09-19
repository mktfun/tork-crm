
import { GestaoTiposTransacao } from '@/components/configuracoes/GestaoTiposTransacao';
import { CommissionAutomationSettings } from '@/components/settings/CommissionAutomationSettings';

export default function TransactionSettings() {
  return (
    <div className="space-y-6">
      <GestaoTiposTransacao />
      <CommissionAutomationSettings />
    </div>
  );
}
