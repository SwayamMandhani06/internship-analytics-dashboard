import { google } from "googleapis";
import { JWT } from "google-auth-library";
import path from "path";
import fs from "fs";
import { BATCHES } from "../config/batches";
import { DIVISIONS, type Division } from "../config/divisions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SemesterInternship {
  internshipName: string;
  startDate: string;
  endDate: string;
  duration: string;
  creditsEarned: string;
}

export interface StudentRecord {
  division: string;
  prn: string;
  studentName: string;
  semesters: {
    fySem1: SemesterInternship;
    fySem2: SemesterInternship;
    sySem3: SemesterInternship;
    sySem4: SemesterInternship;
    tySem5: SemesterInternship;
    tySem6: SemesterInternship;
    btechSem7: SemesterInternship;
  };
  totalCreditsEarned: string;
  totalCreditsRemaining: string;
}

// ---------------------------------------------------------------------------
// Clock drift detection & correction
// ---------------------------------------------------------------------------
//
// Some dev containers have system clocks that drift significantly from real
// time. Google's OAuth2 token endpoint rejects JWTs whose iat/exp are more
// than a few minutes off. We detect drift by comparing our clock to Google's
// Date response header, then inject corrected timestamps into the JWT claims.
// ---------------------------------------------------------------------------

let clockOffsetMs: number | null = null;

async function detectClockOffset(): Promise<number> {
  if (clockOffsetMs !== null) return clockOffsetMs;

  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=ping", // intentionally invalid — we just need the Date header
    });
    const serverDate = new Date(resp.headers.get("date") || "");
    if (!isNaN(serverDate.getTime())) {
      clockOffsetMs = Date.now() - serverDate.getTime();
      const driftSec = Math.round(clockOffsetMs / 1000);
      if (Math.abs(driftSec) > 30) {
        console.warn(
          `[sheets] Detected clock drift of ${driftSec}s vs Google servers — will correct JWT timestamps`
        );
      }
    } else {
      clockOffsetMs = 0;
    }
  } catch {
    console.warn("[sheets] Could not detect clock offset — assuming 0");
    clockOffsetMs = 0;
  }

  return clockOffsetMs;
}

// ---------------------------------------------------------------------------
// Sheets API client (lazy-initialized singleton)
// ---------------------------------------------------------------------------

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const offset = await detectClockOffset();
  const absDrift = Math.abs(offset);

  // ---------------------------------------------------------------------------
  // Resolve credentials: prefer GOOGLE_SERVICE_ACCOUNT_KEY (inline JSON, prod)
  // then fall back to GOOGLE_SERVICE_ACCOUNT_KEY_PATH / local file (dev)
  // ---------------------------------------------------------------------------
  let parsedCred: { client_email: string; private_key: string } | null = null;

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    parsedCred = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  }

  // If drift is small (<30s), use the standard GoogleAuth path
  if (absDrift < 30_000) {
    const authOptions: Record<string, unknown> = {
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    };

    if (parsedCred) {
      authOptions.credentials = parsedCred;
    } else {
      authOptions.keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH
        ? path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH)
        : path.resolve(__dirname, "../../credentials/service-account.json");
    }

    const auth = new google.auth.GoogleAuth(authOptions as any);
    sheetsClient = google.sheets({ version: "v4", auth });
    return sheetsClient;
  }

  // Large drift: build a JWT client with corrected iat/exp
  const cred = parsedCred ?? JSON.parse(
    fs.readFileSync(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH
        ? path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH)
        : path.resolve(__dirname, "../../credentials/service-account.json"),
      "utf8"
    )
  );
  const correctedNow = Math.floor((Date.now() - offset) / 1000);

  const jwtClient = new JWT({
    email: cred.client_email,
    key: cred.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    additionalClaims: { iat: correctedNow, exp: correctedNow + 3600 },
  });

  sheetsClient = google.sheets({ version: "v4", auth: jwtClient as any });
  return sheetsClient;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: StudentRecord[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(batchId: string): StudentRecord[] | null {
  const entry = cache.get(batchId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(batchId);
    return null;
  }
  return entry.data;
}

function setCache(batchId: string, data: StudentRecord[]): void {
  cache.set(batchId, { data, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Row parsing
// ---------------------------------------------------------------------------

// Column layout (0-indexed from col A):
//   A=0 (Sr.No), B=1 (PRN), C=2 (Student Name)
//   D-H  = indices 3-7   = FY Sem I   (block 0)
//   I-M  = indices 8-12  = FY Sem II  (block 1)
//   N-R  = indices 13-17 = SY Sem III (block 2)
//   S-W  = indices 18-22 = SY Sem IV  (block 3)
//   X-AB = indices 23-27 = TY Sem V   (block 4)
//   AC-AG= indices 28-32 = TY Sem VI  (block 5)
//   AH-AL= indices 33-37 = B.Tech VII (block 6)
//   AM=38 (Total Credits Earned), AN=39 (Total Credits Remaining)

const PRN_COL = 1;
const NAME_COL = 2;
const SEMESTER_START_COL = 3;
const COLS_PER_SEMESTER = 5;
const SEMESTER_COUNT = 7;
const TOTAL_CREDITS_EARNED_COL = 38;
const TOTAL_CREDITS_REMAINING_COL = 39;

const SEMESTER_KEYS: (keyof StudentRecord["semesters"])[] = [
  "fySem1",
  "fySem2",
  "sySem3",
  "sySem4",
  "tySem5",
  "tySem6",
  "btechSem7",
];

function cell(row: unknown[], index: number): string {
  const val = row[index];
  if (val == null) return "";
  return String(val).trim();
}

function parseSemester(row: unknown[], blockIndex: number): SemesterInternship {
  const offset = SEMESTER_START_COL + blockIndex * COLS_PER_SEMESTER;
  return {
    internshipName: cell(row, offset),
    startDate: cell(row, offset + 1),
    endDate: cell(row, offset + 2),
    duration: cell(row, offset + 3),
    creditsEarned: cell(row, offset + 4),
  };
}

function parseRow(row: unknown[], division: string): StudentRecord | null {
  const prn = cell(row, PRN_COL);
  const studentName = cell(row, NAME_COL);

  // Skip empty rows (no PRN or no name)
  if (!prn && !studentName) return null;

  const semesters = {} as StudentRecord["semesters"];
  for (let i = 0; i < SEMESTER_COUNT; i++) {
    semesters[SEMESTER_KEYS[i]] = parseSemester(row, i);
  }

  return {
    division,
    prn,
    studentName,
    semesters,
    totalCreditsEarned: cell(row, TOTAL_CREDITS_EARNED_COL),
    totalCreditsRemaining: cell(row, TOTAL_CREDITS_REMAINING_COL),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchBatchData(
  batchId: string,
  refresh = false
): Promise<StudentRecord[]> {
  // Check cache first (unless refresh requested)
  if (!refresh) {
    const cached = getCached(batchId);
    if (cached) {
      console.log(`[sheets] Cache hit for batch "${batchId}"`);
      return cached;
    }
  }

  // Find batch config
  const batch = BATCHES.find((b) => b.id === batchId);
  if (!batch) {
    throw new Error(`Unknown batch ID: ${batchId}`);
  }

  console.log(`[sheets] Fetching batch "${batchId}" from Google Sheets...`);

  const sheets = await getSheetsClient();

  // Build ranges: one per division tab, quoted for safety (handles hyphens/spaces)
  const ranges = DIVISIONS.map(
    (div) => `'${div}'!A4:AN1000`
  );

  // Single batchGet call for all 4 tabs
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: batch.spreadsheetId,
    ranges,
  });

  const valueRanges = response.data.valueRanges ?? [];
  const allStudents: StudentRecord[] = [];

  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    const rows = valueRanges[i]?.values ?? [];
    let divCount = 0;

    for (const row of rows) {
      const record = parseRow(row, division);
      if (record) {
        allStudents.push(record);
        divCount++;
      }
    }

    console.log(`[sheets]   ${division}: ${divCount} students`);
  }

  console.log(`[sheets] Total: ${allStudents.length} students across ${DIVISIONS.length} divisions`);

  // Store in cache
  setCache(batchId, allStudents);

  return allStudents;
}

export function filterByDivision(
  students: StudentRecord[],
  division: string
): StudentRecord[] {
  return students.filter((s) => s.division === division);
}
