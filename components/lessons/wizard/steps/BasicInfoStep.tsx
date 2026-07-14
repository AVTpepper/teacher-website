"use client";

import { useRef, useEffect } from "react";
import { Input, Select } from "@/components/ui";
import { GRADE_LEVELS, SUBJECTS } from "@/lib/firestore/users";
import type { WizardLessonState, ValidationError } from "../LessonWizardState";

export type StepProps = {
  state: WizardLessonState;
  onChange: (patch: Partial<WizardLessonState>) => void;
  isActive: boolean;
  errors?: ValidationError[];
};

export default function BasicInfoStep({ state, onChange, errors = [] }: StepProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const titleError = errors.find((e) => e.field === "title")?.message;

  // Focus title input when a title error appears
  useEffect(() => {
    if (titleError) {
      titleRef.current?.focus();
    }
  }, [titleError]);

  return (
    <div className="space-y-4">
      <Input
        ref={titleRef}
        label="Lesson Title"
        placeholder="e.g. Introduction to Fractions"
        value={state.title}
        onChange={(e) => onChange({ title: e.target.value })}
        required
        error={titleError}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Grade Level"
          value={state.gradeLevel}
          onChange={(e) => onChange({ gradeLevel: e.target.value })}
          placeholder="Select grade level"
          options={GRADE_LEVELS.map((g) => ({ value: g, label: g }))}
        />
        <Select
          label="Subject"
          value={state.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          placeholder="Select subject"
          options={SUBJECTS.map((s) => ({ value: s, label: s }))}
        />
      </div>

      <Input
        label="Duration"
        placeholder="e.g. 45 minutes, 2 class periods"
        value={state.duration}
        onChange={(e) => onChange({ duration: e.target.value })}
      />
    </div>
  );
}
