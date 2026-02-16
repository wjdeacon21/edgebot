# tasks.md — Edge City Ops AI

## How to Use This File

You are an AI coding agent. This file is your single source of truth for building the Edge City Ops AI project. Execute tasks sequentially within each phase. After completing each task, mark it `[x]` and note any decisions, blockers, or deviations inline. Do not skip ahead to a later phase until all tasks in the current phase are marked complete and tested.

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Supabase (Postgres + pgvector) · Claude API (Sonnet) · Vercel  
**Repo structure target:**
```
/app          → pages and layouts
/app/api      → API routes
/lib          → shared utilities (claude.ts, supabase.ts, etc.)
/components   → reusable UI components
/types        → TypeScript type definitions
```

**Design philosophy:** Calm, focused, quietly intelligent. Minimal chrome, clear hierarchy, no decorative noise. Amber for conflicts, subtle confidence badges. Think "mission control for truth."

---

## Phase 1 — MVP (PDF-Only)

### 1.0 Project Scaffolding (Day 1)

- [x] **1.0.1** Initialize a Next.js project with App Router, TypeScript, and Tailwind. Confirm it builds and runs locally.
- [x] **1.0.2** Set up the folder structure: `/app`, `/app/api`, `/lib`, `/components`, `/types`. Add placeholder `index.ts` or `page.tsx` files where needed so the structure is navigable.
- [ ] **1.0.3** Create a Vercel project and confirm deployment from the main branch succeeds (even if it's just the default Next.js page).
- [ ] **1.0.4** Create a Supabase project. Enable the `pgvector` extension (`CREATE EXTENSION IF NOT EXISTS vector;`). Confirm connection from a local `.env.local` using `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **1.0.5** Configure Supabase Auth with Google SSO. Restrict sign-in to allowed internal email addresses (use an allowlist check, not open registration). Create a minimal `/app/login/page.tsx` that redirects to Dashboard on success.
- [ ] **1.0.6** Create the following database tables via Supabase SQL editor or migration file. Use exact column names so all later references are consistent:

**`pdf_documents`**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK, default gen_random_uuid() | |
| name | text, not null | |
| version | text | |
| priority_label | text | e.g. "Master Guide" |
| uploaded_at | timestamptz, default now() | |
| status | text, default 'active' | 'active' or 'deprecated' |

**`content_chunks`**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| source_id | uuid, FK → pdf_documents.id (Phase 1) | |
| source_type | text, default 'pdf' | 'pdf' or 'web' later |
| page_number | int | |
| section_heading | text, nullable | |
| text | text, not null | |
| embedding | vector(1024) | Adjust dimension to match Claude embedding model output |
| created_at | timestamptz, default now() | |

**`structured_facts`**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| category | text, not null | e.g. "Arrival & Departure", "Refund policy" |
| key | text, not null | |
| value | text, not null | |
| source_document | text | human-readable reference |
| source_id | uuid, nullable, FK | |
| page_number | int, nullable | |
| confidence | text, default 'high' | 'high', 'medium', 'low' |
| last_verified | timestamptz, default now() | |
| status | text, default 'active' | 'active' or 'deprecated' |

**`email_queries`**
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| raw_email | text, not null | |
| internal_summary | text | |
| suggested_reply | text | |
| confidence_score | text | 'high', 'medium', 'low' |
| conflict_flag | boolean, default false | |
| sources_used | jsonb | array of {source_id, source_type, page_number, snippet} |
| approved_version | text, nullable | |
| approved_by | uuid, nullable | user id |
| status | text, default 'pending' | 'pending', 'approved', 'escalated' |
| created_at | timestamptz, default now() | |

- [ ] **1.0.7** Create `/lib/supabase.ts` exporting a server-side Supabase client (using service role key) and a client-side Supabase client (using anon key). Both should be typed.
- [ ] **1.0.8** Create `/types/index.ts` with TypeScript interfaces for `PdfDocument`, `ContentChunk`, `StructuredFact`, `EmailQuery` matching the table schemas above.
- [ ] **1.0.9** Create `/lib/claude.ts` with two stub functions. These will be implemented in the next tasks but should have correct signatures now:
  - `generateEmbedding(text: string): Promise<number[]>`
  - `generateResponse(params: { rawEmail: string; topChunks: ContentChunk[]; structuredFacts: StructuredFact[]; conflictFlag: boolean }): Promise<{ internalSummary: string; suggestedReply: string; confidence: string; conflicts: string[] }>`

**Checkpoint:** The app builds, deploys to Vercel, connects to Supabase, and Google SSO login works. All tables exist. Stub utility files compile.

---

### 1.1 PDF Ingestion Pipeline (Days 2–3)

- [ ] **1.1.1** Install `pdf-parse` (npm package). Create `/lib/pdf.ts` with a function `extractTextFromPdf(buffer: Buffer): Promise<{ pages: { pageNumber: number; text: string }[] }>` that returns page-segmented text.
- [ ] **1.1.2** Create the chunking function in `/lib/chunking.ts`:
  - Input: array of `{ pageNumber, text }`.
  - Output: array of `{ pageNumber, sectionHeading: string | null, text: string }`.
  - Target chunk size: 400–800 tokens. Use a simple whitespace/sentence-boundary splitter. Preserve page number. If a line looks like a heading (e.g. all caps, short line before a paragraph), capture it as `sectionHeading`.
- [ ] **1.1.3** Implement `generateEmbedding` in `/lib/claude.ts`. Call the Claude embeddings endpoint. Confirm the vector dimension returned and update the `content_chunks.embedding` column dimension if needed.
- [ ] **1.1.4** Create API route `/app/api/ingest/route.ts` (POST):
  - Accepts multipart form data: PDF file, `version` (string), `priorityLabel` (string, optional).
  - Extracts text → chunks → generates embeddings → inserts a row into `pdf_documents` → inserts rows into `content_chunks` with embeddings.
  - Returns `{ success: true, documentId, chunkCount }`.
  - Wrap in try/catch; return descriptive errors.
- [ ] **1.1.5** Build a minimal admin upload page at `/app/sources/page.tsx`:
  - File picker for PDF.
  - Text inputs for version and priority label.
  - Upload button that POSTs to `/api/ingest`.
  - Show success/error feedback.
  - Below the upload form, list all rows from `pdf_documents` showing name, version, priority_label, uploaded_at, status. No edit/delete actions yet.
- [ ] **1.1.6** Build the Structured Facts UI at `/app/structured-facts/page.tsx`:
  - Table view of all structured facts with columns: category, key, value, source_document, page_number, confidence, last_verified, status.
  - "Add New Fact" form (modal or inline): category (dropdown with predefined categories: Arrival & Departure, Ticket inclusions, Accommodation, Refund policy, WiFi & coworking, Programming structure, Attendance flexibility, Other), key, value, source_document (text), page_number, confidence dropdown (high/medium/low).
  - Edit button per row (inline edit or modal).
  - Deprecate button per row (sets status to 'deprecated'; does not delete).
  - Filter by category dropdown.
- [ ] **1.1.7** Test: Upload a real PDF. Verify rows appear in `pdf_documents` and `content_chunks`. Verify embeddings are non-null vectors of expected dimension. Manually add 5+ structured facts.

**Checkpoint:** You can upload PDFs, see them listed, chunks are embedded and stored, and you can manually manage structured facts.

---

### 1.2 Retrieval Layer (Day 4)

- [ ] **1.2.1** Create a Supabase RPC function (SQL) called `match_chunks`:
  - Input: `query_embedding vector, match_count int, match_threshold float`.
  - Returns: top N `content_chunks` rows ordered by cosine similarity (`1 - (embedding <=> query_embedding)`), including `source_id`, `source_type`, `page_number`, `section_heading`, `text`, and similarity score.
  - Filter out chunks from deprecated documents (join to `pdf_documents` where `status = 'active'`).
- [ ] **1.2.2** Create `/lib/retrieval.ts` with function `retrieveRelevantChunks(queryText: string, topK?: number): Promise<ContentChunk[]>`:
  - Embed the query text using `generateEmbedding`.
  - Call the `match_chunks` RPC with topK (default 5).
  - Return results.
- [ ] **1.2.3** Create `/lib/retrieval.ts` function `retrieveStructuredFacts(queryText: string): Promise<StructuredFact[]>`:
  - Approach 1 (simple, do this first): keyword match — extract nouns/keywords from query, query `structured_facts` where `category` or `key` ilike any keyword, status = 'active'.
  - Approach 2 (stretch): Use Claude to infer the category from the email, then query by category.
  - Return matching facts.
- [ ] **1.2.4** Test: Write a short test script or API route that takes a query string, calls both retrieval functions, and logs the results. Verify chunks are relevant and structured facts match.

**Checkpoint:** Given an email-like query, the system returns relevant chunks and structured facts.

---

### 1.3 Conflict Detection Engine (Day 5)

- [ ] **1.3.1** Create `/lib/conflicts.ts` with function `detectConflicts(chunks: ContentChunk[], facts: StructuredFact[]): Promise<{ conflictFlag: boolean; conflicts: string[]; confidence: 'high' | 'medium' | 'low' }>`:
  - Send the retrieved chunks and facts to Claude with a focused prompt: "You are a conflict detection system. Given these text chunks and structured facts, identify any contradictions in factual claims (dates, prices, policies, locations, etc.). Return a JSON object: `{ conflicts: string[], hasConflict: boolean }`. Each conflict string should name both sources and what they disagree about."
  - Determine confidence:
    - **High**: Structured fact match exists, no contradictions.
    - **Medium**: Vector-only answer (no structured fact), or minor variation.
    - **Low**: Conflicting values found, or no structured fact.
  - Return the result.
- [ ] **1.3.2** Test: Manually create two chunks with conflicting information (e.g., different check-in times). Run `detectConflicts`. Verify the conflict is flagged and described.

**Checkpoint:** The system detects and describes contradictions across retrieved content.

---

### 1.4 Claude Response Engine (Day 6)

- [ ] **1.4.1** Implement `generateResponse` in `/lib/claude.ts`:
  - Build a system prompt that enforces these rules: accuracy over speed, never fabricate, cite sources (document name + page), flag inconsistencies, if unsure say so clearly.
  - User message includes: raw email, retrieved chunks (with source metadata), structured facts, conflict flag and descriptions.
  - Instruct Claude to return a structured response in this format:
    ```
    --- INTERNAL SUMMARY ---
    [Answer with source citations]
    [Confidence: High/Medium/Low]
    [Conflicts: list or "None"]

    --- SUGGESTED REPLY ---
    [Direct, calm, no emojis, no speculation. First paragraph answers the question.]

    --- IF UNSURE ---
    [Clarifying questions, or "N/A"]
    ```
  - Parse Claude's response into the typed return object: `{ internalSummary, suggestedReply, confidence, conflicts }`.
- [ ] **1.4.2** Create API route `/app/api/generate/route.ts` (POST):
  - Input: `{ rawEmail: string }`.
  - Pipeline: embed query → retrieve chunks → retrieve structured facts → detect conflicts → generate response.
  - Save the full result to `email_queries` with status 'pending'.
  - Return the full result plus the `email_queries.id`.
- [ ] **1.4.3** Test: POST a realistic participant email to `/api/generate`. Verify the response includes a summary, suggested reply, confidence score, and citations. Verify it's saved to `email_queries`.

**Checkpoint:** End-to-end pipeline works — email in, verified draft out, logged in database.

---

### 1.5 Email Review Dashboard (Day 7)

- [ ] **1.5.1** Create the main layout shell. All authenticated pages should share a sidebar/nav with links to: Dashboard, Email Review, Sources, Structured Facts, Logs, Admin. Highlight the active page. Keep nav minimal — icon + label, no nested menus.
- [ ] **1.5.2** Build `/app/email-review/page.tsx` — the primary workspace:
  - **Left panel:**
    - Text area: "Paste participant email here".
    - "Generate Response" button. Show a loading spinner while the API call is in flight.
  - **Right panel** (appears after generation):
    - **Internal Summary** section with the answer and source citations.
    - **Confidence badge**: styled pill — green for High, yellow for Medium, red for Low.
    - **Conflict flag**: amber banner if `conflictFlag` is true, listing each conflict.
    - **Suggested Reply**: editable text area pre-filled with Claude's suggested reply.
    - **Action buttons:**
      - **Approve**: PATCH `/api/email-queries/[id]` with `{ status: 'approved', approved_version: <current text>, approved_by: <user id> }`.
      - **Edit**: just means the user modifies the text area before approving. No separate state needed.
      - **Escalate**: PATCH with `{ status: 'escalated' }`.
      - **Regenerate**: re-call `/api/generate` with the same email.
  - After Approve or Escalate, show a brief confirmation and reset the form.
- [ ] **1.5.3** Create API route `/app/api/email-queries/[id]/route.ts` (PATCH):
  - Accepts `{ status, approved_version, approved_by }`.
  - Updates the `email_queries` row.
  - Returns updated row.
- [ ] **1.5.4** Build `/app/dashboard/page.tsx`:
  - Display cards/stats: total PDFs ingested (count of `pdf_documents` where status=active), total structured facts (count), total queries processed (count of `email_queries`), recent queries (last 5, showing snippet of raw_email + confidence + status), conflict rate last 7 days (count of email_queries with conflict_flag=true / total in last 7 days).
  - No interactivity needed — read-only overview.
- [ ] **1.5.5** Build `/app/logs/page.tsx`:
  - Table of all `email_queries` rows, newest first.
  - Columns: timestamp, email snippet (first 80 chars), confidence, conflict flag, status, approved_by.
  - Click a row to expand and see full raw_email, internal_summary, suggested_reply, approved_version, sources_used.
  - Filters: by confidence (dropdown), by conflict flag (toggle), by status (dropdown), by date range (two date pickers).
- [ ] **1.5.6** Test the full Journey 1 flow: paste a real email → Generate → review summary and confidence → edit suggested reply → Approve. Verify the log entry appears in Logs and Dashboard stats update.
- [ ] **1.5.7** Test Journey 2 flow: use an email that triggers a known conflict → verify conflict flag appears → review both sources → Escalate.

**Checkpoint:** The complete MVP loop works — email in, draft generated, human reviews, approves, logged. All 7 pages exist and are navigable.

---

### 1.6 Auth, Roles & Admin (Day 8)

- [ ] **1.6.1** Create a `user_roles` table:

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, unique | Supabase auth user id |
| email | text | |
| role | text, default 'ops_reviewer' | 'ops_reviewer' or 'admin' |
| created_at | timestamptz | |

- [ ] **1.6.2** Create a middleware or utility function `getUserRole(userId: string): Promise<'ops_reviewer' | 'admin'>` that checks this table. Default to 'ops_reviewer' if no row exists.
- [ ] **1.6.3** Enforce role-based access:
  - **Ops Reviewer** can: access Email Review, view Sources (read-only list), view Structured Facts (read-only), view Logs, view Dashboard.
  - **Admin** can additionally: upload/replace PDFs, edit/add/deprecate structured facts, access Admin page, deprecate documents.
  - On the Sources page, hide the upload form for non-admins. On Structured Facts, hide add/edit/deprecate controls for non-admins.
- [ ] **1.6.4** Build `/app/admin/page.tsx` (admin-only):
  - **User management**: list all users from `user_roles`, ability to change role via dropdown.
  - **System health**: display counts — total chunks, total embeddings, any recent API errors (can be a simple read from a `system_logs` table or just display "healthy" for now).
  - **Re-embedding trigger**: a button that, when clicked, re-generates embeddings for all active chunks. This is a slow operation — show a progress indicator or at minimum a "started" confirmation. Implement as a simple loop in an API route; no background job infrastructure needed yet.
- [ ] **1.6.5** Test: Log in as an ops_reviewer — confirm you cannot upload PDFs or edit structured facts. Log in as admin — confirm full access. Verify the Admin page is not accessible to ops_reviewers.

**Checkpoint:** Role-based access works. Admin page functional. MVP access control is in place.

---

### 1.7 MVP Hardening & Validation (Days 9–10)

- [ ] **1.7.1** Ingest 10 real PDFs. Verify all chunks are embedded and searchable.
- [ ] **1.7.2** Populate structured facts table with at least 15–20 key facts across multiple categories.
- [ ] **1.7.3** Run 20 real participant emails through the full pipeline. For each, note:
  - Was the response accurate?
  - Was the confidence rating appropriate?
  - Were conflicts correctly flagged?
  - Were citations correct?
  - Time from paste to approved response (target: < 3 minutes).
- [ ] **1.7.4** Fix any bugs or prompt issues discovered during the 20-email test.
- [ ] **1.7.5** Add error handling and user-facing error states:
  - API route errors should return structured JSON errors, not 500s.
  - The Email Review page should display a clear error message if generation fails.
  - The upload flow should handle oversized files, non-PDF files, and extraction failures gracefully.
- [ ] **1.7.6** Add loading states to all async operations (generate, upload, save).
- [ ] **1.7.7** Review all pages for design consistency: calm palette, clean typography, minimal chrome, amber for conflicts, green/yellow/red confidence badges. No decorative elements.
- [ ] **1.7.8** Verify Vercel deployment works end-to-end with production environment variables.

**Checkpoint — MVP Definition of Done:**
- 10 PDFs ingested.
- Structured fact table populated.
- Email → verified response in < 30 seconds.
- Conflict flags visible and accurate.
- All outputs logged.
- Human approval required before any reply.
- 20 real emails processed successfully.

---

## Phase 2 — V1 (Live Web Ingestion)

Only begin this phase after MVP is validated.

---

### 2.0 Database Additions for Web Sources

- [ ] **2.0.1** Create the `web_documents` table:

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| url | text, not null | |
| title | text | |
| last_updated | timestamptz, nullable | from page metadata if detectable |
| ingestion_timestamp | timestamptz, default now() | |
| status | text, default 'active' | 'active' or 'deprecated' |

- [ ] **2.0.2** Update the `content_chunks` table: ensure `source_type` can be 'pdf' or 'web', and `source_id` can reference either `pdf_documents.id` or `web_documents.id`. (No strict FK needed — use application-level logic.)

---

### 2.1 Web Scraper Integration

- [ ] **2.1.1** Choose scraping approach: Firecrawl (hosted service, simpler) or custom crawler (fetch + cheerio, more control). Install dependencies.
- [ ] **2.1.2** Create `/lib/scraper.ts` with function `scrapeUrl(url: string): Promise<{ title: string; lastUpdated: string | null; sections: { heading: string; text: string }[] }>`:
  - Fetch the page HTML.
  - Extract text content preserving heading hierarchy.
  - Detect `last_updated` from meta tags or page content if possible.
- [ ] **2.1.3** Create API route `/app/api/ingest-web/route.ts` (POST):
  - Input: `{ url: string }`.
  - Scrape → chunk (same 400–800 token strategy) → embed → store in `web_documents` + `content_chunks` (source_type='web').
  - Return `{ success, documentId, chunkCount }`.
- [ ] **2.1.4** Update the Sources page `/app/sources/page.tsx`:
  - Add a "Web" tab alongside "PDFs".
  - Web tab: form to enter URL and trigger scrape. List all `web_documents` with url, title, last_updated, ingestion_timestamp, status.
  - Add a "Re-crawl" button per web document that re-scrapes and re-embeds.
  - Add a "Mark Deprecated" button per document (both tabs).
- [ ] **2.1.5** Test: Scrape 2–3 real Edge City webpages. Verify chunks appear in `content_chunks` with source_type='web'. Verify they show up in the Sources web tab.

**Checkpoint:** Web pages can be ingested into the same vector index as PDFs.

---

### 2.2 Unified Retrieval & Cross-Source Conflicts

- [ ] **2.2.1** Update `match_chunks` RPC to also filter out chunks from deprecated `web_documents`. The function should work across both source types seamlessly.
- [ ] **2.2.2** Update `retrieveRelevantChunks` in `/lib/retrieval.ts` to include source_type in results so the response engine and conflict detector know provenance.
- [ ] **2.2.3** Enhance `/lib/conflicts.ts` — `detectConflicts` should now:
  - Compare timestamps when conflicts are found (prefer newer document).
  - Surface both sources with their `last_updated` / `uploaded_at` dates.
  - Prefer structured facts over raw chunks.
  - Prefer documents labeled "Master Guide" (priority_label) when timestamps are similar.
  - Never silently discard the older source — always surface both in the internal summary.
- [ ] **2.2.4** Update `generateResponse` prompt to reference web sources properly: cite URL + page title instead of document name + page number for web-sourced chunks.
- [ ] **2.2.5** Test: Create a scenario where a PDF and a web page contain conflicting info about the same topic. Run an email through the pipeline. Verify the conflict is detected, both sources are shown, and the newer one is indicated as preferred.

**Checkpoint:** Unified retrieval and cross-source conflict detection work across PDFs and web pages.

---

### 2.3 Re-Ingestion & Admin Controls

- [ ] **2.3.1** Implement PDF re-upload: on the Sources page, add a "Replace" button per PDF. When clicked, upload a new file — create a new `pdf_documents` row with incremented version, mark the old one as deprecated, re-chunk and re-embed.
- [ ] **2.3.2** Implement web re-crawl: the "Re-crawl" button should delete old chunks for that web_document, re-scrape, re-chunk, re-embed, update `ingestion_timestamp`.
- [ ] **2.3.3** Add re-crawl and re-upload controls to the Admin page as well, plus a "Mark Deprecated" bulk action.
- [ ] **2.3.4** Test: Replace a PDF with a new version. Verify old chunks are no longer returned in searches. Re-crawl a web page. Verify updated content is reflected.

**Checkpoint:** Admins can maintain the knowledge base — replace, re-crawl, deprecate.

---

### 2.4 V1 Polish & Validation

- [ ] **2.4.1** Review all pages for consistent design. Ensure web sources are visually distinguished from PDFs (e.g., small icon or label).
- [ ] **2.4.2** Update Dashboard to include: total web sources count, breakdown of sources by type.
- [ ] **2.4.3** Update Logs to show source_type in the sources_used display.
- [ ] **2.4.4** Run 20 more real emails, including queries that should draw from web sources. Validate accuracy, conflict detection, and citation quality.
- [ ] **2.4.5** Conduct a 3-user test: have 3 people paste tricky emails, observe confusion, log top 3 UX friction points, and fix them.

**Checkpoint — V1 Definition of Done:**
- PDFs and web pages in a unified knowledge graph.
- Cross-source conflict detection with timestamp awareness.
- Re-ingestion controls working.
- 20+ additional emails validated.
- 3-user test completed and top issues fixed.

---

## Stretch Goals (Only After V1 Is Stable)

Do not start these unless V1 is validated and stable in production.

- [ ] **S.1** Category auto-tagging: use Claude to auto-suggest a category when a new structured fact is added.
- [ ] **S.2** Recurring question analytics: aggregate `email_queries` by inferred topic, surface the top 10 most common question types on the Dashboard.
- [ ] **S.3** Confidence trend dashboard: chart confidence scores over time (7-day rolling average).
- [ ] **S.4** Version diff viewer for PDFs: when a PDF is replaced, show a diff of what changed between the old and new extracted text.

---

## Anti-Patterns — Do Not Do These

- Do NOT build microservices or split the backend.
- Do NOT build background job infrastructure (no queues, no workers) until absolutely necessary.
- Do NOT auto-send emails. Every reply requires human approval.
- Do NOT build a public-facing chatbot.
- Do NOT auto-extract structured facts from PDFs. Manual entry ensures trust.
- Do NOT add features that don't directly reduce email review time.
