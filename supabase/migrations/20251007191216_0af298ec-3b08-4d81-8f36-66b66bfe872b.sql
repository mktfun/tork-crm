-- Criar bucket público para uploads temporários de orçamentos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quote-uploads',
  'quote-uploads',
  true,
  20971520, -- 20MB
  ARRAY['application/pdf']
);

-- Política: Usuários autenticados podem fazer upload
CREATE POLICY "Authenticated users can upload quotes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'quote-uploads');

-- Política: Acesso público para leitura (necessário para PDF.co acessar)
CREATE POLICY "Public read access for quote uploads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'quote-uploads');

-- Política: Usuários podem deletar apenas seus próprios arquivos
CREATE POLICY "Users can delete their own uploaded quotes"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'quote-uploads' AND auth.uid() = owner);