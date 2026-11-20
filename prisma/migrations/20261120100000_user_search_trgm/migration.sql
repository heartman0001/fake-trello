-- Substring search on name/email uses ILIKE '%query%', which cannot use a
-- btree index. pg_trgm GIN indexes keep invite search fast as users grow.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "users_name_trgm_idx"
  ON "users" USING gin (lower("name") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_email_trgm_idx"
  ON "users" USING gin (lower("email") gin_trgm_ops);
