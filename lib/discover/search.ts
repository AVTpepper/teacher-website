import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserProfile } from "@/lib/firestore/users";
import type { DiscoverSort } from "@/lib/discover/queryState";
import { dedupeEducatorCandidates } from "@/lib/discover/recommendations";

export interface DiscoverSearchFilters {
  q: string;
  role: string;
  subject: string;
  grade: string;
  curriculum: string;
  country: string;
  sort: DiscoverSort;
}

const DEFAULT_POOL_LIMIT = 160;

function normalizeList(values: Array<string | null | undefined> | undefined): string[] {
  if (!values?.length) return [];
  return values.map((value) => (value ?? "").trim()).filter(Boolean);
}

function asProfile(data: unknown): UserProfile | null {
  if (!data || typeof data !== "object") return null;
  const profile = data as UserProfile;
  if (!profile.uid || !profile.displayName?.trim()) return null;
  return profile;
}

function createdAtSeconds(profile: UserProfile): number {
  const createdAt = profile.createdAt as { seconds?: number } | null | undefined;
  return createdAt?.seconds ?? 0;
}

function gradeMatches(profile: UserProfile, grade: string): boolean {
  if (!grade) return true;
  if (profile.gradeLevel === grade) return true;
  return (profile.gradeLevels ?? []).includes(grade);
}

function textSearchMatches(profile: UserProfile, queryText: string): boolean {
  if (!queryText) return true;

  const normalized = queryText.toLowerCase();
  const haystack = [
    profile.displayName,
    profile.professionalHeadline,
    profile.professionalRole,
    profile.country,
    profile.city,
    ...normalizeList(profile.subjects),
    ...normalizeList(profile.curricula),
    ...normalizeList(profile.professionalInterests),
    ...normalizeList(profile.networkingGoals),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

function sortProfiles(profiles: UserProfile[], sort: DiscoverSort): UserProfile[] {
  const clone = [...profiles];
  if (sort === "name") {
    clone.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return clone;
  }

  clone.sort((a, b) => {
    const createdDiff = createdAtSeconds(b) - createdAtSeconds(a);
    if (createdDiff !== 0) return createdDiff;
    return a.displayName.localeCompare(b.displayName);
  });
  return clone;
}

function pickPrimaryConstraint(filters: DiscoverSearchFilters): {
  constraint: QueryConstraint | null;
  mode: "subject" | "curriculum" | "role" | "grade" | "country" | "name-prefix" | "none";
} {
  if (filters.subject) {
    return {
      constraint: where("subjects", "array-contains", filters.subject),
      mode: "subject",
    };
  }

  if (filters.curriculum) {
    return {
      constraint: where("curricula", "array-contains", filters.curriculum),
      mode: "curriculum",
    };
  }

  if (filters.role) {
    return {
      constraint: where("professionalRole", "==", filters.role),
      mode: "role",
    };
  }

  if (filters.grade) {
    return {
      constraint: where("gradeLevel", "==", filters.grade),
      mode: "grade",
    };
  }

  if (filters.country) {
    return {
      constraint: where("country", "==", filters.country),
      mode: "country",
    };
  }

  if (filters.q.length >= 2) {
    const lower = filters.q.toLowerCase();
    return {
      constraint: where("displayNameLower", ">=", lower),
      mode: "name-prefix",
    };
  }

  return { constraint: null, mode: "none" };
}

export async function getDiscoverCandidatePool(
  filters: DiscoverSearchFilters,
  maxPool = DEFAULT_POOL_LIMIT,
): Promise<UserProfile[]> {
  if (!db) throw new Error("Firestore is not initialized");

  const usersCollection = collection(db, "users");
  const constraints: QueryConstraint[] = [];

  const primary = pickPrimaryConstraint(filters);
  if (primary.constraint) {
    constraints.push(primary.constraint);

    if (filters.q.length >= 2 && primary.mode === "name-prefix") {
      const lower = filters.q.toLowerCase();
      constraints.push(where("displayNameLower", "<=", `${lower}\uf8ff`));
    }
  }

  constraints.push(limit(Math.max(20, maxPool)));

  const snapshot = await getDocs(query(usersCollection, ...constraints));
  const rawProfiles = snapshot.docs
    .map((docSnap) => asProfile(docSnap.data()))
    .filter((profile): profile is UserProfile => profile !== null);

  const filteredProfiles = rawProfiles.filter((profile) => {
    if (filters.role && (profile.professionalRole ?? "") !== filters.role) return false;
    if (filters.subject && !(profile.subjects ?? []).includes(filters.subject)) return false;
    if (!gradeMatches(profile, filters.grade)) return false;
    if (filters.curriculum && !(profile.curricula ?? []).includes(filters.curriculum)) return false;
    if (filters.country && (profile.country ?? "") !== filters.country) return false;
    if (!textSearchMatches(profile, filters.q)) return false;
    return true;
  });

  return sortProfiles(dedupeEducatorCandidates(filteredProfiles), filters.sort);
}

export async function getNewestDiscoverEducators(maxPool = 40): Promise<UserProfile[]> {
  if (!db) throw new Error("Firestore is not initialized");

  const snapshot = await getDocs(query(collection(db, "users"), limit(Math.max(12, maxPool))));

  const profiles = snapshot.docs
    .map((docSnap) => asProfile(docSnap.data()))
    .filter((profile): profile is UserProfile => profile !== null)
    .filter((profile) => {
      const hasContext =
        (profile.subjects?.length ?? 0) > 0 ||
        Boolean((profile.professionalRole ?? "").trim()) ||
        Boolean((profile.professionalHeadline ?? "").trim());
      return hasContext;
    });

  return sortProfiles(dedupeEducatorCandidates(profiles), "newest");
}
