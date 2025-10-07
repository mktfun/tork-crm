import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileUp, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Helper para limpar nomes de arquivos para serem seguros para URL/Storage
const sanitizeFilename = (filename: string): string => {
  const extension = filename.split('.').pop() || '';
  const nameWithoutExtension = filename.substring(0, filename.lastIndexOf('.') || filename.length);

  return nameWithoutExtension
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais, exceto espaços e hífens
    .replace(/\s+/g, '-') // Substitui espaços por hífens
    .replace(/-+/g, '-')   // Remove hífens duplicados
    + '.' + extension.toLowerCase();
};

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
      console.log('📤 Fazendo upload do PDF:', file.name);

      // ETAPA 1: Upload para o Supabase Storage
      const sanitizedName = sanitizeFilename(file.name);
      const filePath = `${crypto.randomUUID()}-${sanitizedName}`;
      
      console.log('🔧 Nome sanitizado:', sanitizedName, '| Caminho:', filePath);
      
      const { error: uploadError } = await supabase.storage
        .from('quote-uploads')
        .upload(filePath, file, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Erro no upload:', uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // ETAPA 2: Obter URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('quote-uploads')
        .getPublicUrl(filePath);

      console.log('📄 Enviando URL para processamento:', publicUrl);

      // ETAPA 3: Chamar edge function com a URL
      const { data, error } = await supabase.functions.invoke('extract-quote-data', {
        body: { fileUrl: publicUrl }
      });

      // ETAPA 4: Limpar arquivo temporário do storage
      await supabase.storage
        .from('quote-uploads')
        .remove([filePath]);

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
