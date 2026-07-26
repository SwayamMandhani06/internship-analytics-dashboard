import { Router, Request, Response, NextFunction } from "express";
import { BATCHES } from "../config/batches";
import { DIVISIONS } from "../config/divisions";
import { getEnrichedStudents } from "../services/studentEnrichmentService";

const router = Router();

// Helper to validate query parameters (400 for missing/invalid batch or invalid division)
function validateParams(req: Request, res: Response) {
  const batchId = req.query.batch as string | undefined;
  const division = req.query.division as string | undefined;

  if (!batchId) {
    res.status(400).json({ error: "Missing required query param: batch" });
    return null;
  }

  const batchConfig = BATCHES.find((b) => b.id === batchId);
  if (!batchConfig) {
    res.status(400).json({
      error: `Unknown batch: "${batchId}". Valid batches: ${BATCHES.map((b) => b.id).join(", ")}`,
    });
    return null;
  }

  if (division && !(DIVISIONS as readonly string[]).includes(division)) {
    res.status(400).json({
      error: `Unknown division: "${division}". Valid divisions: ${DIVISIONS.join(", ")}`,
    });
    return null;
  }

  return { batchId, division };
}

// Upstream Sheets API error handler helper
function handleRouteError(err: any, res: Response, next: NextFunction) {
  console.error("[analytics] Error:", err);
  const isUpstream =
    err?.config?.url?.includes("googleapis.com") ||
    err?.domain === "global" ||
    (err?.message &&
      (err.message.includes("Google") ||
        err.message.includes("Sheets") ||
        err.message.includes("Gaxios") ||
        err.message.includes("invalid_grant") ||
        err.message.includes("JWT")));

  if (isUpstream) {
    return res.status(502).json({
      error: `Upstream Google Sheets API error: ${err.message || "Failed to fetch from Google Sheets API"}`,
    });
  }
  return next(err);
}

// ---------------------------------------------------------------------------
// GET /api/analytics/overview
// ---------------------------------------------------------------------------
router.get("/analytics/overview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = validateParams(req, res);
    if (!params) return;

    const { batchId, division } = params;
    const refresh = req.query.refresh === "true";

    // Always fetch all students in the batch first for division comparison breakdown
    const allBatchStudents = await getEnrichedStudents(batchId, undefined, refresh);

    // Filter students for top-level stats if division is specified
    const filteredStudents = division
      ? allBatchStudents.filter((s) => s.division === division)
      : allBatchStudents;

    const totalStudents = filteredStudents.length;
    const studentsWithAtLeastOneInternship = filteredStudents.filter(
      (s) => s.internships.length > 0
    ).length;
    const studentsWithNoInternship = totalStudents - studentsWithAtLeastOneInternship;

    // Calculate unique companies (case-insensitive normalized group)
    const companySet = new Set<string>();
    filteredStudents.forEach((s) => {
      s.internships.forEach((i) => {
        if (i.company && i.company.trim()) {
          companySet.add(i.company.trim().toLowerCase());
        }
      });
    });
    const totalUniqueCompanies = companySet.size;

    const totalCreditsCalculated = filteredStudents.reduce(
      (sum, s) => sum + s.totalCreditsCalculated,
      0
    );
    const averageCreditsPerStudent =
      totalStudents > 0 ? Math.round((totalCreditsCalculated / totalStudents) * 100) / 100 : 0;

    const totalInternshipEntries = filteredStudents.reduce(
      (sum, s) => sum + s.internships.length,
      0
    );

    // Review counts & breakdown
    let entriesNeedingReview = 0;
    const breakdown = {
      unparseable_duration: 0,
      unparseable_start_date: 0,
      unparseable_end_date: 0,
      certification_style: 0,
    };

    filteredStudents.forEach((s) => {
      s.internships.forEach((i) => {
        if (i.needsReview) {
          entriesNeedingReview++;
          i.reviewReasons.forEach((reason) => {
            if (reason in breakdown) {
              breakdown[reason as keyof typeof breakdown]++;
            }
          });
        }
      });
    });

    // Compute division breakdown (always for all 4 divisions of this batch)
    const divisionBreakdown = DIVISIONS.map((div) => {
      const divStudents = allBatchStudents.filter((s) => s.division === div);
      const divStudentCount = divStudents.length;
      const divCredits = divStudents.reduce((sum, s) => sum + s.totalCreditsCalculated, 0);
      const divAvg =
        divStudentCount > 0 ? Math.round((divCredits / divStudentCount) * 100) / 100 : 0;

      return {
        division: div,
        studentCount: divStudentCount,
        totalCreditsCalculated: divCredits,
        averageCreditsPerStudent: divAvg,
      };
    });

    res.json({
      totalStudents,
      studentsWithAtLeastOneInternship,
      studentsWithNoInternship,
      totalUniqueCompanies,
      totalCreditsCalculated,
      averageCreditsPerStudent,
      totalInternshipEntries,
      entriesNeedingReview,
      entriesNeedingReviewBreakdown: breakdown,
      divisionBreakdown,
    });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/companies
// ---------------------------------------------------------------------------
router.get("/analytics/companies", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = validateParams(req, res);
    if (!params) return;

    const { batchId, division } = params;
    const refresh = req.query.refresh === "true";

    const students = await getEnrichedStudents(batchId, division, refresh);

    // Grouping structure to aggregate details by normalized company name
    // NOTE: This list conflates real employer names with certification/program names
    // (e.g. "AICTE Android Internship", "Java Certification") since the source data
    // doesn't distinguish them — do not attempt to auto-classify, just pass through faithfully.
    const companyGroups = new Map<
      string,
      {
        originalName: string;
        studentPrns: Set<string>;
        internshipCount: number;
        divisionPrns: Record<string, Set<string>>;
      }
    >();

    students.forEach((student) => {
      student.internships.forEach((internship) => {
        if (!internship.company || !internship.company.trim()) return;

        const rawCompany = internship.company.trim();
        const normKey = rawCompany.toLowerCase().replace(/\s+/g, " ");

        let group = companyGroups.get(normKey);
        if (!group) {
          group = {
            originalName: rawCompany,
            studentPrns: new Set<string>(),
            internshipCount: 0,
            divisionPrns: {
              "Div-A": new Set<string>(),
              "Div-B": new Set<string>(),
              "Div-C": new Set<string>(),
              "Div-D": new Set<string>(),
            },
          };
          companyGroups.set(normKey, group);
        }

        group.studentPrns.add(student.prn);
        group.internshipCount++;
        if (group.divisionPrns[student.division]) {
          group.divisionPrns[student.division].add(student.prn);
        }
      });
    });

    const result = Array.from(companyGroups.values()).map((group) => ({
      company: group.originalName,
      studentCount: group.studentPrns.size,
      internshipCount: group.internshipCount,
      divisionBreakdown: {
        "Div-A": group.divisionPrns["Div-A"].size,
        "Div-B": group.divisionPrns["Div-B"].size,
        "Div-C": group.divisionPrns["Div-C"].size,
        "Div-D": group.divisionPrns["Div-D"].size,
      },
    }));

    // Sort descending by studentCount, then internshipCount, then company name
    result.sort((a, b) => {
      if (b.studentCount !== a.studentCount) {
        return b.studentCount - a.studentCount;
      }
      if (b.internshipCount !== a.internshipCount) {
        return b.internshipCount - a.internshipCount;
      }
      return a.company.localeCompare(b.company);
    });

    res.json(result);
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/credits
// ---------------------------------------------------------------------------
router.get("/analytics/credits", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = validateParams(req, res);
    if (!params) return;

    const { batchId, division } = params;
    const refresh = req.query.refresh === "true";

    const students = await getEnrichedStudents(batchId, division, refresh);

    const totalStudents = students.length;
    const totalCreditsCalculated = students.reduce(
      (sum, s) => sum + s.totalCreditsCalculated,
      0
    );
    const averageCreditsPerStudent =
      totalStudents > 0 ? Math.round((totalCreditsCalculated / totalStudents) * 100) / 100 : 0;

    // Credit value distribution grouping
    const distributionMap = new Map<number, number>();
    students.forEach((s) => {
      const val = s.totalCreditsCalculated;
      distributionMap.set(val, (distributionMap.get(val) || 0) + 1);
    });

    const distribution = Array.from(distributionMap.entries())
      .map(([creditValue, studentCount]) => ({
        creditValue,
        studentCount,
      }))
      .sort((a, b) => a.creditValue - b.creditValue);

    // Detailed student listing with discrepancy & needsReview flags
    const studentList = students.map((s) => {
      const sheetTotal = parseFloat(s.sheetReportedTotalCredits) || 0;
      const discrepancy = s.totalCreditsCalculated !== sheetTotal;
      const needsReview = s.internships.some((i) => i.needsReview);

      return {
        name: s.name,
        prn: s.prn,
        division: s.division,
        internshipCount: s.internships.length,
        totalCreditsCalculated: s.totalCreditsCalculated,
        sheetReportedTotalCredits: s.sheetReportedTotalCredits,
        discrepancy,
        needsReview,
      };
    });

    // Review summary breakdown by reason for filtered students
    const reviewSummary = {
      unparseable_duration: 0,
      unparseable_start_date: 0,
      unparseable_end_date: 0,
      certification_style: 0,
    };

    students.forEach((s) => {
      s.internships.forEach((i) => {
        if (i.needsReview) {
          i.reviewReasons.forEach((reason) => {
            if (reason in reviewSummary) {
              reviewSummary[reason as keyof typeof reviewSummary]++;
            }
          });
        }
      });
    });

    res.json({
      totalCreditsCalculated,
      averageCreditsPerStudent,
      distribution,
      studentList,
      reviewSummary,
    });
  } catch (err) {
    handleRouteError(err, res, next);
  }
});

export default router;
