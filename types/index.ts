export interface PdfDocument {
  id: string;
  name: string;
  uploaded_at: string;
  status: "active" | "deprecated";
}

export interface ContentChunk {
  id: string;
  source_id: string;
  source_type: "pdf" | "web";
  page_number: number | null;
  section_heading: string | null;
  text: string;
  embedding: number[] | null;
  created_at: string;
}

export interface StructuredFact {
  id: string;
  category: string;
  key: string;
  value: string;
  source_document: string | null;
  source_id: string | null;
  page_number: number | null;
  confidence: "high" | "medium" | "low";
  last_verified: string;
  status: "active" | "deprecated";
}

export interface EmailQuery {
  id: string;
  raw_email: string;
  suggested_reply: string | null;
  confidence_score: "high" | "medium" | "low" | null;
  conflict_flag: boolean;
  sources_used: {
    source_id: string;
    source_type: string;
    page_number: number | null;
    snippet: string;
  }[] | null;
  approved_version: string | null;
  approved_by: string | null;
  status: "pending" | "approved" | "escalated";
  created_at: string;
  source?: 'manual' | 'forwarded';
  subject?: string | null;
  from_address?: string | null;
}
