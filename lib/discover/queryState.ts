import { GRADE_LEVELS } from "@/lib/constants";
import { CURRICULA, PROFESSIONAL_ROLES, COUNTRIES } from "@/lib/onboarding";
import { SUBJECTS } from "@/lib/firestore/users";

export type DiscoverSort = "recommended" | "newest" | "name";

export interface DiscoverQueryState {
  q: string;
  role: string;
  subject: string;
  grade: string;
  curriculum: string;
  country: string;
  sort: DiscoverSort;
  page: number;
}

export const DEFAULT_DISCOVER_QUERY_STATE: DiscoverQueryState = {
  q: "",
  role: "",
  subject: "",
  grade: "",
  curriculum: "",
  country: "",
  sort: "recommended",
  page: 1,
};

const ROLE_SET = new Set<string>(PROFESSIONAL_ROLES);
const SUBJECT_SET = new Set<string>(SUBJECTS);
const GRADE_SET = new Set<string>(GRADE_LEVELS);
const CURRICULUM_SET = new Set<string>(CURRICULA);
const COUNTRY_SET = new Set<string>(COUNTRIES);
const SORT_SET = new Set<DiscoverSort>(["recommended", "newest", "name"]);

function normalizeText(value: string | null, maxLength = 80): string {
  if (!value) return "";
  return value.trim().slice(0, maxLength);
}

function normalizeInt(value: string | null): number {
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.max(1, parsed);
}

export function parseDiscoverQueryState(searchParams: URLSearchParams): DiscoverQueryState {
  const q = normalizeText(searchParams.get("q"), 120);

  const roleCandidate = normalizeText(searchParams.get("role"));
  const subjectCandidate = normalizeText(searchParams.get("subject") ?? searchParams.get("sub"));
  const gradeCandidate = normalizeText(
    searchParams.get("grade") ?? searchParams.get("gradeLevel"),
  );
  const curriculumCandidate = normalizeText(searchParams.get("curriculum"));
  const countryCandidate = normalizeText(searchParams.get("country"));

  const sortCandidate = normalizeText(searchParams.get("sort")) as DiscoverSort;

  return {
    q,
    role: ROLE_SET.has(roleCandidate) ? roleCandidate : "",
    subject: SUBJECT_SET.has(subjectCandidate) ? subjectCandidate : "",
    grade: GRADE_SET.has(gradeCandidate) ? gradeCandidate : "",
    curriculum: CURRICULUM_SET.has(curriculumCandidate) ? curriculumCandidate : "",
    country: COUNTRY_SET.has(countryCandidate) ? countryCandidate : "",
    sort: SORT_SET.has(sortCandidate) ? sortCandidate : DEFAULT_DISCOVER_QUERY_STATE.sort,
    page: normalizeInt(searchParams.get("page")),
  };
}

export function toDiscoverQueryString(state: DiscoverQueryState): string {
  const params = new URLSearchParams();

  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.role) params.set("role", state.role);
  if (state.subject) params.set("subject", state.subject);
  if (state.grade) params.set("grade", state.grade);
  if (state.curriculum) params.set("curriculum", state.curriculum);
  if (state.country) params.set("country", state.country);
  if (state.sort !== DEFAULT_DISCOVER_QUERY_STATE.sort) params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export function stateWithResetPage(
  state: DiscoverQueryState,
  updates: Partial<DiscoverQueryState>,
): DiscoverQueryState {
  const next = { ...state, ...updates };
  const shouldResetPage =
    updates.q !== undefined ||
    updates.role !== undefined ||
    updates.subject !== undefined ||
    updates.grade !== undefined ||
    updates.curriculum !== undefined ||
    updates.country !== undefined ||
    updates.sort !== undefined;

  if (shouldResetPage) {
    next.page = 1;
  }

  return next;
}

export function hasActiveDiscoverFilters(state: DiscoverQueryState): boolean {
  return Boolean(
    state.q ||
      state.role ||
      state.subject ||
      state.grade ||
      state.curriculum ||
      state.country,
  );
}
