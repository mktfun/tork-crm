-- 1. Remove the incorrect global UNIQUE constraint on nome
ALTER TABLE ramos DROP CONSTRAINT IF EXISTS ramos_nome_key;

-- 2. Add composite UNIQUE constraint (nome + user_id)
-- This allows each user to have their own branches with unique names
ALTER TABLE ramos ADD CONSTRAINT ramos_nome_user_unique UNIQUE (nome, user_id);