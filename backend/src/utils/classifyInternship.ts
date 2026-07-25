// ---------------------------------------------------------------------------
// Internship vs Certification Classifier
// ---------------------------------------------------------------------------

/**
 * List of keywords used to heuristically identify certification, course, or
 * training-style entries in internship name fields.
 *
 * Case-insensitive match. Easy to extend with new keywords as needed.
 */
export const CERTIFICATION_KEYWORDS: readonly string[] = [
  "certification",
  "certificate",
  "masterclass",
  "AICTE",
  "NPTEL",
  "EduSkills",
  "Winter School",
  "Summer School",
  "Career Launchpad",
  "Virtual Internship",
];

export type InternshipClassification = "company" | "certification";

/**
 * Heuristically classify an internship entry based on its name.
 *
 * @param internshipName The raw name entered in the sheet
 * @returns `"certification"` if the name contains any keyword from CERTIFICATION_KEYWORDS (case-insensitive),
 *          otherwise `"company"`.
 */
export function classifyInternship(internshipName: string): InternshipClassification {
  if (!internshipName || !internshipName.trim()) {
    return "company";
  }

  const normalized = internshipName.toLowerCase();

  for (const keyword of CERTIFICATION_KEYWORDS) {
    if (normalized.includes(keyword.toLowerCase())) {
      return "certification";
    }
  }

  return "company";
}
