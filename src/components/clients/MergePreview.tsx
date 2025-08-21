import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  Check, 
  X, 
  AlertTriangle, 
  User, 
  Mail, 
  Phone, 
  FileText,
  Calendar,
  MapPin
} from 'lucide-react';
import { Client } from '@/types';

interface MergePreviewProps {
  primaryClient: Client;
  secondaryClients: Client[];
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function MergePreview({ 
  primaryClient, 
  secondaryClients, 
  onConfirm, 
  onCancel, 
  isProcessing = false 
}: MergePreviewProps) {
  
  // Simular dados mesclados
  const mergedData = {
    name: primaryClient.name,
    email: primaryClient.email || secondaryClients.find(c => c.email)?.email,
    phone: primaryClient.phone || secondaryClients.find(c => c.phone)?.phone,
    cpfCnpj: primaryClient.cpfCnpj || secondaryClients.find(c => c.cpfCnpj)?.cpfCnpj,
    birthDate: primaryClient.birthDate || secondaryClients.find(c => c.birthDate)?.birthDate,
    maritalStatus: primaryClient.maritalStatus || secondaryClients.find(c => c.maritalStatus)?.maritalStatus,
    profession: primaryClient.profession || secondaryClients.find(c => c.profession)?.profession,
    address: primaryClient.address || secondaryClients.find(c => c.address)?.address,
    city: primaryClient.city || secondaryClients.find(c => c.city)?.city,
    state: primaryClient.state || secondaryClients.find(c => c.state)?.state,
    observations: [
      primaryClient.observations,
      ...secondaryClients.map(c => c.observations).filter(Boolean)
    ].filter(Boolean).join('\n\n=== MESCLADO ===\n\n')
  };

  const getFieldStatus = (primaryValue: any, mergedValue: any) => {
    if (!primaryValue && mergedValue) return 'added';
    if (primaryValue && mergedValue && primaryValue !== mergedValue) return 'changed';
    return 'unchanged';
  };

  const FieldComparison = ({ 
    label, 
    icon: Icon, 
    primaryValue, 
    mergedValue, 
    type = 'text' 
  }: {
    label: string;
    icon: any;
    primaryValue: any;
    mergedValue: any;
    type?: 'text' | 'date' | 'multiline';
  }) => {
    const status = getFieldStatus(primaryValue, mergedValue);
    const displayPrimary = type === 'date' && primaryValue 
      ? new Date(primaryValue).toLocaleDateString('pt-BR') 
      : primaryValue || 'Não informado';
    const displayMerged = type === 'date' && mergedValue 
      ? new Date(mergedValue).toLocaleDateString('pt-BR') 
      : mergedValue || 'Não informado';

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-white/60" />
          <span className="text-sm font-medium text-white">{label}</span>
          {status === 'added' && (
            <Badge variant="secondary" className="text-xs bg-green-600">Adicionado</Badge>
          )}
          {status === 'changed' && (
            <Badge variant="secondary" className="text-xs bg-blue-600">Alterado</Badge>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          {/* Valor Atual */}
          <div className="space-y-1">
            <span className="text-xs text-white/60 uppercase">Atual (Principal)</span>
            <div className={`p-2 rounded border ${
              status === 'unchanged' ? 'bg-white/5 border-white/10' : 'bg-blue-500/10 border-blue-400/30'
            }`}>
              {type === 'multiline' ? (
                <div className="whitespace-pre-wrap text-white/80">
                  {displayPrimary}
                </div>
              ) : (
                <span className="text-white/80">{displayPrimary}</span>
              )}
            </div>
          </div>

          {/* Seta */}
          <div className="flex items-center justify-center">
            <ArrowRight size={16} className="text-white/40" />
          </div>

          {/* Valor Mesclado */}
          <div className="space-y-1">
            <span className="text-xs text-white/60 uppercase">Após Mesclagem</span>
            <div className={`p-2 rounded border ${
              status === 'added' ? 'bg-green-500/10 border-green-400/30' :
              status === 'changed' ? 'bg-blue-500/10 border-blue-400/30' :
              'bg-white/5 border-white/10'
            }`}>
              {type === 'multiline' ? (
                <div className="whitespace-pre-wrap text-white/80">
                  {displayMerged}
                </div>
              ) : (
                <span className="text-white/80">{displayMerged}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <AlertTriangle className="text-yellow-400" size={20} />
          Preview da Mesclagem
        </CardTitle>
        <p className="text-sm text-white/60">
          Confira como ficará o cliente após a mesclagem. Os campos em branco serão preenchidos com dados dos clientes duplicados.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Clientes que serão removidos */}
        <div className="p-4 bg-red-500/10 border border-red-400/20 rounded-lg">
          <h4 className="text-red-200 font-medium mb-2 flex items-center gap-2">
            <X size={16} />
            Clientes que serão removidos ({secondaryClients.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {secondaryClients.map(client => (
              <Badge key={client.id} variant="outline" className="text-xs border-red-400/30 text-red-200">
                {client.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Cliente que será mantido */}
        <div className="p-4 bg-green-500/10 border border-green-400/20 rounded-lg">
          <h4 className="text-green-200 font-medium mb-2 flex items-center gap-2">
            <Check size={16} />
            Cliente principal (será mantido)
          </h4>
          <Badge variant="outline" className="text-xs border-green-400/30 text-green-200">
            {primaryClient.name}
          </Badge>
        </div>

        {/* Comparação de campos */}
        <div className="space-y-6">
          <h4 className="text-white font-medium">Comparação de Dados:</h4>
          
          <FieldComparison
            label="Nome"
            icon={User}
            primaryValue={primaryClient.name}
            mergedValue={mergedData.name}
          />

          <FieldComparison
            label="Email"
            icon={Mail}
            primaryValue={primaryClient.email}
            mergedValue={mergedData.email}
          />

          <FieldComparison
            label="Telefone"
            icon={Phone}
            primaryValue={primaryClient.phone}
            mergedValue={mergedData.phone}
          />

          <FieldComparison
            label="CPF/CNPJ"
            icon={FileText}
            primaryValue={primaryClient.cpfCnpj}
            mergedValue={mergedData.cpfCnpj}
          />

          <FieldComparison
            label="Data de Nascimento"
            icon={Calendar}
            primaryValue={primaryClient.birthDate}
            mergedValue={mergedData.birthDate}
            type="date"
          />

          <FieldComparison
            label="Endereço Completo"
            icon={MapPin}
            primaryValue={primaryClient.address ? `${primaryClient.address}, ${primaryClient.city || ''} - ${primaryClient.state || ''}`.trim() : ''}
            mergedValue={mergedData.address ? `${mergedData.address}, ${mergedData.city || ''} - ${mergedData.state || ''}`.trim() : ''}
          />

          {(primaryClient.observations || secondaryClients.some(c => c.observations)) && (
            <FieldComparison
              label="Observações"
              icon={FileText}
              primaryValue={primaryClient.observations}
              mergedValue={mergedData.observations}
              type="multiline"
            />
          )}
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? 'Mesclando...' : 'Confirmar Mesclagem'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
