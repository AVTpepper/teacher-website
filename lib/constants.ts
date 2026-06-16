// Shared constants with no SDK dependencies — safe to import in both
// client components and Next.js server route handlers.

export const GRADE_LEVELS = [
  "Kindergarten",
  "Elementary",
  "Middle School",
  "High School",
  "Higher Education",
] as const;

export type GradeLevel = (typeof GRADE_LEVELS)[number];
