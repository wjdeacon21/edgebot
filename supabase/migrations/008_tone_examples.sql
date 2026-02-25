CREATE TABLE IF NOT EXISTS tone_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);
