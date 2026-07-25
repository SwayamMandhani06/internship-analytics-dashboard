import { describe, it, expect } from "vitest";
import { classifyInternship, CERTIFICATION_KEYWORDS } from "../classifyInternship";

describe("classifyInternship", () => {
  it("classifies standard company names as 'company'", () => {
    expect(classifyInternship("Google")).toBe("company");
    expect(classifyInternship("Microsoft Corporation")).toBe("company");
    expect(classifyInternship("Tata Consultancy Services")).toBe("company");
    expect(classifyInternship("TraceLink")).toBe("company");
  });

  it("classifies names containing certification keywords as 'certification'", () => {
    expect(classifyInternship("Java Certification")).toBe("certification");
    expect(classifyInternship("AICTE Android Internship")).toBe("certification");
    expect(classifyInternship("NPTEL Cloud Computing Course")).toBe("certification");
    expect(classifyInternship("EduSkills AWS Virtual Internship")).toBe("certification");
    expect(classifyInternship("Data Science Masterclass")).toBe("certification");
    expect(classifyInternship("IEEE Certificate Course")).toBe("certification");
    expect(classifyInternship("Winter School on AI")).toBe("certification");
    expect(classifyInternship("Summer School 2025")).toBe("certification");
    expect(classifyInternship("Career Launchpad Program")).toBe("certification");
    expect(classifyInternship("Salesforce Virtual Internship")).toBe("certification");
  });

  it("is case-insensitive", () => {
    expect(classifyInternship("aicte internship")).toBe("certification");
    expect(classifyInternship("python CERTIFICATION")).toBe("certification");
    expect(classifyInternship("nptel online")).toBe("certification");
  });

  it("defaults empty or whitespace strings to 'company'", () => {
    expect(classifyInternship("")).toBe("company");
    expect(classifyInternship("   ")).toBe("company");
  });

  it("exports CERTIFICATION_KEYWORDS as a non-empty array", () => {
    expect(Array.isArray(CERTIFICATION_KEYWORDS)).toBe(true);
    expect(CERTIFICATION_KEYWORDS.length).toBeGreaterThan(0);
  });
});
