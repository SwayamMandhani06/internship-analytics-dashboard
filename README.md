# Internship Analytics Dashboard

A full-stack analytics dashboard that reads student internship data from Google Sheets and provides real-time KPI visualizations, student-level drill-downs, company rankings, credit auditing, and exportable reports. Built with **React + TypeScript** on the frontend and **Express + Google Sheets API** on the backend.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Google Service Account Setup](#google-service-account-setup)
  - [Installation](#installation)
  - [Running in Development](#running-in-development)
- [Environment Variables](#environment-variables)
- [Pages & Functionality](#pages--functionality)
  - [Dashboard Overview](#1-dashboard-overview)
  - [Student Directory](#2-student-directory)
  - [Company & Certification Analytics](#3-company--certification-analytics)
  - [Credit Analytics & Audit](#4-credit-analytics--audit)
  - [Reports & Export Center](#5-reports--export-center)
  - [Settings & Batch Configuration](#6-settings--batch-configuration)
- [API Reference](#api-reference)
- [Credit Calculation Rules](#credit-calculation-rules)
- [Data Pipeline](#data-pipeline)
- [License](#license)

---

## Features

- **Real-time Google Sheets Integration** — Fetches live student internship data from Google Sheets via a service account with server-side caching (5-minute TTL)
- **Dashboard KPIs** — At-a-glance metrics: total students, internship participation, unique companies, credit totals, averages, and data quality flags
- **Division Comparison** — Side-by-side breakdown of all 4 divisions (Div-A through Div-D) with progress bars and per-division credit averages
- **Student Directory** — Searchable, sortable, paginated data table with expandable rows showing per-student internship details across 7 semesters
- **Company Rankings** — Interactive horizontal bar chart (Recharts) and ranked data table of companies by student participation with division breakdown
- **Credit Auditing** — Automated credit calculation from internship duration, credit distribution charts, and discrepancy detection between calculated and sheet-reported values
- **Reports & Export** — One-click generation of 3 report types (Student List, Credit Summary, Company Participation) in both Excel (`.xlsx`) and PDF formats
- **Data Quality Tracking** — Automatic flagging of entries needing manual review (unparseable durations, dates, certification-style entries)
- **Dark Mode** — Full dark/light theme toggle with system preference detection and `localStorage` persistence
- **Batch Filtering** — Global batch selector (e.g., 2023–2027, 2024–2028) with division-level filtering across all pages
- **Responsive Design** — Mobile-friendly layout with collapsible sidebar navigation
- **Clock Drift Correction** — Automatic detection and correction of system clock drift for Google OAuth JWT authentication

---

## Tech Stack

### Frontend

| Technology           | Purpose                          |
| -------------------- | -------------------------------- |
| React 19             | UI framework                     |
| TypeScript 6         | Type safety                      |
| Vite 8               | Build tool & dev server          |
| Tailwind CSS 4       | Utility-first styling            |
| React Router DOM 7   | Client-side routing              |
| Recharts 3           | Data visualization (bar charts)  |
| Axios                | HTTP client for API requests     |
| Lucide React         | Icon library                     |
| date-fns             | Date formatting utilities        |
| jsPDF + autoTable    | Client-side PDF report generation|
| xlsx (SheetJS)       | Client-side Excel export         |
| clsx                 | Conditional CSS class merging    |

### Backend

| Technology           | Purpose                              |
| -------------------- | ------------------------------------ |
| Express 4            | REST API server                      |
| TypeScript 5         | Type safety                          |
| Google APIs (v173)   | Google Sheets API v4 integration     |
| google-auth-library  | JWT/Service Account authentication   |
| CORS                 | Cross-origin resource sharing        |
| dotenv               | Environment variable management      |
| Vitest               | Unit testing framework               |
| Supertest            | HTTP assertion testing               |
| ts-node-dev          | TypeScript dev server with hot reload|

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (React SPA)               │
│  ┌───────────┬────────────┬──────────┬───────────┐  │
│  │ Dashboard │  Students  │Companies │  Credits  │  │
│  │  Reports  │  Settings  │          │           │  │
│  └─────┬─────┴─────┬──────┴────┬─────┴─────┬─────┘  │
│        │  Axios    │           │           │         │
│        └───────────┴─────┬─────┴───────────┘         │
└──────────────────────────┼───────────────────────────┘
                           │ /api/*
                           ▼
┌──────────────────────────────────────────────────────┐
│              Express Backend (Port 3001)             │
│  ┌──────────┬──────────┬───────────┬──────────────┐  │
│  │ /health  │/students │/analytics │  /config     │  │
│  └──────────┴────┬─────┴─────┬─────┴──────────────┘  │
│                  │           │                        │
│          ┌───────┴───────────┴───────┐                │
│          │  Student Enrichment Svc   │                │
│          │  ├─ Date Parser           │                │
│          │  ├─ Duration Parser       │                │
│          │  ├─ Status Calculator     │                │
│          │  └─ Credit Rules Engine   │                │
│          └───────────┬───────────────┘                │
│                      │                                │
│          ┌───────────┴───────────────┐                │
│          │   Sheets Service          │                │
│          │   (Cache: 5min TTL)       │                │
│          └───────────┬───────────────┘                │
└──────────────────────┼───────────────────────────────┘
                       │ Google Sheets API v4
                       ▼
              ┌─────────────────┐
              │  Google Sheets  │
              │  (Spreadsheet)  │
              └─────────────────┘
```

---

## Project Structure

```
internship-analytics-dashboard/
├── package.json                 # Monorepo root (npm workspaces)
├── backend/
│   ├── package.json
│   ├── .env                     # Environment variables
│   ├── tsconfig.json
│   ├── credentials/
│   │   └── service-account.json # Google service account key (gitignored)
│   └── src/
│       ├── index.ts             # Express app entry point
│       ├── integrationTest.ts   # End-to-end integration tests
│       ├── config/
│       │   ├── batches.ts       # Batch → Spreadsheet ID mapping
│       │   └── divisions.ts     # Division constants (Div-A..D)
│       ├── routes/
│       │   ├── index.ts         # Route registration
│       │   ├── health.ts        # GET /api/health
│       │   ├── students.ts      # GET /api/students
│       │   ├── analytics.ts     # GET /api/analytics/*
│       │   ├── config.ts        # GET /api/config/batches
│       │   └── __tests__/       # Route-level tests
│       ├── services/
│       │   ├── sheetsService.ts          # Google Sheets API client + cache
│       │   ├── studentEnrichmentService.ts # Raw → enriched data transform
│       │   ├── statusCalculator.ts       # Internship status derivation
│       │   ├── creditRules.ts            # Credit calculation policy
│       │   └── __tests__/                # Service-level tests
│       └── utils/
│           ├── dateParser.ts     # Multi-format date parsing
│           ├── durationParser.ts # Duration string → months conversion
│           └── __tests__/        # Utility tests
│
└── frontend/
    ├── package.json
    ├── vite.config.ts            # Vite config + API proxy
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx              # React entry point
        ├── App.tsx               # Route definitions
        ├── index.css             # Global styles + Tailwind
        ├── context/
        │   ├── FilterContext.tsx  # Global batch/division filter state
        │   └── ThemeContext.tsx   # Dark/light mode state
        ├── layouts/
        │   └── AppLayout.tsx     # Sidebar + topbar shell layout
        ├── components/
        │   ├── DataTable.tsx     # Reusable sortable/searchable/paginated table
        │   ├── KPICard.tsx       # Metric display card component
        │   ├── Sidebar.tsx       # Navigation sidebar
        │   └── Topbar.tsx        # Top bar with batch selector & theme toggle
        └── pages/
            ├── DashboardPage.tsx  # KPI overview + division comparison
            ├── StudentsPage.tsx   # Student directory with expandable rows
            ├── CompaniesPage.tsx  # Company bar chart + ranking table
            ├── CreditsPage.tsx    # Credit distribution + audit table
            ├── ReportsPage.tsx    # Export center (Excel + PDF)
            └── SettingsPage.tsx   # Batch config, cache refresh, data health
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A **Google Cloud** project with the Google Sheets API enabled
- A **Google service account** with read access to the target spreadsheet(s)

### Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Enable the **Google Sheets API** under APIs & Services.
3. Create a **Service Account** under IAM & Admin → Service Accounts.
4. Download the JSON key file for the service account.
5. Place the key file at `backend/credentials/service-account.json`.
6. Share your Google Sheets spreadsheet with the service account's email address (with **Viewer** access).

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd internship-analytics-dashboard

# Install all dependencies (root + backend + frontend via workspaces)
npm install
```

### Running in Development

```bash
# Start both backend and frontend concurrently
npm run dev

# Or start them individually:
npm run dev:backend    # Express server → http://localhost:3001
npm run dev:frontend   # Vite dev server → http://localhost:5173
```

The Vite dev server proxies all `/api/*` requests to the Express backend on port 3001.

### Running Tests

```bash
# Run backend unit tests
cd backend
npm test
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

| Variable                           | Default                                     | Description                                    |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `PORT`                             | `3001`                                      | Backend server port                            |
| `FRONTEND_ORIGIN`                  | `http://localhost:5173`                      | Allowed CORS origin for the frontend           |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`  | `./credentials/service-account.json`         | Path to the Google service account JSON key    |

---

## Pages & Functionality

### 1. Dashboard Overview

The main landing page displaying high-level KPI cards:

| KPI                              | Description                                            |
| -------------------------------- | ------------------------------------------------------ |
| Total Students                   | Count of all students in the selected batch/division   |
| Students With Internship         | Students with at least one internship entry            |
| Students Without Internship      | Students with zero internship entries                  |
| Total Unique Companies           | Distinct company names (case-insensitive)              |
| Total Credits Calculated         | Sum of all auto-calculated credits                     |
| Average Credits per Student      | Mean calculated credits per student                    |
| Total Internship Entries         | Total number of individual internship records          |
| Entries Needing Review           | Entries flagged for manual review (expandable breakdown)|

When viewing "All Divisions", a **Division Comparison Breakdown** section shows per-division cards with student counts, average credits, and progress bars.

### 2. Student Directory

A dense, wide-format data table with:

- **Columns**: Student Name, PRN, Division, Internship Count, Total Credits, Data Quality
- **Search**: Filter by student name or PRN
- **Filters**: Company, Semester (FY Sem I through B.Tech Sem VII), Review status
- **Expandable Rows**: Click any row to reveal a nested sub-table showing all internship entries with semester, company, duration, dates, status badges (Completed / Ongoing / Needs Review), and calculated credits
- **Sorting**: Click column headers to sort ascending/descending
- **Pagination**: 20 rows per page with navigation

### 3. Company & Certification Analytics

- **Horizontal Bar Chart**: Interactive Recharts visualization showing student count per company/program, with a toggle to show Top 15 or all entries
- **Custom Tooltips**: Hover to see student count, internship count, and per-division breakdown
- **Company Rankings Table**: Full ranked list with columns for Rank, Company Name, Students, Internships, and Division Breakdown (A/B/C/D)
- **Data Quality Note**: Infobox explaining that company names are shown as-entered from the source sheet

### 4. Credit Analytics & Audit

- **KPI Cards**: Total Credits Calculated, Average Credits per Student, Review-Related Credit Entries (with expandable reason breakdown)
- **Credit Distribution Bar Chart**: Histogram showing how many students fall into each credit bucket
- **Student Credit Audit Table**: Searchable table with columns for Student Name, PRN, Division, Internships, Calculated Credits, Sheet Reported Credits, and Discrepancy flag
- **Discrepancy Filter**: Checkbox to show only students where calculated credits differ from the sheet-reported value

### 5. Reports & Export Center

Three downloadable report types, each available in both **Excel** and **PDF** formats:

| Report               | Format         | Description                                                    |
| -------------------- | -------------- | -------------------------------------------------------------- |
| Student List Report  | One row per internship | Name, PRN, Division, Semester, Company, Duration, Dates, Status, Credits |
| Credit Summary Report| One row per student    | Name, PRN, Division, Internship Count, Calculated Credits, Sheet Reported, Discrepancy |
| Company Report       | One row per company    | Company Name, Student Count, Internship Count, Div-A/B/C/D breakdown |

All reports respect the currently selected batch and division filters. PDF reports include styled headers with batch/division metadata and generation timestamps.

### 6. Settings & Batch Configuration

- **Live Data Sync**: Manual cache-busting button to force a fresh Google Sheets API fetch (bypasses the 5-minute cache)
- **Configured Batches Table**: Read-only registry showing all batch entries (e.g., 2023–2027) and their configuration status
- **Data Quality & Health Reference**: Summary of entries needing review for the selected batch, with an expandable breakdown by reason category (unparseable duration, certification-style, unparseable dates)

---

## API Reference

All endpoints are prefixed with `/api`.

### Health

| Method | Endpoint        | Description          |
| ------ | --------------- | -------------------- |
| GET    | `/api/health`   | Server health check  |

### Students

| Method | Endpoint         | Query Params                         | Description                                    |
| ------ | ---------------- | ------------------------------------ | ---------------------------------------------- |
| GET    | `/api/students`  | `batch` (required), `division`, `refresh` | Returns enriched student data with internship details |

### Analytics

| Method | Endpoint                   | Query Params                         | Description                                              |
| ------ | -------------------------- | ------------------------------------ | -------------------------------------------------------- |
| GET    | `/api/analytics/overview`  | `batch` (required), `division`, `refresh` | Dashboard KPIs, review breakdown, division comparison    |
| GET    | `/api/analytics/companies` | `batch` (required), `division`, `refresh` | Company participation data sorted by student count       |
| GET    | `/api/analytics/credits`   | `batch` (required), `division`, `refresh` | Credit distribution, student audit list, review summary  |

### Configuration

| Method | Endpoint             | Description                              |
| ------ | -------------------- | ---------------------------------------- |
| GET    | `/api/config/batches`| Returns list of all configured batches   |

### Query Parameters

| Parameter  | Type   | Required | Description                                           |
| ---------- | ------ | -------- | ----------------------------------------------------- |
| `batch`    | string | Yes      | Batch identifier (e.g., `2023-2027`)                  |
| `division` | string | No       | Division filter (e.g., `Div-A`, `Div-B`, `Div-C`, `Div-D`) |
| `refresh`  | string | No       | Set to `"true"` to bypass the server-side cache       |

---

## Credit Calculation Rules

Credits are automatically calculated based on internship duration using the following department policy:

| Duration (months) | Credits Awarded |
| ------------------ | --------------- |
| < 1                | 0               |
| 1 – < 2            | 1               |
| 2 – < 4            | 2               |
| 4 – < 6            | 3               |
| ≥ 6                | 4               |

**Special cases:**
- **Certification-style entries** (hours-based courses, not month-based placements) → `null` (requires manual review)
- **Unparseable durations** → `null` (flagged for review)
- **Zero or negative durations** → `null` (flagged for review)

The credit rules are defined as a single source of truth in [`creditRules.ts`](backend/src/services/creditRules.ts).

---

## Data Pipeline

1. **Fetch** — The Sheets Service authenticates via a Google service account and uses `batchGet` to pull data from all 4 division tabs (Div-A through Div-D) in a single API call
2. **Parse** — Raw spreadsheet rows are mapped to `StudentRecord` objects with 7 semester blocks (FY Sem I through B.Tech Sem VII), each containing internship name, dates, duration, and credits
3. **Enrich** — The Student Enrichment Service processes each student record:
   - Parses multi-format date strings (DD/MM/YYYY, MM-DD-YYYY, "Jan 2024", etc.)
   - Converts freeform duration strings to months (e.g., "2 months", "45 days", "120 hours")
   - Detects certification-style entries
   - Calculates internship status (Completed / Ongoing / Not Started)
   - Applies credit rules to derive per-internship credit values
   - Flags entries needing manual review with specific reason codes
4. **Cache** — Processed results are cached server-side with a 5-minute TTL to reduce API quota consumption
5. **Serve** — REST endpoints aggregate and filter the enriched data for the frontend

---

## License

This project is private and intended for internal academic department use.
