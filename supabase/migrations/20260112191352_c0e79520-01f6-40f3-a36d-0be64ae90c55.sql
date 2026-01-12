-- Adicionar colunas de controle de download na tabela brokerages
ALTER TABLE brokerages 
ADD COLUMN IF NOT EXISTS portal_allow_policy_download BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS portal_allow_card_download BOOLEAN DEFAULT true;

-- Adicionar coluna de telefone de assistência na tabela companies
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS assistance_phone TEXT DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN companies.assistance_phone IS 'Telefone de assistência 24h da seguradora';