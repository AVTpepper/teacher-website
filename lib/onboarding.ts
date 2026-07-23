import type { UserProfile } from "@/lib/firestore/users";
import { GRADE_LEVELS } from "@/lib/constants";

export const ONBOARDING_VERSION = 1;

export const PROFESSIONAL_ROLES = [
  "Early Years Educator",
  "Primary Teacher",
  "Secondary Teacher",
  "Special Education Educator",
  "School Leader",
  "Counselor",
  "Higher Education Educator",
  "Education Professional",
  "EdTech Professional",
  "Student Teacher",
  "Other",
] as const;

export const CURRICULA = [
  "IB PYP",
  "IB MYP",
  "IB DP",
  "British",
  "American",
  "Swedish",
  "Norwegian",
  "Montessori",
  "Cambridge",
  "National Curriculum",
  "Other",
] as const;

export const SCHOOL_TYPES = [
  "Public",
  "Private",
  "International",
  "Charter",
  "Higher Education",
  "Vocational",
  "Other",
] as const;

export const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Dutch",
  "Polish",
  "Arabic",
  "Hindi",
  "Urdu",
  "Mandarin Chinese",
  "Cantonese",
  "Japanese",
  "Korean",
  "Turkish",
  "Greek",
  "Hebrew",
  "Russian",
  "Ukrainian",
  "Other",
] as const;

export const PROFESSIONAL_INTERESTS = [
  "Inquiry-based learning",
  "Educational technology",
  "AI in education",
  "Assessment",
  "Classroom management",
  "Inclusive education",
  "Special education",
  "International education",
  "Curriculum design",
  "Project-based learning",
  "Student wellbeing",
  "Leadership",
  "Coaching and mentoring",
  "Physical education",
  "Literacy",
  "Numeracy",
  "Sustainability",
  "Career transition",
  "Other",
] as const;

export const NETWORKING_GOALS = [
  "Connect with educators",
  "Find a mentor",
  "Become a mentor",
  "Find collaborators",
  "Share teaching resources",
  "Discover job opportunities",
  "Discuss teaching challenges",
  "Connect internationally",
  "Explore educational technology",
  "Build my professional profile",
  "Find educators in my subject",
  "Find educators using my curriculum",
] as const;

export const COUNTRIES = [
  "Australia",
  "Canada",
  "Denmark",
  "Finland",
  "France",
  "Germany",
  "India",
  "Ireland",
  "Japan",
  "Netherlands",
  "New Zealand",
  "Norway",
  "Poland",
  "Portugal",
  "Singapore",
  "South Africa",
  "Spain",
  "Sweden",
  "Switzerland",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Other",
] as const;

const NON_CLASSROOM_ROLE_SET = new Set<string>([
  "School Leader",
  "Counselor",
  "Education Professional",
  "EdTech Professional",
  "Other",
]);

export type OnboardingEligibility = "completed" | "legacy-complete" | "needs-onboarding";

export interface ProfileCompletionResult {
  percentage: number;
  minimumComplete: boolean;
  missingRecommended: string[];
}

function nonEmpty(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function uniqueAllowed(values: string[] | undefined, allowed: readonly string[], max = 8): string[] {
  if (!values?.length) return [];
  const allowedSet = new Set(allowed);
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of values) {
    const clean = item.trim();
    if (!clean) continue;
    if (!allowedSet.has(clean)) continue;
    if (seen.has(clean)) continue;
    normalized.push(clean);
    seen.add(clean);
    if (normalized.length >= max) break;
  }

  return normalized;
}

export function normalizeOnboardingArrays(profile: Partial<UserProfile>): Partial<UserProfile> {
  return {
    ...profile,
    gradeLevels: uniqueAllowed(profile.gradeLevels, GRADE_LEVELS, 6),
    additionalRoles: uniqueAllowed(profile.additionalRoles, PROFESSIONAL_ROLES, 4),
    curricula: uniqueAllowed(profile.curricula, CURRICULA, 6),
    languages: uniqueAllowed(profile.languages, LANGUAGES, 8),
    professionalInterests: uniqueAllowed(profile.professionalInterests, PROFESSIONAL_INTERESTS, 8),
    networkingGoals: uniqueAllowed(profile.networkingGoals, NETWORKING_GOALS, 6),
  };
}

export function roleRequiresSubject(primaryRole: string | undefined): boolean {
  if (!primaryRole) return true;
  return !NON_CLASSROOM_ROLE_SET.has(primaryRole);
}

function hasTeachingContext(profile: Partial<UserProfile>): boolean {
  return Boolean(
    (profile.subjects?.length ?? 0) > 0 ||
      (profile.gradeLevels?.length ?? 0) > 0 ||
      nonEmpty(profile.gradeLevel)
  );
}

export function hasMinimumOnboardingData(profile: Partial<UserProfile>): boolean {
  const hasIdentity = nonEmpty(profile.displayName) && nonEmpty(profile.professionalRole);
  const hasCountry = nonEmpty(profile.country);
  const hasGoals = (profile.networkingGoals?.length ?? 0) > 0;
  const subjectRequired = roleRequiresSubject(profile.professionalRole);

  const hasGradeContext = (profile.gradeLevels?.length ?? 0) > 0 || nonEmpty(profile.gradeLevel);
  const hasSubjects = (profile.subjects?.length ?? 0) > 0;

  const hasRoleContext = subjectRequired
    ? hasSubjects && hasGradeContext
    : hasTeachingContext(profile);

  return hasIdentity && hasCountry && hasGoals && hasRoleContext;
}

export function isLegacyProfileSufficient(profile: Partial<UserProfile>): boolean {
  const hasIdentity = nonEmpty(profile.displayName);
  const hasCountry = nonEmpty(profile.country);
  const hasContext = hasTeachingContext(profile);
  return hasIdentity && hasCountry && hasContext;
}

export function getOnboardingEligibility(profile: Partial<UserProfile> | null): OnboardingEligibility {
  if (!profile) return "needs-onboarding";
  if (profile.onboardingCompleted && (profile.onboardingVersion ?? 0) >= ONBOARDING_VERSION) {
    return "completed";
  }
  if (hasMinimumOnboardingData(profile)) {
    return "completed";
  }
  if (isLegacyProfileSufficient(profile)) {
    return "legacy-complete";
  }
  return "needs-onboarding";
}

export function getOnboardingStepCount(): number {
  return 7;
}

export function coerceOnboardingCurrentStep(step: number | undefined): number {
  if (!step || Number.isNaN(step)) return 1;
  return Math.max(1, Math.min(getOnboardingStepCount(), step));
}

export function computeProfileCompletion(profile: Partial<UserProfile>): ProfileCompletionResult {
  const checks: Array<{ key: string; label: string; weight: number; complete: boolean }> = [
    { key: "professionalRole", label: "Primary professional role", weight: 12, complete: nonEmpty(profile.professionalRole) },
    { key: "subjects", label: "Subjects", weight: 12, complete: (profile.subjects?.length ?? 0) > 0 },
    {
      key: "gradeContext",
      label: "Grade levels",
      weight: 10,
      complete: (profile.gradeLevels?.length ?? 0) > 0 || nonEmpty(profile.gradeLevel),
    },
    { key: "country", label: "Country", weight: 10, complete: nonEmpty(profile.country) },
    { key: "professionalHeadline", label: "Professional headline", weight: 8, complete: nonEmpty(profile.professionalHeadline) },
    { key: "bio", label: "Bio", weight: 8, complete: nonEmpty(profile.bio) },
    { key: "photoURL", label: "Profile photo", weight: 8, complete: nonEmpty(profile.photoURL ?? undefined) },
    { key: "curricula", label: "Curriculum", weight: 6, complete: (profile.curricula?.length ?? 0) > 0 },
    { key: "professionalInterests", label: "Professional interests", weight: 6, complete: (profile.professionalInterests?.length ?? 0) > 0 },
    { key: "networkingGoals", label: "Networking goals", weight: 12, complete: (profile.networkingGoals?.length ?? 0) > 0 },
    { key: "languages", label: "Languages", weight: 4, complete: (profile.languages?.length ?? 0) > 0 },
    {
      key: "yearsOfExperience",
      label: "Years of experience",
      weight: 4,
      complete: typeof profile.yearsOfExperience === "number" && profile.yearsOfExperience >= 0,
    },
  ];

  const earned = checks.reduce((sum, check) => (check.complete ? sum + check.weight : sum), 0);
  const percentage = Math.round(earned);
  const missingRecommended = checks
    .filter((check) => !check.complete)
    .map((check) => check.label);

  return {
    percentage,
    minimumComplete: hasMinimumOnboardingData(profile),
    missingRecommended,
  };
}
