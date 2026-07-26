import { describe, it, expect } from "vitest";
import { calculateCredits, CREDIT_RULES } from "../creditRules";

describe("CREDIT_RULES", () => {
  it("covers the full range [0, Infinity)", () => {
    // Rules should form a contiguous cover from 0 to Infinity
    expect(CREDIT_RULES[0].minMonths).toBe(0);
    expect(CREDIT_RULES[CREDIT_RULES.length - 1].maxMonths).toBe(Infinity);

    for (let i = 1; i < CREDIT_RULES.length; i++) {
      expect(CREDIT_RULES[i].minMonths).toBe(CREDIT_RULES[i - 1].maxMonths);
    }
  });
});

describe("calculateCredits", () => {
  // -----------------------------------------------------------------------
  // Standard internship (not certification-style)
  // -----------------------------------------------------------------------
  describe("standard internships", () => {
    it("returns 0 credits for duration < 1 month (e.g. 0.5)", () => {
      expect(calculateCredits(0.5, false)).toBe(0);
    });

    it("returns 1 credit for duration = 1 month (boundary)", () => {
      expect(calculateCredits(1, false)).toBe(1);
    });

    it("returns 1 credit for duration = 1.5 months", () => {
      expect(calculateCredits(1.5, false)).toBe(1);
    });

    it("returns 2 credits for duration = 2 months (boundary)", () => {
      expect(calculateCredits(2, false)).toBe(2);
    });

    it("returns 2 credits for duration = 3 months", () => {
      expect(calculateCredits(3, false)).toBe(2);
    });

    it("returns 3 credits for duration = 4 months (boundary)", () => {
      expect(calculateCredits(4, false)).toBe(3);
    });

    it("returns 3 credits for duration = 5 months", () => {
      expect(calculateCredits(5, false)).toBe(3);
    });

    it("returns 4 credits for duration = 6 months (boundary)", () => {
      expect(calculateCredits(6, false)).toBe(4);
    });

    it("returns 4 credits for duration = 12 months", () => {
      expect(calculateCredits(12, false)).toBe(4);
    });
  });

  // -----------------------------------------------------------------------
  // Certification-style exclusion
  // -----------------------------------------------------------------------
  describe("certification-style entries", () => {
    it("returns null for certification-style regardless of duration", () => {
      expect(calculateCredits(3, true)).toBeNull();
    });

    it("returns null for certification-style even with large duration", () => {
      expect(calculateCredits(12, true)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Invalid durations
  // -----------------------------------------------------------------------
  describe("invalid durations", () => {
    it("returns null for 0 months", () => {
      expect(calculateCredits(0, false)).toBeNull();
    });

    it("returns null for negative duration", () => {
      expect(calculateCredits(-1, false)).toBeNull();
    });

    it("returns null for NaN", () => {
      expect(calculateCredits(NaN, false)).toBeNull();
    });

    it("returns null for Infinity", () => {
      expect(calculateCredits(Infinity, false)).toBeNull();
    });
  });
});
