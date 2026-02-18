-- Store Google OAuth provider tokens for Gmail API access
CREATE TABLE provider_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  provider text DEFAULT 'google',
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE provider_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (tokens are sensitive)
-- No user-facing RLS policies needed since we use the service client
