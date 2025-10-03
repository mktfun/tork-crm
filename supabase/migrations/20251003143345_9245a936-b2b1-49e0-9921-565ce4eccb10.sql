-- Backfill ramo_id for existing policies where type is a UUID
-- This ensures all policies have proper ramo_id populated for JOIN queries

UPDATE apolices
SET ramo_id = type::uuid
WHERE ramo_id IS NULL
  AND type ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- Log summary
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfill concluído: % apólices atualizadas com ramo_id', updated_count;
END $$;