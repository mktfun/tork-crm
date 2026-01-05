-- ============= FASE 18: OCR & Upload de Comprovantes =============

-- 1. Criar bucket público para comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de Storage para o bucket comprovantes

-- Usuários autenticados podem fazer upload em sua própria pasta
CREATE POLICY "Users can upload receipts" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'comprovantes' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Qualquer um pode visualizar (bucket público)
CREATE POLICY "Public can view receipts" 
ON storage.objects 
FOR SELECT 
TO public
USING (bucket_id = 'comprovantes');

-- Usuários podem deletar seus próprios comprovantes
CREATE POLICY "Users can delete own receipts" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'comprovantes' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Adicionar coluna attachments na tabela financial_transactions
ALTER TABLE public.financial_transactions
ADD COLUMN IF NOT EXISTS attachments text[] DEFAULT '{}';