import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseDurationToMonths } from "../durationParser";

// Suppress console.warn noise during tests
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("parseDurationToMonths", () => {
  // -----------------------------------------------------------------------
  // Months
  // -----------------------------------------------------------------------
  describe("months", () => {
    it('parses "2 Month"', () => {
      const result = parseDurationToMonths("2 Month");
      expect(result).not.toBeNull();
      expect(result!.months).toBe(2);
      expect(result!.isCertificationStyle).toBe(false);
    });

    it('parses "3 Month"', () => {
      const result = parseDurationToMonths("3 Month");
      expect(result).not.toBeNull();
      expect(result!.months).toBe(3);
      expect(result!.isCertificationStyle).toBe(false);
    });

    it('parses "6 Months"', () => {
      const result = parseDurationToMonths("6 Months");
      expect(result).not.toBeNull();
      expect(result!.months).toBe(6);
      expect(result!.isCertificationStyle).toBe(false);
    });

    it('parses "1.5 months" (decimal)', () => {
      const result = parseDurationToMonths("1.5 months");
      expect(result).not.toBeNull();
      expect(result!.months).toBe(1.5);
      expect(result!.isCertificationStyle).toBe(false);
    });

    it('parses "1month" (no space)', () => {
      const result = parseDurationToMonths("1month");
      expect(result).not.toBeNull();
      expect(result!.months).toBe(1);
      expect(result!.isCertificationStyle).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Weeks
  // -----------------------------------------------------------------------
  describe("weeks", () => {
    it('parses "4 weeks"', () => {
      const result = parseDurationToMonths("4 weeks");
      expect(result).not.toBeNull();
      expect(result!.months).toBeCloseTo(4 / 4.33, 1);
      expect(result!.isCertificationStyle).toBe(false);
    });

    it('parses "10 weeks"', () => {
      const result = parseDurationToMonths("10 weeks");
      expect(result).not.toBeNull();
      expect(result!.months).toBeCloseTo(10 / 4.33, 1);
      expect(result!.isCertificationStyle).toBe(false);
    });

    it('parses "2 weeks"', () => {
      const result = parseDurationToMonths("2 weeks");
      expect(result).not.toBeNull();
      expect(result!.months).toBeCloseTo(2 / 4.33, 1);
      expect(result!.isCertificationStyle).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Days
  // -----------------------------------------------------------------------
  describe("days", () => {
    it('parses "10 days"', () => {
      const result = parseDurationToMonths("10 days");
      expect(result).not.toBeNull();
      expect(result!.months).toBeCloseTo(10 / 30, 1);
      expect(result!.isCertificationStyle).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Hours (certification-style)
  // -----------------------------------------------------------------------
  describe("hours (certification-style)", () => {
    it('parses "135.5 hours" and flags isCertificationStyle', () => {
      const result = parseDurationToMonths("135.5 hours");
      expect(result).not.toBeNull();
      expect(result!.months).toBeCloseTo(135.5 / 730, 2);
      expect(result!.isCertificationStyle).toBe(true);
    });

    it('parses "135.5hr" (no space, abbreviated)', () => {
      const result = parseDurationToMonths("135.5hr");
      expect(result).not.toBeNull();
      expect(result!.months).toBeCloseTo(135.5 / 730, 2);
      expect(result!.isCertificationStyle).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Casing and whitespace
  // -----------------------------------------------------------------------
  describe("casing and whitespace tolerance", () => {
    it('parses "  6  MONTHS  " (extra spaces, uppercase)', () => {
      const result = parseDurationToMonths("  6  MONTHS  ");
      expect(result).not.toBeNull();
      expect(result!.months).toBe(6);
    });

    it('parses "3 WEEK" (uppercase singular)', () => {
      const result = parseDurationToMonths("3 WEEK");
      expect(result).not.toBeNull();
      expect(result!.months).toBeCloseTo(3 / 4.33, 1);
    });

    it('parses "2Days" (no space, mixed case)', () => {
      const result = parseDurationToMonths("2Days");
      expect(result).not.toBeNull();
      expect(result!.months).toBeCloseTo(2 / 30, 2);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases and unparseable
  // -----------------------------------------------------------------------
  describe("edge cases", () => {
    it("returns null for empty string", () => {
      expect(parseDurationToMonths("")).toBeNull();
    });

    it("returns null for whitespace-only string", () => {
      expect(parseDurationToMonths("   ")).toBeNull();
    });

    it('returns null for garbage "asdf"', () => {
      expect(parseDurationToMonths("asdf")).toBeNull();
    });

    it('returns null for garbage "not a duration at all"', () => {
      expect(parseDurationToMonths("not a duration at all")).toBeNull();
    });

    it('returns null for "0 months"', () => {
      // 0 is not a valid duration
      expect(parseDurationToMonths("0 months")).toBeNull();
    });

    it("logs context (PRN + semester) for unparseable strings", () => {
      const warnSpy = vi.spyOn(console, "warn");
      parseDurationToMonths("garbage", {
        prn: "PRN001",
        semesterLabel: "FY Sem I",
      });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("PRN001")
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("FY Sem I")
      );
    });
  });
});
