// ---------------------------------------------------------------------------
// Status Calculator — derives internship status from parsed dates
// ---------------------------------------------------------------------------

export type InternshipStatus = "Completed" | "Ongoing" | "Not Started" | "Unknown";

/**
 * Determine the status of an internship entry based on its parsed dates.
 *
 * Rules (evaluated in order):
 *   1. If both dates failed to parse → "Unknown"
 *   2. endDate exists and is in the past → "Completed"
 *   3. startDate is in the past AND (endDate is missing OR in the future) → "Ongoing"
 *   4. startDate exists and is in the future → "Not Started"
 *   5. Fallback → "Unknown"
 *
 * "Unknown" is surfaced honestly in the UI rather than silently guessing.
 *
 * @param startDate - Parsed start date (null if unparseable)
 * @param endDate   - Parsed end date (null if unparseable)
 * @param today     - Reference date for comparison (injected for testability)
 */
export function calculateStatus(
  startDate: Date | null,
  endDate: Date | null,
  today: Date
): InternshipStatus {
  // Both dates missing → we can't determine anything
  if (!startDate && !endDate) {
    return "Unknown";
  }

  // endDate exists and is in the past → completed
  if (endDate && endDate < today) {
    return "Completed";
  }

  // startDate is in the past and either no endDate or endDate in the future → ongoing
  if (startDate && startDate <= today && (!endDate || endDate >= today)) {
    return "Ongoing";
  }

  // startDate exists and is in the future → not started yet
  if (startDate && startDate > today) {
    return "Not Started";
  }

  // Fallback — shouldn't normally be reached, but be honest
  return "Unknown";
}
