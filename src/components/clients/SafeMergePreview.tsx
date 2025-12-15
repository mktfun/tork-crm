import { useState } from 'react';
import { Client } from '@/types';
import { ClientRelationships, SmartMergeField } from '@/hooks/useSafeMerge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeftRight, 
  Check, 
  X, 
  FileText, 
  Calendar, 
  AlertTriangle,
  User,
  Mail,
  Phone,
  MapPin,
  Loader2,
  ArrowRight,
  Shield,
} from 'lucide-react';

interface SafeMergePreviewProps {
  primaryClient: Client;
  secondaryClient: Client;
  primaryRelationships: ClientRelationships;
  secondaryRelationships: ClientRelationships;
  smartMergeFields: SmartMergeField[];
  onConfirm: (fieldsToInherit: SmartMergeField[]) => Promise<void>;
  onCancel: () => void;
  onSwap: () => void;
  isProcessing: boolean;
  batchMode?: boolean; // Quando true, esconde os botões de ação (são controlados externamente)
}

export function SafeMergePreview({
  primaryClient,
  secondaryClient,
  primaryRelationships,
  secondaryRelationships,
  smartMergeFields,
  onConfirm,
  onCancel,
  onSwap,
  isProcessing,
  batchMode = false,
}: SafeMergePreviewProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedInheritFields, setSelectedInheritFields] = useState<Set<keyof Client>>(
    new Set(smartMergeFields.filter(f => f.willInherit).map(f => f.field))
  );

  const formatCPFCNPJ = (doc: string | undefined) => {
    if (!doc) return '—';
    const cleaned = doc.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  const formatPhone = (phone: string | undefined) => {
    if (!phone) return '—';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const toggleFieldInherit = (field: keyof Client) => {
    const newSet = new Set(selectedInheritFields);
    if (newSet.has(field)) {
      newSet.delete(field);
    } else {
      newSet.add(field);
    }
    setSelectedInheritFields(newSet);
  };

  const handleConfirmClick = () => {
    setShowConfirmDialog(true);
  };

  const handleFinalConfirm = async () => {
    setShowConfirmDialog(false);
    const fieldsToInherit = smartMergeFields.map(f => ({
      ...f,
      willInherit: selectedInheritFields.has(f.field),
    }));
    await onConfirm(fieldsToInherit);
  };

  const totalTransfers = 
    secondaryRelationships.apolicesCount + 
    secondaryRelationships.appointmentsCount + 
    secondaryRelationships.sinistrosCount;

  const ClientCard = ({ 
    client, 
    relationships, 
    isPrimary 
  }: { 
    client: Client; 
    relationships: ClientRelationships;
    isPrimary: boolean;
  }) => (
    <Card className={`flex-1 ${isPrimary ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-destructive/50 bg-destructive/5'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {isPrimary ? (
            <Badge variant="default" className="bg-emerald-600">
              <Check className="h-3 w-3 mr-1" />
              MANTER
            </Badge>
          ) : (
            <Badge variant="destructive">
              <X className="h-3 w-3 mr-1" />
              SERÁ REMOVIDO
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg mt-2">{client.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{formatCPFCNPJ(client.cpfCnpj)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>{client.email || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{formatPhone(client.phone)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{client.city && client.state ? `${client.city} - ${client.state}` : '—'}</span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Apólices
            </span>
            <Badge variant="secondary">{relationships.apolicesCount}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-500" />
              Agendamentos
            </span>
            <Badge variant="secondary">{relationships.appointmentsCount}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Sinistros
            </span>
            <Badge variant="secondary">{relationships.sinistrosCount}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const inheritableFields = smartMergeFields.filter(f => 
    f.secondaryValue && (!f.primaryValue || f.primaryValue.trim() === '')
  );

  return (
    <div className="space-y-4">
      {/* Split View */}
      <div className="flex flex-col md:flex-row gap-4">
        <ClientCard 
          client={primaryClient} 
          relationships={primaryRelationships}
          isPrimary={true}
        />
        
        {/* Botão de troca */}
        <div className="flex items-center justify-center">
          <Button
            variant="outline"
            size="icon"
            onClick={onSwap}
            disabled={isProcessing}
            className="rounded-full"
            title="Inverter seleção"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        </div>

        <ClientCard 
          client={secondaryClient} 
          relationships={secondaryRelationships}
          isPrimary={false}
        />
      </div>

      {/* Smart Merge - Campos herdáveis */}
      {inheritableFields.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Smart Merge - Herdar Campos Vazios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              O cliente principal não possui estes dados, mas o secundário possui. Deseja herdá-los?
            </p>
            <div className="space-y-2">
              {inheritableFields.map(field => (
                <div key={field.field} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                  <Checkbox
                    id={`inherit-${field.field}`}
                    checked={selectedInheritFields.has(field.field)}
                    onCheckedChange={() => toggleFieldInherit(field.field)}
                  />
                  <label 
                    htmlFor={`inherit-${field.field}`}
                    className="flex-1 text-sm cursor-pointer"
                  >
                    <span className="font-medium">{field.label}:</span>{' '}
                    <span className="text-muted-foreground">{field.secondaryValue}</span>
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo das transferências */}
      {totalTransfers > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-amber-500" />
              Transferências que serão realizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {secondaryRelationships.apolicesCount > 0 && (
                <li className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <strong>{secondaryRelationships.apolicesCount}</strong> apólice(s) de "{secondaryClient.name}" → "{primaryClient.name}"
                </li>
              )}
              {secondaryRelationships.appointmentsCount > 0 && (
                <li className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <strong>{secondaryRelationships.appointmentsCount}</strong> agendamento(s) de "{secondaryClient.name}" → "{primaryClient.name}"
                </li>
              )}
              {secondaryRelationships.sinistrosCount > 0 && (
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <strong>{secondaryRelationships.sinistrosCount}</strong> sinistro(s) de "{secondaryClient.name}" → "{primaryClient.name}"
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Aviso de ação irreversível */}
      <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-destructive">Atenção: Esta ação é IRREVERSÍVEL!</p>
          <p className="text-muted-foreground">
            O cadastro "{secondaryClient.name}" será <strong>excluído permanentemente</strong> após a mesclagem.
          </p>
        </div>
      </div>

      {/* Botões de ação - escondidos em batch mode */}
      {!batchMode && (
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmClick} 
            disabled={isProcessing}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Confirmar Mesclagem
              </>
            )}
          </Button>
        </div>
      )}

      {/* Dialog de confirmação final - apenas em modo manual */}
      {!batchMode && (
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirmação Final
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>Você está prestes a:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {secondaryRelationships.apolicesCount > 0 && (
                      <li>Transferir <strong>{secondaryRelationships.apolicesCount}</strong> apólice(s) para "{primaryClient.name}"</li>
                    )}
                    {secondaryRelationships.appointmentsCount > 0 && (
                      <li>Transferir <strong>{secondaryRelationships.appointmentsCount}</strong> agendamento(s)</li>
                    )}
                    {secondaryRelationships.sinistrosCount > 0 && (
                      <li>Transferir <strong>{secondaryRelationships.sinistrosCount}</strong> sinistro(s)</li>
                    )}
                    {selectedInheritFields.size > 0 && (
                      <li>Herdar <strong>{selectedInheritFields.size}</strong> campo(s) do cliente secundário</li>
                    )}
                    <li className="text-destructive font-medium">
                      EXCLUIR permanentemente o cadastro "{secondaryClient.name}"
                    </li>
                  </ul>
                  <p className="font-medium text-destructive">
                    Esta ação NÃO PODE ser desfeita.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFinalConfirm}
                className="bg-destructive hover:bg-destructive/90"
              >
                Confirmar Exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
