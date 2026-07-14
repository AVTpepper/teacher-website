"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { GRADE_LEVELS, SPECIFIC_GRADE_LEVELS } from "@/lib/constants";
import { SUBJECTS } from "@/lib/firestore/users";
import { createLesson } from "@/lib/firestore/lessons";
import Spinner from "@/components/ui/Spinner";
import type { WizardLessonState } from "./LessonWizardState";

// ─── Types ────────────────────────────────────────────────────────────────────

type AIGenerateScreenProps = {
  user: User | null;
  userTier: "free" | "plus";
  onGenerated: (state: WizardLessonState, draftId: string) => void;
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
  const [gradeLevelOverride, setGradeLevelOverride] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

      // Map API response → WizardLessonState
      const wizardState: WizardLessonState = {
        title: lesson.title ?? "",
        gradeLevel,
        subject,
        duration: typeof lesson.duration === "string" ? lesson.duration : "",
        objectives:
          lesson.objectives?.length > 0 ? lesson.objectives : [""],
        materials:
          lesson.materials?.length > 0 ? lesson.materials : [""],
        steps:
          lesson.steps?.length > 0
            ? lesson.steps
            : [{ title: "", description: "" }],
        checkForUnderstanding:
          lesson.checkForUnderstanding?.length > 0
            ? lesson.checkForUnderstanding
            : [""],
        assessments:
          lesson.assessments?.length > 0 ? lesson.assessments : [""],
      };

      // Save Firestore draft immediately
      const draftId = await createLesson({
        title: wizardState.title,
        authorId: user.uid,
        authorName: user.displayName ?? "Anonymous",
        authorPhotoURL: user.photoURL ?? null,
        gradeLevel: wizardState.gradeLevel,
        subject: wizardState.subject,
        duration: wizardState.duration,
        objectives: wizardState.objectives.filter((o) => o.trim() !== ""),
        materials: wizardState.materials.filter((m) => m.trim() !== ""),
        steps: wizardState.steps.filter((s) => s.title.trim() !== ""),
        checkForUnderstanding: wizardState.checkForUnderstanding.filter(
          (c) => c.trim() !== ""
        ),
        assessments: wizardState.assessments.filter((a) => a.trim() !== ""),
        attachments: [],
        isPublic: false,
      });

      onGenerated(wizardState, draftId);
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
          Describe your lesson topic and we'll create a complete plan.
        </p>

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
  );
}
