import { describe, it, expect } from "vitest";
import { calculateStatus } from "../statusCalculator";

// Helper: create dates easily
function d(iso: string): Date {
  return new Date(iso);
}

describe("calculateStatus", () => {
  const today = d("2026-07-24T00:00:00Z");

  describe("Completed", () => {
    it("returns Completed when endDate is in the past", () => {
      expect(
        calculateStatus(d("2025-01-01"), d("2026-06-30"), today)
      ).toBe("Completed");
    });

    it("returns Completed even when startDate is null but endDate is in past", () => {
      expect(calculateStatus(null, d("2026-01-01"), today)).toBe("Completed");
    });
  });

  describe("Ongoing", () => {
    it("returns Ongoing when start is past and end is future", () => {
      expect(
        calculateStatus(d("2026-01-01"), d("2026-12-31"), today)
      ).toBe("Ongoing");
    });

    it("returns Ongoing when start is past and end is null", () => {
      expect(calculateStatus(d("2026-01-01"), null, today)).toBe("Ongoing");
    });

    it("returns Ongoing when start is today", () => {
      expect(
        calculateStatus(d("2026-07-24"), d("2027-01-01"), today)
      ).toBe("Ongoing");
    });
  });

  describe("Not Started", () => {
    it("returns Not Started when start is in the future", () => {
      expect(
        calculateStatus(d("2027-01-01"), d("2027-06-30"), today)
      ).toBe("Not Started");
    });

    it("returns Not Started when start is future and end is null", () => {
      expect(calculateStatus(d("2027-01-01"), null, today)).toBe("Not Started");
    });
  });

  describe("Unknown", () => {
    it("returns Unknown when both dates are null", () => {
      expect(calculateStatus(null, null, today)).toBe("Unknown");
    });
  });
});
