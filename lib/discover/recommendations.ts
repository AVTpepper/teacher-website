import type { UserProfile } from "@/lib/firestore/users";
import { hasMinimumOnboardingData } from "@/lib/onboarding";

export interface RecommendationWeights {
  subject: number;
  curriculum: number;
  gradeLevel: number;
  interest: number;
  networkingGoal: number;
  language: number;
  country: number;
  role: number;
}

export interface RecommendationReason {
  id: string;
  label: string;
}

export interface RecommendationResult {
  educator: UserProfile;
  score: number;
  reasons: RecommendationReason[];
  matchLabel: "Strong match" | "Good match" | "Several shared interests";
}

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  subject: 6,
  curriculum: 5,
  gradeLevel: 4,
  interest: 4,
  networkingGoal: 3,
  language: 2,
  country: 2,
  role: 2,
};

function normalizeList(values: Array<string | null | undefined> | undefined): string[] {
  if (!values?.length) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const clean = (value ?? "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(clean);
  }
  return normalized;
}

function overlap(viewerValues: string[], candidateValues: string[]): string[] {
  if (viewerValues.length === 0 || candidateValues.length === 0) return [];

  const candidateMap = new Map(candidateValues.map((value) => [value.toLowerCase(), value]));
  const matches = new Set<string>();

  for (const value of viewerValues) {
    const found = candidateMap.get(value.toLowerCase());
    if (found) matches.add(found);
  }

  return Array.from(matches);
}

function formatReason(prefix: string, values: string[]): string {
  if (values.length === 0) return prefix;
  if (values.length === 1) return `${prefix}: ${values[0]}`;
  if (values.length === 2) return `${prefix}: ${values[0]} and ${values[1]}`;
  return `${prefix}: ${values[0]}, ${values[1]}, +${values.length - 2} more`;
}

function getGradeContext(profile: UserProfile): string[] {
  return normalizeList([...(profile.gradeLevels ?? []), profile.gradeLevel]);
}

function profileCountry(profile: UserProfile): string {
  return (profile.country ?? "").trim();
}

function createdAtSeconds(profile: UserProfile): number {
  const createdAt = profile.createdAt as { seconds?: number } | null | undefined;
  return createdAt?.seconds ?? 0;
}

export function dedupeEducatorCandidates(candidates: UserProfile[]): UserProfile[] {
  const seen = new Set<string>();
  const deduped: UserProfile[] = [];

  for (const candidate of candidates) {
    if (!candidate.uid || !candidate.displayName?.trim()) continue;
    if (seen.has(candidate.uid)) continue;
    seen.add(candidate.uid);
    deduped.push(candidate);
  }

  return deduped;
}

export function isRecommendationEligible(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return hasMinimumOnboardingData(profile);
}

export function scoreRecommendation(
  viewer: UserProfile,
  candidate: UserProfile,
  weights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
): { score: number; reasons: RecommendationReason[] } {
  const reasons: RecommendationReason[] = [];
  let score = 0;

  const subjectOverlap = overlap(normalizeList(viewer.subjects), normalizeList(candidate.subjects));
  if (subjectOverlap.length > 0) {
    score += subjectOverlap.length * weights.subject;
    reasons.push({ id: "subjects", label: formatReason("Shared subjects", subjectOverlap) });
  }

  const curriculumOverlap = overlap(
    normalizeList(viewer.curricula),
    normalizeList(candidate.curricula),
  );
  if (curriculumOverlap.length > 0) {
    score += curriculumOverlap.length * weights.curriculum;
    reasons.push({ id: "curricula", label: formatReason("Shared curriculum", curriculumOverlap) });
  }

  const gradeOverlap = overlap(getGradeContext(viewer), getGradeContext(candidate));
  if (gradeOverlap.length > 0) {
    score += gradeOverlap.length * weights.gradeLevel;
    reasons.push({ id: "gradeLevels", label: formatReason("Shared grade levels", gradeOverlap) });
  }

  const interestOverlap = overlap(
    normalizeList(viewer.professionalInterests),
    normalizeList(candidate.professionalInterests),
  );
  if (interestOverlap.length > 0) {
    score += interestOverlap.length * weights.interest;
    reasons.push({ id: "interests", label: formatReason("Shared interests", interestOverlap) });
  }

  const goalOverlap = overlap(
    normalizeList(viewer.networkingGoals),
    normalizeList(candidate.networkingGoals),
  );
  if (goalOverlap.length > 0) {
    score += goalOverlap.length * weights.networkingGoal;
    reasons.push({ id: "goals", label: formatReason("Shared networking goals", goalOverlap) });
  }

  const languageOverlap = overlap(normalizeList(viewer.languages), normalizeList(candidate.languages));
  if (languageOverlap.length > 0) {
    score += Math.min(languageOverlap.length, 2) * weights.language;
    reasons.push({ id: "languages", label: formatReason("Shared languages", languageOverlap) });
  }

  const viewerCountry = profileCountry(viewer).toLowerCase();
  const candidateCountry = profileCountry(candidate);
  if (viewerCountry && candidateCountry && viewerCountry === candidateCountry.toLowerCase()) {
    score += weights.country;
    reasons.push({ id: "country", label: `Same country: ${candidateCountry}` });
  }

  const viewerRole = (viewer.professionalRole ?? "").trim().toLowerCase();
  const candidateRole = (candidate.professionalRole ?? "").trim();
  if (viewerRole && candidateRole && viewerRole === candidateRole.toLowerCase()) {
    score += weights.role;
    reasons.push({ id: "role", label: `Same role: ${candidateRole}` });
  }

  return { score, reasons };
}

function toMatchLabel(score: number): RecommendationResult["matchLabel"] {
  if (score >= 16) return "Strong match";
  if (score >= 9) return "Good match";
  return "Several shared interests";
}

export function rankRecommendedEducators(
  viewer: UserProfile,
  candidates: UserProfile[],
  options?: {
    excludeUserIds?: Set<string>;
    maxResults?: number;
    weights?: RecommendationWeights;
  },
): RecommendationResult[] {
  const exclude = options?.excludeUserIds ?? new Set<string>();
  const maxResults = options?.maxResults ?? 8;
  const weights = options?.weights ?? DEFAULT_RECOMMENDATION_WEIGHTS;

  const deduped = dedupeEducatorCandidates(candidates);

  const ranked = deduped
    .filter((candidate) => candidate.uid !== viewer.uid && !exclude.has(candidate.uid))
    .map((candidate) => {
      const scored = scoreRecommendation(viewer, candidate, weights);
      return {
        educator: candidate,
        score: scored.score,
        reasons: scored.reasons.slice(0, 3),
        matchLabel: toMatchLabel(scored.score),
      } satisfies RecommendationResult;
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const createdDiff = createdAtSeconds(b.educator) - createdAtSeconds(a.educator);
      if (createdDiff !== 0) return createdDiff;
      return a.educator.displayName.localeCompare(b.educator.displayName);
    });

  return ranked.slice(0, Math.max(1, maxResults));
}
