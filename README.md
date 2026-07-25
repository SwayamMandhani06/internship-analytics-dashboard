# Internship Analytics Dashboard

A full-stack analytics dashboard that reads student internship data from Google Sheets, enriches and audits credit calculations, and provides a persistent **Supabase-backed Faculty Review & Approval Workflow**. Features real-time KPI visualizations, student-level drill-downs, company & certification analytics, cross-semester split-internship auto-merging, inline review controls, bulk approval actions, and exportable Excel/PDF reports.

Built with **React 19 + TypeScript + Tailwind CSS** on the frontend and **Express + Google Sheets API + Supabase Postgres** on the backend.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture & Data Pipeline](#architecture--data-pipeline)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Google Service Account Setup](#google-service-account-setup)
  - [Supabase Setup](#supabase-setup)
  - [Installation & Local Running](#installation--local-running)
- [Environment Variables & Deployment](#environment-variables--deployment)
- [Pages & Functionality](#pages--functionality)
  - [Dashboard Overview](#1-dashboard-overview)
  - [Student Directory](#2-student-directory)
  - [Company & Certification Analytics](#3-company--certification-analytics)
  - [Credit Analytics & Audit](#4-credit-analytics--audit)
  - [Reports & Export Center](#5-reports--export-center)
  - [Settings & Batch Configuration](#6-settings--batch-configuration)
- [API Reference](#api-reference)
- [Credit Calculation & Review Policy](#credit-calculation--review-policy)
- [License](#license)

---

## Features

- **Google Sheets Live Sync** — Reads student internship data across 4 division tabs (`Div-A` .. `Div-D`) with a server-side 5-minute in-memory cache and clock-drift-corrected OAuth JWT auth.
- **Supabase Persistent Overrides Layer** — Faculty decisions (`approved`, `declined`, `pending`), custom credit overrides, classification changes, and split-merge decisions are stored in Supabase (`review_overrides`) and merged fresh on every request over the raw Google Sheets data.
- **Inline Faculty Review Workflow** — Embedded directly in the **Credits** and **Student Directory** pages with inline review panels, reason diagnostics, reclassification controls (`company` vs `certification`), and continuous split-internship handling.
- **Bulk Approval Actions** — One-click bulk approval/decline for visible flagged entries scoped strictly by batch and division, with confirmation dialogs.
- **Cross-Semester Split Internship Detection** — Automatically detects continuous internships spanning semester boundaries (e.g. TY Sem VI to B.Tech Sem VII), calculates combined dates/durations using `MAX(duration)`, and assigns credits once without double-counting. Faculty can explicitly confirm or reject merges (`reject_merge`).
- **Internship vs Certification Classifier** — Heuristic classification engine distinguishing corporate employer placements from training/course programs (`AICTE`, `NPTEL`, `Masterclass`, etc.), with faculty override support.
- **Reports & Export Center** — Client-side generation of Excel (`.xlsx`) and PDF reports for Student Lists, Credit Audit Summaries, and Company Participation. Exports automatically use the final post-override `totalCreditsCalculated`.
- **Data Quality Banners & Fallbacks** — Automatic top-level `overridesApplied: false` status signalling and UI warning banners when Supabase is temporarily unreachable.
- **Theme & Scope Filtering** — Full dark/light mode toggle with system preference auto-detection, global batch selection, and division-level filtering across all pages.

---

## Tech Stack

### Frontend
- **React 19** + **TypeScript 6** + **Vite 8**
- **Tailwind CSS 4** (utility-first styling with dark mode)
- **React Router DOM 7** (SPA routing)
- **Recharts 3** (interactive bar charts)
- **Axios** (shared client instance via `src/lib/api.ts`)
- **jsPDF + autoTable** & **xlsx (SheetJS)** (PDF/Excel generation)
- **Lucide React** (icons)

### Backend
- **Express 4** + **TypeScript 5**
- **@supabase/supabase-js** (Supabase Postgres client)
- **googleapis (v173)** & **google-auth-library** (Google Sheets API v4)
- **dotenv** (environment variables with CommonJS sync loading)
- **Vitest + Supertest** (unit and HTTP integration testing suite with 113+ tests)

---

## Architecture & Data Pipeline

```
                                  ┌────────────────────────────────┐
                                  │      Google Sheets (Read-Only)  │
                                  │  (Raw student records A..D)    │
                                  └───────────────┬────────────────┘
                                                  │ batchGet
                                                  ▼
┌───────────────────────┐         ┌────────────────────────────────┐
│   Supabase Postgres   │         │     Sheets Service (Cache)     │
│   (review_overrides)  │         └───────────────┬────────────────┘
└───────────┬───────────┘                         │
            │ fetch fresh                         ▼
            │ (never cached)      ┌────────────────────────────────┐
            └────────────────────►│   Student Enrichment Pipeline  │
                                  │  - Date & Duration Parsers     │
                                  │  - Split-Internship Auto-Merge │
                                  │  - Classification Engine       │
                                  │  - Credit Rules Engine         │
                                  │  - Apply Supabase Overrides    │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │    Express REST API (/api/*)   │
                                  └───────────────┬────────────────┘
                                                  │ JSON
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │     React Frontend (Vite)      │
                                  │  Dashboard / Credits / Directory│
                                  │  Reports (PDF/Excel) / Settings│
                                  └────────────────────────────────┘
```

---

## Environment Variables & Deployment

### Backend `.env` Configuration (`backend/.env`)

| Variable | Type | Description | Example / Default |
|---|---|---|---|
| `PORT` | number | Backend server port | `3001` |
| `FRONTEND_ORIGIN` | string | Allowed CORS origin | `http://localhost:5173` |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | string | Local path to Google service account key file (Development) | `./credentials/service-account.json` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | string | Minified JSON key string (Production / Render) | `{"type":"service_account",...}` |
| `SUPABASE_URL` | string | Supabase project URL | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | string | Supabase Service Role secret key | `your-service-role-key` |

### Cloud Deployment (e.g. Render / Railway / Vercel)
When deploying the backend to Render or similar cloud hosts, ensure all **3 production secrets** are added in the environment configuration:
1. `GOOGLE_SERVICE_ACCOUNT_KEY` — full single-line minified service account JSON.
2. `SUPABASE_URL` — your Supabase project HTTPS endpoint.
3. `SUPABASE_SERVICE_ROLE_KEY` — your Supabase service role API key.

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9
- Google Cloud Service Account with Google Sheets API enabled & Viewer access to spreadsheet tabs
- Supabase Postgres instance with table `review_overrides`

### Supabase Setup
Create the `review_overrides` table in Supabase Table Editor:
```sql
CREATE TABLE public.review_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL,
  division text NOT NULL,
  prn text NOT NULL,
  semester_label text NOT NULL,
  sibling_semester_label text,
  internship_name_snapshot text,
  decision text CHECK (decision IN ('approved', 'declined', 'pending')),
  classification text CHECK (classification IN ('company', 'certification')),
  merge_decision text CHECK (merge_decision IN ('confirm_merge', 'reject_merge')),
  override_credits numeric,
  reviewed_by text,
  note text,
  reviewed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT review_overrides_unique UNIQUE (batch_id, division, prn, semester_label)
);
```

### Installation & Local Running

```bash
# Clone repository and install dependencies
git clone https://github.com/SwayamMandhani06/internship-analytics-dashboard.git
cd internship-analytics-dashboard
npm install

# Start both backend (3001) and frontend (5173) concurrently
npm run dev

# Run unit & integration test suite
cd backend
npm test
```

---

## Pages & Functionality

### 1. Dashboard Overview
- High-level KPIs: Total Students, Participation %, Companies Count, Total Post-Override Credits, Averages, and Data Quality Review Flags.
- Per-division comparison breakdown cards across `Div-A` through `Div-D`.
- Offline warning banner when Supabase override sync is unavailable.

### 2. Student Directory
- Dense, searchable student listing with multi-internship breakdown across 7 semesters (`FY Sem I` through `B.Tech Sem VII`).
- **Merged Badge**: Highlights cross-semester split internships with tooltips identifying paired sibling semesters.
- **Inline Faculty Review**: Actions column with inline `<ReviewPanel />` to approve, decline, or reclassify entries.

### 3. Company & Certification Analytics
- Interactive Recharts bar chart showing company rankings with Top 15 / All toggle.
- Automatically groups and classifies companies vs certifications based on keywords and faculty overrides.
- Flags inconsistently classified company names across student entries.

### 4. Credit Analytics & Audit
- Credit bucket distribution histogram.
- Audit table identifying discrepancies between post-override calculated credits and sheet-reported values.
- **"Needs Review Only" Toggle**: Filter table to flagged unreviewed entries.
- **Bulk Actions Bar**: One-click bulk approval (`Approve All Visible`) or rejection (`Decline All Visible`) scoped strictly to the active batch/division view.
- Expandable student rows with per-internship review controls.

### 5. Reports & Export Center
- Downloads styled **Excel (`.xlsx`)** and **PDF** documents for:
  1. *Student List Report* (entry-level detail)
  2. *Credit Summary Report* (student-wise audit totals using post-override credits)
  3. *Company Participation Report* (company breakdown per division)

### 6. Settings & Batch Configuration
- Cache management with manual force-sync trigger (bypasses 5-min cache).
- Batch registry status table and data quality health diagnostics.

---

## API Reference

### Health & Config
- `GET /api/health` — Backend server health status.
- `GET /api/config/batches` — List of configured academic batches.

### Student & Analytics Data
- `GET /api/students?batch=X&division=Y&refresh=true` — Enriched student records with semester details & override states.
- `GET /api/analytics/overview?batch=X` — Overview KPIs & review breakdown.
- `GET /api/analytics/companies?batch=X` — Company rankings & classification statistics.
- `GET /api/analytics/credits?batch=X` — Credit audit data & student listing with internships.

### Faculty Reviews (Supabase Overrides)
- `GET /api/reviews?batch=X&division=Y` — Fetch active review overrides.
- `POST /api/reviews` — Upsert a single review override (`decision`, `classification`, `mergeDecision`, `overrideCredits`, `reviewedBy`, `note`).
- `POST /api/reviews/bulk` — Apply bulk approval/decline to visible flagged entries in scope.
- `DELETE /api/reviews/:batchId/:division/:prn/:semesterLabel` — Reset a review decision back to pending.

---

## Credit Calculation & Review Policy

- **Standard Credit Policy**:
  - `< 1 month` → 0 Credits
  - `1 – < 2 months` → 1 Credit
  - `2 – < 4 months` → 2 Credits
  - `4 – < 6 months` → 3 Credits
  - `≥ 6 months` → 4 Credits
- **Certification Entries** (`hours-based` or `certification` classification) → Requires manual review / `null` auto-credits.
- **Declined Entries** → Forced to `0` credits and excluded from total credit summation.
- **Split Internships** → Continuous cross-semester internships default to single crediting (`MAX(duration)`). Faculty can set `reject_merge` to restore independent per-semester crediting to both halves.

---

## License

Private academic project. Developed for internal department analytics and auditing.
