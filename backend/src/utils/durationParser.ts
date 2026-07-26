// ---------------------------------------------------------------------------
// Duration Parser — normalizes messy real-world duration strings to months
// ---------------------------------------------------------------------------

export interface DurationResult {
  /** Duration normalized to months */
  months: number;
  /**
   * true when the original value was specified in hours — these are typically
   * short certification / course-style entries (e.g. "Java Certification — 135.5 hours")
   * and should NOT receive standard internship credits under the department's
   * duration-based rules.
   */
  isCertificationStyle: boolean;
}

interface ParseContext {
  prn?: string;
  semesterLabel?: string;
}

// Conversion constants
const WEEKS_PER_MONTH = 4.33;
const DAYS_PER_MONTH = 30;
const HOURS_PER_MONTH = 730;

/**
 * Parse a raw duration string into a normalised month value.
 *
 * Supported formats (case-insensitive, tolerant of extra whitespace):
 *   "4 weeks", "2 Month", "3 Month", "10 weeks", "135.5 hours",
 *   "135.5hr", "1.5 months", "6 Months", "1month" (no space),
 *   "10 days", "2 weeks", etc.
 *
 * Returns `null` when the string cannot be parsed — the caller should
 * surface this honestly as a "needs review" entry rather than silently
 * defaulting to 0.
 */
export function parseDurationToMonths(
  raw: string,
  context?: ParseContext
): DurationResult | null {
  if (!raw || !raw.trim()) {
    return null;
  }

  // Normalise: lowercase, collapse whitespace, trim
  const normalised = raw.trim().toLowerCase().replace(/\s+/g, " ");

  // Match pattern: <number> <unit>
  // The number can be integer or decimal (e.g. 1.5, 135.5)
  // The unit can be directly attached (e.g. "1month", "135.5hr")
  const match = normalised.match(
    /^(\d+(?:\.\d+)?)\s*(months?|mons?|weeks?|wks?|days?|hours?|hrs?)\s*$/
  );

  if (!match) {
    const ctxStr = formatContext(context);
    console.warn(
      `[durationParser] Unparseable duration: "${raw}"${ctxStr} — flagged for manual review`
    );
    return null;
  }

  const value = parseFloat(match[1]);
  const unit = match[2];

  if (value <= 0 || !isFinite(value)) {
    const ctxStr = formatContext(context);
    console.warn(
      `[durationParser] Invalid numeric value in duration: "${raw}"${ctxStr} — flagged for manual review`
    );
    return null;
  }

  // Determine unit category and convert
  if (/^months?$/.test(unit) || /^mons?$/.test(unit)) {
    return { months: round(value), isCertificationStyle: false };
  }

  if (/^weeks?$/.test(unit) || /^wks?$/.test(unit)) {
    return {
      months: round(value / WEEKS_PER_MONTH),
      isCertificationStyle: false,
    };
  }

  if (/^days?$/.test(unit)) {
    return {
      months: round(value / DAYS_PER_MONTH),
      isCertificationStyle: false,
    };
  }

  if (/^hours?$/.test(unit) || /^hrs?$/.test(unit)) {
    return {
      months: round(value / HOURS_PER_MONTH),
      isCertificationStyle: true,
    };
  }

  // Should not be reachable given the regex, but safety fallback
  const ctxStr = formatContext(context);
  console.warn(
    `[durationParser] Unrecognised unit in duration: "${raw}"${ctxStr} — flagged for manual review`
  );
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatContext(context?: ParseContext): string {
  if (!context) return "";
  const parts: string[] = [];
  if (context.prn) parts.push(`PRN=${context.prn}`);
  if (context.semesterLabel) parts.push(`sem=${context.semesterLabel}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}
