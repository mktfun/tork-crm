import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';

export function BackfillCommissionsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const handleBackfill = async () => {
    if (!user) {
      toast.error('Você precisa estar logado para executar esta operação');
      return;
    }

    setIsLoading(true);
    try {
      console.log('🚀 Iniciando backfill de comissões...');
      
      const { data, error } = await supabase.functions.invoke('backfill-commissions', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('❌ Erro ao executar backfill:', error);
        toast.error('Erro ao gerar comissões retroativas: ' + error.message);
        return;
      }

      console.log('✅ Backfill concluído:', data);
      toast.success(data.message || 'Comissões retroativas geradas com sucesso!');
      
      if (data.summary) {
        console.log('📊 Resumo:', data.summary);
        toast.info(`Total: ${data.summary.total} | Sucesso: ${data.summary.success} | Puladas: ${data.summary.skipped} | Erros: ${data.summary.errors}`);
      }
    } catch (err: any) {
      console.error('❌ Erro inesperado:', err);
      toast.error('Erro inesperado ao executar backfill');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleBackfill}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Processando...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          Gerar Comissões Retroativas
        </>
      )}
    </Button>
  );
}
