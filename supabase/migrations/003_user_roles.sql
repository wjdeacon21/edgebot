-- user_roles table for role-based access control
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'ops_reviewer',
  created_at timestamptz DEFAULT now()
);
