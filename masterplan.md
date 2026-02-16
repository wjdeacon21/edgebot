
# masterplan.md

## 30-Second Elevator Pitch

Edge City Ops AI is a browser-based internal copilot that turns PDFs and live Edge webpages into a unified knowledge graph. It delivers citation-backed answers, flags inconsistencies across sources, and requires human approval before any reply is sent.

It replaces scattered documents with a calm, reliable operations engine.

---

## Problem & Mission

### Problem

* Critical information is split across PDFs and evolving webpages.
* Details sometimes conflict.
* Each email requires manual verification.
* Institutional knowledge lives in people’s heads.

### Mission

Build a browser-based internal system that:

* Merges PDFs and live site content into one knowledge graph
* Detects inconsistencies automatically
* Cites every answer
* Never guesses
* Logs every approved response

Accuracy > speed.
Trust > automation.

---

# Architecture Overview

Four layers:

1. Ingestion
2. Unified Knowledge Graph
3. Claude-Powered Response Engine
4. Human Review + Logging

Built by one developer. No unnecessary abstraction.

---

# PHASE 1 — MVP (PDF-Only)

Contained system. 10 PDFs.

## 1. Ingestion (MVP)

Source:

* 10 curated PDFs (manual upload)

Pipeline:

* Extract text
* Chunk (400–800 tokens)
* Store:

  * document_name
  * version
  * page_number
  * section_heading
  * uploaded_at
* Generate embeddings (Claude embeddings)
* Store in pgvector (Supabase Postgres)

No scraper yet.
No background jobs.
Manual re-upload for updates.

---

## 2. Structured Fact Table (MVP)

Critical deterministic fields stored manually.

Schema:

StructuredFact

* category
* key
* value
* source_document
* page_number
* confidence
* last_verified

Categories:

* Arrival & Departure
* Ticket inclusions
* Accommodation
* Refund policy
* WiFi & coworking
* Programming structure
* Attendance flexibility

Rule:
If structured fact exists → it overrides raw chunk ambiguity.

Prevents hallucination.

---

## 3. Lightweight Conflict Detection (PDF Scope)

When answering:

1. Retrieve top 3–5 chunks.
2. Retrieve matching structured facts.
3. Compare values across documents.
4. If mismatch:

   * Flag conflict
   * Lower confidence
   * Surface both sources

Selection logic:

* Prefer most recent document version.
* Prefer explicitly labeled “Master Guide” if present.

If unresolved → recommend clarification before reply.

---

## 4. Claude Response Engine

Model:

* Claude Sonnet-class reasoning model

System rules:

* Accuracy over speed
* Never fabricate
* Cite sources
* Flag inconsistencies
* If unsure → say so clearly

Output format:

--- INTERNAL SUMMARY ---
Answer
Sources (Document + Page)
Confidence (High / Medium / Low)
Conflicts

--- SUGGESTED REPLY ---

* Direct first paragraph
* Calm
* Thoughtful
* No emojis
* No speculation

--- IF UNSURE ---
Clarifying questions

---

## 5. Human Review Layer

Browser-based dashboard.

Workflow:

1. Paste participant email.
2. Generate answer.
3. Review:

   * Confidence badge
   * Conflict flag
   * Source citations
4. Approve / Edit / Escalate.

No auto-send.

All actions logged.

---

# PHASE 2 — V1 (Live Web Ingestion)

System evolves from static to living knowledge graph.

---

## Expanded Ingestion

Add:

* Edge live webpages
* FAQ pages
* Event blog posts

Tool:

* Lightweight scraper (invoked manually or scheduled)

Metadata stored:

SourceDocument

* id
* type (PDF | Web | Blog | FAQ)
* url (if web)
* version (if PDF)
* last_updated
* ingestion_timestamp

All content embedded into same vector index.

Unified retrieval layer.

---

## Unified Knowledge Graph

All content treated equally at query time.

Conflict logic uses:

* last_updated timestamp
* source type metadata
* structured fact overrides

Single retrieval pipeline.
Single embedding index.
No separate silos.

---

## Enhanced Conflict Detection (V1)

When retrieving:

1. Pull top 5 matches across all sources.
2. Group by semantic key (e.g., arrival date).
3. Compare values.
4. If disagreement:

   * Surface both sources.
   * Indicate most recent.
   * Lower confidence.

System never silently chooses between conflicting values.

---

# Technical Stack

Frontend:

* Next.js (App Router)
* Tailwind (minimal UI)
* Deployed on Vercel

Backend:

* Supabase (Postgres + pgvector)
* Simple API routes

AI:

* Claude API (Sonnet-class reasoning)
* Claude embeddings

Auth:

* Supabase Auth (Google SSO)

Scraping (V1):

* Simple crawler (Firecrawl or custom fetch + parse)

No microservices.
No queues initially.
Keep it understandable.

---

# Data Model (Simple + Evolvable)

PDFDocument

* id
* name
* version
* uploaded_at

WebDocument (V1)

* id
* url
* title
* last_updated
* ingested_at

ContentChunk

* id
* source_id
* source_type
* embedding
* text
* page_or_section

StructuredFact

* id
* category
* key
* value
* source_id
* confidence
* last_verified

EmailQuery

* id
* raw_email
* internal_summary
* suggested_reply
* confidence_score
* conflict_flag
* approved_version
* approved_by
* timestamp

---

# UI Design Principles

Grounded in your design philosophy:

Technology should feel kind.

Internal interface should feel:

* Calm
* Focused
* Quietly intelligent
* Non-corporate

Design rules:

* Minimal chrome
* Clear hierarchy
* Short text blocks
* Amber conflict indicator
* Subtle confidence badge
* Zero decorative noise

Feels like:
A mission control console for truth.

---

# Risks & Mitigations

Risk: Model overconfidence
Mitigation:

* Structured fact override
* Explicit uncertainty language
* Mandatory citations
* Visible confidence score

Risk: Source drift (V1)
Mitigation:

* Timestamp weighting
* Re-ingestion button
* Conflict surfacing

Risk: Solo-dev overbuilding
Mitigation:

* Phase separation
* MVP must ship before scraper

---

# Why This Is the Right Build

MVP:

* Proves accuracy
* Proves time savings
* Keeps scope controlled

V1:

* Turns system into living institutional memory
* Eliminates manual syncing between PDFs and site
* Maintains trust through conflict transparency

This is infrastructure thinking.
But built lean.

---

