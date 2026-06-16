import type { LessonStep } from "@/lib/firestore/lessons";

export type WizardLessonState = {
  title: string;
  gradeLevel: string;
  subject: string;
  duration: string;
  objectives: string[];
  materials: string[];
  steps: LessonStep[];
  checkForUnderstanding: string[];
  assessments: string[];
};

export const WIZARD_STEPS = [
  { id: 1, key: "basicInfo", label: "Basic Info" },
  { id: 2, key: "objectives", label: "Learning Objectives" },
  { id: 3, key: "materials", label: "Materials Needed" },
  { id: 4, key: "lessonSteps", label: "Lesson Steps" },
  { id: 5, key: "cfu", label: "Check for Understanding" },
  { id: 6, key: "assessments", label: "Suggested Assessments" },
  { id: 7, key: "review", label: "Review & Publish" },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

export function emptyWizardState(): WizardLessonState {
  return {
    title: "",
    gradeLevel: "",
    subject: "",
    duration: "",
    objectives: [""],
    materials: [""],
    steps: [{ title: "", description: "" }],
    checkForUnderstanding: [""],
    assessments: [""],
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export type ValidationError = { field: string; message: string };

export function validateStep(
  stepKey: WizardStepKey,
  state: WizardLessonState
): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (stepKey) {
    case "basicInfo":
      if (!state.title.trim()) {
        errors.push({ field: "title", message: "Title is required" });
      }
      break;
    case "objectives":
      if (!state.objectives.some((o) => o.trim() !== "")) {
        errors.push({ field: "objectives", message: "Add at least one objective" });
      }
      break;
    case "lessonSteps":
      if (!state.steps.some((s) => s.title.trim() !== "")) {
        errors.push({
          field: "lessonSteps",
          message: "Add at least one step with a title",
        });
      }
      break;
    // materials, cfu, assessments, review: always valid (optional)
  }

  return errors;
}
