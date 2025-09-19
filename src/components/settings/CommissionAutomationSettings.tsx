import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { toast } from "@/hooks/use-toast";
import { AppCard } from '@/components/ui/app-card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function CommissionAutomationSettings() {
  const { data: profile, isLoading } = useProfile();
  const updateProfileMutation = useUpdateProfile();

  const handleUpdate = (field: string, value: any) => {
    updateProfileMutation.mutate(
      { [field]: value },
      {
        onSuccess: () => {
          const fieldNames: Record<string, string> = {
            settle_commissions_automatically: "Automação de comissões",
            commission_settlement_days: "Dias para baixa",
            commission_settlement_strategy: "Estratégia de parcelas",
            commission_settlement_installments: "Quantidade de parcelas"
          };
          toast({
            title: "Configuração atualizada",
            description: `${fieldNames[field]} atualizada com sucesso.`,
          });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível atualizar a configuração.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="h-4 bg-muted animate-pulse rounded"></div>
        <div className="h-10 bg-muted animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <AppCard>
      <CardHeader>
        <CardTitle>Automação de Faturamento</CardTitle>
        <CardDescription>Configure a baixa automática de comissões para reduzir trabalho manual.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="automatic-commission" className="font-medium">Baixa Automática de Comissões</Label>
          <Switch
            id="automatic-commission"
            checked={profile?.settle_commissions_automatically || false}
            onCheckedChange={(isChecked) => handleUpdate('settle_commissions_automatically', isChecked)}
            disabled={updateProfileMutation.isPending}
          />
        </div>

        {profile?.settle_commissions_automatically && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <Label htmlFor="settlement-days">Dar baixa após (dias da emissão)</Label>
              <Input
                id="settlement-days"
                type="number"
                min="1"
                max="365"
                value={profile?.commission_settlement_days || 7}
                onChange={(e) => handleUpdate('commission_settlement_days', parseInt(e.target.value, 10))}
                disabled={updateProfileMutation.isPending}
                className="mt-1 w-24"
              />
              <p className="text-sm text-muted-foreground mt-1">
                A comissão será marcada como 'Paga' X dias após a data de criação.
              </p>
            </div>
            <div>
              <Label htmlFor="strategy">Estratégia de Parcelas</Label>
              <Select
                value={profile?.commission_settlement_strategy || 'all'}
                onValueChange={(value) => handleUpdate('commission_settlement_strategy', value)}
                disabled={updateProfileMutation.isPending}
              >
                <SelectTrigger id="strategy" className="mt-1">
                  <SelectValue placeholder="Selecione a estratégia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">Primeira parcela apenas</SelectItem>
                  <SelectItem value="all">Todas as parcelas</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Define quais parcelas das comissões serão processadas automaticamente.
              </p>
            </div>
            {profile?.commission_settlement_strategy === 'custom' && (
              <div>
                <Label htmlFor="installments-count">Quantidade de parcelas</Label>
                <Input
                  id="installments-count"
                  type="number"
                  min="1"
                  max="24"
                  value={profile?.commission_settlement_installments || 1}
                  onChange={(e) => handleUpdate('commission_settlement_installments', parseInt(e.target.value, 10))}
                  disabled={updateProfileMutation.isPending}
                  className="mt-1 w-24"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Número de parcelas que serão processadas automaticamente.
                </p>
              </div>
            )}
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Como funciona:</strong> Todo dia às 3h da manhã, o sistema verifica as comissões 
                pendentes e as marca como pagas conforme suas configurações.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </AppCard>
  );
}