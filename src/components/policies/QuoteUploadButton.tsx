import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileUp, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExtractedQuoteData {
  insuredItem: string | null;
  insurerName: string | null;
  insuranceLine: string | null;
  policyNumber: string | null;
  premiumValue: number | null;
  commissionPercentage: number | null;
  shouldGenerateRenewal: boolean;
  startDate: string | null;
}

interface QuoteUploadButtonProps {
  onDataExtracted: (data: ExtractedQuoteData) => void;
  disabled?: boolean;
}

export function QuoteUploadButton({ onDataExtracted, disabled }: QuoteUploadButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validação de tipo
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são aceitos');
      return;
    }

    // Validação de tamanho (20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 20MB');
      return;
    }

    setIsProcessing(true);
    setStatus('idle');

    try {
      // Converter PDF para base64
      const base64 = await fileToBase64(file);

      console.log('📄 Enviando PDF para processamento:', file.name);

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('extract-quote-data', {
        body: {
          pdfBase64: base64,
          fileName: file.name
        }
      });

      if (error) {
        console.error('❌ Erro ao processar PDF:', error);
        throw new Error(error.message || 'Falha ao processar o orçamento');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Falha ao extrair dados do orçamento');
      }

      console.log('✅ Dados extraídos:', data.data);

      setStatus('success');
      toast.success('Orçamento processado com sucesso!', {
        description: 'Os dados foram extraídos e o formulário será preenchido automaticamente.'
      });

      // Callback com os dados extraídos
      onDataExtracted(data.data);

      // Reset status após 3 segundos
      setTimeout(() => setStatus('idle'), 3000);

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      setStatus('error');
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao processar orçamento', {
        description: errorMessage
      });

      // Reset status após 3 segundos
      setTimeout(() => setStatus('idle'), 3000);
    } finally {
      setIsProcessing(false);
      // Limpar input para permitir reupload do mesmo arquivo
      event.target.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remover o prefixo "data:application/pdf;base64,"
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  const getButtonIcon = () => {
    if (isProcessing) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (status === 'success') return <CheckCircle2 className="h-4 w-4" />;
    if (status === 'error') return <XCircle className="h-4 w-4" />;
    return <FileUp className="h-4 w-4" />;
  };

  const getButtonVariant = () => {
    if (status === 'success') return 'default';
    if (status === 'error') return 'destructive';
    return 'outline';
  };

  return (
    <div className="relative">
      <input
        type="file"
        id="quote-upload"
        accept="application/pdf"
        onChange={handleFileSelect}
        disabled={isProcessing || disabled}
        className="hidden"
      />
      <label htmlFor="quote-upload">
        <Button
          type="button"
          variant={getButtonVariant()}
          disabled={isProcessing || disabled}
          className="w-full"
          asChild
        >
          <span className="cursor-pointer">
            {getButtonIcon()}
            <span className="ml-2">
              {isProcessing
                ? 'Processando PDF...'
                : status === 'success'
                ? 'Orçamento Processado!'
                : status === 'error'
                ? 'Erro no Processamento'
                : 'Importar Orçamento PDF'}
            </span>
          </span>
        </Button>
      </label>
      
      {isProcessing && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Extraindo dados com IA... Isso pode levar alguns segundos.
        </p>
      )}
    </div>
  );
}
