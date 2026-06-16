// Shared constants with no SDK dependencies - safe to import in both
// client components and Next.js server route handlers.

export const GRADE_LEVELS = [
  "Kindergarten",
  "Elementary",
  "Middle School",
  "High School",
  "Higher Education",
] as const;

export type GradeLevel = (typeof GRADE_LEVELS)[number];

// Specific grade levels used in the Plus AI panel for precise targeting
export const SPECIFIC_GRADE_LEVELS = [
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "9th Grade",
  "10th Grade",
  "11th Grade",
  "12th Grade",
  "College / University",
] as const;

export type SpecificGradeLevel = (typeof SPECIFIC_GRADE_LEVELS)[number];
