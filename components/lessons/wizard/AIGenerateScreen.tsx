"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { GRADE_LEVELS, SPECIFIC_GRADE_LEVELS } from "@/lib/constants";
import { SUBJECTS } from "@/lib/firestore/users";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { WizardLessonState } from "./LessonWizardState";

// ─── Types ────────────────────────────────────────────────────────────────────

type AIGenerateScreenProps = {
  user: User | null;
  userTier: "free" | "plus";
  onGenerated: (state: WizardLessonState) => void;
  onBack: () => void;
};

type GenerateResponse = {
  lesson: {
    title: string;
    duration?: string;
    objectives: string[];
    materials: string[];
    steps: Array<{ title: string; description: string; duration?: string }>;
    checkForUnderstanding: string[];
    assessments: string[];
  };
  remainingRequests?: number | null;
};

type GeneratedLessonPreview = GenerateResponse["lesson"];

const ACTIVITY_STYLE_OPTIONS = [
  "Hands-on exploration",
  "Discussion-based learning",
  "Direct instruction with practice",
  "Collaborative group work",
  "Inquiry-based learning",
  "Project-based learning",
] as const;

// ─── Error mapping ────────────────────────────────────────────────────────────

function mapErrorToMessage(
  err: unknown,
  responseStatus?: number,
  responseData?: Record<string, unknown>
): string {
  if (err instanceof Error && err.name === "AbortError") {
    return "The AI took too long to respond. Please try again.";
  }
  if (err instanceof TypeError) {
    return "Could not reach the AI service. Check your connection and try again.";
  }
  if (responseStatus === 503) {
    return "AI features are not available in this environment.";
  }
  if (responseStatus === 429) {
    const errMsg =
      typeof responseData?.error === "string" ? responseData.error : "";
    if (errMsg.includes("daily AI limit")) {
      return "You've reached your daily limit (10 requests). Upgrade to Plus for unlimited access.";
    }
    return "The AI service is busy. Please wait a moment and try again.";
  }
  return "Something went wrong. Please try again.";
}

function extractMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function buildQualityChecks(lesson: GeneratedLessonPreview) {
  const filledObjectives = lesson.objectives.filter((item) => item.trim() !== "");
  const filledMaterials = lesson.materials.filter((item) => item.trim() !== "");
  const filledSteps = lesson.steps.filter((step) => step.title.trim() !== "");
  const totalDuration = extractMinutes(lesson.duration);
  const stepDurationTotal = filledSteps.reduce<number | null>((sum, step) => {
    const value = extractMinutes(step.duration);
    if (sum === null || value === null) return null;
    return sum + value;
  }, 0);

  return [
    {
      label: "Objectives",
      status: filledObjectives.length > 0 ? "pass" : "warn",
      detail:
        filledObjectives.length > 0
          ? `${filledObjectives.length} included`
          : "Add at least one clear learning target before publishing.",
    },
    {
      label: "Lesson steps",
      status: filledSteps.length >= 3 ? "pass" : "warn",
      detail:
        filledSteps.length >= 3
          ? `${filledSteps.length} steps drafted`
          : "The draft is short. Consider regenerating or expanding before use.",
    },
    {
      label: "Duration math",
      status:
        totalDuration !== null && stepDurationTotal !== null && totalDuration === stepDurationTotal
          ? "pass"
          : "warn",
      detail:
        totalDuration !== null && stepDurationTotal !== null
          ? `${lesson.duration ?? "No total set"} total vs ${stepDurationTotal} minutes across steps`
          : "One or more durations need a quick teacher check.",
    },
    {
      label: "Materials",
      status: filledMaterials.length > 0 ? "pass" : "warn",
      detail:
        filledMaterials.length > 0
          ? `${filledMaterials.length} materials listed`
          : "No materials listed yet.",
    },
  ] as const;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIGenerateScreen({
  user,
  userTier,
  onGenerated,
  onBack,
}: AIGenerateScreenProps) {
  const [topic, setTopic] = useState("");
  const [gradeLevel, setGradeLevel] = useState<string>(GRADE_LEVELS[0]);
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [learningGoal, setLearningGoal] = useState("");
  const [studentSupports, setStudentSupports] = useState("");
  const [activityStyle, setActivityStyle] = useState("");
  const [gradeLevelOverride, setGradeLevelOverride] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [previewLesson, setPreviewLesson] = useState<GeneratedLessonPreview | null>(null);
  const [remainingRequests, setRemainingRequests] = useState<number | null>(
    null
  );

  // Fetch remaining daily requests on mount (free tier guard)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchUsage() {
      try {
        const token = await user!.getIdToken();
        const res = await fetch("/api/ai/lesson", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          remainingRequests?: number | null;
        };
        if (!cancelled) {
          setRemainingRequests(data.remainingRequests ?? null);
        }
      } catch {
        // Non-critical - usage limit is enforced server-side
      }
    }

    fetchUsage();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isLimitReached = remainingRequests === 0;
  const isSubmitDisabled = !topic.trim() || isGenerating || isLimitReached;
  const remainsId = "ai-generate-remaining";

  async function generateLesson() {
    if (isSubmitDisabled || !user) return;

    setIsGenerating(true);
    setError("");

    let responseStatus: number | undefined;
    let responseData: Record<string, unknown> = {};
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ai/lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: "generate",
          topic: topic.trim(),
          gradeLevel,
          subject,
          ...(learningGoal.trim()
            ? { learningGoal: learningGoal.trim() }
            : {}),
          ...(studentSupports.trim()
            ? { studentSupports: studentSupports.trim() }
            : {}),
          ...(activityStyle ? { activityStyle } : {}),
          ...(userTier === "plus" && gradeLevelOverride
            ? { gradeLevelOverride }
            : {}),
          ...(userTier === "plus" && additionalContext.trim()
            ? { description: additionalContext.trim() }
            : {}),
        }),
        signal: controller.signal,
      });

      responseStatus = res.status;
      responseData = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (!res.ok) throw new Error("api_error");

      // Update remaining requests counter
      const remField = (responseData as GenerateResponse).remainingRequests;
      if (typeof remField === "number") setRemainingRequests(remField);
      else if (remField === null) setRemainingRequests(null);

      const lesson = (responseData as GenerateResponse).lesson;
      setPreviewLesson(lesson);
    } catch (err) {
      const msg = mapErrorToMessage(err, responseStatus, responseData);
      setError(msg);
      // Update remaining counter if returned in 429 response
      if (
        responseStatus === 429 &&
        typeof responseData.remainingRequests === "number"
      ) {
        setRemainingRequests(responseData.remainingRequests);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await generateLesson();
  }

  function handleAcceptPreview() {
    if (!previewLesson) return;

    const wizardState: WizardLessonState = {
      title: previewLesson.title ?? "",
      gradeLevel,
      subject,
      duration:
        typeof previewLesson.duration === "string" ? previewLesson.duration : "",
      objectives:
        previewLesson.objectives?.length > 0 ? previewLesson.objectives : [""],
      materials:
        previewLesson.materials?.length > 0 ? previewLesson.materials : [""],
      steps:
        previewLesson.steps?.length > 0
          ? previewLesson.steps
          : [{ title: "", description: "" }],
      checkForUnderstanding:
        previewLesson.checkForUnderstanding?.length > 0
          ? previewLesson.checkForUnderstanding
          : [""],
      assessments:
        previewLesson.assessments?.length > 0 ? previewLesson.assessments : [""],
    };

    onGenerated(wizardState);
  }

  // Full-screen loading overlay while generating
  if (isGenerating) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-16 px-4">
        <div role="status" className="flex flex-col items-center gap-6">
          <Spinner className="h-12 w-12 border-[3px]" />
          <p
            aria-live="polite"
            className="text-base font-medium text-foreground"
          >
            Generating your lesson plan…
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex min-h-[60vh] flex-col items-center justify-center py-16 px-4">
        <div className="w-full max-w-lg">
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
          Generate a Lesson with AI
        </h1>
        <p className="text-sm text-muted mb-6">
          Describe the lesson you need, then add a few teaching constraints so the first draft is easier to trust and edit.
        </p>

        <div className="mb-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          Best results: name the topic, clarify the main learning outcome, and note any support or pacing needs the AI should respect.
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Topic */}
          <div>
            <label
              htmlFor="ai-topic"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Topic{" "}
              <span aria-hidden="true" className="text-red-500">
                *
              </span>
            </label>
            <textarea
              id="ai-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={300}
              required
              aria-required="true"
              placeholder="e.g. Introduction to fractions using real-world examples"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <p className="mt-1 text-xs text-muted text-right" aria-live="polite">
              {topic.length} / 300
            </p>
          </div>

          <div>
            <label
              htmlFor="ai-learning-goal"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Learning Goal
            </label>
            <textarea
              id="ai-learning-goal"
              value={learningGoal}
              onChange={(e) => setLearningGoal(e.target.value.slice(0, 200))}
              maxLength={200}
              rows={2}
              placeholder="e.g. Students will compare fractions using visual models and explain their reasoning."
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <p className="mt-1 text-xs text-muted text-right" aria-live="polite">
              {learningGoal.length} / 200
            </p>
          </div>

          <div>
            <label
              htmlFor="ai-student-supports"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Student Support Needs
            </label>
            <textarea
              id="ai-student-supports"
              value={studentSupports}
              onChange={(e) =>
                setStudentSupports(e.target.value.slice(0, 300))
              }
              maxLength={300}
              rows={2}
              placeholder="e.g. Include ELL scaffolds, sentence stems, and one extension task for fast finishers."
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <p className="mt-1 text-xs text-muted text-right" aria-live="polite">
              {studentSupports.length} / 300
            </p>
          </div>

          <div>
            <label
              htmlFor="ai-activity-style"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Preferred Activity Style
            </label>
            <select
              id="ai-activity-style"
              value={activityStyle}
              onChange={(e) => setActivityStyle(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">No preference</option>
              {ACTIVITY_STYLE_OPTIONS.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </div>

          {/* Grade Level */}
          <div>
            <label
              htmlFor="ai-grade-level"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Grade Level
            </label>
            <select
              id="ai-grade-level"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {GRADE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label
              htmlFor="ai-subject"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Subject
            </label>
            <select
              id="ai-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Plus-tier only: specific grade override & additional context */}
          {userTier === "plus" && (
            <>
              <div>
                <label
                  htmlFor="ai-grade-override"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Specific Grade{" "}
                  <span className="ml-1 inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                    Plus
                  </span>
                </label>
                <select
                  id="ai-grade-override"
                  value={gradeLevelOverride}
                  onChange={(e) => setGradeLevelOverride(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">No override</option>
                  {SPECIFIC_GRADE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="ai-context"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Additional Context{" "}
                  <span className="ml-1 inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                    Plus
                  </span>
                </label>
                <textarea
                  id="ai-context"
                  value={additionalContext}
                  onChange={(e) =>
                    setAdditionalContext(e.target.value.slice(0, 500))
                  }
                  maxLength={500}
                  rows={3}
                  placeholder="Add curriculum standards, special requirements, or other context…"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
                <p className="mt-1 text-xs text-muted text-right" aria-live="polite">
                  {additionalContext.length} / 500
                </p>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p
              role="alert"
              className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          {/* Free-tier remaining requests indicator */}
          {remainingRequests !== null && (
            <p
              id={remainsId}
              className={`text-xs ${
                remainingRequests === 0 ? "text-red-600 font-medium" : "text-muted"
              }`}
            >
              {remainingRequests === 0
                ? "You've reached your daily AI limit. Upgrade to Plus for unlimited access."
                : `${remainingRequests} / 10 requests remaining today`}
            </p>
          )}

          {/* Generate button */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            aria-disabled={isSubmitDisabled ? "true" : undefined}
            aria-describedby={
              remainingRequests !== null ? remainsId : undefined
            }
            className={[
              "w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
              isSubmitDisabled
                ? "bg-primary-200 text-primary-400 cursor-not-allowed"
                : "bg-primary-600 text-white hover:bg-primary-700 cursor-pointer",
            ].join(" ")}
          >
            Generate Lesson
          </button>
        </form>
      </div>
    </main>

      <Modal
        open={previewLesson !== null}
        onClose={() => setPreviewLesson(null)}
        title="Review AI Draft"
        className="max-w-3xl"
      >
        {previewLesson && (
          <div className="space-y-5">
            <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900">
              Review this draft before you adopt it. AI can speed up planning, but timing, rigor, and student fit still need a teacher check.
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {previewLesson.title || "Untitled lesson"}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {gradeLevel} • {subject}
                    {previewLesson.duration ? ` • ${previewLesson.duration}` : ""}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Objectives
                  </h3>
                  <ul className="space-y-1.5 list-disc list-inside text-sm text-foreground">
                    {previewLesson.objectives.filter((item) => item.trim() !== "").map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Lesson steps
                  </h3>
                  <ol className="space-y-2">
                    {previewLesson.steps.filter((step) => step.title.trim() !== "").map((step, index) => (
                      <li key={`${step.title}-${index}`} className="rounded-lg border border-border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {index + 1}. {step.title}
                          </span>
                          {step.duration && (
                            <span className="ml-auto text-xs text-muted">
                              {step.duration}
                            </span>
                          )}
                        </div>
                        {step.description && (
                          <p className="mt-1 text-sm text-muted">{step.description}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Quick quality check
                  </h3>
                  <ul className="space-y-2">
                    {buildQualityChecks(previewLesson).map((check) => (
                      <li key={check.label} className="rounded-lg border border-border px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                              check.status === "pass"
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700",
                            ].join(" ")}
                          >
                            {check.status === "pass" ? "✓" : "!"}
                          </span>
                          <span className="font-medium text-foreground">{check.label}</span>
                        </div>
                        <p className="mt-1 text-muted">{check.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Next step
                  </h3>
                  <p className="text-sm text-muted">
                    Use this draft to continue into review, adjust your inputs, or generate another version before anything is saved.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewLesson(null)}
              >
                Edit Inputs
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPreviewLesson(null);
                  void generateLesson();
                }}
                disabled={isGenerating}
              >
                Regenerate
              </Button>
              <Button type="button" variant="primary" onClick={handleAcceptPreview}>
                Use This Draft
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
