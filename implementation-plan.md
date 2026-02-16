# implementation-plan.md

## Build Philosophy (Solo Dev, Vibecoding)

Principles:

* Ship MVP in < 10 days
* No premature abstraction
* One deployable app
* One database
* One vector index
* Claude handles reasoning, not your backend

Rule:
If it doesn’t reduce email review time, it doesn’t ship.

---

# Phase 1 — MVP (PDF-Only)

Target: Working internal copilot with 10 PDFs.

Timeline: ~7–10 focused days.

---

## Step 1 — Project Setup (Day 1)

### 1.1 Create App

* Next.js (App Router)
* Tailwind
* TypeScript
* Deploy to Vercel

Keep structure simple:

/app
/api
/lib
/components
/types

---

### 1.2 Set Up Supabase

Enable:

* Postgres
* pgvector extension
* Auth (Google SSO)

Create tables:

* pdf_documents
* content_chunks
* structured_facts
* email_queries

No over-modeling.

---

### 1.3 Claude Integration

Set up:

* Claude Sonnet model for reasoning
* Claude embeddings for chunk vectors

Create:

/lib/claude.ts

* generateEmbedding(text)
* generateResponse(context)

Keep wrapper minimal.

---

## Step 2 — PDF Ingestion Pipeline (Days 2–3)

Goal: Upload PDF → chunk → embed → store.

---

### 2.1 PDF Upload UI

Simple admin page:

* Upload file
* Enter version
* Enter optional “priority label” (e.g. Master Guide)

Store metadata in pdf_documents.

---

### 2.2 Text Extraction

Use:

* pdf-parse (Node)

Extract:

* Page number
* Raw text

---

### 2.3 Chunking Strategy

* 400–800 tokens
* Preserve page number
* Preserve section headings if detectable

Store:

content_chunks

* id
* source_id
* source_type = "pdf"
* page_number
* text
* embedding (vector)

Generate embedding per chunk via Claude.

Insert into pgvector.

---

### 2.4 Manual Structured Fact Entry

Build small internal UI:

* Select PDF
* Select category
* Enter key/value
* Attach page number
* Confidence dropdown

Keep it manual initially.

No auto extraction.
Trust > automation.

---

## Step 3 — Retrieval Layer (Day 4)

Goal: Email → retrieve relevant chunks.

---

### 3.1 Vector Search Function

Supabase RPC:

* Pass query embedding
* Return top 5 matches
* Include source metadata

---

### 3.2 Structured Fact Lookup

Given email content:

* Infer category via Claude
* Query structured_facts for matching category

OR

Simple approach:

* Always pull structured facts from relevant categories if keywords match.

Keep it simple first.

---

## Step 4 — Lightweight Conflict Engine (Day 5)

Goal: Detect contradictions across PDFs.

Logic:

1. Group retrieved chunks by semantic topic.
2. Extract candidate values using Claude.
3. Compare values.
4. If mismatch:

   * conflict_flag = true
   * lower confidence score

Confidence logic (simple):

High:

* Structured fact match
* No contradictions

Medium:

* Vector-only answer
* Minor variation

Low:

* Conflicting values
* No structured fact

Do not over-engineer.

---

## Step 5 — Claude Response Engine (Day 6)

API route:

/api/generate

Input:

* raw_email
* top_chunks
* structured_facts
* conflict_flag

System prompt includes:

* Accuracy > speed
* Never guess
* Cite sources
* Flag inconsistencies

Return formatted output:

--- INTERNAL SUMMARY ---
--- SUGGESTED REPLY ---
--- IF UNSURE ---

Store in email_queries.

---

## Step 6 — Review Dashboard (Day 7)

Main screen:

Left:

* Email input box

Right:

* Generated response
* Confidence badge
* Conflict indicator
* Citation list

Buttons:

* Approve
* Edit
* Escalate

On approve:

* Save approved_version
* Timestamp
* User ID

---

## MVP Definition of Done

* 10 PDFs ingested
* Structured fact table populated
* Email → verified response in < 30 seconds
* Conflict flags visible
* All outputs logged
* Human approval required

If this works reliably for 20 real emails, MVP is validated.

---

# Phase 2 — V1 (Live Web Ingestion)

Target: Unified knowledge graph across PDFs + Edge site.

Timeline: ~2–3 additional weeks (part-time).

---

## Step 7 — Scraper Integration

Choose:

* Firecrawl
  OR
* Simple custom crawler (fetch + cheerio)

Start manual:

* Enter URL
* Crawl site
* Extract text
* Preserve heading hierarchy

Store in:

web_documents
content_chunks (source_type = "web")

Embed same as PDFs.

Same vector index.

---

## Step 8 — Metadata Normalization

Store for web docs:

* url
* page_title
* last_updated (if detectable)
* ingestion_timestamp

Do not build full CMS sync.

Keep it lean.

---

## Step 9 — Cross-Source Conflict Logic

Enhance conflict engine:

When mismatch:

* Compare timestamps
* Surface both sources
* Prefer newer document
* Prefer structured fact

Never silently discard older source.

Always display comparison in INTERNAL SUMMARY.

---

## Step 10 — Re-Ingestion Controls

Admin panel:

* Re-crawl site
* Replace PDF version
* Mark document deprecated

Simple buttons.
No automation required at first.

---

# Team Rituals (Even as Solo Dev)

### Weekly

* Review top 10 logged questions
* Identify missing structured facts
* Update table

### Monthly (30 minutes)

Run 3-user test:

* Paste tricky emails
* Observe confusion
* Log top 3 UX friction points
* Fix those first

Clarity is compounding.

---

# Stretch Goals (Optional, Only If Time)

* Category auto-tagging
* Recurring question analytics
* “Confidence trend” dashboard
* Version diff viewer for PDFs

Only after V1 is stable.

---

# What Not To Do

* Don’t build microservices
* Don’t build background job infra prematurely
* Don’t auto-send emails
* Don’t build a public chatbot
* Don’t automate structured fact extraction yet

---

# Final Build Sequence (Compressed View)

Week 1:

* Setup
* PDF ingestion
* Vector search
* Response engine
* Review UI

Week 2:

* Conflict logic refinement
* Logging improvements
* Real-world testing

Week 3–5:

* Scraper
* Unified graph
* Cross-source conflict handling

---

This is realistic for a single focused developer using Cursor + Claude.

If this looks solid:

**Proceed to design-guidelines.md**

This will translate your emotional design philosophy into a concrete UI system for this internal cockpit.
