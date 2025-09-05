-- Adiciona as colunas que o código estava esperando na tabela producers
ALTER TABLE public.producers
ADD COLUMN cpf_cnpj TEXT,
ADD COLUMN company_name TEXT;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.producers.cpf_cnpj IS 'CPF ou CNPJ do produtor, sem formatação.';
COMMENT ON COLUMN public.producers.company_name IS 'Razão Social, se for pessoa jurídica.';