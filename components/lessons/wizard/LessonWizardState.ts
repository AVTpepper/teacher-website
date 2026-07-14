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

export const REQUIRED_WIZARD_STEPS: WizardStepKey[] = [
  "basicInfo",
  "objectives",
  "lessonSteps",
];

export type StepAttention = {
  kind: "required" | "recommended";
  message: string;
};

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

function extractMinutes(value: string): number | null {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function getStepAttention(
  stepKey: WizardStepKey,
  state: WizardLessonState
): StepAttention[] {
  const issues: StepAttention[] = [];

  switch (stepKey) {
    case "basicInfo": {
      if (!state.title.trim()) {
        issues.push({ kind: "required", message: "Add a lesson title." });
      }
      if (!state.gradeLevel.trim()) {
        issues.push({ kind: "required", message: "Choose a grade level." });
      }
      if (!state.subject.trim()) {
        issues.push({ kind: "required", message: "Choose a subject." });
      }
      if (!state.duration.trim()) {
        issues.push({ kind: "recommended", message: "Add a lesson duration." });
      }
      break;
    }
    case "objectives":
      if (!state.objectives.some((o) => o.trim() !== "")) {
        issues.push({ kind: "required", message: "Add at least one objective." });
      }
      break;
    case "materials":
      if (!state.materials.some((m) => m.trim() !== "")) {
        issues.push({ kind: "recommended", message: "Add materials if students need them." });
      }
      break;
    case "lessonSteps": {
      const titledSteps = state.steps.filter((s) => s.title.trim() !== "");
      if (titledSteps.length === 0) {
        issues.push({ kind: "required", message: "Add at least one lesson step." });
      }
      const totalDuration = extractMinutes(state.duration);
      const stepDurationTotal = titledSteps.reduce<number | null>((sum, step) => {
        const value = step.duration ? extractMinutes(step.duration) : null;
        if (sum === null || value === null) return null;
        return sum + value;
      }, 0);
      if (
        totalDuration !== null &&
        stepDurationTotal !== null &&
        totalDuration !== stepDurationTotal
      ) {
        issues.push({ kind: "recommended", message: "Review step timing against the total duration." });
      }
      if (titledSteps.some((step) => !(step.duration ?? "").trim())) {
        issues.push({ kind: "recommended", message: "Add durations to each lesson step." });
      }
      break;
    }
    case "cfu":
      if (!state.checkForUnderstanding.some((item) => item.trim() !== "")) {
        issues.push({ kind: "recommended", message: "Add a check for understanding." });
      }
      break;
    case "assessments":
      if (!state.assessments.some((item) => item.trim() !== "")) {
        issues.push({ kind: "recommended", message: "Add an assessment plan." });
      }
      break;
    case "review": {
      const upstreamIssues = [
        ...getStepAttention("basicInfo", state),
        ...getStepAttention("objectives", state),
        ...getStepAttention("materials", state),
        ...getStepAttention("lessonSteps", state),
        ...getStepAttention("cfu", state),
        ...getStepAttention("assessments", state),
      ];
      if (upstreamIssues.length > 0) {
        issues.push({ kind: "recommended", message: "Review remaining lesson issues before publishing." });
      }
      break;
    }
  }

  return issues;
}

export function validateStep(
  stepKey: WizardStepKey,
  state: WizardLessonState
): ValidationError[] {
  return getStepAttention(stepKey, state)
    .filter((issue) => issue.kind === "required")
    .map((issue) => {
      if (stepKey === "basicInfo") {
        if (issue.message.includes("title")) {
          return { field: "title", message: "Title is required" };
        }
        if (issue.message.includes("grade level")) {
          return { field: "gradeLevel", message: "Grade level is required" };
        }
        return { field: "subject", message: "Subject is required" };
      }
      if (stepKey === "objectives") {
        return { field: "objectives", message: "Add at least one objective" };
      }
      return {
        field: "lessonSteps",
        message: "Add at least one step with a title",
      };
    });
}
