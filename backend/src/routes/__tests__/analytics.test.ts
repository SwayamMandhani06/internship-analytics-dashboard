import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import analyticsRouter from "../analytics";
import * as enrichmentService from "../../services/studentEnrichmentService";

// Mock the enrichment service
vi.mock("../../services/studentEnrichmentService", () => {
  return {
    getEnrichedStudents: vi.fn(),
  };
});

// Setup sample mocked data
const mockEnrichedStudents = [
  {
    prn: "123B1B001",
    name: "Alice Smith",
    division: "Div-A",
    totalCreditsCalculated: 4,
    sheetReportedTotalCredits: "3",
    sheetReportedRemainingCredits: "13",
    internships: [
      {
        semesterLabel: "FY Sem I",
        company: "Google",
        startDateRaw: "1/6/2025",
        endDateRaw: "1/8/2025",
        startDate: "2025-06-01T00:00:00.000Z",
        endDate: "2025-08-01T00:00:00.000Z",
        durationRaw: "2 Month",
        durationMonths: 2,
        isCertificationStyle: false,
        classification: "company",
        status: "Completed",
        creditsCalculated: 2,
        needsReview: false,
        reviewReasons: [],
        reviewOverride: null,
        possibleSplitInternship: false,
        splitMergeRole: null,
        splitSiblingLabel: null,
        splitOriginalCredits: null,
      },
      {
        semesterLabel: "FY Sem II",
        company: "Microsoft",
        startDateRaw: "1/12/2025",
        endDateRaw: "1/2/2026",
        startDate: "2025-12-01T00:00:00.000Z",
        endDate: "2026-02-01T00:00:00.000Z",
        durationRaw: "2 Month",
        durationMonths: 2,
        isCertificationStyle: false,
        classification: "company",
        status: "Completed",
        creditsCalculated: 2,
        needsReview: false,
        reviewReasons: [],
        reviewOverride: null,
        possibleSplitInternship: false,
        splitMergeRole: null,
        splitSiblingLabel: null,
        splitOriginalCredits: null,
      },
    ],
  },
  {
    prn: "123B1B002",
    name: "Bob Jones",
    division: "Div-B",
    totalCreditsCalculated: 0,
    sheetReportedTotalCredits: "0",
    sheetReportedRemainingCredits: "16",
    internships: [
      {
        semesterLabel: "FY Sem I",
        company: "Java Certification",
        startDateRaw: "1/6/2025",
        endDateRaw: "",
        startDate: "2025-06-01T00:00:00.000Z",
        endDate: null,
        durationRaw: "135.5 hours",
        durationMonths: 0.19,
        isCertificationStyle: true,
        classification: "certification",
        status: "Ongoing",
        creditsCalculated: null,
        needsReview: true,
        reviewReasons: ["certification_style"],
        reviewOverride: null,
        possibleSplitInternship: false,
        splitMergeRole: null,
        splitSiblingLabel: null,
        splitOriginalCredits: null,
      },
    ],
  },
  {
    prn: "123B1B003",
    name: "Charlie Brown",
    division: "Div-A",
    totalCreditsCalculated: 0,
    sheetReportedTotalCredits: "0",
    sheetReportedRemainingCredits: "16",
    internships: [],
  },
];

/** Wraps the mock student array in the EnrichedStudentsResult envelope. */
const mockResult = (overridesApplied = true) => ({
  students: mockEnrichedStudents,
  overridesApplied,
});

describe("Analytics Endpoints", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use("/api", analyticsRouter);
  });

  // -------------------------------------------------------------------------
  // GET /api/analytics/overview
  // -------------------------------------------------------------------------
  describe("GET /api/analytics/overview", () => {
    it("requires the batch query parameter", async () => {
      const res = await request(app).get("/api/analytics/overview");
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Missing required query param");
    });

    it("validates the batch query parameter", async () => {
      const res = await request(app).get("/api/analytics/overview?batch=invalid");
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Unknown batch");
    });

    it("returns correct overview aggregations for the whole batch", async () => {
      vi.mocked(enrichmentService.getEnrichedStudents).mockResolvedValue(mockResult() as any);

      const res = await request(app).get("/api/analytics/overview?batch=2023-2027");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        overridesApplied: true,
        totalStudents: 3,
        studentsWithAtLeastOneInternship: 2,
        studentsWithNoInternship: 1,
        totalUniqueCompanies: 3,
        totalCreditsCalculated: 4,
        averageCreditsPerStudent: 1.33,
        totalInternshipEntries: 3,
        entriesNeedingReview: 1,
        entriesNeedingReviewBreakdown: {
          unparseable_duration: 0,
          unparseable_start_date: 0,
          unparseable_end_date: 0,
          certification_style: 1,
          possible_duplicate_split: 0,
        },
        divisionBreakdown: [
          { division: "Div-A", studentCount: 2, totalCreditsCalculated: 4, averageCreditsPerStudent: 2 },
          { division: "Div-B", studentCount: 1, totalCreditsCalculated: 0, averageCreditsPerStudent: 0 },
          { division: "Div-C", studentCount: 0, totalCreditsCalculated: 0, averageCreditsPerStudent: 0 },
          { division: "Div-D", studentCount: 0, totalCreditsCalculated: 0, averageCreditsPerStudent: 0 },
        ],
      });
    });

    it("surfaces overridesApplied: false when Supabase fallback is active", async () => {
      vi.mocked(enrichmentService.getEnrichedStudents).mockResolvedValue(mockResult(false) as any);

      const res = await request(app).get("/api/analytics/overview?batch=2023-2027");
      expect(res.status).toBe(200);
      expect(res.body.overridesApplied).toBe(false);
    });

    it("applies division filtering to stats but keeps full divisionBreakdown comparison", async () => {
      vi.mocked(enrichmentService.getEnrichedStudents).mockResolvedValue(mockResult() as any);

      const res = await request(app).get("/api/analytics/overview?batch=2023-2027&division=Div-A");
      expect(res.status).toBe(200);
      expect(res.body.totalStudents).toBe(2);
      expect(res.body.studentsWithAtLeastOneInternship).toBe(1);
      expect(res.body.studentsWithNoInternship).toBe(1);
      expect(res.body.totalCreditsCalculated).toBe(4);
      expect(res.body.averageCreditsPerStudent).toBe(2);

      // divisionBreakdown should still contain all divisions
      expect(res.body.divisionBreakdown.length).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/analytics/companies
  // -------------------------------------------------------------------------
  describe("GET /api/analytics/companies", () => {
    it("returns companies array nested under the overridesApplied envelope", async () => {
      vi.mocked(enrichmentService.getEnrichedStudents).mockResolvedValue(mockResult() as any);

      const res = await request(app).get("/api/analytics/companies?batch=2023-2027");
      expect(res.status).toBe(200);
      expect(res.body.overridesApplied).toBe(true);
      expect(Array.isArray(res.body.companies)).toBe(true);
      expect(res.body.companies.length).toBe(3);

      // Verify the sorting / shape
      expect(res.body.companies[0].company).toBe("Google");
      expect(res.body.companies[0].type).toBe("company");
      expect(res.body.companies[0].isInconsistentlyClassified).toBe(false);
      expect(res.body.companies[0].studentCount).toBe(1);
      expect(res.body.companies[0].internshipCount).toBe(1);
      expect(res.body.companies[0].divisionBreakdown).toEqual({ "Div-A": 1, "Div-B": 0, "Div-C": 0, "Div-D": 0 });
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/analytics/credits
  // -------------------------------------------------------------------------
  describe("GET /api/analytics/credits", () => {
    it("returns credit analytics and distribution", async () => {
      vi.mocked(enrichmentService.getEnrichedStudents).mockResolvedValue(mockResult() as any);

      const res = await request(app).get("/api/analytics/credits?batch=2023-2027");
      expect(res.status).toBe(200);
      expect(res.body.overridesApplied).toBe(true);
      expect(res.body.totalCreditsCalculated).toBe(4);
      expect(res.body.averageCreditsPerStudent).toBe(1.33);

      // Distribution should group by credits: Alice has 4, Bob has 0, Charlie has 0
      expect(res.body.distribution).toEqual([
        { creditValue: 0, studentCount: 2 },
        { creditValue: 4, studentCount: 1 },
      ]);

      // Check student list discrepancy calculation
      expect(res.body.studentList).toEqual([
        {
          name: "Alice Smith",
          prn: "123B1B001",
          division: "Div-A",
          internshipCount: 2,
          totalCreditsCalculated: 4,
          sheetReportedTotalCredits: "3",
          discrepancy: true, // 4 !== 3
          needsReview: false,
        },
        {
          name: "Bob Jones",
          prn: "123B1B002",
          division: "Div-B",
          internshipCount: 1,
          totalCreditsCalculated: 0,
          sheetReportedTotalCredits: "0",
          discrepancy: false, // 0 === 0
          needsReview: true,
        },
        {
          name: "Charlie Brown",
          prn: "123B1B003",
          division: "Div-A",
          internshipCount: 0,
          totalCreditsCalculated: 0,
          sheetReportedTotalCredits: "0",
          discrepancy: false,
          needsReview: false,
        },
      ]);

      expect(res.body.reviewSummary).toEqual({
        unparseable_duration: 0,
        unparseable_start_date: 0,
        unparseable_end_date: 0,
        certification_style: 1,
        possible_duplicate_split: 0,
      });
    });

    it("handles 502 error on upstream Sheets API failure", async () => {
      const sheetsError = new Error("Google Sheets API request failed");
      (sheetsError as any).domain = "global";
      vi.mocked(enrichmentService.getEnrichedStudents).mockRejectedValue(sheetsError);

      const res = await request(app).get("/api/analytics/credits?batch=2023-2027");
      expect(res.status).toBe(502);
      expect(res.body.error).toContain("Upstream Google Sheets API error");
    });
  });
});
