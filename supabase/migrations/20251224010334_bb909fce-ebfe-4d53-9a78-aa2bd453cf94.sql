
-- Delete duplicate transaction_types keeping only the oldest one per user/name/nature combination
DELETE FROM transaction_types
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, name, nature) id
  FROM transaction_types
  ORDER BY user_id, name, nature, created_at ASC
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE transaction_types
ADD CONSTRAINT unique_user_transaction_type UNIQUE (user_id, name, nature);
