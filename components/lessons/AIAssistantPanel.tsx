"use client";

import { useEffect, useRef, useState } from "react";
import type { LessonStep } from "@/lib/firestore/lessons";
import { SPECIFIC_GRADE_LEVELS } from "@/lib/constants";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

// ---------- Types ----------

export type LessonFormState = {
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

export type ApplySuggestionPayload =
  | { field: "objectives"; items: string[] }
  | { field: "materials"; items: string[] }
  | { field: "steps"; items: LessonStep[] }
  | { field: "checkForUnderstanding"; items: string[] }
  | { field: "assessments"; items: string[] }
  | {
      field: "all";
      lesson: {
        title: string;
        duration: string;
        objectives: string[];
        materials: string[];
        steps: LessonStep[];
        checkForUnderstanding: string[];
        assessments: string[];
      };
    };

type SuggestSection = "objectives" | "materials" | "steps" | "checkForUnderstanding" | "assessments";

type AIAssistantPanelProps = {
  isOpen: boolean;
  onToggle: () => void;
  isAvailable: boolean;
  lessonFormState: LessonFormState;
  onApplySuggestion: (payload: ApplySuggestionPayload) => void;
  onGetToken: () => Promise<string>;
  onHighlightBasicInfo: () => void;
  // US-04: Per-section suggestions
  activeSuggestSection: SuggestSection | null;
  isSuggesting: boolean;
  suggestionItems: string[] | Array<{ title: string; description: string; duration?: string }> | null;
  suggestionError: string;
  onDismissSuggestion: () => void;
  // US-07: Usage tracking
  remainingRequests: number | null;
  onRemainingUpdate: (remaining: number | null) => void;
  // US-08: Plus tier
  userTier: "free" | "plus";
};

// ---------- Component ----------

// Returns true when every form field is blank (no content to overwrite)
function isFormEmpty(state: LessonFormState): boolean {
  const hasTitle = state.title.trim().length > 0;
  const hasObjective = state.objectives.some((o) => o.trim().length > 0);
  const hasMaterial = state.materials.some((m) => m.trim().length > 0);
  const hasStep = state.steps.some(
    (s) => s.title.trim().length > 0 || s.description.trim().length > 0
  );
  return !hasTitle && !hasObjective && !hasMaterial && !hasStep;
}

function sectionLabel(section: SuggestSection | null): string {
  if (section === "objectives") return "Objectives";
  if (section === "materials") return "Materials";
  if (section === "steps") return "Steps";
  if (section === "checkForUnderstanding") return "Check for Understanding";
  if (section === "assessments") return "Assessments";
  return "";
}

export default function AIAssistantPanel({
  isOpen,
  onToggle,
  isAvailable,
  lessonFormState,
  onApplySuggestion,
  onGetToken,
  onHighlightBasicInfo,
  activeSuggestSection,
  isSuggesting,
  suggestionItems,
  suggestionError,
  onDismissSuggestion,
  remainingRequests,
  onRemainingUpdate,
  userTier,
}: AIAssistantPanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  // Generate Full Lesson state
  const [topic, setTopic] = useState("");
  const [gradeLevelOverride, setGradeLevelOverride] = useState("");
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingLesson, setPendingLesson] = useState<{
    title: string;
    objectives: string[];
    materials: string[];
    steps: Array<{ title: string; description: string; duration?: string }>;
    checkForUnderstanding: string[];
    assessments: string[];
  } | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenerateError("");

    let responseStatus: number | undefined;
    let responseData: Record<string, unknown> = {};
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const token = await onGetToken();
      const res = await fetch("/api/ai/lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: "generate",
          topic: topic.trim(),
          gradeLevel: lessonFormState.gradeLevel,
          subject: lessonFormState.subject,
          ...(userTier === "plus" && gradeLevelOverride
            ? { gradeLevelOverride }
            : {}),
          ...(userTier === "plus" && description.trim()
            ? { description: description.trim() }
            : {}),
        }),
        signal: controller.signal,
      });

      responseStatus = res.status;
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      responseData = data;

      if (!res.ok) {
        throw new Error("api_error");
      }

      // Update remaining requests from response
      const remField = data.remainingRequests;
      if (typeof remField === "number") onRemainingUpdate(remField);
      else if (remField === null) onRemainingUpdate(null);

      const lesson = (data as { lesson: { title: string; objectives: string[]; materials: string[]; steps: Array<{ title: string; description: string; duration?: string }>; checkForUnderstanding: string[]; assessments: string[] } }).lesson;

      if (isFormEmpty(lessonFormState)) {
        applyLesson(lesson);
      } else {
        setPendingLesson(lesson);
        setConfirmOpen(true);
      }
    } catch (err) {
      let msg: string;
      if (err instanceof Error && err.name === "AbortError") {
        msg = "The AI took too long to respond. Please try again.";
      } else if (err instanceof TypeError) {
        msg = "Could not reach the AI service. Check your connection and try again.";
      } else if (responseStatus === 503) {
        msg = "AI features are not available in this environment.";
      } else if (responseStatus === 429) {
        const errBody = typeof responseData.error === "string" ? responseData.error : "";
        msg = errBody.includes("daily AI limit")
          ? "You've reached your daily limit (10 requests). Upgrade to Plus for unlimited access."
          : "The AI service is busy. Please wait a moment and try again.";
        if (typeof responseData.remainingRequests === "number") {
          onRemainingUpdate(responseData.remainingRequests);
        }
      } else {
        msg = "Something went wrong. Please try again.";
      }
      setGenerateError(msg);
    } finally {
      clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  }

  function applyLesson(lesson: {
    title: string;
    duration?: string;
    objectives: string[];
    materials: string[];
    steps: Array<{ title: string; description: string; duration?: string }>;
    checkForUnderstanding: string[];
    assessments: string[];
  }) {
    onApplySuggestion({
      field: "all",
      lesson: {
        title: lesson.title,
        duration: lesson.duration ?? "",
        objectives: lesson.objectives,
        materials: lesson.materials,
        steps: lesson.steps,
        checkForUnderstanding: lesson.checkForUnderstanding,
        assessments: lesson.assessments,
      },
    });
  }

  // Close on Escape key - focus is returned by the parent via useEffect on isOpen
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onToggle();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onToggle]);

  // Focus the panel header when it opens
  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <>
      {/* Mobile backdrop - fades in/out behind the panel, below the navbar */}
      <div
        className={[
          "fixed inset-x-0 bottom-0 top-14 z-20 bg-black/40 md:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        aria-hidden="true"
        onClick={onToggle}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        id="ai-assistant-panel"
        role="complementary"
        aria-label="AI Assistant"
        aria-hidden={!isOpen}
        inert={!isOpen || undefined}
        tabIndex={-1}
        className={[
          // Base
          "flex flex-col bg-surface border-border outline-none",
          "transition-all duration-300 ease-in-out",
          // Mobile: overlay below the navbar (top-14 = 56px matches navbar h-14)
          "fixed inset-x-0 bottom-0 top-14 z-30",
          isOpen ? "translate-x-0" : "translate-x-full",
          // Desktop: in-flow sidebar with animated width
          "md:relative md:inset-auto md:z-auto md:translate-x-0",
          "md:rounded-lg md:border md:shadow-sm md:self-start md:sticky md:top-22",
          isOpen ? "md:w-80 md:opacity-100" : "md:w-0 md:opacity-0 md:overflow-hidden",
        ].join(" ")}
      >
        {/* Panel header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-primary-700" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground whitespace-nowrap">
              AI Assistant
            </h2>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="rounded p-1 text-muted hover:bg-surface-hover hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
            aria-label="Close AI Assistant panel"
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
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!isAvailable ? (
            /* Unavailable notice - shown when OPENAI_API_KEY is absent */
            <div
              role="status"
              className="rounded-lg border border-warning-500/30 bg-warning-50 px-4 py-4 text-sm text-warning-700"
            >
              <p className="font-semibold mb-1">AI features unavailable</p>
              <p className="text-xs leading-relaxed">
                AI features are unavailable in this environment. Ask your
                administrator to configure the OpenAI API key, then reload the
                page.
              </p>
            </div>
          ) : (
            /* US-03: Generate Full Lesson Plan */
            <div className="space-y-4">
              <form onSubmit={handleGenerate} noValidate className="space-y-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                    Generate Full Lesson
                  </h3>

                  {/* Context pills - read-only form values */}
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {lessonFormState.gradeLevel ? (
                      <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs text-secondary-700">
                        {lessonFormState.gradeLevel}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs text-muted italic">
                        No grade selected
                      </span>
                    )}
                    {lessonFormState.subject ? (
                      <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs text-secondary-700">
                        {lessonFormState.subject}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs text-muted italic">
                        No subject selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mb-3">
                    To change grade or subject, update the{" "}
                    <button
                      type="button"
                      onClick={() => {
                        // On mobile the panel is a full-screen overlay - close it first
                        // so the user can see the form fields being highlighted
                        if (window.innerWidth < 768) onToggle();
                        onHighlightBasicInfo();
                      }}
                      className="font-medium text-primary-700 underline underline-offset-2 hover:text-primary-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded cursor-pointer"
                    >
                      Basic Info
                    </button>
                    {" "}section.
                  </p>

                  {/* Topic input */}
                  <label
                    htmlFor="ai-topic"
                    className="block text-xs font-medium text-foreground mb-1"
                  >
                    Topic <span aria-hidden="true" className="text-error-500">*</span>
                  </label>
                  <input
                    id="ai-topic"
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={isGenerating}
                    placeholder="e.g. Fractions, Photosynthesis, WW2…"
                    maxLength={300}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
                    aria-required="true"
                    aria-describedby={generateError ? "ai-generate-error" : "ai-topic-hint"}
                  />
                  {!topic.trim() && !generateError && (
                    <p id="ai-topic-hint" className="text-xs text-muted mt-1">
                      Enter a topic to generate a lesson.
                    </p>
                  )}
                </div>

                {/* US-08: Plus tier controls / Free upgrade notice */}
                {userTier === "plus" ? (
                  <div className="space-y-3">
                    {/* Specific Grade Level (Plus only) */}
                    <div>
                      <label
                        htmlFor="ai-grade-override"
                        className="block text-xs font-medium text-foreground mb-1"
                      >
                        Specific Grade
                      </label>
                      <select
                        id="ai-grade-override"
                        value={gradeLevelOverride}
                        onChange={(e) => setGradeLevelOverride(e.target.value)}
                        disabled={isGenerating}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
                      >
                        <option value="">Use form grade level</option>
                        {SPECIFIC_GRADE_LEVELS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Additional Context */}
                    <div>
                      <label
                        htmlFor="ai-description"
                        className="block text-xs font-medium text-foreground mb-1"
                      >
                        Additional Context
                      </label>
                      <textarea
                        id="ai-description"
                        value={description}
                        onChange={(e) =>
                          setDescription(e.target.value.slice(0, 500))
                        }
                        disabled={isGenerating}
                        placeholder="e.g. Focus on visual learners, avoid fractions"
                        maxLength={500}
                        rows={3}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 resize-none"
                        aria-describedby="ai-description-counter"
                      />
                      <p
                        id="ai-description-counter"
                        className="text-xs text-muted mt-0.5 text-right"
                        aria-live="polite"
                      >
                        {description.length} / 500
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
                    Upgrade to Plus to access grade override and additional context fields.
                  </p>
                )}

                {/* Error message */}
                {generateError && (
                  <div className="flex items-start justify-between gap-2">
                    <p
                      id="ai-generate-error"
                      role="alert"
                      className="text-xs text-error-600"
                    >
                      {generateError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setGenerateError("")}
                      aria-label="Dismiss error"
                      className="shrink-0 rounded p-0.5 text-error-600 hover:bg-error-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500 cursor-pointer"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isGenerating}
                  disabled={!topic.trim() || isGenerating || remainingRequests === 0}
                  className="w-full"
                  aria-live="polite"
                >
                  {isGenerating ? "Generating…" : "Generate"}
                </Button>

                {/* US-07: Usage meter for free tier */}
                {remainingRequests !== null && remainingRequests > 0 && (
                  <p className="text-center text-xs text-muted" aria-live="polite">
                    {remainingRequests} / 10 requests remaining today
                  </p>
                )}

                {/* US-07: Upgrade prompt when daily limit is reached */}
                {remainingRequests === 0 && (
                  <div
                    role="alert"
                    className="rounded-lg border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-700"
                  >
                    <p className="font-semibold mb-1">Daily limit reached</p>
                    <p className="leading-relaxed">
                      You&apos;ve used all 10 daily requests. Upgrade to Plus for
                      unlimited AI access.
                    </p>
                  </div>
                )}
              </form>

              {/* US-04: Per-section suggestions preview */}
              {(activeSuggestSection !== null || suggestionError) && (
                <div className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Suggested {sectionLabel(activeSuggestSection)}
                  </h3>

                  {isSuggesting && (
                    <div className="flex items-center gap-2 text-sm text-muted" role="status" aria-live="polite">
                      <svg
                        className="h-4 w-4 animate-spin text-primary-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                      <span>Fetching suggestions…</span>
                    </div>
                  )}

                  {suggestionError && !isSuggesting && (
                    <div className="flex items-start justify-between gap-2">
                      <p role="alert" className="text-xs text-error-600">
                        {suggestionError}
                      </p>
                      <button
                        type="button"
                        onClick={onDismissSuggestion}
                        aria-label="Dismiss suggestion error"
                        className="shrink-0 rounded px-2 py-0.5 text-xs text-error-600 hover:bg-error-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {!isSuggesting && suggestionItems && suggestionItems.length > 0 && (
                    <>
                      <ul className="space-y-1.5" aria-label={`Suggested ${sectionLabel(activeSuggestSection)}`}>
                        {(suggestionItems as Array<string | { title: string; description: string; duration?: string }>).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">•</span>
                            {typeof item === "string" ? (
                              <span>{item}</span>
                            ) : (
                              <span>
                                <span className="font-medium">{item.title}</span>
                                {item.duration && (
                                  <span className="text-xs text-muted ml-1">({item.duration})</span>
                                )}
                                {item.description && (
                                  <span className="text-muted"> - {item.description}</span>
                                )}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            if (!activeSuggestSection || !suggestionItems) return;
                            if (activeSuggestSection === "steps") {
                              onApplySuggestion({
                                field: "steps",
                                items: (suggestionItems as Array<{ title: string; description: string; duration?: string }>).map((s) => ({
                                  title: typeof s === "string" ? s : s.title,
                                  description: typeof s === "string" ? "" : s.description,
                                  duration: typeof s === "string" ? undefined : s.duration,
                                })),
                              });
                            } else if (activeSuggestSection === "checkForUnderstanding" || activeSuggestSection === "assessments") {
                              onApplySuggestion({
                                field: activeSuggestSection,
                                items: suggestionItems as string[],
                              });
                            } else {
                              onApplySuggestion({
                                field: activeSuggestSection,
                                items: suggestionItems as string[],
                              });
                            }
                            onDismissSuggestion();
                          }}
                        >
                          Apply
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={onDismissSuggestion}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Confirmation dialog */}
          <Modal
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title="Replace lesson content?"
          >
            <p className="text-sm text-muted mb-6">
              This will replace your current lesson content. Continue?
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (pendingLesson) applyLesson(pendingLesson);
                  setPendingLesson(null);
                  setConfirmOpen(false);
                }}
              >
                Continue
              </Button>
            </div>
          </Modal>
        </div>{/* end panel body */}
      </aside>
    </>
  );
}

// ---------- Icon ----------

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
      />
    </svg>
  );
}
