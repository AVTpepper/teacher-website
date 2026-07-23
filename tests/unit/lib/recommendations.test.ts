import { describe, expect, it } from "vitest";
import {
  dedupeEducatorCandidates,
  isRecommendationEligible,
  rankRecommendedEducators,
  scoreRecommendation,
  type RecommendationWeights,
} from "@/lib/discover/recommendations";
import type { UserProfile } from "@/lib/firestore/users";

function buildProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    uid: "u-1",
    displayName: "Alex Rivera",
    email: "alex@example.com",
    photoURL: null,
    gradeLevel: "Elementary",
    gradeLevels: ["Elementary"],
    subjects: ["Math"],
    professionalRole: "Primary Teacher",
    additionalRoles: [],
    professionalHeadline: "Math and inquiry learning",
    curricula: ["IB PYP"],
    country: "Canada",
    city: "Toronto",
    languages: ["English"],
    school: "Vista School",
    schoolType: "Public",
    yearsOfExperience: 7,
    bio: "",
    professionalInterests: ["Inquiry-based learning"],
    networkingGoals: ["Find collaborators"],
    lookingFor: "",
    onboardingCompleted: true,
    onboardingVersion: 1,
    onboardingCurrentStep: 7,
    profileCompletion: 92,
    isVerified: false,
    createdAt: { seconds: 1000 },
    badges: [],
    followerCount: 0,
    followingCount: 0,
    ...overrides,
  };
}

describe("discover recommendations", () => {
  it("scores overlap deterministically and returns explainable reasons", () => {
    const viewer = buildProfile({ uid: "viewer" });
    const candidate = buildProfile({
      uid: "candidate",
      subjects: ["Math", "Science"],
      curricula: ["IB PYP"],
      gradeLevels: ["Elementary"],
      professionalInterests: ["Inquiry-based learning"],
      networkingGoals: ["Find collaborators"],
      languages: ["English", "French"],
      professionalRole: "Primary Teacher",
      country: "Canada",
    });

    const scored = scoreRecommendation(viewer, candidate);

    expect(scored.score).toBeGreaterThan(0);
    expect(scored.reasons.map((reason) => reason.id)).toContain("subjects");
    expect(scored.reasons.map((reason) => reason.id)).toContain("curricula");
  });

  it("dedupes candidate profiles by uid", () => {
    const first = buildProfile({ uid: "same" });
    const second = buildProfile({ uid: "same", displayName: "Duplicate" });
    const third = buildProfile({ uid: "different" });

    const deduped = dedupeEducatorCandidates([first, second, third]);

    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.uid).toBe("same");
    expect(deduped[1]?.uid).toBe("different");
  });

  it("handles legacy profile recommendation eligibility", () => {
    const legacyProfile = buildProfile({
      professionalRole: "",
      networkingGoals: [],
      onboardingCompleted: false,
      onboardingVersion: 0,
    });

    expect(isRecommendationEligible(legacyProfile)).toBe(false);
  });

  it("ranks candidates by score then recency", () => {
    const viewer = buildProfile({ uid: "viewer" });
    const highOverlap = buildProfile({
      uid: "high",
      createdAt: { seconds: 100 },
      subjects: ["Math"],
      curricula: ["IB PYP"],
      networkingGoals: ["Find collaborators"],
      professionalInterests: ["Inquiry-based learning"],
    });
    const lowerOverlapNewer = buildProfile({
      uid: "lower",
      createdAt: { seconds: 300 },
      subjects: ["History"],
      curricula: ["British"],
      networkingGoals: ["Find a mentor"],
      professionalInterests: ["Leadership"],
      country: "Spain",
    });

    const ranked = rankRecommendedEducators(viewer, [lowerOverlapNewer, highOverlap], {
      maxResults: 5,
    });

    expect(ranked[0]?.educator.uid).toBe("high");
    expect(ranked[0]?.matchLabel).toBeDefined();
  });

  it("supports configurable weights", () => {
    const viewer = buildProfile({ uid: "viewer" });
    const candidate = buildProfile({ uid: "candidate" });

    const customWeights: RecommendationWeights = {
      subject: 1,
      curriculum: 1,
      gradeLevel: 1,
      interest: 1,
      networkingGoal: 1,
      language: 1,
      country: 1,
      role: 1,
    };

    const scored = scoreRecommendation(viewer, candidate, customWeights);
    expect(scored.score).toBeGreaterThan(0);
  });
});
