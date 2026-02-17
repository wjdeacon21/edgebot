-- Ensure pgvector is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- pdf_documents
CREATE TABLE pdf_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text,
  priority_label text,
  uploaded_at timestamptz DEFAULT now(),
  status text DEFAULT 'active'
);

-- content_chunks
CREATE TABLE content_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES pdf_documents(id),
  source_type text DEFAULT 'pdf',
  page_number int,
  section_heading text,
  text text NOT NULL,
  embedding vector(1024),
  created_at timestamptz DEFAULT now()
);

-- structured_facts
CREATE TABLE structured_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  source_document text,
  source_id uuid,
  page_number int,
  confidence text DEFAULT 'high',
  last_verified timestamptz DEFAULT now(),
  status text DEFAULT 'active'
);

-- email_queries
CREATE TABLE email_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_email text NOT NULL,
  internal_summary text,
  suggested_reply text,
  confidence_score text,
  conflict_flag boolean DEFAULT false,
  sources_used jsonb,
  approved_version text,
  approved_by uuid,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
