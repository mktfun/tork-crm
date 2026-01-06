import { useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Loader2, Calendar, Paperclip, X, Upload, Clock } from 'lucide-react';
import { format, isFuture, parseISO } from 'date-fns';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

import { supabase } from '@/integrations/supabase/client';
import { useFinancialAccounts, useRegisterExpense } from '@/hooks/useFinanceiro';
import { FinancialAccount } from '@/types/financeiro';
import { Badge } from '@/components/ui/badge';

interface FormData {
  description: string;
  amount: string;
  transactionDate: string;
  expenseAccountId: string;
  assetAccountId: string;
  referenceNumber: string;
}

// Gerar ID único
function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function NovaDespesaModal() {
  const [open, setOpen] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: expenseAccounts = [], isLoading: loadingExpense } = useFinancialAccounts('expense');
  const { data: assetAccounts = [], isLoading: loadingAsset } = useFinancialAccounts('asset');
  
  const registerExpense = useRegisterExpense();
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      description: '',
      amount: '',
      transactionDate: format(new Date(), 'yyyy-MM-dd'),
      expenseAccountId: '',
      assetAccountId: '',
      referenceNumber: ''
    }
  });

  // Handler para seleção de arquivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Selecione uma imagem ou PDF');
      return;
    }

    setAttachmentFile(file);
    
    // Preview para imagens
    if (file.type.startsWith('image/')) {
      setAttachmentPreview(URL.createObjectURL(file));
    } else {
      setAttachmentPreview(null);
    }
  };

  // Remover arquivo
  const removeAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Detectar se a data selecionada é futura
  const transactionDate = watch('transactionDate');
  const isDateFuture = useMemo(() => {
    if (!transactionDate) return false;
    try {
      return isFuture(parseISO(transactionDate));
    } catch {
      return false;
    }
  }, [transactionDate]);

  const onSubmit = async (data: FormData) => {
    try {
      const amount = parseFloat(data.amount.replace(',', '.'));
      
      if (isNaN(amount) || amount <= 0) {
        toast.error('Valor inválido');
        return;
      }

      let attachmentUrl: string | undefined;

      // Upload do comprovante se houver
      if (attachmentFile) {
        setIsUploading(true);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Usuário não autenticado');

          const ext = attachmentFile.name.split('.').pop() || 'jpg';
          const fileName = `${user.id}/${generateId()}.${ext}`;
          
          const { error: uploadError } = await supabase.storage
            .from('comprovantes')
            .upload(fileName, attachmentFile, { contentType: attachmentFile.type });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('comprovantes')
            .getPublicUrl(fileName);

          attachmentUrl = urlData.publicUrl;
        } catch (uploadErr) {
          console.error('Erro no upload:', uploadErr);
          toast.error('Erro ao anexar comprovante');
          // Continua sem o anexo
        } finally {
          setIsUploading(false);
        }
      }

      await registerExpense.mutateAsync({
        description: data.description,
        amount,
        transactionDate: data.transactionDate,
        expenseAccountId: data.expenseAccountId,
        assetAccountId: data.assetAccountId,
        referenceNumber: data.referenceNumber || undefined,
        memo: attachmentUrl, // Salvamos a URL no memo por enquanto
      });

      toast.success('Despesa registrada com sucesso!');
      reset();
      removeAttachment();
      setOpen(false);
    } catch (error: any) {
      console.error('Erro ao registrar despesa:', error);
      toast.error(error.message || 'Erro ao registrar despesa');
    }
  };

  const isLoading = loadingExpense || loadingAsset;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Despesa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar Despesa</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              placeholder="Ex: Pagamento de conta de luz"
              {...register('description', { required: 'Descrição obrigatória' })}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                {...register('amount', { required: 'Valor obrigatório' })}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="transactionDate">Data *</Label>
                {isDateFuture && (
                  <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/30 bg-amber-500/10">
                    <Calendar className="w-3 h-3" />
                    Previsão
                  </Badge>
                )}
              </div>
              <Input
                id="transactionDate"
                type="date"
                {...register('transactionDate', { required: 'Data obrigatória' })}
              />
              {isDateFuture && (
                <p className="text-xs text-muted-foreground">
                  Despesas futuras aparecem como previsão no Fluxo de Caixa
                </p>
              )}
              {errors.transactionDate && (
                <p className="text-sm text-destructive">{errors.transactionDate.message}</p>
              )}
            </div>
          </div>

          {/* Checkbox: Já paga? */}
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Checkbox 
              id="isPaid" 
              checked={isPaid} 
              onCheckedChange={(checked) => setIsPaid(!!checked)}
            />
            <div className="flex-1">
              <Label htmlFor="isPaid" className="text-sm font-medium cursor-pointer">
                Despesa já foi paga
              </Label>
              {!isPaid && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  Esta despesa aparecerá como "A Pagar" no fluxo de caixa
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Para que foi? (Categoria) *</Label>
            <Select
              onValueChange={(value) => setValue('expenseAccountId', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {expenseAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code ? `${acc.code} - ${acc.name}` : acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('expenseAccountId', { required: 'Selecione uma categoria' })} />
            {errors.expenseAccountId && (
              <p className="text-sm text-destructive">{errors.expenseAccountId.message}</p>
            )}
          </div>

          {/* Conta de Saída (Ativo) */}
          <div className="space-y-2">
            <Label>De onde saiu o dinheiro? *</Label>
            <Select
              onValueChange={(value) => setValue('assetAccountId', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {assetAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.code ? `${acc.code} - ${acc.name}` : acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('assetAccountId', { required: 'Selecione uma conta' })} />
            {errors.assetAccountId && (
              <p className="text-sm text-destructive">{errors.assetAccountId.message}</p>
            )}
          </div>

          {/* Referência (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="referenceNumber">Referência (opcional)</Label>
            <Input
              id="referenceNumber"
              placeholder="Ex: NF 12345, Boleto, etc."
              {...register('referenceNumber')}
            />
          </div>

          {/* Anexar Comprovante */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Anexar Comprovante (opcional)
            </Label>
            
            {!attachmentFile ? (
              <div
                className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar imagem ou PDF
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/30">
                {attachmentPreview ? (
                  <img 
                    src={attachmentPreview} 
                    alt="Preview" 
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                    <Paperclip className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachmentFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(attachmentFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeAttachment}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={registerExpense.isPending || isUploading}
            >
              {(registerExpense.isPending || isUploading) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isUploading ? 'Anexando...' : 'Salvando...'}
                </>
              ) : (
                'Salvar Despesa'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
