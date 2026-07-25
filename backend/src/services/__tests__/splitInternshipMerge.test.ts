import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock supabaseClient BEFORE any imports so module initialization does not
// throw when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are absent (test env).
// The pure functions under test (detectAndMergeSplitInternships,
// applyOverridesToStudents) never call Supabase — this is purely a guard.
// ---------------------------------------------------------------------------
const { mockSupabaseFrom } = vi.hoisted(() => {
  const mockSupabaseFrom = vi.fn();
  return { mockSupabaseFrom };
});

vi.mock("../supabaseClient", () => ({
  default: { from: mockSupabaseFrom },
}));

import {
  detectAndMergeSplitInternships,
  applyOverridesToStudents,
  type EnrichedInternship,
  type EnrichedStudent,
} from "../studentEnrichmentService";
import { makeOverrideKey, type ReviewOverride } from "../reviewOverrideService";
import { calculateCredits } from "../creditRules";
import { classifyInternship } from "../../utils/classifyInternship";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TODAY = new Date("2026-07-25T00:00:00.000Z");

/** Build a minimal EnrichedInternship with sensible defaults. */
function makeSlot(overrides: Partial<EnrichedInternship>): EnrichedInternship {
  const durationMonths = overrides.durationMonths !== undefined ? overrides.durationMonths : 6;
  const isCertificationStyle = overrides.isCertificationStyle ?? false;
  const defaultCredits = durationMonths !== null ? calculateCredits(durationMonths, isCertificationStyle) : null;

  return {
    semesterLabel: "FY Sem I",
    company: "Test Corp",
    startDateRaw: "1/1/2025",
    endDateRaw: "30/6/2025",
    startDate: "2025-01-01T00:00:00.000Z",
    endDate: "2025-06-30T00:00:00.000Z",
    durationRaw: "6 months",
    durationMonths,
    isCertificationStyle,
    classification: overrides.company ? classifyInternship(overrides.company) : "company",
    status: "Completed",
    creditsCalculated: defaultCredits,
    needsReview: false,
    reviewReasons: [],
    reviewOverride: null,
    possibleSplitInternship: false,
    splitMergeRole: null,
    splitSiblingLabel: null,
    splitOriginalCredits: null,
    ...overrides,
  };
}

/** Build a 7-slot nullable array initialised to all-null. */
function emptySlots(): (EnrichedInternship | null)[] {
  return Array(7).fill(null);
}

/** Build a minimal EnrichedStudent with a given internship list. */
function makeStudent(
  internships: EnrichedInternship[],
  overrides: Partial<EnrichedStudent> = {}
): EnrichedStudent {
  const totalCreditsCalculated = internships.reduce(
    (s, i) => s + (i.creditsCalculated ?? 0),
    0
  );
  return {
    prn: "TEST001",
    name: "Test Student",
    division: "Div-A",
    internships,
    totalCreditsCalculated,
    sheetReportedTotalCredits: String(totalCreditsCalculated),
    sheetReportedRemainingCredits: "0",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectAndMergeSplitInternships — unit tests
// ---------------------------------------------------------------------------

describe("detectAndMergeSplitInternships", () => {
  // ------- Test 1: exact match on adjacent pair (the Keyura scenario) -------
  it("merges adjacent pair (TY Sem VI / B.Tech Sem VII) with matching company name", () => {
    const slots = emptySlots();
    // Index 5 = TY Sem VI: has start date + duration
    slots[5] = makeSlot({
      semesterLabel: "TY Sem VI",
      company: "TraceLink",
      startDate: "2026-01-12T00:00:00.000Z",
      startDateRaw: "12/1/2026",
      endDate: null,
      endDateRaw: "",
      durationMonths: 6,
      durationRaw: "6 months",
      creditsCalculated: calculateCredits(6, false), // 4
    });
    // Index 6 = B.Tech Sem VII: has end date only, no duration
    slots[6] = makeSlot({
      semesterLabel: "B.Tech Sem VII",
      company: "TraceLink",
      startDate: null,
      startDateRaw: "",
      endDate: "2026-07-12T00:00:00.000Z",
      endDateRaw: "12/7/2026",
      durationMonths: null,
      durationRaw: "",
      creditsCalculated: null,
    });

    const result = detectAndMergeSplitInternships(slots, TODAY);
    const primary = result[5]!;
    const sibling = result[6]!;

    // ---- Primary slot assertions ----
    expect(primary.possibleSplitInternship).toBe(true);
    expect(primary.splitMergeRole).toBe("primary");
    expect(primary.splitSiblingLabel).toBe("B.Tech Sem VII");
    expect(primary.splitOriginalCredits).toBe(4); // pre-merge value
    expect(primary.creditsCalculated).toBe(4);    // max(6, null) = 6 months → 4 credits
    expect(primary.durationMonths).toBe(6);

    // Dates should span both halves
    expect(primary.startDate).toBe("2026-01-12T00:00:00.000Z"); // earliest
    expect(primary.endDate).toBe("2026-07-12T00:00:00.000Z");   // latest

    expect(primary.needsReview).toBe(true);
    expect(primary.reviewReasons).toContain("possible_duplicate_split");

    // ---- Sibling slot assertions ----
    expect(sibling.possibleSplitInternship).toBe(true);
    expect(sibling.splitMergeRole).toBe("sibling");
    expect(sibling.splitSiblingLabel).toBe("TY Sem VI");
    expect(sibling.splitOriginalCredits).toBeNull(); // sibling had no credits before merge
    expect(sibling.creditsCalculated).toBeNull();    // nulled — counted in primary
    expect(sibling.needsReview).toBe(true);
    expect(sibling.reviewReasons).toContain("split_sibling");
  });

  // ------- Test 2: case-insensitive + whitespace normalisation -------
  it("matches company name case-insensitively with collapsed whitespace", () => {
    const slots = emptySlots();
    slots[4] = makeSlot({ semesterLabel: "TY Sem V",  company: "  WIPRO  " });
    slots[5] = makeSlot({ semesterLabel: "TY Sem VI", company: "wipro" });

    const result = detectAndMergeSplitInternships(slots, TODAY);
    expect(result[4]?.possibleSplitInternship).toBe(true);
    expect(result[5]?.possibleSplitInternship).toBe(true);
  });

  // ------- Test 3: non-adjacent same-name pair must NOT merge -------
  it("does NOT merge non-adjacent semesters with the same company name", () => {
    // FY Sem I (index 0) and SY Sem III (index 2) both = "Infosys"; FY Sem II (index 1) is null.
    // The pairs checked are (0,1),(1,2),(2,3)... — neither (0,2) nor any path
    // creates a direct primary→sibling link across the null gap.
    const slots = emptySlots();
    slots[0] = makeSlot({
      semesterLabel: "FY Sem I",
      company: "Infosys",
      creditsCalculated: 2,
      durationMonths: 2,
    });
    slots[2] = makeSlot({
      semesterLabel: "SY Sem III",
      company: "Infosys",
      creditsCalculated: 2,
      durationMonths: 2,
    });
    // slots[1] stays null (FY Sem II absent)

    const result = detectAndMergeSplitInternships(slots, TODAY);

    // Neither should be flagged as a split — they are separated by an empty semester
    expect(result[0]?.possibleSplitInternship).toBe(false);
    expect(result[2]?.possibleSplitInternship).toBe(false);
    expect(result[0]?.creditsCalculated).toBe(2);
    expect(result[2]?.creditsCalculated).toBe(2);
  });

  // ------- Test 4: different company names in adjacent slots must NOT merge -------
  it("does NOT merge adjacent semesters with different company names", () => {
    const slots = emptySlots();
    slots[5] = makeSlot({ semesterLabel: "TY Sem VI",      company: "Google" });
    slots[6] = makeSlot({ semesterLabel: "B.Tech Sem VII", company: "Microsoft" });

    const result = detectAndMergeSplitInternships(slots, TODAY);

    expect(result[5]?.possibleSplitInternship).toBe(false);
    expect(result[6]?.possibleSplitInternship).toBe(false);
  });

  // ------- Test 5: when both halves have duration, use the LARGER one (not the sum) -------
  it("uses the LARGER of two durations — never their sum", () => {
    // 3 months = 2 credits, 5 months = 3 credits, 3+5=8 months = 4 credits
    const slots = emptySlots();
    slots[4] = makeSlot({
      semesterLabel: "TY Sem V",
      company: "Wipro",
      durationMonths: 3,
      creditsCalculated: calculateCredits(3, false), // 2 credits
    });
    slots[5] = makeSlot({
      semesterLabel: "TY Sem VI",
      company: "Wipro",
      durationMonths: 5,
      creditsCalculated: calculateCredits(5, false), // 3 credits
    });

    const result = detectAndMergeSplitInternships(slots, TODAY);
    const primary = result[4]!;

    expect(primary.durationMonths).toBe(5);                          // max(3, 5)
    expect(primary.creditsCalculated).toBe(calculateCredits(5, false)); // 3 credits
    // Must NOT be the sum: calculateCredits(8, false) = 4 credits
    expect(primary.creditsCalculated).not.toBe(calculateCredits(8, false));
    // Sibling credits are nulled
    expect(result[5]?.creditsCalculated).toBeNull();
  });

  // ------- Test 6: slot already consumed as sibling cannot become a primary -------
  it("does not chain a sibling into a new primary for the next pair", () => {
    // FY Sem I, FY Sem II, SY Sem III all have same company.
    // Expected: pair (0,1) merges; pair (1,2) is skipped because index 1 is a sibling.
    const slots = emptySlots();
    slots[0] = makeSlot({ semesterLabel: "FY Sem I",   company: "Accenture", durationMonths: 3 });
    slots[1] = makeSlot({ semesterLabel: "FY Sem II",  company: "Accenture", durationMonths: 3 });
    slots[2] = makeSlot({ semesterLabel: "SY Sem III", company: "Accenture", durationMonths: 3 });

    const result = detectAndMergeSplitInternships(slots, TODAY);

    expect(result[0]?.splitMergeRole).toBe("primary");  // merged with FY Sem II
    expect(result[1]?.splitMergeRole).toBe("sibling");  // consumed by pair (0,1)
    // SY Sem III should NOT be merged (FY Sem II was already a sibling)
    expect(result[2]?.splitMergeRole).toBeNull();
    expect(result[2]?.possibleSplitInternship).toBe(false);
    expect(result[2]?.creditsCalculated).toBe(calculateCredits(3, false));
  });

  // ------- Test 7: empty company name in one slot must NOT trigger a merge -------
  it("does NOT merge when one slot has an empty company name", () => {
    const slots = emptySlots();
    slots[5] = makeSlot({ semesterLabel: "TY Sem VI",      company: "TCS", durationMonths: 2 });
    slots[6] = makeSlot({ semesterLabel: "B.Tech Sem VII", company: "",    durationMonths: 2 });

    const result = detectAndMergeSplitInternships(slots, TODAY);

    expect(result[5]?.possibleSplitInternship).toBe(false);
    expect(result[6]?.possibleSplitInternship).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyOverridesToStudents — reject_merge path
// ---------------------------------------------------------------------------

describe("applyOverridesToStudents — reject_merge", () => {
  // Build a student that already has a detected split pair applied
  function buildMergedStudent(): EnrichedStudent {
    // Simulates what detectAndMergeSplitInternships would produce for Keyura:
    //   TY Sem VI (primary): 6 months → 4 credits (original = 4)
    //   B.Tech Sem VII (sibling): null credits, original = null
    const primary = makeSlot({
      semesterLabel: "TY Sem VI",
      company: "TraceLink",
      durationMonths: 6,
      creditsCalculated: 4,   // merged credits
      needsReview: true,
      reviewReasons: ["possible_duplicate_split"],
      possibleSplitInternship: true,
      splitMergeRole: "primary",
      splitSiblingLabel: "B.Tech Sem VII",
      splitOriginalCredits: 4, // same as merged in this case (only primary had duration)
    });

    const sibling = makeSlot({
      semesterLabel: "B.Tech Sem VII",
      company: "TraceLink",
      durationMonths: null,
      creditsCalculated: null,  // nulled by merge
      needsReview: true,
      reviewReasons: ["split_sibling"],
      possibleSplitInternship: true,
      splitMergeRole: "sibling",
      splitSiblingLabel: "TY Sem VI",
      splitOriginalCredits: null, // sibling had no credits before merge
    });

    return makeStudent([primary, sibling], { prn: "123B5B293", division: "Div-A" });
  }

  // ------- Test 1: reject_merge set on primary → both halves restored -------
  it("restores both halves when reject_merge is on the primary slot", () => {
    const student = buildMergedStudent();
    const override: ReviewOverride = {
      batch_id: "2023-2027",
      division: "Div-A",
      prn: "123B5B293",
      semester_label: "TY Sem VI",
      merge_decision: "reject_merge",
      decision: null,
      override_credits: null,
    };

    const overrides = new Map([
      [makeOverrideKey("Div-A", "123B5B293", "TY Sem VI"), override],
    ]);

    const [result] = applyOverridesToStudents([student], overrides);
    const primaryOut = result.internships.find((i) => i.semesterLabel === "TY Sem VI")!;
    const siblingOut = result.internships.find((i) => i.semesterLabel === "B.Tech Sem VII")!;

    // Both split flags should be cleared
    expect(primaryOut.possibleSplitInternship).toBe(false);
    expect(siblingOut.possibleSplitInternship).toBe(false);
    expect(primaryOut.splitMergeRole).toBeNull();
    expect(siblingOut.splitMergeRole).toBeNull();

    // Primary gets its original credits back
    expect(primaryOut.creditsCalculated).toBe(4); // splitOriginalCredits

    // Sibling gets its original credits back (null → contributes 0)
    expect(siblingOut.creditsCalculated).toBeNull();

    // Total = primary(4) + sibling(null→0) = 4
    // (In a realistic reject_merge where the sibling also had duration, total would be 8)
    expect(result.totalCreditsCalculated).toBe(4);

    // Split-specific reasons should be removed
    expect(primaryOut.reviewReasons).not.toContain("possible_duplicate_split");
    expect(siblingOut.reviewReasons).not.toContain("split_sibling");

    // Override info is still populated
    expect(primaryOut.reviewOverride?.mergeDecision).toBe("reject_merge");
  });

  // ------- Test 2: reject_merge set on sibling → both halves restored -------
  it("restores both halves when reject_merge is on the sibling slot", () => {
    const student = buildMergedStudent();
    const override: ReviewOverride = {
      batch_id: "2023-2027",
      division: "Div-A",
      prn: "123B5B293",
      semester_label: "B.Tech Sem VII", // override on sibling
      merge_decision: "reject_merge",
      decision: null,
      override_credits: null,
    };

    const overrides = new Map([
      [makeOverrideKey("Div-A", "123B5B293", "B.Tech Sem VII"), override],
    ]);

    const [result] = applyOverridesToStudents([student], overrides);
    const primaryOut = result.internships.find((i) => i.semesterLabel === "TY Sem VI")!;
    const siblingOut = result.internships.find((i) => i.semesterLabel === "B.Tech Sem VII")!;

    // Both should be restored even though the override was on the sibling
    expect(primaryOut.possibleSplitInternship).toBe(false);
    expect(siblingOut.possibleSplitInternship).toBe(false);
    expect(primaryOut.creditsCalculated).toBe(4);
    expect(siblingOut.creditsCalculated).toBeNull();
  });

  // ------- Test 3: reject_merge + both halves have credits → total is sum, not merged -------
  it("total reflects both halves independently when both had original credits", () => {
    // Build a split where both primary AND sibling originally had 2 credits each
    const primary = makeSlot({
      semesterLabel: "FY Sem I",
      company: "Cognizant",
      durationMonths: 4,            // 4 months → 3 credits merged
      creditsCalculated: 3,         // merged credits (max(2,2) → max(2,2) would actually be 2)
      needsReview: true,
      reviewReasons: ["possible_duplicate_split"],
      possibleSplitInternship: true,
      splitMergeRole: "primary",
      splitSiblingLabel: "FY Sem II",
      splitOriginalCredits: 2,      // pre-merge: 2 months → 2 credits
    });
    const sibling = makeSlot({
      semesterLabel: "FY Sem II",
      company: "Cognizant",
      durationMonths: null,         // nulled by merge
      creditsCalculated: null,      // nulled
      needsReview: true,
      reviewReasons: ["split_sibling"],
      possibleSplitInternship: true,
      splitMergeRole: "sibling",
      splitSiblingLabel: "FY Sem I",
      splitOriginalCredits: 2,      // pre-merge: had its own 2 credits
    });

    const student = makeStudent([primary, sibling], { totalCreditsCalculated: 3 });
    const override: ReviewOverride = {
      batch_id: "2023-2027",
      division: "Div-A",
      prn: "TEST001",
      semester_label: "FY Sem I",
      merge_decision: "reject_merge",
      decision: null,
      override_credits: null,
    };

    const overrides = new Map([
      [makeOverrideKey("Div-A", "TEST001", "FY Sem I"), override],
    ]);

    const [result] = applyOverridesToStudents([student], overrides);
    const primaryOut = result.internships.find((i) => i.semesterLabel === "FY Sem I")!;
    const siblingOut = result.internships.find((i) => i.semesterLabel === "FY Sem II")!;

    expect(primaryOut.creditsCalculated).toBe(2); // splitOriginalCredits
    expect(siblingOut.creditsCalculated).toBe(2); // splitOriginalCredits

    // Total = 2 + 2 = 4 (both credited independently after reject_merge)
    expect(result.totalCreditsCalculated).toBe(4);
  });

  // ------- Test 4: reject_merge + override_credits on primary → override_credits wins -------
  it("override_credits takes precedence over splitOriginalCredits on reject_merge", () => {
    const student = buildMergedStudent();
    const override: ReviewOverride = {
      batch_id: "2023-2027",
      division: "Div-A",
      prn: "123B5B293",
      semester_label: "TY Sem VI",
      merge_decision: "reject_merge",
      decision: null,
      override_credits: 3, // faculty manually set 3 credits
    };

    const overrides = new Map([
      [makeOverrideKey("Div-A", "123B5B293", "TY Sem VI"), override],
    ]);

    const [result] = applyOverridesToStudents([student], overrides);
    const primaryOut = result.internships.find((i) => i.semesterLabel === "TY Sem VI")!;

    expect(primaryOut.creditsCalculated).toBe(3); // override_credits wins
  });

  // ------- Test 5: no reject_merge → normal override behaviour unchanged -------
  it("leaves split merge intact when no reject_merge override is set", () => {
    const student = buildMergedStudent();
    // Normal approval override on primary (no merge_decision)
    const override: ReviewOverride = {
      batch_id: "2023-2027",
      division: "Div-A",
      prn: "123B5B293",
      semester_label: "TY Sem VI",
      decision: "approved",
      override_credits: null,
      merge_decision: null,
    };

    const overrides = new Map([
      [makeOverrideKey("Div-A", "123B5B293", "TY Sem VI"), override],
    ]);

    const [result] = applyOverridesToStudents([student], overrides);
    const primaryOut = result.internships.find((i) => i.semesterLabel === "TY Sem VI")!;
    const siblingOut = result.internships.find((i) => i.semesterLabel === "B.Tech Sem VII")!;

    // Merge should still be in effect
    expect(primaryOut.possibleSplitInternship).toBe(true);
    expect(primaryOut.splitMergeRole).toBe("primary");
    // needsReview cleared by "approved" decision
    expect(primaryOut.needsReview).toBe(false);
    // Sibling unchanged (no override on sibling slot)
    expect(siblingOut.creditsCalculated).toBeNull();
    expect(result.totalCreditsCalculated).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// resolveClassification regression — classification override bug fix
// ---------------------------------------------------------------------------

describe("applyOverridesToStudents — classification override resolution", () => {
  it('faculty classification: "company" overrides heuristic "certification" for AICTE entry', () => {
    // Arrange: internship name triggers the "certification" heuristic (contains "AICTE")
    const aicteInternship = makeSlot({
      semesterLabel: "FY Sem I",
      company: "AICTE Google AI/ML EduSkills",
      durationMonths: 2,
      // makeSlot calls classifyInternship → "certification" due to "AICTE" keyword
    });
    expect(aicteInternship.classification).toBe("certification"); // confirm heuristic baseline

    const student = makeStudent([aicteInternship], { prn: "REG001", division: "Div-A" });

    // Faculty has reviewed this and decided it qualifies as a real employer internship
    const override: ReviewOverride = {
      batch_id: "2023-2027",
      division: "Div-A",
      prn: "REG001",
      semester_label: "FY Sem I",
      classification: "company", // DB constraint only permits "company" or "certification"
      decision: "approved",
      override_credits: null,
      merge_decision: null,
    };

    const overrides = new Map([
      [makeOverrideKey("Div-A", "REG001", "FY Sem I"), override],
    ]);

    const [result] = applyOverridesToStudents([student], overrides);
    const out = result.internships[0];

    // Override must win — classification should be "company", NOT the heuristic "certification"
    expect(out.classification).toBe("company");
    // Prior to fix: resolveClassification checked `=== "internship"` (dead code) so this
    // would have returned "certification" instead — the bug this test pins down.
    expect(out.classification).not.toBe("certification");
    expect(out.reviewOverride?.classification).toBe("company");
    expect(out.needsReview).toBe(false); // cleared by "approved" decision
  });

  it('faculty classification: "certification" overrides heuristic "company" for a plain name', () => {
    // "Infosys SpringBoard" would default to "company" (no keywords match)
    const infosysInternship = makeSlot({
      semesterLabel: "SY Sem III",
      company: "Infosys SpringBoard",
      durationMonths: 3,
    });
    expect(infosysInternship.classification).toBe("company"); // heuristic baseline

    const student = makeStudent([infosysInternship], { prn: "REG002", division: "Div-B" });

    const override: ReviewOverride = {
      batch_id: "2023-2027",
      division: "Div-B",
      prn: "REG002",
      semester_label: "SY Sem III",
      classification: "certification", // faculty reclassifies to certification
      decision: null,
      override_credits: null,
      merge_decision: null,
    };

    const overrides = new Map([
      [makeOverrideKey("Div-B", "REG002", "SY Sem III"), override],
    ]);

    const [result] = applyOverridesToStudents([student], overrides);
    const out = result.internships[0];

    expect(out.classification).toBe("certification");
    expect(out.classification).not.toBe("company");
  });

  it("null classification override falls through to heuristic result", () => {
    // Override exists (e.g. credit decision only) but no classification is set
    const aicteInternship = makeSlot({
      semesterLabel: "TY Sem V",
      company: "AICTE Full Stack NPTEL",
      durationMonths: 2,
    });
    expect(aicteInternship.classification).toBe("certification");

    const student = makeStudent([aicteInternship], { prn: "REG003", division: "Div-C" });

    const override: ReviewOverride = {
      batch_id: "2023-2027",
      division: "Div-C",
      prn: "REG003",
      semester_label: "TY Sem V",
      classification: null, // no classification override
      decision: "approved",
      override_credits: 3,
      merge_decision: null,
    };

    const overrides = new Map([
      [makeOverrideKey("Div-C", "REG003", "TY Sem V"), override],
    ]);

    const [result] = applyOverridesToStudents([student], overrides);
    const out = result.internships[0];

    // Heuristic should be preserved when no classification override exists
    expect(out.classification).toBe("certification");
    // But credit override still applies
    expect(out.creditsCalculated).toBe(3);
  });
});
