// ---------------------------------------------------------------------------
// Credit Rules — THE single source of truth for department credit policy
// ---------------------------------------------------------------------------
//
// ⚠️  MAINTAINERS: update ONLY this table when the department changes its
//     credit policy. All downstream calculations flow from here.
//
// Each rule defines an inclusive [minMonths, maxMonths) range and the credits
// awarded for internships whose duration falls within that range.
//
// The brackets below are a sensible default. Replace with the department's
// official table once available.
// ---------------------------------------------------------------------------

export interface CreditRule {
  /** Inclusive lower bound (months) */
  minMonths: number;
  /** Exclusive upper bound (months) — use Infinity for the last tier */
  maxMonths: number;
  /** Credits awarded */
  credits: number;
}

/**
 * Department credit policy brackets.
 *
 *   Duration (months)  │  Credits
 *   ──────────────────-┼─────────
 *   < 1                │  0
 *   1  – < 2           │  1
 *   2  – < 4           │  2
 *   4  – < 6           │  3
 *   6+                 │  4
 */
export const CREDIT_RULES: CreditRule[] = [
  { minMonths: 0,   maxMonths: 1,        credits: 0 },
  { minMonths: 1,   maxMonths: 2,        credits: 1 },
  { minMonths: 2,   maxMonths: 4,        credits: 2 },
  { minMonths: 4,   maxMonths: 6,        credits: 3 },
  { minMonths: 6,   maxMonths: Infinity, credits: 4 },
];

/**
 * Calculate credits for an internship entry based on its duration.
 *
 * @param durationMonths      - Duration in months (from parseDurationToMonths)
 * @param isCertificationStyle - true for hours-based entries (short certifications)
 *
 * @returns
 *   - The matched credit value for valid standard internships
 *   - `null` for certification-style entries (needs manual review — these are
 *     short courses, not month-long placements)
 *   - `null` for durations that are 0, negative, or don't match any rule
 *
 * Never returns 0 silently for ambiguous inputs — always `null` to surface
 * the need for manual review.
 */
export function calculateCredits(
  durationMonths: number,
  isCertificationStyle: boolean
): number | null {
  // Certification-style entries (hours-based) need manual review
  if (isCertificationStyle) {
    return null;
  }

  // Invalid durations
  if (!isFinite(durationMonths) || durationMonths <= 0) {
    return null;
  }

  // Find matching tier
  for (const rule of CREDIT_RULES) {
    if (durationMonths >= rule.minMonths && durationMonths < rule.maxMonths) {
      return rule.credits;
    }
  }

  // No matching rule (should not happen if rules cover [0, Infinity))
  return null;
}
