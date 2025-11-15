-- Criar bucket para uploads de orçamentos em PDF (se ainda não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quote-uploads',
  'quote-uploads',
  true,
  10485760, -- 10MB em bytes
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Public read access for quote uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete quote uploads" ON storage.objects;

-- Recriar políticas RLS para o bucket quote-uploads

-- Permitir upload autenticado
CREATE POLICY "Authenticated users can upload PDFs to quote uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quote-uploads' 
  AND auth.uid() IS NOT NULL
);

-- Permitir leitura pública (necessário para a Edge Function)
CREATE POLICY "Public read access to quote uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'quote-uploads');

-- Permitir deleção automática pela Edge Function
CREATE POLICY "Service role can delete from quote uploads"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'quote-uploads');