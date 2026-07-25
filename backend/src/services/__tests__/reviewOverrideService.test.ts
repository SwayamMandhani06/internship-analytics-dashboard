import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Use vi.hoisted() so the mock factory can reference these variables even
// though vi.mock() is hoisted to the top of the file by Vitest's transformer.
// ---------------------------------------------------------------------------

const { mockFrom, mockSelect, mockEq, mockUpsert, mockDelete, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockUpsert = vi.fn();
  const mockDelete = vi.fn();

  // Chainable query-builder stub — each method returns the same object so
  // calls can be chained.  Individual tests override the terminal resolution.
  const chain = { select: mockSelect, eq: mockEq, upsert: mockUpsert, delete: mockDelete, single: mockSingle };
  [mockSelect, mockEq, mockUpsert, mockDelete, mockSingle].forEach((fn) =>
    fn.mockReturnValue(chain)
  );

  const mockFrom = vi.fn(() => chain);

  return { mockFrom, mockSelect, mockEq, mockUpsert, mockDelete, mockSingle };
});

vi.mock("../supabaseClient", () => ({
  default: { from: mockFrom },
}));

// Import service AFTER vi.mock() is set up
import {
  getOverridesForBatch,
  upsertOverride,
  bulkUpsertOverrides,
  deleteOverride,
  makeOverrideKey,
} from "../reviewOverrideService";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleRow = {
  id: 1,
  batch_id: "2023-2027",
  division: "Div-A",
  prn: "123B1B001",
  semester_label: "FY Sem I",
  sibling_semester_label: null,
  internship_name_snapshot: "Google",
  decision: "approved",
  classification: "internship",
  merge_decision: null,
  override_credits: null,
  reviewed_by: "faculty@example.com",
  note: null,
  reviewed_at: "2026-07-25T00:00:00.000Z",
  created_at: "2026-07-25T00:00:00.000Z",
  updated_at: "2026-07-25T00:00:00.000Z",
};

// Helper to get a fresh chain object pointing at the same mocked fns
function getChain() {
  return {
    select: mockSelect,
    eq: mockEq,
    upsert: mockUpsert,
    delete: mockDelete,
    single: mockSingle,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("reviewOverrideService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = getChain();
    [mockSelect, mockEq, mockUpsert, mockDelete, mockSingle].forEach((fn) =>
      fn.mockReturnValue(chain)
    );
    mockFrom.mockReturnValue(chain);
  });

  // -------------------------------------------------------------------------
  // getOverridesForBatch
  // -------------------------------------------------------------------------
  describe("getOverridesForBatch", () => {
    it("returns a Map keyed by division:prn:semesterLabel", async () => {
      // Terminal call: last .eq() resolves to { data, error }
      mockEq.mockReturnValueOnce({ data: [sampleRow], error: null });

      const result = await getOverridesForBatch("2023-2027");

      expect(mockFrom).toHaveBeenCalledWith("review_overrides");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("batch_id", "2023-2027");

      const expectedKey = makeOverrideKey("Div-A", "123B1B001", "FY Sem I");
      expect(result.has(expectedKey)).toBe(true);
      expect(result.get(expectedKey)).toEqual(sampleRow);
    });

    it("adds division filter when division param is provided", async () => {
      const chain = getChain();
      // First .eq() returns the chain so second .eq() can be called
      mockEq
        .mockReturnValueOnce(chain)
        .mockReturnValueOnce({ data: [sampleRow], error: null });

      await getOverridesForBatch("2023-2027", "Div-A");

      expect(mockEq).toHaveBeenCalledWith("batch_id", "2023-2027");
      expect(mockEq).toHaveBeenCalledWith("division", "Div-A");
    });

    it("returns an empty Map when no rows exist", async () => {
      mockEq.mockReturnValueOnce({ data: [], error: null });

      const result = await getOverridesForBatch("2023-2027");
      expect(result.size).toBe(0);
    });

    it("throws on Supabase error", async () => {
      mockEq.mockReturnValueOnce({ data: null, error: { message: "DB error" } });

      await expect(getOverridesForBatch("2023-2027")).rejects.toThrow(
        "[reviewOverrideService] getOverridesForBatch failed: DB error"
      );
    });
  });

  // -------------------------------------------------------------------------
  // upsertOverride
  // -------------------------------------------------------------------------
  describe("upsertOverride", () => {
    it("upserts with correct payload and returns the saved row", async () => {
      // chain: .upsert().select().single()
      mockSingle.mockResolvedValueOnce({ data: sampleRow, error: null });

      const input = {
        batch_id: "2023-2027",
        division: "Div-A",
        prn: "123B1B001",
        semester_label: "FY Sem I",
        internship_name_snapshot: "Google",
        decision: "approved" as const,
        classification: "internship" as const,
        merge_decision: null,
        override_credits: null,
        reviewed_by: "faculty@example.com",
        note: null,
      };

      const result = await upsertOverride(input);

      expect(mockFrom).toHaveBeenCalledWith("review_overrides");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          batch_id: "2023-2027",
          division: "Div-A",
          prn: "123B1B001",
          semester_label: "FY Sem I",
          decision: "approved",
          reviewed_at: expect.any(String),
        }),
        { onConflict: "batch_id,division,prn,semester_label" }
      );
      expect(result).toEqual(sampleRow);
    });

    it("throws on Supabase error", async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: "Upsert failed" } });

      await expect(
        upsertOverride({
          batch_id: "2023-2027",
          division: "Div-A",
          prn: "123B1B001",
          semester_label: "FY Sem I",
          internship_name_snapshot: "Google",
        })
      ).rejects.toThrow("[reviewOverrideService] upsertOverride failed: Upsert failed");
    });
  });

  // -------------------------------------------------------------------------
  // bulkUpsertOverrides
  // -------------------------------------------------------------------------
  describe("bulkUpsertOverrides", () => {
    it("returns empty array for empty input without calling Supabase", async () => {
      const result = await bulkUpsertOverrides([]);
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("calls upsert once with all entries and reviewed_at injected", async () => {
      // chain: .upsert().select()
      mockSelect.mockReturnValueOnce({ data: [sampleRow, sampleRow], error: null });

      const entries = [
        {
          batch_id: "2023-2027",
          division: "Div-A",
          prn: "123B1B001",
          semester_label: "FY Sem I",
          internship_name_snapshot: "Google",
          decision: "declined" as const,
        },
        {
          batch_id: "2023-2027",
          division: "Div-A",
          prn: "123B1B002",
          semester_label: "FY Sem II",
          internship_name_snapshot: "AICTE",
          decision: "declined" as const,
        },
      ];

      const result = await bulkUpsertOverrides(entries);

      expect(mockFrom).toHaveBeenCalledWith("review_overrides");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ prn: "123B1B001", reviewed_at: expect.any(String) }),
          expect.objectContaining({ prn: "123B1B002", reviewed_at: expect.any(String) }),
        ]),
        { onConflict: "batch_id,division,prn,semester_label" }
      );
      expect(result).toHaveLength(2);
    });

    it("throws on Supabase error", async () => {
      mockSelect.mockReturnValueOnce({ data: null, error: { message: "Bulk upsert failed" } });

      await expect(
        bulkUpsertOverrides([
          {
            batch_id: "2023-2027",
            division: "Div-A",
            prn: "123B1B001",
            semester_label: "FY Sem I",
            internship_name_snapshot: "Google",
          },
        ])
      ).rejects.toThrow(
        "[reviewOverrideService] bulkUpsertOverrides failed: Bulk upsert failed"
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteOverride
  // -------------------------------------------------------------------------
  describe("deleteOverride", () => {
    it("calls delete with correct filters", async () => {
      const chain = getChain();
      // .eq() is called 4 times; the last one returns { error: null }
      mockEq
        .mockReturnValueOnce(chain)          // eq("batch_id")
        .mockReturnValueOnce(chain)          // eq("division")
        .mockReturnValueOnce(chain)          // eq("prn")
        .mockReturnValueOnce({ error: null }); // eq("semester_label")

      await deleteOverride("2023-2027", "Div-A", "123B1B001", "FY Sem I");

      expect(mockFrom).toHaveBeenCalledWith("review_overrides");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("batch_id", "2023-2027");
      expect(mockEq).toHaveBeenCalledWith("division", "Div-A");
      expect(mockEq).toHaveBeenCalledWith("prn", "123B1B001");
      expect(mockEq).toHaveBeenCalledWith("semester_label", "FY Sem I");
    });

    it("throws on Supabase error", async () => {
      const chain = getChain();
      mockEq
        .mockReturnValueOnce(chain)
        .mockReturnValueOnce(chain)
        .mockReturnValueOnce(chain)
        .mockReturnValueOnce({ error: { message: "Delete failed" } });

      await expect(
        deleteOverride("2023-2027", "Div-A", "123B1B001", "FY Sem I")
      ).rejects.toThrow(
        "[reviewOverrideService] deleteOverride failed: Delete failed"
      );
    });
  });
});
