ALTER TABLE email_queries ADD COLUMN IF NOT EXISTS intent_category text;
ALTER TABLE email_queries ADD COLUMN IF NOT EXISTS was_manually_overridden boolean DEFAULT false;
