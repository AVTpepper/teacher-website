import { describe, expect, it } from "vitest";
import { getSharedContextReasons, type SharedContextReason } from "@/lib/profile/sharedContext";
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
    professionalHeadline: "Helping students love math",
    curricula: ["IB PYP"],
    country: "Canada",
    city: "Toronto",
    languages: ["English"],
    school: "Vista School",
    schoolType: "Public",
    yearsOfExperience: 8,
    bio: "",
    professionalInterests: ["Assessment"],
    networkingGoals: ["Connect with educators"],
    lookingFor: "",
    onboardingCompleted: true,
    onboardingVersion: 1,
    onboardingCurrentStep: 7,
    profileCompletion: 90,
    isVerified: false,
    createdAt: null,
    badges: [],
    followerCount: 0,
    followingCount: 0,
    ...overrides,
  };
}

function reasonIds(reasons: SharedContextReason[]): string[] {
  return reasons.map((reason) => reason.id);
}

describe("getSharedContextReasons", () => {
  it("returns deterministic overlap reasons using real profile fields", () => {
    const viewer = buildProfile({
      uid: "viewer",
      gradeLevels: ["Elementary", "Middle School"],
      subjects: ["Math", "Science"],
      curricula: ["IB PYP", "Cambridge"],
      country: "Canada",
      professionalInterests: ["Assessment", "AI in education"],
      networkingGoals: ["Connect with educators", "Find collaborators"],
      languages: ["English", "French"],
    });

    const target = buildProfile({
      uid: "target",
      gradeLevels: ["Middle School", "High School"],
      subjects: ["Science", "History"],
      curricula: ["Cambridge"],
      country: "Canada",
      professionalInterests: ["AI in education"],
      networkingGoals: ["Find collaborators"],
      languages: ["French", "Spanish"],
    });

    const reasons = getSharedContextReasons(viewer, target);

    expect(reasonIds(reasons)).toEqual([
      "grade-levels",
      "subjects",
      "curricula",
      "country",
    ]);
    expect(reasons[0]?.detail).toContain("Middle School");
  });

  it("hides shared context when viewing own profile", () => {
    const viewer = buildProfile({ uid: "same-user" });
    const target = buildProfile({ uid: "same-user" });

    expect(getSharedContextReasons(viewer, target)).toEqual([]);
  });

  it("returns empty list when there is no overlap", () => {
    const viewer = buildProfile({
      uid: "viewer",
      gradeLevels: ["Elementary"],
      subjects: ["Math"],
      curricula: ["IB PYP"],
      country: "Canada",
      professionalInterests: ["Assessment"],
      networkingGoals: ["Connect with educators"],
      languages: ["English"],
    });

    const target = buildProfile({
      uid: "target",
      gradeLevel: "Higher Education",
      gradeLevels: ["Higher Education"],
      subjects: ["History"],
      curricula: ["British"],
      country: "Spain",
      professionalInterests: ["Leadership"],
      networkingGoals: ["Find a mentor"],
      languages: ["Spanish"],
    });

    expect(getSharedContextReasons(viewer, target)).toEqual([]);
  });
});
