import { Router, Request, Response } from "express";
import { BATCHES } from "../config/batches";
import { DIVISIONS } from "../config/divisions";
import { getEnrichedStudents } from "../services/studentEnrichmentService";

const router = Router();

router.get("/students", async (req: Request, res: Response) => {
  try {
    const batchId = req.query.batch as string | undefined;
    const division = req.query.division as string | undefined;
    const refresh = req.query.refresh === "true";

    // Validate batch param
    if (!batchId) {
      res.status(400).json({ error: "Missing required query param: batch" });
      return;
    }

    const batchConfig = BATCHES.find((b) => b.id === batchId);
    if (!batchConfig) {
      res.status(400).json({
        error: `Unknown batch: "${batchId}". Valid batches: ${BATCHES.map((b) => b.id).join(", ")}`,
      });
      return;
    }

    // Validate division param (if provided)
    if (division && !(DIVISIONS as readonly string[]).includes(division)) {
      res.status(400).json({
        error: `Unknown division: "${division}". Valid divisions: ${DIVISIONS.join(", ")}`,
      });
      return;
    }

    // Fetch enriched data (leveraging cache inside Sheets API)
    const { students: enrichedStudents, overridesApplied } =
      await getEnrichedStudents(batchId, division, refresh);

    // Compute summary stats
    const totalInternships = enrichedStudents.reduce(
      (sum, s) => sum + s.internships.length,
      0
    );
    const reviewEntries = enrichedStudents.flatMap((s) =>
      s.internships
        .filter((i) => i.needsReview)
        .map((i) => ({
          prn: s.prn,
          name: s.name,
          semesterLabel: i.semesterLabel,
          company: i.company,
          reasons: i.reviewReasons,
        }))
    );

    res.json({
      overridesApplied,
      count: enrichedStudents.length,
      totalInternshipEntries: totalInternships,
      needsReviewCount: reviewEntries.length,
      needsReviewSummary: reviewEntries,
      data: enrichedStudents,
    });
  } catch (err) {
    console.error("[students] Error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;
export type { EnrichedStudent, EnrichedInternship } from "../services/studentEnrichmentService";
