import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseFlexibleDate } from "../dateParser";

// Suppress console.warn noise during tests
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

// Helper: create a UTC date for comparison
function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d)); // m is 1-indexed for readability
}

describe("parseFlexibleDate", () => {
  // -----------------------------------------------------------------------
  // Numeric DD/MM/YYYY
  // -----------------------------------------------------------------------
  describe("numeric DD/MM/YYYY", () => {
    it('parses "6/10/2025" as 6 Oct 2025 (DD/MM)', () => {
      const result = parseFlexibleDate("6/10/2025");
      expect(result).toEqual(utc(2025, 10, 6));
    });

    it('parses "15/1/2025" unambiguously (day > 12)', () => {
      const result = parseFlexibleDate("15/1/2025");
      expect(result).toEqual(utc(2025, 1, 15));
    });

    it('logs warning for ambiguous "5/6/2025"', () => {
      const warnSpy = vi.spyOn(console, "warn");
      const result = parseFlexibleDate("5/6/2025");
      // Should still return a date (DD/MM default)
      expect(result).toEqual(utc(2025, 6, 5));
      // Should warn about ambiguity
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Ambiguous")
      );
    });

    it('parses "31/12/2025" unambiguously', () => {
      const result = parseFlexibleDate("31/12/2025");
      expect(result).toEqual(utc(2025, 12, 31));
    });
  });

  // -----------------------------------------------------------------------
  // "10 July 2025" format
  // -----------------------------------------------------------------------
  describe("D Month YYYY", () => {
    it('parses "10 July 2025"', () => {
      const result = parseFlexibleDate("10 July 2025");
      expect(result).toEqual(utc(2025, 7, 10));
    });
  });

  // -----------------------------------------------------------------------
  // "21 May, 2025" (comma after month)
  // -----------------------------------------------------------------------
  describe("D Month, YYYY", () => {
    it('parses "21 May, 2025"', () => {
      const result = parseFlexibleDate("21 May, 2025");
      expect(result).toEqual(utc(2025, 5, 21));
    });
  });

  // -----------------------------------------------------------------------
  // "1st July 2026" (ordinal suffix)
  // -----------------------------------------------------------------------
  describe("ordinal day", () => {
    it('parses "1st July 2026"', () => {
      const result = parseFlexibleDate("1st July 2026");
      expect(result).toEqual(utc(2026, 7, 1));
    });

    it('parses "2nd March 2025"', () => {
      const result = parseFlexibleDate("2nd March 2025");
      expect(result).toEqual(utc(2025, 3, 2));
    });

    it('parses "3rd January 2025"', () => {
      const result = parseFlexibleDate("3rd January 2025");
      expect(result).toEqual(utc(2025, 1, 3));
    });

    it('parses "15th August 2025"', () => {
      const result = parseFlexibleDate("15th August 2025");
      expect(result).toEqual(utc(2025, 8, 15));
    });
  });

  // -----------------------------------------------------------------------
  // "April'2025" (month + apostrophe + year)
  // -----------------------------------------------------------------------
  describe("Month'YYYY", () => {
    it("parses \"April'2025\" as April 1, 2025", () => {
      const result = parseFlexibleDate("April'2025");
      expect(result).toEqual(utc(2025, 4, 1));
    });
  });

  // -----------------------------------------------------------------------
  // "25/May/25" (DD/MonthName/YY)
  // -----------------------------------------------------------------------
  describe("DD/MonthName/YY", () => {
    it('parses "25/May/25" as 25 May 2025', () => {
      const result = parseFlexibleDate("25/May/25");
      expect(result).toEqual(utc(2025, 5, 25));
    });
  });

  // -----------------------------------------------------------------------
  // No year → returns null
  // -----------------------------------------------------------------------
  describe("missing year → null", () => {
    it('returns null for "1st July" (no year)', () => {
      const result = parseFlexibleDate("1st July");
      expect(result).toBeNull();
    });

    it('returns null for "5-Dec" (no year)', () => {
      const result = parseFlexibleDate("5-Dec");
      expect(result).toBeNull();
    });

    it("logs warning about missing year with context", () => {
      const warnSpy = vi.spyOn(console, "warn");
      parseFlexibleDate("5-Dec", {
        prn: "PRN002",
        semesterLabel: "SY Sem III",
      });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing year")
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("PRN002")
      );
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe("edge cases", () => {
    it("returns null for empty string", () => {
      expect(parseFlexibleDate("")).toBeNull();
    });

    it("returns null for whitespace-only string", () => {
      expect(parseFlexibleDate("   ")).toBeNull();
    });

    it('returns null for garbage "not a date"', () => {
      expect(parseFlexibleDate("not a date")).toBeNull();
    });

    it("parses 2-digit year in numeric format (DD/MM/YY)", () => {
      const result = parseFlexibleDate("15/6/25");
      expect(result).toEqual(utc(2025, 6, 15));
    });

    it("parses dash-separated numeric date (15-6-2025)", () => {
      const result = parseFlexibleDate("15-6-2025");
      expect(result).toEqual(utc(2025, 6, 15));
    });

    it('parses "11/24/2025" as MM/DD (second > 12 proves it)', () => {
      const result = parseFlexibleDate("11/24/2025");
      expect(result).toEqual(utc(2025, 11, 24));
    });

    it('parses "30 th July 2026" (spaced ordinal suffix)', () => {
      const result = parseFlexibleDate("30 th July 2026");
      expect(result).toEqual(utc(2026, 7, 30));
    });

    it('parses "Jan\' 2026" (space before apostrophe)', () => {
      const result = parseFlexibleDate("Jan' 2026");
      expect(result).toEqual(utc(2026, 1, 1));
    });

    it('parses "march\' 2026" (lowercase, space before apostrophe)', () => {
      const result = parseFlexibleDate("march' 2026");
      expect(result).toEqual(utc(2026, 3, 1));
    });

    it('parses "12 Jan 26" (D Month YY, 2-digit year)', () => {
      const result = parseFlexibleDate("12 Jan 26");
      expect(result).toEqual(utc(2026, 1, 12));
    });

    it('parses "6 February 26" (D Month YY)', () => {
      const result = parseFlexibleDate("6 February 26");
      expect(result).toEqual(utc(2026, 2, 6));
    });

    it('parses "April 2025" (Month YYYY, day defaults to 1)', () => {
      const result = parseFlexibleDate("April 2025");
      expect(result).toEqual(utc(2025, 4, 1));
    });

    it('parses "June 2025" (Month YYYY)', () => {
      const result = parseFlexibleDate("June 2025");
      expect(result).toEqual(utc(2025, 6, 1));
    });

    it('parses "11/24/25" as MM/DD/YY (second > 12)', () => {
      const result = parseFlexibleDate("11/24/25");
      expect(result).toEqual(utc(2025, 11, 24));
    });
  });
});
