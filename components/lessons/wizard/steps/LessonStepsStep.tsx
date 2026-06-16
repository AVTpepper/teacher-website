"use client";

import { Input, Textarea, Button } from "@/components/ui";
import type { LessonStep } from "@/lib/firestore/lessons";
import type { WizardLessonState, ValidationError } from "../LessonWizardState";

type StepProps = {
  state: WizardLessonState;
  onChange: (patch: Partial<WizardLessonState>) => void;
  isActive: boolean;
  errors?: ValidationError[];
};

export default function LessonStepsStep({ state, onChange, errors = [] }: StepProps) {
  const lessonStepsError = errors.find((e) => e.field === "lessonSteps")?.message;
  const { steps } = state;

  function updateStep(index: number, patch: Partial<LessonStep>) {
    onChange({
      steps: steps.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    onChange({ steps: steps.filter((_, i) => i !== index) });
  }

  function moveStep(from: number, to: number) {
    if (to < 0 || to >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange({ steps: next });
  }

  function insertStepBelow(index: number) {
    const next = [...steps];
    next.splice(index + 1, 0, { title: "", description: "" });
    onChange({ steps: next });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Break your lesson into sequential steps. Each step should have a clear title and description.
      </p>

      {lessonStepsError && (
        <p role="alert" className="text-xs text-error-600">{lessonStepsError}</p>
      )}

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div
            key={i}
            className="rounded-lg border border-border p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                Step {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveStep(i, i - 1)}
                  disabled={i === 0}
                  className="p-1 text-muted hover:text-foreground disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Move step up"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 15.75 7.5-7.5 7.5 7.5"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(i, i + 1)}
                  disabled={i === steps.length - 1}
                  className="p-1 text-muted hover:text-foreground disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Move step down"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m19.5 8.25-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </button>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    className="p-1 text-muted hover:text-error-500 transition-colors cursor-pointer"
                    aria-label={`Remove step ${i + 1}`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <Input
              placeholder="Step title (e.g. Warm-Up Activity)"
              value={step.title}
              onChange={(e) => updateStep(i, { title: e.target.value })}
            />

            <Input
              placeholder="Duration (e.g. 10 minutes)"
              value={step.duration ?? ""}
              onChange={(e) => updateStep(i, { duration: e.target.value })}
            />

            <Textarea
              placeholder="Describe what happens in this step…"
              value={step.description}
              onChange={(e) => updateStep(i, { description: e.target.value })}
              rows={2}
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertStepBelow(i)}
              >
                + Add Step Below
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
