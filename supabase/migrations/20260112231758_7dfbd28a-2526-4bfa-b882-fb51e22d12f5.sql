-- Tornar o bucket policy-docs público para que os links funcionem
UPDATE storage.buckets SET public = true WHERE id = 'policy-docs';