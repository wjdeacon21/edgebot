CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1024),
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  source_type text,
  page_number int,
  section_heading text,
  text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.source_id,
    cc.source_type,
    cc.page_number,
    cc.section_heading,
    cc.text,
    (1 - (cc.embedding <=> query_embedding))::float AS similarity
  FROM content_chunks cc
  JOIN pdf_documents pd ON cc.source_id = pd.id AND pd.status = 'active'
  WHERE cc.embedding IS NOT NULL
    AND (1 - (cc.embedding <=> query_embedding)) > match_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
