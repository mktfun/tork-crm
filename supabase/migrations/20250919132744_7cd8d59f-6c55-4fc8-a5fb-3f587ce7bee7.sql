-- Otimização de Performance: Habilitar Realtime e Índices para a tabela clientes (CORRIGIDA)

-- 1. Habilitar REPLICA IDENTITY FULL para capturar dados completos durante updates
ALTER TABLE public.clientes REPLICA IDENTITY FULL;

-- 2. Adicionar a tabela à publicação realtime para ativar funcionalidade em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;

-- 3. Criar índices compostos para melhorar performance de filtros
-- Índice para filtros por seguradora (via apolices)
CREATE INDEX IF NOT EXISTS idx_apolices_client_insurance ON public.apolices (client_id, insurance_company, user_id);

-- Índice para filtros por ramo/tipo (via apolices)
CREATE INDEX IF NOT EXISTS idx_apolices_client_type ON public.apolices (client_id, type, user_id);

-- Índice para ordenação por data de criação (mais usado)
CREATE INDEX IF NOT EXISTS idx_clientes_created_at ON public.clientes (user_id, created_at DESC);

-- Índice para ordenação por nome
CREATE INDEX IF NOT EXISTS idx_clientes_name ON public.clientes (user_id, name);

-- Índice para busca por email
CREATE INDEX IF NOT EXISTS idx_clientes_email ON public.clientes (user_id, email);

-- Índice para busca por telefone
CREATE INDEX IF NOT EXISTS idx_clientes_phone ON public.clientes (user_id, phone);

-- Índice para busca por CPF/CNPJ
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON public.clientes (user_id, cpf_cnpj);

-- 4. Comentários para documentar as otimizações
COMMENT ON INDEX idx_apolices_client_insurance IS 'Otimização: Acelera filtros de clientes por seguradora';
COMMENT ON INDEX idx_apolices_client_type IS 'Otimização: Acelera filtros de clientes por ramo/tipo';
COMMENT ON INDEX idx_clientes_created_at IS 'Otimização: Acelera ordenação por data de criação';
COMMENT ON INDEX idx_clientes_name IS 'Otimização: Acelera ordenação por nome';
COMMENT ON INDEX idx_clientes_email IS 'Otimização: Acelera busca por email';
COMMENT ON INDEX idx_clientes_phone IS 'Otimização: Acelera busca por telefone';
COMMENT ON INDEX idx_clientes_cpf_cnpj IS 'Otimização: Acelera busca por CPF/CNPJ';