/**
 * Integration test — exercises the full enrichment pipeline with realistic
 * mock data that simulates what comes from the real Google Sheet.
 *
 * Run with: node -e "require('./dist/integrationTest.js')"
 * Or: npx ts-node src/integrationTest.ts
 */
import { parseDurationToMonths } from "./utils/durationParser";
import { parseFlexibleDate } from "./utils/dateParser";
import { calculateStatus } from "./services/statusCalculator";
import { calculateCredits } from "./services/creditRules";
import type { StudentRecord, SemesterInternship } from "./services/sheetsService";

// ---------------------------------------------------------------------------
// Simulated raw data (realistic messy formats from the sheet)
// ---------------------------------------------------------------------------

function makeSem(
  name: string,
  start: string,
  end: string,
  duration: string,
  credits: string
): SemesterInternship {
  return {
    internshipName: name,
    startDate: start,
    endDate: end,
    duration,
    creditsEarned: credits,
  };
}

const emptySem = makeSem("", "", "", "", "");

const mockStudents: StudentRecord[] = [
  {
    division: "Div-A",
    prn: "12210001",
    studentName: "Piyush Rajkumar Patil",
    semesters: {
      fySem1: makeSem("TCS iON", "6/10/2025", "10 July 2025", "3 Month", "2"),
      fySem2: makeSem("Infosys Springboard", "1st July 2026", "21 May, 2025", "6 Months", "4"),
      sySem3: makeSem("Java Certification", "April'2025", "", "135.5 hours", ""),
      sySem4: makeSem("Wipro Intern", "25/May/25", "5/6/2025", "4 weeks", "1"),
      tySem5: emptySem,
      tySem6: emptySem,
      btechSem7: emptySem,
    },
    totalCreditsEarned: "7",
    totalCreditsRemaining: "9",
  },
  {
    division: "Div-B",
    prn: "12210002",
    studentName: "Shweta Popatrao Jadhav",
    semesters: {
      fySem1: makeSem("Google Developer", "10 July 2025", "31/12/2025", "2 Month", "2"),
      fySem2: makeSem("Microsoft Learn", "1st July 2026", "", "1.5 months", "1"),
      sySem3: makeSem("AWS Cloud Cert", "", "", "135.5hr", ""),
      sySem4: makeSem("Startup XYZ", "5-Dec", "1st July", "10 weeks", ""),
      tySem5: makeSem("Jio Platforms", "15/1/2025", "15/6/2025", "1month", "1"),
      tySem6: makeSem("Unknown Co", "not_a_date", "also_bad", "garbage_duration", ""),
      btechSem7: makeSem("Short Workshop", "5/6/2025", "15/6/2025", "10 days", "0"),
    },
    totalCreditsEarned: "4",
    totalCreditsRemaining: "12",
  },
  {
    division: "Div-C",
    prn: "12210003",
    studentName: "Test Edge Cases",
    semesters: {
      fySem1: makeSem("Intern A", "15-6-2025", "15/6/25", "2 weeks", ""),
      fySem2: makeSem("Intern B", "  5/6/2025  ", "  31/12/2025  ", "  6  MONTHS  ", ""),
      sySem3: makeSem("Future Start", "1/1/2027", "1/6/2027", "6 Months", ""),
      sySem4: emptySem,
      tySem5: emptySem,
      tySem6: emptySem,
      btechSem7: emptySem,
    },
    totalCreditsEarned: "0",
    totalCreditsRemaining: "16",
  },
];

// ---------------------------------------------------------------------------
// Enrichment logic (same as students.ts route handler)
// ---------------------------------------------------------------------------

const SEMESTER_LABELS: Record<string, string> = {
  fySem1: "FY Sem I",
  fySem2: "FY Sem II",
  sySem3: "SY Sem III",
  sySem4: "SY Sem IV",
  tySem5: "TY Sem V",
  tySem6: "TY Sem VI",
  btechSem7: "B.Tech Sem VII",
};

interface EnrichedInternship {
  semesterLabel: string;
  company: string;
  startDateRaw: string;
  endDateRaw: string;
  startDate: string | null;
  endDate: string | null;
  durationRaw: string;
  durationMonths: number | null;
  isCertificationStyle: boolean;
  status: string;
  creditsCalculated: number | null;
  needsReview: boolean;
  reviewReasons: string[];
}

function enrichInternship(
  sem: SemesterInternship,
  semesterLabel: string,
  prn: string,
  today: Date
): EnrichedInternship | null {
  if (!sem.internshipName && !sem.startDate && !sem.endDate && !sem.duration) {
    return null;
  }

  const context = { prn, semesterLabel };
  const reviewReasons: string[] = [];

  const durationResult = sem.duration
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

  const status = calculateStatus(startDate, endDate, today);

  let creditsCalculated: number | null = null;
  if (durationMonths !== null) {
    creditsCalculated = calculateCredits(durationMonths, isCertificationStyle);
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

// ---------------------------------------------------------------------------
// Run the pipeline
// ---------------------------------------------------------------------------

const today = new Date("2026-07-24T00:00:00Z");

console.log("=".repeat(80));
console.log("INTEGRATION TEST — Enrichment Pipeline");
console.log(`Reference date (today): ${today.toISOString()}`);
console.log("=".repeat(80));

let totalInternships = 0;
const allReviewEntries: Array<{
  prn: string;
  name: string;
  semesterLabel: string;
  company: string;
  reasons: string[];
}> = [];

for (const student of mockStudents) {
  console.log(`\n--- ${student.studentName} (${student.prn}, ${student.division}) ---`);

  const semKeys = Object.keys(student.semesters) as (keyof typeof student.semesters)[];
  let studentCredits = 0;

  for (const key of semKeys) {
    const sem = student.semesters[key];
    const label = SEMESTER_LABELS[key];
    const enriched = enrichInternship(sem, label, student.prn, today);

    if (enriched) {
      totalInternships++;
      studentCredits += enriched.creditsCalculated ?? 0;

      console.log(`  ${enriched.semesterLabel}: ${enriched.company}`);
      console.log(`    Duration: "${enriched.durationRaw}" → ${enriched.durationMonths} months (cert=${enriched.isCertificationStyle})`);
      console.log(`    Dates: "${enriched.startDateRaw}" → ${enriched.startDate} | "${enriched.endDateRaw}" → ${enriched.endDate}`);
      console.log(`    Status: ${enriched.status} | Credits: ${enriched.creditsCalculated}`);

      if (enriched.needsReview) {
        console.log(`    ⚠️  NEEDS REVIEW: ${enriched.reviewReasons.join(", ")}`);
        allReviewEntries.push({
          prn: student.prn,
          name: student.studentName,
          semesterLabel: enriched.semesterLabel,
          company: enriched.company,
          reasons: enriched.reviewReasons,
        });
      }
    }
  }

  console.log(`  → Total calculated credits: ${studentCredits}`);
  console.log(`  → Sheet-reported total: ${student.totalCreditsEarned} | remaining: ${student.totalCreditsRemaining}`);
}

// ---------------------------------------------------------------------------
// Summary report
// ---------------------------------------------------------------------------

console.log("\n" + "=".repeat(80));
console.log("SUMMARY REPORT");
console.log("=".repeat(80));
console.log(`Total students: ${mockStudents.length}`);
console.log(`Total internship entries processed: ${totalInternships}`);
console.log(`Entries flagged needsReview: ${allReviewEntries.length}`);

// Group by reason
const byReason: Record<string, typeof allReviewEntries> = {};
for (const entry of allReviewEntries) {
  for (const reason of entry.reasons) {
    if (!byReason[reason]) byReason[reason] = [];
    byReason[reason].push(entry);
  }
}

console.log("\nBreakdown by reason:");
for (const [reason, entries] of Object.entries(byReason)) {
  console.log(`  ${reason}: ${entries.length} entries`);
  for (const e of entries) {
    console.log(`    - ${e.name} (${e.prn}) / ${e.semesterLabel}: ${e.company}`);
  }
}

console.log("\n" + "=".repeat(80));
console.log("✅ Integration test completed successfully");
console.log("=".repeat(80));
