import { Router, Request, Response, NextFunction } from "express";
import { BATCHES } from "../config/batches";
import { DIVISIONS } from "../config/divisions";
import { getEnrichedStudents } from "../services/studentEnrichmentService";
import {
  getOverridesForBatch,
  upsertOverride,
  bulkUpsertOverrides,
  deleteOverride,
  type Decision,
  type Classification,
  type MergeDecision,
} from "../services/reviewOverrideService";

const router = Router();

// ---------------------------------------------------------------------------
// Enum constants for validation
// ---------------------------------------------------------------------------

const VALID_DECISIONS: Decision[] = ["approved", "declined", "pending"];
// DB constraint on review_overrides.classification only allows these two values:
const VALID_CLASSIFICATIONS: Classification[] = ["company", "certification"];
const VALID_MERGE_DECISIONS: MergeDecision[] = ["confirm_merge", "reject_merge"];

// ---------------------------------------------------------------------------
// Shared error handler
// ---------------------------------------------------------------------------

function handleError(err: any, res: Response, next: NextFunction) {
  console.error("[reviews] Error:", err);
  if (err instanceof Error && err.message.includes("[reviewOverrideService]")) {
    return res.status(500).json({ error: err.message });
  }
  return next(err);
}

// ---------------------------------------------------------------------------
// GET /api/reviews?batch=X&division=Y
// Returns all override records for the given scope.
// ---------------------------------------------------------------------------

router.get("/reviews", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = req.query.batch as string | undefined;
    const division = req.query.division as string | undefined;

    if (!batchId) {
      res.status(400).json({ error: "Missing required query param: batch" });
      return;
    }
    if (!BATCHES.find((b) => b.id === batchId)) {
      res.status(400).json({
        error: `Unknown batch: "${batchId}". Valid batches: ${BATCHES.map((b) => b.id).join(", ")}`,
      });
      return;
    }
    if (division && !(DIVISIONS as readonly string[]).includes(division)) {
      res.status(400).json({
        error: `Unknown division: "${division}". Valid divisions: ${DIVISIONS.join(", ")}`,
      });
      return;
    }

    const overridesMap = await getOverridesForBatch(batchId, division);
    res.json(Array.from(overridesMap.values()));
  } catch (err) {
    handleError(err, res, next);
  }
});

// ---------------------------------------------------------------------------
// POST /api/reviews
// Upsert one override row; sets reviewed_at to now().
// ---------------------------------------------------------------------------

router.post("/reviews", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      batchId,
      division,
      prn,
      semesterLabel,
      siblingSemesterLabel,
      internshipNameSnapshot,
      decision,
      classification,
      mergeDecision,
      overrideCredits,
      reviewedBy,
      note,
    } = req.body;

    // --- Required field validation ---
    if (!batchId || typeof batchId !== "string") {
      res.status(400).json({ error: "Missing required field: batchId" });
      return;
    }
    if (!division || typeof division !== "string") {
      res.status(400).json({ error: "Missing required field: division" });
      return;
    }
    if (!prn || typeof prn !== "string") {
      res.status(400).json({ error: "Missing required field: prn" });
      return;
    }
    if (!semesterLabel || typeof semesterLabel !== "string") {
      res.status(400).json({ error: "Missing required field: semesterLabel" });
      return;
    }
    if (!internshipNameSnapshot || typeof internshipNameSnapshot !== "string") {
      res.status(400).json({ error: "Missing required field: internshipNameSnapshot" });
      return;
    }

    // --- Enum validation ---
    if (decision !== undefined && decision !== null && !VALID_DECISIONS.includes(decision)) {
      res.status(400).json({
        error: `Invalid decision: "${decision}". Valid values: ${VALID_DECISIONS.join(", ")}`,
      });
      return;
    }
    if (
      classification !== undefined &&
      classification !== null &&
      !VALID_CLASSIFICATIONS.includes(classification)
    ) {
      res.status(400).json({
        error: `Invalid classification: "${classification}". Valid values: ${VALID_CLASSIFICATIONS.join(", ")}`,
      });
      return;
    }
    if (
      mergeDecision !== undefined &&
      mergeDecision !== null &&
      !VALID_MERGE_DECISIONS.includes(mergeDecision)
    ) {
      res.status(400).json({
        error: `Invalid mergeDecision: "${mergeDecision}". Valid values: ${VALID_MERGE_DECISIONS.join(", ")}`,
      });
      return;
    }
    if (!BATCHES.find((b) => b.id === batchId)) {
      res.status(400).json({
        error: `Unknown batch: "${batchId}". Valid batches: ${BATCHES.map((b) => b.id).join(", ")}`,
      });
      return;
    }
    if (!(DIVISIONS as readonly string[]).includes(division)) {
      res.status(400).json({
        error: `Unknown division: "${division}". Valid divisions: ${DIVISIONS.join(", ")}`,
      });
      return;
    }

    const result = await upsertOverride({
      batch_id: batchId,
      division,
      prn,
      semester_label: semesterLabel,
      sibling_semester_label: siblingSemesterLabel ?? null,
      internship_name_snapshot: internshipNameSnapshot,
      decision: decision ?? null,
      classification: classification ?? null,
      merge_decision: mergeDecision ?? null,
      override_credits: overrideCredits ?? null,
      reviewed_by: reviewedBy ?? null,
      note: note ?? null,
    });

    res.status(200).json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

// ---------------------------------------------------------------------------
// POST /api/reviews/bulk
// Apply the same decision to every currently-matching entry in scope.
// Fetches enriched student data to resolve which entries match the filter,
// then bulk-upserts overrides for all of them.
// ---------------------------------------------------------------------------

router.post("/reviews/bulk", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId, division, filter, action, reviewedBy } = req.body;

    // --- Required field validation ---
    if (!batchId || typeof batchId !== "string") {
      res.status(400).json({ error: "Missing required field: batchId" });
      return;
    }
    if (!filter || !["all", "needsReview", "certificationsOnly"].includes(filter)) {
      res.status(400).json({
        error: 'Missing or invalid filter. Valid values: "all", "needsReview", "certificationsOnly"',
      });
      return;
    }
    if (!action || typeof action !== "object") {
      res.status(400).json({ error: "Missing required field: action (object)" });
      return;
    }
    if (!BATCHES.find((b) => b.id === batchId)) {
      res.status(400).json({
        error: `Unknown batch: "${batchId}". Valid batches: ${BATCHES.map((b) => b.id).join(", ")}`,
      });
      return;
    }
    if (division && !(DIVISIONS as readonly string[]).includes(division)) {
      res.status(400).json({
        error: `Unknown division: "${division}". Valid divisions: ${DIVISIONS.join(", ")}`,
      });
      return;
    }

    // --- Enum validation on action fields ---
    if (
      action.decision !== undefined &&
      action.decision !== null &&
      !VALID_DECISIONS.includes(action.decision)
    ) {
      res.status(400).json({
        error: `Invalid action.decision: "${action.decision}". Valid values: ${VALID_DECISIONS.join(", ")}`,
      });
      return;
    }
    if (
      action.classification !== undefined &&
      action.classification !== null &&
      !VALID_CLASSIFICATIONS.includes(action.classification)
    ) {
      res.status(400).json({
        error: `Invalid action.classification: "${action.classification}". Valid values: ${VALID_CLASSIFICATIONS.join(", ")}`,
      });
      return;
    }
    if (
      action.mergeDecision !== undefined &&
      action.mergeDecision !== null &&
      !VALID_MERGE_DECISIONS.includes(action.mergeDecision)
    ) {
      res.status(400).json({
        error: `Invalid action.mergeDecision: "${action.mergeDecision}". Valid values: ${VALID_MERGE_DECISIONS.join(", ")}`,
      });
      return;
    }

    // --- Resolve matching entries from enriched student data ---
    const { students } = await getEnrichedStudents(batchId, division ?? undefined);

    const entries: Parameters<typeof bulkUpsertOverrides>[0] = [];

    for (const student of students) {
      for (const internship of student.internships) {
        const matches =
          filter === "all" ||
          (filter === "needsReview" && internship.needsReview) ||
          (filter === "certificationsOnly" && internship.isCertificationStyle);

        if (matches) {
          entries.push({
            batch_id: batchId,
            division: student.division,
            prn: student.prn,
            semester_label: internship.semesterLabel,
            internship_name_snapshot: internship.company,
            decision: action.decision ?? null,
            classification: action.classification ?? null,
            merge_decision: action.mergeDecision ?? null,
            override_credits: null,
            reviewed_by: reviewedBy ?? null,
            note: null,
          });
        }
      }
    }

    const results = await bulkUpsertOverrides(entries);

    res.status(200).json({
      applied: results.length,
      filter,
      batchId,
      division: division ?? null,
    });
  } catch (err) {
    handleError(err, res, next);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/reviews/:batchId/:division/:prn/:semesterLabel
// Reset a single entry to pending by removing the override row.
// ---------------------------------------------------------------------------

router.delete(
  "/reviews/:batchId/:division/:prn/:semesterLabel",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { batchId, division, prn, semesterLabel } = req.params;

      if (!BATCHES.find((b) => b.id === batchId)) {
        res.status(400).json({
          error: `Unknown batch: "${batchId}". Valid batches: ${BATCHES.map((b) => b.id).join(", ")}`,
        });
        return;
      }
      if (!(DIVISIONS as readonly string[]).includes(division)) {
        res.status(400).json({
          error: `Unknown division: "${division}". Valid divisions: ${DIVISIONS.join(", ")}`,
        });
        return;
      }

      await deleteOverride(batchId, division, prn, decodeURIComponent(semesterLabel));
      res.status(204).send();
    } catch (err) {
      handleError(err, res, next);
    }
  }
);

export default router;
