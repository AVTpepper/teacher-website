import { describe, expect, it } from "vitest";
import {
  computeProfileCompletion,
  getOnboardingEligibility,
  hasMinimumOnboardingData,
  isLegacyProfileSufficient,
  normalizeOnboardingArrays,
  roleRequiresSubject,
} from "@/lib/onboarding";

describe("onboarding helpers", () => {
  it("requires subject context for classroom roles", () => {
    expect(roleRequiresSubject("Primary Teacher")).toBe(true);
    expect(roleRequiresSubject("School Leader")).toBe(false);
  });

  it("determines minimum onboarding requirements with role-aware checks", () => {
    const classroom = {
      displayName: "Alex",
      professionalRole: "Primary Teacher",
      country: "Canada",
      networkingGoals: ["Connect with educators"],
      gradeLevels: ["Elementary"],
      subjects: ["Math"],
    };
    expect(hasMinimumOnboardingData(classroom)).toBe(true);

    const noSubjects = {
      ...classroom,
      subjects: [],
    };
    expect(hasMinimumOnboardingData(noSubjects)).toBe(false);

    const leader = {
      displayName: "Ari",
      professionalRole: "School Leader",
      country: "Canada",
      networkingGoals: ["Find collaborators"],
      gradeLevels: [],
      subjects: [],
    };
    expect(hasMinimumOnboardingData(leader)).toBe(false);
  });

  it("classifies legacy profiles as complete when core context exists", () => {
    const legacy = {
      displayName: "Legacy User",
      country: "Sweden",
      gradeLevel: "High School",
      subjects: ["Science"],
    };

    expect(isLegacyProfileSufficient(legacy)).toBe(true);
    expect(getOnboardingEligibility(legacy)).toBe("legacy-complete");
  });

  it("returns completed eligibility when explicit completion is set", () => {
    expect(
      getOnboardingEligibility({
        onboardingCompleted: true,
        onboardingVersion: 1,
      })
    ).toBe("completed");
  });

  it("normalizes onboarding arrays and removes unsupported values", () => {
    const normalized = normalizeOnboardingArrays({
      gradeLevels: ["Elementary", "Elementary", "Invalid"],
      additionalRoles: ["Primary Teacher", "Primary Teacher", "Invalid"],
      curricula: ["IB PYP", "Unknown"],
      languages: ["English", "Unknown", "English"],
      professionalInterests: ["AI in education", "Invalid"],
      networkingGoals: ["Connect with educators", "Invalid"],
    });

    expect(normalized.gradeLevels).toEqual(["Elementary"]);
    expect(normalized.additionalRoles).toEqual(["Primary Teacher"]);
    expect(normalized.curricula).toEqual(["IB PYP"]);
    expect(normalized.languages).toEqual(["English"]);
    expect(normalized.professionalInterests).toEqual(["AI in education"]);
    expect(normalized.networkingGoals).toEqual(["Connect with educators"]);
  });

  it("computes completion percentage and missing fields deterministically", () => {
    const result = computeProfileCompletion({
      displayName: "Alex",
      professionalRole: "Primary Teacher",
      gradeLevels: ["Elementary"],
      subjects: ["Math"],
      country: "Canada",
      networkingGoals: ["Connect with educators"],
      yearsOfExperience: 8,
    });

    expect(result.percentage).toBeGreaterThan(40);
    expect(result.minimumComplete).toBe(true);
    expect(result.missingRecommended).toContain("Professional headline");
  });
});
