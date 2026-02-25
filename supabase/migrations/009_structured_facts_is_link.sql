ALTER TABLE structured_facts ADD COLUMN IF NOT EXISTS is_link boolean NOT NULL DEFAULT false;
