"use client";

import { useRef, useEffect, type KeyboardEvent } from "react";
import { Textarea, Button } from "@/components/ui";
import type { WizardLessonState } from "../LessonWizardState";

type StepProps = {
  state: WizardLessonState;
  onChange: (patch: Partial<WizardLessonState>) => void;
  isActive: boolean;
};

export default function AssessmentsStep({ state, onChange }: StepProps) {
  const { assessments } = state;
  const refs = useRef<Array<HTMLTextAreaElement | null>>([]);

  useEffect(() => {
    refs.current = refs.current.slice(0, assessments.length);
  }, [assessments.length]);

  function updateItem(index: number, value: string) {
    onChange({
      assessments: assessments.map((item, i) => (i === index ? value : item)),
    });
  }

  function removeItem(index: number) {
    if (assessments.length <= 1) return;
    onChange({ assessments: assessments.filter((_, i) => i !== index) });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, index: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const isLast = index === assessments.length - 1;
    const hasValue = assessments[index].trim().length > 0;

    if (isLast && hasValue) {
      onChange({ assessments: [...assessments, ""] });
      setTimeout(() => refs.current[index + 1]?.focus(), 0);
      return;
    }
    refs.current[index + 1]?.focus();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Suggest ways to assess student learning. (Optional - you can skip this step.)
      </p>

      <div className="space-y-3">
        {assessments.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2.5 text-xs text-muted font-medium w-5 shrink-0">
              {i + 1}.
            </span>
            <Textarea
              ref={(el) => {
                refs.current[i] = el;
              }}
              placeholder={`Assessment ${i + 1} (e.g. Quiz on key concepts)`}
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              rows={1}
              style={
                { minHeight: "2.25rem", resize: "none", fieldSizing: "content" } as React.CSSProperties
              }
              className="flex-1 min-h-0"
            />
            {assessments.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="mt-2 p-1 text-muted hover:text-error-500 transition-colors cursor-pointer"
                aria-label={`Remove assessment ${i + 1}`}
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
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange({ assessments: [...assessments, ""] })}
      >
        + Add Assessment
      </Button>
    </div>
  );
}
