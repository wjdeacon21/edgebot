-- Add fields to support forwarded/inbound emails from Postmark
ALTER TABLE email_queries ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE email_queries ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE email_queries ADD COLUMN IF NOT EXISTS from_address text;
