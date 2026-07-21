"use client";

import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import type { WizardLessonState } from "./LessonWizardState";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type SectionKey =
  | "basicInfo"
  | "objectives"
  | "materials"
  | "lessonSteps"
  | "cfu"
  | "assessments";

// Maps a section key to the WizardLessonState field it operates on.
// null = not refinable (basicInfo is multi-field).
export const SECTION_FIELD_MAP: Record<SectionKey, keyof WizardLessonState | null> = {
  basicInfo: null,
  objectives: "objectives",
  materials: "materials",
  lessonSteps: "steps",
  cfu: "checkForUnderstanding",
  assessments: "assessments",
};

export const REFINE_LABEL_MAP: Record<SectionKey, string> = {
  basicInfo: "Basic Info",
  objectives: "Learning Objectives",
  materials: "Materials Needed",
  lessonSteps: "Lesson Steps",
  cfu: "Check for Understanding",
  assessments: "Suggested Assessments",
};

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface AIRefineState {
  refiningSection: SectionKey | null;
  setRefiningSection: (k: SectionKey | null) => void;
  expandingSection: SectionKey | null;
  aiActionMap: Map<SectionKey, "refined" | "elaborated">;
  clearAIActionForSection: (key: SectionKey) => void;
  undoMap: Map<SectionKey, unknown>;
  clearUndoForSection: (key: SectionKey) => void;
  refineInstruction: string;
  setRefineInstruction: (v: string) => void;
  refineError: string;
  setRefineError: (v: string) => void;
  isRefining: boolean;
  remainingRefines: number | null;
  showRefineButton: boolean;
  handleRefineRequest: (key: SectionKey) => void;
  handleRefineSubmit: () => Promise<void>;
  handleExpandRequest: (key: SectionKey) => Promise<void>;
  handleUndo: (key: SectionKey) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIRefine(
  lesson: WizardLessonState,
  onChange: (patch: Partial<WizardLessonState>) => void,
  user: User | null,
  isAvailable: boolean,
): AIRefineState {
  const [refiningSection, setRefiningSection] = useState<SectionKey | null>(null);
  const [expandingSection, setExpandingSection] = useState<SectionKey | null>(null);
  // Persistent map of which sections have been AI-modified and how
  const [aiActionMap, setAIActionMap] = useState<Map<SectionKey, "refined" | "elaborated">>(new Map());
  const [undoMap, setUndoMap] = useState<Map<SectionKey, unknown>>(new Map());
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refineError, setRefineError] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [remainingRefines, setRemainingRefines] = useState<number | null>(null);

  const showRefineButton = isAvailable && remainingRefines !== 0;

  function clearUndoForSection(key: SectionKey) {
    setUndoMap((prev) => {
      const m = new Map(prev);
      m.delete(key);
      return m;
    });
  }

  function clearAIActionForSection(key: SectionKey) {
    setAIActionMap((prev) => {
      const m = new Map(prev);
      m.delete(key);
      return m;
    });
  }

  // Fetch remaining monthly refine count on mount
  useEffect(() => {
    if (!user || !isAvailable) return;
    let cancelled = false;
    async function fetchRefines() {
      try {
        const token = await user!.getIdToken();
        const res = await fetch("/api/ai/lesson", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { remainingRefines?: number | null };
        if (!cancelled) setRemainingRefines(data.remainingRefines ?? null);
      } catch {
        // Non-critical - silent failure
      }
    }
    fetchRefines();
    return () => { cancelled = true; };
  }, [user, isAvailable]);

  // ── Core API call ─────────────────────────────────────────────────────────

  async function callRefineAPI(
    key: SectionKey,
    instruction: string,
    onSuccess: () => void,
    onError: (msg: string) => void,
    onFinally: () => void,
  ) {
    if (!user) return;
    const field = SECTION_FIELD_MAP[key];
    if (!field) return;

    let responseStatus: number | undefined;
    let responseData: Record<string, unknown> = {};
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const token = await user.getIdToken();
      const content = lesson[field];
      const res = await fetch("/api/ai/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: "refine",
          field,
          content,
          instruction,
          gradeLevel: lesson.gradeLevel || "General",
          subject: lesson.subject || "General",
          lessonContext: {
            title: lesson.title || undefined,
            duration: lesson.duration || undefined,
            objectives: lesson.objectives.filter((item) => item.trim() !== ""),
            materials: lesson.materials.filter((item) => item.trim() !== ""),
            steps: lesson.steps
              .filter(
                (step) =>
                  step.title.trim() !== "" || step.description.trim() !== ""
              )
              .map((step) => ({
                title: step.title,
                description: step.description,
                duration: step.duration,
              })),
            checkForUnderstanding: lesson.checkForUnderstanding.filter(
              (item) => item.trim() !== ""
            ),
            assessments: lesson.assessments.filter(
              (item) => item.trim() !== ""
            ),
          },
        }),
        signal: controller.signal,
      });

      responseStatus = res.status;
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      responseData = data;

      if (!res.ok) throw new Error("api_error");

      // Capture old content for undo before overwriting
      setUndoMap((prev) => new Map(prev).set(key, lesson[field]));
      onChange({ [field]: data.refined } as Partial<WizardLessonState>);

      if (typeof data.remainingRefines === "number") setRemainingRefines(data.remainingRefines);
      else if (data.remainingRefines === null) setRemainingRefines(null);

      onSuccess();
    } catch (err) {
      let msg: string;
      if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
        msg = "The AI took too long to respond. Please try again.";
      } else if (err instanceof TypeError) {
        msg = "Could not reach the AI service. Check your connection and try again.";
      } else if (responseStatus === 429) {
        const errBody = typeof responseData.error === "string" ? responseData.error : "";
        msg = errBody.includes("monthly refine limit")
          ? "You've reached your monthly refine limit (20). Upgrade to Plus for unlimited refines."
          : "The AI service is busy. Please wait a moment and try again.";
        if (typeof responseData.remainingRefines === "number") {
          setRemainingRefines(responseData.remainingRefines);
        }
      } else if (responseStatus === 503) {
        msg = "AI features are not available in this environment.";
      } else {
        msg = "Something went wrong. Please try again.";
      }
      onError(msg);
    } finally {
      clearTimeout(timeoutId);
      onFinally();
    }
  }

  // ── Refine ────────────────────────────────────────────────────────────────

  function handleRefineRequest(key: SectionKey) {
    if (refiningSection === key) {
      setRefiningSection(null);
      setRefineInstruction("");
      setRefineError("");
      return;
    }
    setRefiningSection(key);
    setRefineInstruction("");
    setRefineError("");
  }

  async function handleRefineSubmit() {
    if (!refiningSection || !refineInstruction.trim()) return;
    setIsRefining(true);
    setRefineError("");
    const key = refiningSection;
    await callRefineAPI(
      key,
      refineInstruction.trim(),
      () => {
        setRefiningSection(null);
        setRefineInstruction("");
        setAIActionMap((prev) => new Map(prev).set(key, "refined"));
      },
      (msg) => setRefineError(msg),
      () => setIsRefining(false),
    );
  }

  // ── Undo ──────────────────────────────────────────────────────────────────

  function handleUndo(key: SectionKey) {
    const field = SECTION_FIELD_MAP[key];
    if (!field) return;
    const prev = undoMap.get(key);
    if (prev === undefined) return;
    onChange({ [field]: prev } as Partial<WizardLessonState>);
    setUndoMap((m) => { const n = new Map(m); n.delete(key); return n; });
    // Remove the AI-modified badge for this section
    setAIActionMap((m) => { const n = new Map(m); n.delete(key); return n; });
  }

  // ── Elaborate ─────────────────────────────────────────────────────────────

  async function handleExpandRequest(key: SectionKey) {
    if (expandingSection) return;
    setExpandingSection(key);
    await callRefineAPI(
      key,
      "Expand this section with more detail, depth, and helpful specifics while keeping it practical and age-appropriate.",
      () => {
        setExpandingSection(null);
        setAIActionMap((prev) => new Map(prev).set(key, "elaborated"));
      },
      () => setExpandingSection(null),
      () => {},
    );
  }

  return {
    refiningSection,
    setRefiningSection,
    expandingSection,
    aiActionMap,
    clearAIActionForSection,
    undoMap,
    clearUndoForSection,
    refineInstruction,
    setRefineInstruction,
    refineError,
    setRefineError,
    isRefining,
    remainingRefines,
    showRefineButton,
    handleRefineRequest,
    handleRefineSubmit,
    handleExpandRequest,
    handleUndo,
  };
}
