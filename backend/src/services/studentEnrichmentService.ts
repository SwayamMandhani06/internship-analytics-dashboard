import {
  fetchBatchData,
  filterByDivision,
  type StudentRecord,
  type SemesterInternship,
} from "./sheetsService";
import { parseDurationToMonths, type DurationResult } from "../utils/durationParser";
import { parseFlexibleDate } from "../utils/dateParser";
import { calculateStatus, type InternshipStatus } from "./statusCalculator";
import { calculateCredits } from "./creditRules";

// ---------------------------------------------------------------------------
// Types for enriched response
// ---------------------------------------------------------------------------

export interface EnrichedInternship {
  semesterLabel: string;
  company: string;
  startDateRaw: string;
  endDateRaw: string;
  startDate: string | null;     // ISO string or null
  endDate: string | null;       // ISO string or null
  durationRaw: string;
  durationMonths: number | null;
  isCertificationStyle: boolean;
  status: InternshipStatus;
  creditsCalculated: number | null;
  needsReview: boolean;
  reviewReasons: string[];
}

export interface EnrichedStudent {
  prn: string;
  name: string;
  division: string;
  internships: EnrichedInternship[];
  totalCreditsCalculated: number;
  sheetReportedTotalCredits: string;
  sheetReportedRemainingCredits: string;
}

// ---------------------------------------------------------------------------
// Semester labels (human-readable for logging and API output)
// ---------------------------------------------------------------------------

const SEMESTER_LABELS: Record<keyof StudentRecord["semesters"], string> = {
  fySem1: "FY Sem I",
  fySem2: "FY Sem II",
  sySem3: "SY Sem III",
  sySem4: "SY Sem IV",
  tySem5: "TY Sem V",
  tySem6: "TY Sem VI",
  btechSem7: "B.Tech Sem VII",
};

const SEMESTER_KEYS = Object.keys(SEMESTER_LABELS) as (keyof StudentRecord["semesters"])[];

// ---------------------------------------------------------------------------
// Enrichment pipeline
// ---------------------------------------------------------------------------

export function enrichInternship(
  sem: SemesterInternship,
  semesterLabel: string,
  prn: string,
  today: Date
): EnrichedInternship | null {
  // Skip completely empty semester slots (no internship entered)
  if (
    !sem.internshipName &&
    !sem.startDate &&
    !sem.endDate &&
    !sem.duration
  ) {
    return null;
  }

  const context = { prn, semesterLabel };
  const reviewReasons: string[] = [];

  // --- Parse duration ---
  const durationResult: DurationResult | null = sem.duration
    ? parseDurationToMonths(sem.duration, context)
    : null;

  const durationMonths = durationResult?.months ?? null;
  const isCertificationStyle = durationResult?.isCertificationStyle ?? false;

  if (sem.duration && !durationResult) {
    reviewReasons.push("unparseable_duration");
  }
  if (isCertificationStyle) {
    reviewReasons.push("certification_style");
  }

  // --- Parse dates ---
  const startDate = sem.startDate
    ? parseFlexibleDate(sem.startDate, context)
    : null;
  const endDate = sem.endDate
    ? parseFlexibleDate(sem.endDate, context)
    : null;

  if (sem.startDate && !startDate) {
    reviewReasons.push("unparseable_start_date");
  }
  if (sem.endDate && !endDate) {
    reviewReasons.push("unparseable_end_date");
  }

  // --- Calculate status ---
  const status = calculateStatus(startDate, endDate, today);

  // --- Calculate credits ---
  let creditsCalculated: number | null = null;
  if (durationMonths !== null) {
    creditsCalculated = calculateCredits(durationMonths, isCertificationStyle);
  }
  if (sem.duration && durationMonths === null) {
    // Duration was present but unparseable — credits need review
    creditsCalculated = null;
  }

  return {
    semesterLabel,
    company: sem.internshipName,
    startDateRaw: sem.startDate,
    endDateRaw: sem.endDate,
    startDate: startDate ? startDate.toISOString() : null,
    endDate: endDate ? endDate.toISOString() : null,
    durationRaw: sem.duration,
    durationMonths,
    isCertificationStyle,
    status,
    creditsCalculated,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  };
}

export function enrichStudentRecord(
  record: StudentRecord,
  today: Date
): EnrichedStudent {
  const internships: EnrichedInternship[] = [];

  for (const key of SEMESTER_KEYS) {
    const sem = record.semesters[key];
    const label = SEMESTER_LABELS[key];
    const enriched = enrichInternship(sem, label, record.prn, today);
    if (enriched) {
      internships.push(enriched);
    }
  }

  // Sum all non-null credits
  const totalCreditsCalculated = internships.reduce(
    (sum, i) => sum + (i.creditsCalculated ?? 0),
    0
  );

  return {
    prn: record.prn,
    name: record.studentName,
    division: record.division,
    internships,
    totalCreditsCalculated,
    sheetReportedTotalCredits: record.totalCreditsEarned,
    sheetReportedRemainingCredits: record.totalCreditsRemaining,
  };
}

export async function getEnrichedStudents(
  batchId: string,
  division?: string,
  refresh = false
): Promise<EnrichedStudent[]> {
  let rawStudents = await fetchBatchData(batchId, refresh);

  if (division) {
    rawStudents = filterByDivision(rawStudents, division);
  }

  const today = new Date();
  return rawStudents.map((s) => enrichStudentRecord(s, today));
}
