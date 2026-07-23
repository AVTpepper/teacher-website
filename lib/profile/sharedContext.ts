import type { UserProfile } from "@/lib/firestore/users";

export interface SharedContextReason {
  id: string;
  label: string;
  detail: string;
}

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

function normalizeString(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function intersectLabels(viewerValues: string[], targetValues: string[]): string[] {
  if (viewerValues.length === 0 || targetValues.length === 0) return [];

  const targetByKey = new Map<string, string>();
  for (const value of targetValues) {
    targetByKey.set(value.toLowerCase(), value);
  }

  const overlap = new Set<string>();
  for (const value of viewerValues) {
    const match = targetByKey.get(value.toLowerCase());
    if (match) {
      overlap.add(match);
    }
  }

  return Array.from(overlap).sort((a, b) => a.localeCompare(b));
}

function formatOverlap(values: string[], suffix: string): string {
  if (values.length === 1) return `${values[0]} ${suffix}`;
  if (values.length === 2) return `${values[0]} and ${values[1]} ${suffix}`;
  const firstThree = values.slice(0, 3);
  if (values.length > 3) {
    return `${firstThree.join(", ")}, +${values.length - 3} more ${suffix}`;
  }
  const start = firstThree.slice(0, firstThree.length - 1).join(", ");
  return `${start}, and ${firstThree[firstThree.length - 1]} ${suffix}`;
}

export function getSharedContextReasons(
  viewerProfile: UserProfile | null,
  targetProfile: UserProfile,
  maxReasons = 4,
): SharedContextReason[] {
  if (!viewerProfile) return [];
  if (viewerProfile.uid === targetProfile.uid) return [];

  const viewerGradeLevels = normalizeList([
    ...(viewerProfile.gradeLevels ?? []),
    viewerProfile.gradeLevel,
  ]);
  const targetGradeLevels = normalizeList([
    ...(targetProfile.gradeLevels ?? []),
    targetProfile.gradeLevel,
  ]);

  const overlaps = {
    gradeLevels: intersectLabels(viewerGradeLevels, targetGradeLevels),
    subjects: intersectLabels(normalizeList(viewerProfile.subjects), normalizeList(targetProfile.subjects)),
    curricula: intersectLabels(normalizeList(viewerProfile.curricula), normalizeList(targetProfile.curricula)),
    interests: intersectLabels(
      normalizeList(viewerProfile.professionalInterests),
      normalizeList(targetProfile.professionalInterests),
    ),
    goals: intersectLabels(normalizeList(viewerProfile.networkingGoals), normalizeList(targetProfile.networkingGoals)),
    languages: intersectLabels(normalizeList(viewerProfile.languages), normalizeList(targetProfile.languages)),
  };

  const reasons: SharedContextReason[] = [];

  if (overlaps.gradeLevels.length > 0) {
    reasons.push({
      id: "grade-levels",
      label: "Shared teaching stages",
      detail: formatOverlap(overlaps.gradeLevels, "grade-level overlap"),
    });
  }

  if (overlaps.subjects.length > 0) {
    reasons.push({
      id: "subjects",
      label: "Shared subject focus",
      detail: formatOverlap(overlaps.subjects, "subjects in common"),
    });
  }

  if (overlaps.curricula.length > 0) {
    reasons.push({
      id: "curricula",
      label: "Shared curriculum context",
      detail: formatOverlap(overlaps.curricula, "curriculum matches"),
    });
  }

  const viewerCountry = normalizeString(viewerProfile.country).toLowerCase();
  const targetCountry = normalizeString(targetProfile.country);
  if (viewerCountry && targetCountry && viewerCountry === targetCountry.toLowerCase()) {
    reasons.push({
      id: "country",
      label: "Shared region",
      detail: `Both work in ${targetCountry}`,
    });
  }

  if (overlaps.interests.length > 0) {
    reasons.push({
      id: "interests",
      label: "Shared professional interests",
      detail: formatOverlap(overlaps.interests, "interest areas in common"),
    });
  }

  if (overlaps.goals.length > 0) {
    reasons.push({
      id: "goals",
      label: "Shared networking goals",
      detail: formatOverlap(overlaps.goals, "networking goals in common"),
    });
  }

  if (overlaps.languages.length > 0) {
    reasons.push({
      id: "languages",
      label: "Shared language support",
      detail: formatOverlap(overlaps.languages, "shared languages"),
    });
  }

  return reasons.slice(0, Math.max(0, maxReasons));
}
