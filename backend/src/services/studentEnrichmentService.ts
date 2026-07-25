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
import {
  classifyInternship,
  type InternshipClassification,
} from "../utils/classifyInternship";
import {
  getOverridesForBatch,
  makeOverrideKey,
  type ReviewOverride,
  type Decision,
  type Classification,
  type MergeDecision,
} from "./reviewOverrideService";

// ---------------------------------------------------------------------------
// Types for enriched response
// ---------------------------------------------------------------------------

/** Faculty-supplied override fields merged onto an internship entry. Null when no override exists. */
export interface ReviewOverrideInfo {
  decision: Decision | null;
  classification: Classification | null;
  mergeDecision: MergeDecision | null;
  overrideCredits: number | null;
  reviewedBy: string | null;
  note: string | null;
  reviewedAt: string | null;
}

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
  classification: InternshipClassification;
  status: InternshipStatus;
  creditsCalculated: number | null;
  needsReview: boolean;
  reviewReasons: string[];
  /** Populated from Supabase review_overrides on every request (never cached). Null = no faculty override yet. */
  reviewOverride: ReviewOverrideInfo | null;

  // ---- Split internship detection (set by detectAndMergeSplitInternships) ----
  /**
   * true when this entry is one half of a detected cross-semester-boundary split:
   * same company name appearing in two adjacent semester slots.
   */
  possibleSplitInternship: boolean;
  /** Role within the detected split pair. null when not part of a split. */
  splitMergeRole: "primary" | "sibling" | null;
  /**
   * The semester label of the paired other half.
   * primary: contains the sibling's label. sibling: contains the primary's label.
   */
  splitSiblingLabel: string | null;
  /**
   * Credits calculated for this slot BEFORE the merge was applied.
   * Restored when a faculty reject_merge override is active for this pair.
   */
  splitOriginalCredits: number | null;
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

/**
 * Result envelope returned by getEnrichedStudents.
 *
 * overridesApplied = true  → Supabase was reachable and override rows were merged.
 * overridesApplied = false → Supabase was unreachable; data is raw sheet values only.
 *
 * Routes must propagate this flag to the API response so the frontend can show
 * a visible warning banner when overrides are unavailable.
 */
export interface EnrichedStudentsResult {
  students: EnrichedStudent[];
  overridesApplied: boolean;
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

/**
 * Adjacent semester index pairs used for split internship detection.
 * Only these pairs are checked — non-adjacent same-name entries are NOT merged.
 *
 * Index mapping (aligned with SEMESTER_KEYS insertion order):
 *   0 = FY Sem I      1 = FY Sem II
 *   2 = SY Sem III    3 = SY Sem IV
 *   4 = TY Sem V      5 = TY Sem VI     6 = B.Tech Sem VII
 */
const ADJACENT_SEMESTER_PAIRS: [number, number][] = [
  [0, 1], // FY Sem I  → FY Sem II
  [1, 2], // FY Sem II → SY Sem III
  [2, 3], // SY Sem III→ SY Sem IV
  [3, 4], // SY Sem IV → TY Sem V
  [4, 5], // TY Sem V  → TY Sem VI
  [5, 6], // TY Sem VI → B.Tech Sem VII  ← Keyura Motegaonkar (TraceLink) triggers here
];

// ---------------------------------------------------------------------------
// Enrichment pipeline — sheet data only (no Supabase; safe to cache)
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
    classification: classifyInternship(sem.internshipName),
    status,
    creditsCalculated,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
    reviewOverride: null, // populated later by applyOverridesToStudents
    // Split detection fields — initialized to no-split state
    possibleSplitInternship: false,
    splitMergeRole: null,
    splitSiblingLabel: null,
    splitOriginalCredits: null,
  };
}

// ---------------------------------------------------------------------------
// Split internship detection
// ---------------------------------------------------------------------------

/** Normalise a company name for fuzzy matching: lowercase, collapse whitespace. */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Return the lexicographically earlier ISO date string (i.e. the earlier date). */
function earliestIsoDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

/** Return the lexicographically later ISO date string (i.e. the later date). */
function latestIsoDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * Scans adjacent semester pairs for internships with matching company names.
 *
 * When a match is found the pair is merged into one logical internship:
 *   - Primary slot (earlier semester):
 *       • gets merged date range (earliest start, latest end)
 *       • durationMonths = MAX(primary, sibling) — never the sum, never double-counted
 *       • creditsCalculated = calculateCredits(mergedDuration)
 *       • possibleSplitInternship = true, splitMergeRole = "primary"
 *       • "possible_duplicate_split" added to reviewReasons (needsReview → true)
 *   - Sibling slot (later semester):
 *       • creditsCalculated = null  (credits already counted in primary)
 *       • possibleSplitInternship = true, splitMergeRole = "sibling"
 *       • "split_sibling" added to reviewReasons (needsReview → true)
 *
 * Faculty can reject the automatic merge via a "reject_merge" override
 * (handled downstream in applyOverridesToStudents) which restores
 * splitOriginalCredits to both halves and credits them independently.
 *
 * Only ADJACENT pairs (per ADJACENT_SEMESTER_PAIRS) are ever merged.
 * Non-adjacent same-name entries are left as-is.
 *
 * @param slots  Nullable array of exactly 7 EnrichedInternships, one per semester in order.
 * @param today  Used to recompute status on the merged primary from the combined date range.
 */
export function detectAndMergeSplitInternships(
  slots: (EnrichedInternship | null)[],
  today: Date
): (EnrichedInternship | null)[] {
  const result: (EnrichedInternship | null)[] = [...slots];

  for (const [primaryIdx, siblingIdx] of ADJACENT_SEMESTER_PAIRS) {
    const primary = result[primaryIdx];
    const sibling = result[siblingIdx];

    // Skip if either slot is empty
    if (!primary || !sibling) continue;
    // Skip if primary was already consumed as a sibling in a prior pair
    if (primary.splitMergeRole === "sibling") continue;
    // Skip if either company name is empty
    if (!primary.company?.trim() || !sibling.company?.trim()) continue;
    // Skip if company names don't match (normalised comparison)
    if (normalizeName(primary.company) !== normalizeName(sibling.company)) continue;

    // ---- Match found — compute merged attributes ----

    // Date range: span the earliest start to the latest end across both halves
    const mergedStartDate = earliestIsoDate(primary.startDate, sibling.startDate);
    const mergedEndDate = latestIsoDate(primary.endDate, sibling.endDate);

    // Raw date strings: use whichever half actually has data for each end
    const mergedStartDateRaw = primary.startDate ? primary.startDateRaw : sibling.startDateRaw;
    const mergedEndDateRaw = sibling.endDate ? sibling.endDateRaw : primary.endDateRaw;

    // Duration: use the LARGER of the two parsed values — never sum them,
    // which would double-count the same continuous span.
    let mergedDurationMonths: number | null;
    if (primary.durationMonths !== null && sibling.durationMonths !== null) {
      mergedDurationMonths = Math.max(primary.durationMonths, sibling.durationMonths);
    } else {
      mergedDurationMonths = primary.durationMonths ?? sibling.durationMonths;
    }

    // Certification flag: if either half is certification-style, the merged entry is too
    const mergedIsCertificationStyle =
      primary.isCertificationStyle || sibling.isCertificationStyle;

    // Credits: computed once on the merged duration
    const mergedCredits: number | null =
      mergedDurationMonths !== null
        ? calculateCredits(mergedDurationMonths, mergedIsCertificationStyle)
        : null;

    // Status: recompute from the merged date range
    const mergedStartParsed = mergedStartDate ? new Date(mergedStartDate) : null;
    const mergedEndParsed = mergedEndDate ? new Date(mergedEndDate) : null;
    const mergedStatus = calculateStatus(mergedStartParsed, mergedEndParsed, today);

    // Store pre-merge credits so applyOverridesToStudents can restore them on reject_merge
    const primaryOriginalCredits = primary.creditsCalculated;
    const siblingOriginalCredits = sibling.creditsCalculated;

    // Review reasons — deduplicated
    const primaryReviewReasons = Array.from(
      new Set([...primary.reviewReasons, "possible_duplicate_split"])
    );
    const siblingReviewReasons = Array.from(
      new Set([...sibling.reviewReasons, "split_sibling"])
    );

    // Update primary slot
    result[primaryIdx] = {
      ...primary,
      startDate: mergedStartDate,
      endDate: mergedEndDate,
      startDateRaw: mergedStartDateRaw,
      endDateRaw: mergedEndDateRaw,
      durationMonths: mergedDurationMonths,
      isCertificationStyle: mergedIsCertificationStyle,
      status: mergedStatus,
      creditsCalculated: mergedCredits,
      needsReview: true,
      reviewReasons: primaryReviewReasons,
      possibleSplitInternship: true,
      splitMergeRole: "primary",
      splitSiblingLabel: sibling.semesterLabel,
      splitOriginalCredits: primaryOriginalCredits,
    };

    // Update sibling slot — null out its credits (counted in primary)
    result[siblingIdx] = {
      ...sibling,
      creditsCalculated: null,
      needsReview: true,
      reviewReasons: siblingReviewReasons,
      possibleSplitInternship: true,
      splitMergeRole: "sibling",
      splitSiblingLabel: primary.semesterLabel,
      splitOriginalCredits: siblingOriginalCredits,
    };
  }

  return result;
}

export function enrichStudentRecord(
  record: StudentRecord,
  today: Date
): EnrichedStudent {
  // Step 1: Build nullable slot array (one per semester, insertion order preserved)
  const rawSlots: (EnrichedInternship | null)[] = SEMESTER_KEYS.map((key) => {
    const sem = record.semesters[key];
    const label = SEMESTER_LABELS[key];
    return enrichInternship(sem, label, record.prn, today);
  });

  // Step 2: Detect cross-semester-boundary split internships and merge pairs
  const processedSlots = detectAndMergeSplitInternships(rawSlots, today);

  // Step 3: Filter out empty slots, keeping semester ordering
  const internships = processedSlots.filter((i): i is EnrichedInternship => i !== null);

  // Step 4: Sum credits — sibling slots carry null (→ 0), so no double-counting
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

// ---------------------------------------------------------------------------
// Override merge layer (Supabase — fetched fresh on every request, never cached)
// ---------------------------------------------------------------------------

/**
 * Merges faculty overrides onto already-enriched students.
 *
 * Credit rules per decision (when no explicit override_credits is set):
 *   - "approved"  → creditsCalculated unchanged (faculty confirmed the computed value)
 *   - "declined"  → creditsCalculated forced to 0 (entry is rejected; contributes nothing)
 *   - "pending"   → creditsCalculated unchanged (no decision yet)
 *
 * override_credits always wins when explicitly set, regardless of decision.
 *
 * needsReview rules:
 *   - "approved"  → false (reviewed, accepted — no longer needs attention)
 *   - "declined"  → false (reviewed, rejected — faculty actively rejected it; still
 *                          visible via reviewOverride.decision so the UI can display
 *                          "Declined" state rather than "Needs review" or "Not reviewed")
 *   - "pending"   → unchanged from sheet-derived value (still needs a decision)
 *   - no override → unchanged from sheet-derived value
 *
 * Split internship merge override (merge_decision = "reject_merge"):
 *   When either half of a detected split pair has reject_merge set, BOTH halves
 *   have their splitOriginalCredits restored and are credited independently.
 *   The automatic merge is undone and possibleSplitInternship is cleared.
 *   Normal decision/override_credits rules still apply on top of the restored value.
 *
 * The student's totalCreditsCalculated is recomputed after all credits are applied.
 */
function resolveClassification(
  heuristic: InternshipClassification,
  overrideClassification: Classification | null | undefined
): InternshipClassification {
  // DB constraint on review_overrides.classification only allows "company" or "certification"
  // (not "internship" — that value can never be stored, so checking it was dead code).
  if (overrideClassification === "company") return "company";
  if (overrideClassification === "certification") return "certification";
  return heuristic;
}

export function applyOverridesToStudents(
  students: EnrichedStudent[],
  overrides: Map<string, ReviewOverride>
): EnrichedStudent[] {
  return students.map((student) => {
    // --- Phase 1: Identify split pairs where reject_merge is active ---
    // If EITHER half of a split pair has reject_merge, BOTH halves are restored.
    const rejectMergeLabels = new Set<string>();
    for (const internship of student.internships) {
      if (!internship.possibleSplitInternship) continue;
      const key = makeOverrideKey(student.division, student.prn, internship.semesterLabel);
      const override = overrides.get(key);
      if (override?.merge_decision === "reject_merge") {
        rejectMergeLabels.add(internship.semesterLabel);
        if (internship.splitSiblingLabel) {
          rejectMergeLabels.add(internship.splitSiblingLabel);
        }
      }
    }

    // --- Phase 2: Apply overrides to each internship ---
    const mergedInternships = student.internships.map((internship) => {
      const key = makeOverrideKey(student.division, student.prn, internship.semesterLabel);
      const override = overrides.get(key) ?? null;

      const overrideInfo: ReviewOverrideInfo | null = override
        ? {
            decision: override.decision ?? null,
            classification: override.classification ?? null,
            mergeDecision: override.merge_decision ?? null,
            overrideCredits: override.override_credits ?? null,
            reviewedBy: override.reviewed_by ?? null,
            note: override.note ?? null,
            reviewedAt: override.reviewed_at ?? null,
          }
        : null;

      // --- reject_merge path: restore original per-semester credits ---
      if (internship.possibleSplitInternship && rejectMergeLabels.has(internship.semesterLabel)) {
        // Start from the pre-merge per-semester credit value
        let creditsCalculated: number | null = internship.splitOriginalCredits;

        // Apply any explicit overrides on top of the restored value
        if (override?.override_credits !== null && override?.override_credits !== undefined) {
          creditsCalculated = override.override_credits;
        } else if (override?.decision === "declined") {
          creditsCalculated = 0;
        }

        // Remove split-specific review reasons; let original reasons stand
        const cleanedReasons = internship.reviewReasons.filter(
          (r) => r !== "possible_duplicate_split" && r !== "split_sibling"
        );
        const needsReview =
          override?.decision === "approved" || override?.decision === "declined"
            ? false
            : cleanedReasons.length > 0 || creditsCalculated === null;

        const classification = resolveClassification(internship.classification, override?.classification);

        const splitMergeRole: "primary" | "sibling" | null = null;
        return {
          ...internship,
          classification,
          creditsCalculated,
          needsReview,
          reviewReasons: cleanedReasons,
          possibleSplitInternship: false, // merge explicitly rejected — treat as normal entries
          splitMergeRole,
          reviewOverride: overrideInfo,
        };
      }

      // --- Normal override path (no reject_merge) ---
      if (!override) {
        return internship; // reviewOverride is already null from enrichInternship
      }

      // Resolve effective credits
      let creditsCalculated: number | null;
      if (override.override_credits !== null && override.override_credits !== undefined) {
        creditsCalculated = override.override_credits;
      } else if (override.decision === "declined") {
        creditsCalculated = 0;
      } else {
        creditsCalculated = internship.creditsCalculated;
      }

      const needsReview =
        override.decision === "approved" || override.decision === "declined"
          ? false
          : internship.needsReview;

      const classification = resolveClassification(internship.classification, override.classification);

      return {
        ...internship,
        classification,
        creditsCalculated,
        needsReview,
        reviewOverride: overrideInfo,
      };
    });

    // Recompute total after credits may have changed (sibling nulls → 0)
    const totalCreditsCalculated = mergedInternships.reduce(
      (sum, i) => sum + (i.creditsCalculated ?? 0),
      0
    );

    return { ...student, internships: mergedInternships, totalCreditsCalculated };
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns enriched students for a batch with faculty overrides applied.
 *
 * Cache strategy:
 *   - Raw Google Sheets data: cached 5 minutes (see sheetsService)
 *   - Split internship detection: runs on the cached data (pure, no I/O)
 *   - Supabase overrides:     fetched fresh on EVERY call (never cached)
 *
 * This means a POST /api/reviews is immediately reflected in the next
 * GET /api/students or /api/analytics/* call without waiting for cache expiry.
 *
 * Returns EnrichedStudentsResult so callers can propagate overridesApplied = false
 * in the HTTP response when Supabase is temporarily unreachable, allowing the
 * frontend to show a visible warning rather than silently displaying stale numbers.
 */
export async function getEnrichedStudents(
  batchId: string,
  division?: string,
  refresh = false
): Promise<EnrichedStudentsResult> {
  // 1. Cached sheet data → enrichment (includes split detection)
  let rawStudents = await fetchBatchData(batchId, refresh);
  if (division) {
    rawStudents = filterByDivision(rawStudents, division);
  }
  const today = new Date();
  const enriched = rawStudents.map((s) => enrichStudentRecord(s, today));

  // 2. Fresh overrides from Supabase — always bypasses cache
  try {
    const overrides = await getOverridesForBatch(batchId, division);
    // Fast path: no override rows exist yet — skip merge, still mark as applied
    const students = overrides.size === 0
      ? enriched
      : applyOverridesToStudents(enriched, overrides);
    return { students, overridesApplied: true };
  } catch (err) {
    // Supabase unavailable: degrade gracefully — return sheet-only data and signal
    // the failure explicitly so routes can expose it in their responses.
    console.warn(
      "[enrichment] Supabase override fetch failed — returning unoverridden data:",
      err instanceof Error ? err.message : err
    );
    return { students: enriched, overridesApplied: false };
  }
}
