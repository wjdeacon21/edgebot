# app-flow-pages-and-roles.md

## Site Map (Top-Level Pages Only)

1. **Login**
2. **Dashboard**
3. **Email Review**
4. **Sources**
5. **Structured Facts**
6. **Logs**
7. **Admin**

Lean. No unnecessary navigation.

---

## Purpose of Each Page

### 1. Login

Authenticate via Google SSO.
Restrict to internal Edge City team only.

---

### 2. Dashboard

High-level system overview.

Shows:

* Total PDFs ingested
* Total web sources (V1)
* # of structured facts
* Recent queries
* Conflict rate (last 7 days)

Purpose:
Quick operational pulse check.

---

### 3. Email Review (Primary Workspace)

Core interface.

Left panel:

* Paste participant email
* Generate response button

Right panel:

* INTERNAL SUMMARY
* Confidence badge
* Conflict flag (if present)
* Source citations
* Suggested reply (editable)

Actions:

* Approve
* Edit
* Escalate
* Regenerate

This is where 90% of time is spent.

---

### 4. Sources

View all ingested content.

Tabs:

* PDFs (MVP)
* Web (V1)

Each item shows:

* Name / URL
* Version
* Last updated
* Ingestion date
* Status (Active / Deprecated)

Actions:

* Re-upload PDF
* Re-crawl webpage (V1)
* Mark deprecated

Purpose:
Maintain trust in knowledge base.

---

### 5. Structured Facts

Deterministic truth layer.

Table view:

Columns:

* Category
* Key
* Value
* Source
* Page / URL
* Confidence
* Last verified

Actions:

* Add new fact
* Edit
* Deprecate
* Filter by category

Purpose:
Prevent hallucinations.
Quickly resolve ambiguity.

---

### 6. Logs

Historical memory.

Each entry:

* Email (raw)
* Generated answer
* Approved version
* Confidence score
* Conflict flag
* Sources used
* Approved by
* Timestamp

Filters:

* By category
* By confidence
* By conflict
* By date range

Purpose:
Institutional memory + QA surface.

---

### 7. Admin

Restricted access.

Controls:

* Manage user roles
* Adjust conflict weighting logic (basic parameters)
* Trigger full re-embedding (advanced)
* View system health (API errors, embedding failures)

Keep minimal.

---

# User Roles & Access Levels

## 1. Ops Reviewer (Default Role)

Can:

* Generate responses
* Approve / edit
* View sources
* View structured facts
* View logs

Cannot:

* Delete sources
* Change system parameters
* Manage users

---

## 2. Admin

Can:

* Upload / replace PDFs
* Trigger web re-crawl (V1)
* Edit structured facts
* Deprecate documents
* Adjust conflict settings
* Manage users

Small group only.

---

# Primary User Journeys (Max 3 Steps Each)

## Journey 1 — Answer Participant Email

1. Paste email into Email Review.
2. Click Generate.
3. Review → Approve (or Edit).

Time target: < 3 minutes.

---

## Journey 2 — Resolve Conflict

1. See conflict flag in summary.
2. Compare cited sources.
3. Escalate or update structured fact.

System never hides disagreement.

---

## Journey 3 — Update Source of Truth

1. Go to Sources.
2. Re-upload PDF or re-crawl webpage.
3. Confirm ingestion complete.

Knowledge graph refreshes.

---

## Journey 4 — Add Missing Policy

1. Go to Structured Facts.
2. Add category + key + value.
3. Attach source reference.

Future answers improve automatically.

---

# Flow Summary (Big Picture)

Email arrives
→ Paste into tool
→ Claude retrieves + checks conflicts
→ System generates verified draft
→ Human approves
→ Logged permanently

Calm loop.
No auto-send.
No silent assumptions.
Institutional clarity compounding over time.