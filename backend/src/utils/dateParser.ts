// ---------------------------------------------------------------------------
// Date Parser — normalizes messy real-world date strings from the sheet
// ---------------------------------------------------------------------------

interface ParseContext {
  prn?: string;
  semesterLabel?: string;
}

// Named months lookup (case-insensitive)
const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parse a raw date string into a JavaScript Date (UTC midnight).
 *
 * Handles formats seen in the real data:
 *   "6/10/2025"          → DD/MM/YYYY (Indian convention default)
 *   "10 July 2025"       → D Month YYYY
 *   "21 May, 2025"       → D Month, YYYY
 *   "1st July 2026"      → ordinal day + Month YYYY
 *   "April'2025"         → Month'YYYY (day defaults to 1)
 *   "25/May/25"          → DD/Month/YY (2-digit year → 2000+YY)
 *   "1st July"           → no year → returns null
 *   "5-Dec"              → no year → returns null
 *
 * Ambiguous numeric dates (e.g. "5/6/2025" where both ≤ 12) are parsed
 * as DD/MM but a warning is logged.
 *
 * Returns null (not an invalid date) when the string can't be parsed,
 * and logs the raw value with context for manual review.
 */
export function parseFlexibleDate(
  raw: string,
  context?: ParseContext
): Date | null {
  if (!raw || !raw.trim()) {
    return null;
  }

  const trimmed = raw.trim();

  // Try each pattern in priority order
  return (
    tryNumericSlashDash(trimmed, context) ??
    tryDayMonthNameYear(trimmed, context) ??
    tryMonthApostropheYear(trimmed, context) ??
    tryMonthSpaceYear(trimmed, context) ??
    tryDDMonthNameYY(trimmed, context) ??
    tryNoYearFallback(trimmed, context)
  );
}

// ---------------------------------------------------------------------------
// Pattern 1: Numeric with / or - separator → DD/MM/YYYY or DD-MM-YYYY
//   Also handles DD/MM/YY (2-digit year)
// ---------------------------------------------------------------------------

function tryNumericSlashDash(
  s: string,
  context?: ParseContext
): Date | null | undefined {
  const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!match) return undefined; // not this pattern — try next

  let first = parseInt(match[1], 10);
  let second = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);

  // 2-digit year → 2000+YY
  if (year < 100) year += 2000;

  let day: number;
  let month: number;

  if (first > 12 && second <= 12) {
    // Unambiguously DD/MM (day > 12 can't be a month)
    day = first;
    month = second - 1;
  } else if (second > 12 && first <= 12) {
    // Unambiguously MM/DD (second > 12 can't be a month, e.g. "11/24/2025")
    day = second;
    month = first - 1;
  } else {
    // Default: DD/MM/YYYY (Indian convention)
    day = first;
    month = second - 1; // 0-indexed

    // Log warning if ambiguous (both values ≤ 12)
    if (first <= 12 && second <= 12 && first !== second) {
      const ctxStr = formatContext(context);
      console.warn(
        `[dateParser] Ambiguous date "${s}"${ctxStr} — defaulting to DD/MM/YYYY (Indian convention)`
      );
    }
  }

  // Validate
  if (month < 0 || month > 11 || day < 1 || day > 31) {
    logUnparseable(s, context);
    return null;
  }

  return makeUTCDate(year, month, day);
}

// ---------------------------------------------------------------------------
// Pattern 2: "10 July 2025", "21 May, 2025", "1st July 2026"
//   <day> <monthName> <year>   (with optional ordinal suffix and comma)
// ---------------------------------------------------------------------------

function tryDayMonthNameYear(
  s: string,
  context?: ParseContext
): Date | null | undefined {
  // Strip ordinal suffixes: 1st, 2nd, 3rd, 4th, etc.
  // Also handles spaced ordinals like "30 th July 2026"
  const cleaned = s.replace(/(\d+)\s*(st|nd|rd|th)\b/gi, "$1");

  // Accept 2-digit or 4-digit year: "12 Jan 26", "10 July 2025"
  const match = cleaned.match(
    /^(\d{1,2})\s+([a-z]+),?\s+(\d{2,4})$/i
  );
  if (!match) return undefined;

  const day = parseInt(match[1], 10);
  const monthStr = match[2].toLowerCase();
  let year = parseInt(match[3], 10);

  const month = MONTH_MAP[monthStr];
  if (month === undefined) return undefined; // not a valid month name — try next pattern

  // 2-digit year → 2000+YY
  if (year < 100) year += 2000;

  if (day < 1 || day > 31) {
    logUnparseable(s, context);
    return null;
  }

  return makeUTCDate(year, month, day);
}

// ---------------------------------------------------------------------------
// Pattern 3: "April'2025" → Month'YYYY  (day defaults to 1)
// ---------------------------------------------------------------------------

function tryMonthApostropheYear(
  s: string,
  context?: ParseContext
): Date | null | undefined {
  // Allow optional space before apostrophe: "April'2025" and "Jan' 2026"
  const match = s.match(/^([a-z]+)\s*['\u2019]\s*(\d{4})$/i);
  if (!match) return undefined;

  const monthStr = match[1].toLowerCase();
  const year = parseInt(match[2], 10);

  const month = MONTH_MAP[monthStr];
  if (month === undefined) return undefined;

  return makeUTCDate(year, month, 1);
}

// ---------------------------------------------------------------------------
// Pattern 3b: "April 2025", "June 2025" → Month YYYY  (day defaults to 1)
// ---------------------------------------------------------------------------

function tryMonthSpaceYear(
  s: string,
  context?: ParseContext
): Date | null | undefined {
  const match = s.match(/^([a-z]+)\s+(\d{4})$/i);
  if (!match) return undefined;

  const monthStr = match[1].toLowerCase();
  const year = parseInt(match[2], 10);

  const month = MONTH_MAP[monthStr];
  if (month === undefined) return undefined;

  return makeUTCDate(year, month, 1);
}

// ---------------------------------------------------------------------------
// Pattern 4: "25/May/25" → DD/MonthName/YY
// ---------------------------------------------------------------------------

function tryDDMonthNameYY(
  s: string,
  context?: ParseContext
): Date | null | undefined {
  const match = s.match(/^(\d{1,2})[\/\-]([a-z]+)[\/\-](\d{2,4})$/i);
  if (!match) return undefined;

  const day = parseInt(match[1], 10);
  const monthStr = match[2].toLowerCase();
  let year = parseInt(match[3], 10);

  const month = MONTH_MAP[monthStr];
  if (month === undefined) return undefined;

  if (year < 100) year += 2000;

  if (day < 1 || day > 31) {
    logUnparseable(s, context);
    return null;
  }

  return makeUTCDate(year, month, day);
}

// ---------------------------------------------------------------------------
// Pattern 5 (fallback): no year → "5-Dec", "1st July"
//   Return null and log — we refuse to guess the year
// ---------------------------------------------------------------------------

function tryNoYearFallback(
  s: string,
  context?: ParseContext
): null {
  // Check if it looks like a date-ish pattern but missing year
  const cleaned = s.replace(/(\d+)\s*(st|nd|rd|th)\b/gi, "$1");

  const hasDatePattern =
    /^\d{1,2}[\s\-\/][a-z]+$/i.test(cleaned) || // "5-Dec", "5 Dec"
    /^[a-z]+[\s\-\/]\d{1,2}$/i.test(cleaned) || // "Dec-5", "Dec 5"
    /^\d{1,2}\s+[a-z]+$/i.test(cleaned);         // "1 July"

  if (hasDatePattern) {
    const ctxStr = formatContext(context);
    console.warn(
      `[dateParser] Date missing year: "${s}"${ctxStr} — returning null for manual review (refusing to guess year)`
    );
    return null;
  }

  // Truly unparseable
  logUnparseable(s, context);
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUTCDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function logUnparseable(raw: string, context?: ParseContext): void {
  const ctxStr = formatContext(context);
  console.warn(
    `[dateParser] Unparseable date: "${raw}"${ctxStr} — flagged for manual review`
  );
}

function formatContext(context?: ParseContext): string {
  if (!context) return "";
  const parts: string[] = [];
  if (context.prn) parts.push(`PRN=${context.prn}`);
  if (context.semesterLabel) parts.push(`sem=${context.semesterLabel}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}
