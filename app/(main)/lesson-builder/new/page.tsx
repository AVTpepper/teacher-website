"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  Suspense,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { GRADE_LEVELS, SUBJECTS } from "@/lib/firestore/users";
import { checkAndAwardBadges } from "@/lib/badges";
import {
  createLesson,
  getLesson,
  updateLesson,
  getLessonsByAuthor,
  type Lesson,
  type LessonStep,
  type LessonAttachment,
} from "@/lib/firestore/lessons";
import { Badge, Button, Card, Input, Select, Spinner, Textarea } from "@/components/ui";
import AIAssistantPanel, { type LessonFormState, type ApplySuggestionPayload } from "@/components/lessons/AIAssistantPanel";
import WizardShell from "@/components/lessons/wizard/WizardShell";
import AIGenerateScreen from "@/components/lessons/wizard/AIGenerateScreen";
import type { WizardLessonState } from "@/components/lessons/wizard/LessonWizardState";

// Convert a persisted Lesson into the wizard's flat state shape
function lessonToWizardState(lesson: Lesson): WizardLessonState {
  return {
    title: lesson.title,
    gradeLevel: lesson.gradeLevel,
    subject: lesson.subject,
    duration: lesson.duration,
    objectives: lesson.objectives.length > 0 ? lesson.objectives : [""],
    materials: lesson.materials.length > 0 ? lesson.materials : [""],
    steps: lesson.steps.length > 0 ? lesson.steps : [{ title: "", description: "" }],
    checkForUnderstanding:
      lesson.checkForUnderstanding.length > 0 ? lesson.checkForUnderstanding : [""],
    assessments: lesson.assessments.length > 0 ? lesson.assessments : [""],
  };
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const UPLOAD_TIMEOUT_MS = 30_000;
const STORAGE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Upload timed out. Please try again."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export default function LessonBuilderNewPage() {
  return (
    <Suspense>
      <LessonBuilderNewEntry />
    </Suspense>
  );
}

// ------------------------------------------------------------
// US-09: Entry screen
// ------------------------------------------------------------

function LessonBuilderNewEntry() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const editingLessonId = searchParams.get("edit");
  const remixLessonId = searchParams.get("remix");
  const draftParam = searchParams.get("draft");
  const completeParam = searchParams.get("complete") === "true";
  const pathParam = searchParams.get("path") as "manual" | "ai" | null;
  const isEditOrRemix = Boolean(editingLessonId ?? remixLessonId);
  // ?draft=id&complete=true: load draft and jump straight to Review step with AI Refine
  const isCompleteFlow = Boolean(draftParam && completeParam);

  const isAvailable = process.env.NEXT_PUBLIC_AI_AVAILABLE === "true";

  const [wizardPath, setWizardPath] = useState<"manual" | "ai" | null>(
    // ?draft= goes straight to manual wizard; ?path= sets the path directly
    (draftParam && !completeParam) ? "manual" : (pathParam ?? null)
  );
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(draftParam ?? null);
  const [draft, setDraft] = useState<Pick<Lesson, "id" | "title"> | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  // US-12: AI creation path state
  const [aiGeneratedState, setAiGeneratedState] = useState<WizardLessonState | null>(null);
  const [aiDraftId, setAiDraftId] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<"free" | "plus">("free");

  // Edit / Remix path: load lesson into wizard state
  const [editLoadedState, setEditLoadedState] = useState<WizardLessonState | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);

  // Complete-flow state: load a draft and open Review step
  const [completeLoadedState, setCompleteLoadedState] = useState<WizardLessonState | null>(null);
  const [completeLoading, setCompleteLoading] = useState(isCompleteFlow);
  const [completeLoadError, setCompleteLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCompleteFlow || !draftParam) return;
    setCompleteLoading(true);
    getLesson(draftParam)
      .then((lesson) => {
        if (!lesson) { setCompleteLoadError("Draft not found."); return; }
        setCompleteLoadedState(lessonToWizardState(lesson));
      })
      .catch(() => setCompleteLoadError("Failed to load draft. Please try again."))
      .finally(() => setCompleteLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEditOrRemix || !user) return;
    const lessonId = editingLessonId ?? remixLessonId;
    if (!lessonId) return;
    setEditLoading(true);
    getLesson(lessonId)
      .then((lesson) => {
        if (!lesson) { setEditLoadError("Lesson not found."); return; }
        setEditLoadedState(lessonToWizardState(lesson));
      })
      .catch(() => setEditLoadError("Failed to load lesson. Please try again."))
      .finally(() => setEditLoading(false));
  }, [isEditOrRemix, user, editingLessonId, remixLessonId]);

  // Detect existing draft for the current user (skip when bypassing for edit/remix)
  useEffect(() => {
    if (isEditOrRemix || !user) return;
    let cancelled = false;

    async function fetchDraft() {
      try {
        const result = await getLessonsByAuthor(user!.uid, true);
        if (cancelled) return;
        const drafts = result.lessons.filter((l) => !l.isPublic);
        if (drafts.length > 0) {
          setDraft({ id: drafts[0].id, title: drafts[0].title });
        }
      } catch {
        // Non-critical - silent failure; banner simply won't appear
      }
    }

    fetchDraft();
    return () => {
      cancelled = true;
    };
  }, [user, isEditOrRemix]);

  // US-12: Fetch user tier on mount so it can be passed to AIGenerateScreen
  useEffect(() => {
    if (!user || !isAvailable) return;
    let cancelled = false;
    async function fetchTier() {
      try {
        const token = await user!.getIdToken();
        const res = await fetch("/api/ai/lesson", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { tier?: string };
        if (!cancelled && data.tier === "plus") setUserTier("plus");
      } catch {
        // Non-critical - defaults to "free"
      }
    }
    fetchTier();
    return () => {
      cancelled = true;
    };
  }, [user, isAvailable]);

  // Complete flow: ?draft=id&complete=true - opens draft at Review step with AI Refine available
  if (isCompleteFlow) {
    if (completeLoading || (!completeLoadedState && !completeLoadError)) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner />
        </div>
      );
    }
    if (completeLoadError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <p className="text-base text-destructive">{completeLoadError}</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/lesson-builder/drafts")}>Back to drafts</Button>
        </div>
      );
    }
    return (
      <WizardShell
        user={user}
        initialDraftId={draftParam}
        initialState={completeLoadedState ?? undefined}
        initialCompletedSteps={new Set([1, 2, 3, 4, 5, 6, 7])}
        startAtStep={7}
        isAvailable={isAvailable}
        onExit={() => router.push("/lesson-builder/drafts")}
      />
    );
  }

  // Edit / Remix path - wizard (replaces LessonBuilderNewInner)
  if (isEditOrRemix) {
    if (editLoading || (!editLoadedState && !editLoadError)) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner />
        </div>
      );
    }
    if (editLoadError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <p className="text-base text-destructive">{editLoadError}</p>
          <Button variant="outline" size="sm" onClick={() => router.back()}>Go back</Button>
        </div>
      );
    }
    return (
      <WizardShell
        user={user}
        // For edit: reuse the existing doc; for remix: create a new draft on first save
        initialDraftId={editingLessonId ?? null}
        initialState={editLoadedState ?? undefined}
        initialCompletedSteps={new Set([1, 2, 3, 4, 5, 6, 7])}
        isAvailable={isAvailable}
        onExit={() => {
          if (editingLessonId) {
            router.push(`/lesson-builder/${editingLessonId}`);
          } else {
            router.push("/lesson-builder");
          }
        }}
      />
    );
  }

  // AC-2: manual wizard shell (US-10)
  if (wizardPath === "manual") {
    return (
      <WizardShell
        user={user}
        initialDraftId={resumeDraftId}
        isAvailable={process.env.NEXT_PUBLIC_AI_AVAILABLE === "true"}
        onExit={() => { setWizardPath(null); setResumeDraftId(null); }}
      />
    );
  }

  // AC-3: AI path (US-12)
  if (wizardPath === "ai") {
    if (aiGeneratedState) {
      // Generation complete - show wizard shell starting at Review step with all steps pre-completed
      return (
        <WizardShell
          user={user}
          initialDraftId={aiDraftId}
          initialState={aiGeneratedState}
          initialCompletedSteps={new Set([1, 2, 3, 4, 5, 6, 7])}
          startAtStep={7}
          isAvailable={process.env.NEXT_PUBLIC_AI_AVAILABLE === "true"}
          onExit={() => {
            setWizardPath(null);
            setAiGeneratedState(null);
            setAiDraftId(null);
          }}
        />
      );
    }
    return (
      <AIGenerateScreen
        user={user}
        userTier={userTier}
        onGenerated={(state, draftId) => {
          setAiGeneratedState(state);
          setAiDraftId(draftId);
        }}
        onBack={() => setWizardPath(null)}
      />
    );
  }

  // Entry screen
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-8 py-16 px-4">
      {/* AC-5: Draft resume banner */}
      {!bannerDismissed && draft && (
        <div
          role="alert"
          className="w-full max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm font-medium text-amber-800">
            You have an unfinished lesson draft
            {draft.title ? `: "${draft.title}"` : ""}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => {
                setResumeDraftId(draft.id);
                setWizardPath("manual");
              }}
            >
              Resume
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBannerDismissed(true)}
            >
              Start fresh
            </Button>
          </div>
        </div>
      )}

      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Lesson Builder
        </h1>
        <p className="mt-2 text-base text-muted">
          How would you like to create your lesson?
        </p>
      </div>

      {/* AC-1: Two path cards */}
      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        {/* Create My Own */}
        <button
          type="button"
          onClick={() => setWizardPath("manual")}
          className="group flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-surface p-8 text-center transition-colors hover:border-primary-500 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 cursor-pointer"
        >
          {/* Pencil icon */}
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700 group-hover:bg-primary-200 transition-colors" aria-hidden="true">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </span>
          <span className="text-base font-semibold text-foreground">Create My Own</span>
          <span className="text-sm text-muted">Fill in each section at your own pace</span>
        </button>

        {/* Create with AI Assistant - AC-4: disabled with tooltip when AI unavailable */}
        <button
          type="button"
          onClick={isAvailable ? () => setWizardPath("ai") : undefined}
          disabled={!isAvailable}
          aria-disabled={!isAvailable}
          title={!isAvailable ? "AI features are not available in this environment" : undefined}
          className={[
            "group flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-surface p-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
            isAvailable
              ? "hover:border-primary-500 hover:bg-primary-50 cursor-pointer"
              : "opacity-50 cursor-not-allowed",
          ].join(" ")}
        >
          {/* Sparkle icon */}
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700 group-hover:bg-primary-200 transition-colors" aria-hidden="true">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
            </svg>
          </span>
          <span className="text-base font-semibold text-foreground">Create with AI Assistant</span>
          <span className="text-sm text-muted">Let AI generate a starting plan for you</span>
        </button>
      </div>
    </main>
  );
}

// ------------------------------------------------------------
// Existing editor (edit / remix bypass - retained for US-13)
// ------------------------------------------------------------

function LessonBuilderNewInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const editingLessonId = searchParams.get("edit");
  const remixLessonId = searchParams.get("remix");
  const sourceLessonId = editingLessonId ?? remixLessonId;
  const isEditMode = Boolean(editingLessonId);

  // Basic info
  const [title, setTitle] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("");

  // Lists
  const [objectives, setObjectives] = useState<string[]>([""]);
  const [materials, setMaterials] = useState<string[]>([""]);
  const [steps, setSteps] = useState<LessonStep[]>([
    { title: "", description: "" },
  ]);
  const [checkForUnderstanding, setCheckForUnderstanding] = useState<string[]>([""]);
  const [assessments, setAssessments] = useState<string[]>([""]);
  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);

  // UI state
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);

  const formTopRef = useRef<HTMLDivElement>(null);
  const objectiveRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const materialRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const checkForUnderstandingRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const assessmentRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  // AI Assistant panel
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const aiToggleButtonRef = useRef<HTMLButtonElement>(null);
  const aiPanelWasOpen = useRef(false);
  const isAvailable = process.env.NEXT_PUBLIC_AI_AVAILABLE === "true";

  // US-07: Daily AI usage tracking
  const [remainingRequests, setRemainingRequests] = useState<number | null>(null);
  // US-08: User tier
  const [userTier, setUserTier] = useState<"free" | "plus">("free");

  // US-04: Per-section suggestions
  const [activeSuggestSection, setActiveSuggestSection] = useState<"objectives" | "materials" | "steps" | "checkForUnderstanding" | "assessments" | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionItems, setSuggestionItems] = useState<string[] | Array<{ title: string; description: string; duration?: string }> | null>(null);
  const [suggestionError, setSuggestionError] = useState("");

  // AI Assistant - Basic Info highlight
  const [highlightBasicInfo, setHighlightBasicInfo] = useState(false);
  function handleHighlightBasicInfo() {
    document.getElementById("grade-level")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightBasicInfo(true);
    setTimeout(() => setHighlightBasicInfo(false), 2000);
  }

  // Return focus to the toggle button whenever the panel closes
  useEffect(() => {
    if (aiPanelWasOpen.current && !aiPanelOpen) {
      aiToggleButtonRef.current?.focus();
    }
    aiPanelWasOpen.current = aiPanelOpen;
  }, [aiPanelOpen]);

  // US-07: Fetch initial AI usage on mount
  useEffect(() => {
    if (!user || !isAvailable) return;
    let cancelled = false;
    async function fetchUsage() {
      try {
        const token = await user!.getIdToken();
        const res = await fetch("/api/ai/lesson", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { remainingRequests?: number | null; tier?: string };
        if (!cancelled) {
          setRemainingRequests(data.remainingRequests ?? null);
          if (data.tier === "plus") setUserTier("plus");
        }
      } catch {
        // Non-critical - silent failure; usage will update after first request
      }
    }
    fetchUsage();
    return () => { cancelled = true; };
  }, [user, isAvailable]);

  const lessonFormState: LessonFormState = {
    title,
    gradeLevel,
    subject,
    duration,
    objectives,
    materials,
    steps,
    checkForUnderstanding,
    assessments,
  };

  function handleApplySuggestion(payload: ApplySuggestionPayload) {
    if (payload.field === "all") {
      setTitle(payload.lesson.title);
      setDuration(payload.lesson.duration ?? "");
      setObjectives(
        payload.lesson.objectives.length > 0 ? payload.lesson.objectives : [""]
      );
      setMaterials(
        payload.lesson.materials.length > 0 ? payload.lesson.materials : [""]
      );
      setSteps(
        payload.lesson.steps.length > 0
          ? payload.lesson.steps
          : [{ title: "", description: "" }]
      );
      setCheckForUnderstanding(
        payload.lesson.checkForUnderstanding.length > 0 ? payload.lesson.checkForUnderstanding : [""]
      );
      setAssessments(
        payload.lesson.assessments.length > 0 ? payload.lesson.assessments : [""]
      );
    } else if (payload.field === "objectives") {
      setObjectives(payload.items.length > 0 ? payload.items : [""]);
    } else if (payload.field === "materials") {
      setMaterials(payload.items.length > 0 ? payload.items : [""]);
    } else if (payload.field === "steps") {
      setSteps(payload.items.length > 0 ? payload.items : [{ title: "", description: "" }]);
    } else if (payload.field === "checkForUnderstanding") {
      setCheckForUnderstanding(payload.items.length > 0 ? payload.items : [""]);
    } else if (payload.field === "assessments") {
      setAssessments(payload.items.length > 0 ? payload.items : [""]);
    }
  }

  async function getToken(): Promise<string> {
    const token = await user?.getIdToken();
    if (!token) throw new Error("You must be signed in to use AI features.");
    return token;
  }

  async function handleSuggestRequest(section: "objectives" | "materials" | "steps" | "checkForUnderstanding" | "assessments") {
    // Replace any existing preview immediately
    setActiveSuggestSection(section);
    setIsSuggesting(true);
    setSuggestionItems(null);
    setSuggestionError("");

    const existingContent =
      section === "objectives"
        ? objectives.filter((o) => o.trim())
        : section === "materials"
        ? materials.filter((m) => m.trim())
        : section === "checkForUnderstanding"
        ? checkForUnderstanding.filter((c) => c.trim())
        : section === "assessments"
        ? assessments.filter((a) => a.trim())
        : steps
            .map((s) =>
              s.title.trim() && s.description.trim()
                ? `${s.title}: ${s.description}`
                : s.title.trim() || s.description.trim()
            )
            .filter(Boolean);

    let responseStatus: number | undefined;
    let responseData: Record<string, unknown> = {};
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const token = await getToken();
      const res = await fetch("/api/ai/lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: "suggest",
          section,
          gradeLevel,
          subject,
          existingContent,
          lessonContext: {
            title: title.trim() || undefined,
            objectives: objectives.filter((o) => o.trim()),
            steps: steps
              .filter((s) => s.title.trim())
              .map((s) => ({ title: s.title, description: s.description })),
          },
        }),
        signal: controller.signal,
      });

      responseStatus = res.status;
      const data = await res.json().catch(() => ({}) as Record<string, unknown>);
      responseData = data as Record<string, unknown>;

      if (!res.ok) {
        throw new Error("api_error");
      }

      setSuggestionItems(
        section === "steps"
          ? (data as { suggestions: Array<{ title: string; description: string; duration?: string }> }).suggestions
          : (data as { suggestions: string[] }).suggestions
      );

      // US-07: Update remaining requests from response
      const remField = (data as Record<string, unknown>).remainingRequests;
      if (typeof remField === "number") setRemainingRequests(remField);
      else if (remField === null) setRemainingRequests(null);
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
          setRemainingRequests(responseData.remainingRequests);
        }
      } else {
        msg = "Something went wrong. Please try again.";
      }
      setSuggestionError(msg);
    } finally {
      clearTimeout(timeoutId);
      setIsSuggesting(false);
    }
  }

  function handleDismissSuggestion() {
    setActiveSuggestSection(null);
    setSuggestionItems(null);
    setSuggestionError("");
  }

  useEffect(() => {
    objectiveRefs.current = objectiveRefs.current.slice(0, objectives.length);
  }, [objectives.length]);

  useEffect(() => {
    materialRefs.current = materialRefs.current.slice(0, materials.length);
  }, [materials.length]);

  useEffect(() => {
    checkForUnderstandingRefs.current = checkForUnderstandingRefs.current.slice(0, checkForUnderstanding.length);
  }, [checkForUnderstanding.length]);

  useEffect(() => {
    assessmentRefs.current = assessmentRefs.current.slice(0, assessments.length);
  }, [assessments.length]);

  useEffect(() => {
    async function loadSourceLesson() {
      if (!sourceLessonId) return;
      if (isEditMode && !user) return;

      setSourceLoading(true);
      setError("");

      try {
        const sourceLesson = await getLesson(sourceLessonId);
        if (!sourceLesson) {
          setError("Could not load lesson data.");
          return;
        }

        if (isEditMode && user && sourceLesson.authorId !== user.uid) {
          setError("You can only edit lessons you created.");
          return;
        }

        setTitle(sourceLesson.title);
        setGradeLevel(sourceLesson.gradeLevel);
        setSubject(sourceLesson.subject);
        setDuration(sourceLesson.duration ?? "");
        setObjectives(
          sourceLesson.objectives.length > 0 ? sourceLesson.objectives : [""]
        );
        setMaterials(
          sourceLesson.materials.length > 0 ? sourceLesson.materials : [""]
        );
        setSteps(
          sourceLesson.steps.length > 0
            ? sourceLesson.steps
            : [{ title: "", description: "" }]
        );
        setCheckForUnderstanding(
          sourceLesson.checkForUnderstanding?.length > 0 ? sourceLesson.checkForUnderstanding : [""]
        );
        setAssessments(
          sourceLesson.assessments?.length > 0 ? sourceLesson.assessments : [""]
        );
        setAttachments(sourceLesson.attachments ?? []);
      } catch {
        setError("Failed to load lesson data.");
      } finally {
        setSourceLoading(false);
      }
    }

    loadSourceLesson();
  }, [sourceLessonId, isEditMode, user]);

  // --- List helpers ---

  function updateListItem<T>(
    list: T[],
    setList: Dispatch<SetStateAction<T[]>>,
    index: number,
    value: T
  ) {
    setList(list.map((item, i) => (i === index ? value : item)));
  }

  function removeListItem<T>(
    list: T[],
    setList: Dispatch<SetStateAction<T[]>>,
    index: number
  ) {
    if (list.length <= 1) return;
    setList(list.filter((_, i) => i !== index));
  }

  function moveListItem<T>(
    list: T[],
    setList: Dispatch<SetStateAction<T[]>>,
    from: number,
    to: number
  ) {
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setList(next);
  }

  function handleListInputEnter(
    event: KeyboardEvent<HTMLTextAreaElement>,
    list: string[],
    setList: Dispatch<SetStateAction<string[]>>,
    index: number,
    refs: MutableRefObject<Array<HTMLTextAreaElement | null>>
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const isLast = index === list.length - 1;
    const hasValue = list[index].trim().length > 0;

    if (isLast && hasValue) {
      setList((prev) => [...prev, ""]);
      setTimeout(() => {
        refs.current[index + 1]?.focus();
      }, 0);
      return;
    }

    refs.current[index + 1]?.focus();
  }

  // --- File attachment upload ---

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setError("Sign in to attach files.");
      e.target.value = "";
      return;
    }

    if (!STORAGE_CONFIGURED || !storage) {
      setError(
        "File uploads are not available yet. Activate Firebase Storage first, then try again."
      );
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File must be under 25 MB.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const storageRef = ref(
        storage,
        `lessons/${user.uid}/${Date.now()}_${file.name}`
      );
      await withTimeout(uploadBytes(storageRef, file), UPLOAD_TIMEOUT_MS);
      const url = await withTimeout(getDownloadURL(storageRef), UPLOAD_TIMEOUT_MS);
      setAttachments((prev) => [...prev, { name: file.name, url }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.toLowerCase().includes("timed out")) {
        setError("Upload timed out. If Storage is not active yet, skip attachments for now.");
      } else {
        setError("Failed to upload file. If Storage is not active yet, skip attachments for now.");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // --- Save ---

  function showError(msg: string) {
    setError(msg);
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSave(publish: boolean) {
    if (!user) return;

    if (!title.trim()) return showError("Title is required.");

    // Publishing requires complete info; drafts only need a title
    if (publish) {
      if (!gradeLevel) return showError("Grade level is required.");
      if (!subject) return showError("Subject is required.");
    }

    const cleanObjectives = objectives
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    if (publish && cleanObjectives.length === 0)
      return showError("Add at least one learning objective.");

    const cleanSteps = steps.filter(
      (s) => s.title.trim() || s.description.trim()
    );
    if (publish && cleanSteps.length === 0)
      return showError("Add at least one step to the plan.");

    const cleanMaterials = materials
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    setError("");
    setSaving(true);

    try {
      const lessonPayload = {
        title: title.trim(),
        authorId: user.uid,
        authorName: user.displayName || "Anonymous",
        authorPhotoURL: user.photoURL,
        gradeLevel,
        subject,
        duration: duration.trim(),
        objectives: cleanObjectives,
        materials: cleanMaterials,
        steps: cleanSteps.map((s) => ({
          title: s.title.trim(),
          description: s.description.trim(),
          ...(s.duration?.trim() ? { duration: s.duration.trim() } : {}),
        })),
        attachments,
        checkForUnderstanding: checkForUnderstanding.map((c) => c.trim()).filter(Boolean),
        assessments: assessments.map((a) => a.trim()).filter(Boolean),
        isPublic: publish,
      };

      if (isEditMode && editingLessonId) {
        await updateLesson(editingLessonId, lessonPayload);
        router.push(`/lesson-builder/${editingLessonId}`);
        return;
      }

      const lessonId = await createLesson({
        ...lessonPayload,
        remixedFromId: remixLessonId || null,
      });

      if (publish) {
        checkAndAwardBadges(user!.uid).catch(() => {});
      }
      router.push(`/lesson-builder/${lessonId}`);
    } catch {
      setError("Failed to save lesson. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
  }

  // --- Preview mode ---

  if (preview) {
    const cleanObjectives = objectives.map((o) => o.trim()).filter(Boolean);
    const cleanMaterials = materials.map((m) => m.trim()).filter(Boolean);
    const cleanSteps = steps.filter(
      (s) => s.title.trim() || s.description.trim()
    );
    const cleanCheckForUnderstanding = checkForUnderstanding.map((c) => c.trim()).filter(Boolean);
    const cleanAssessments = assessments.map((a) => a.trim()).filter(Boolean);

    return (
      <div className="py-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">
            Lesson Preview
          </h2>
          <Button variant="outline" size="sm" onClick={() => setPreview(false)}>
            Back to Editor
          </Button>
        </div>

        <Card padding="lg" className="space-y-6">
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {gradeLevel && <Badge variant="default">{gradeLevel}</Badge>}
              {subject && <Badge variant="info">{subject}</Badge>}
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {title || "Untitled Lesson"}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted">
              <span>By {user?.displayName || "Anonymous"}</span>
              {duration.trim() && (
                <>
                  <span>·</span>
                  <span>⏱ {duration.trim()}</span>
                </>
              )}
            </div>
          </div>

          {cleanObjectives.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                🎯 Learning Objectives
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                {cleanObjectives.map((obj, i) => (
                  <li key={i}>{obj}</li>
                ))}
              </ul>
            </div>
          )}

          {cleanMaterials.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                📦 Materials Needed
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                {cleanMaterials.map((mat, i) => (
                  <li key={i}>{mat}</li>
                ))}
              </ul>
            </div>
          )}

          {cleanSteps.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                📋 Lesson Plan
              </h3>
              <div className="space-y-4">
                {cleanSteps.map((step, i) => (
                  <div key={i} className="border-l-2 border-primary-300 pl-4">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        Step {i + 1}
                        {step.title.trim() ? `: ${step.title.trim()}` : ""}
                      </p>
                      {step.duration?.trim() && (
                        <span className="text-xs text-muted">({step.duration.trim()})</span>
                      )}
                    </div>
                    {step.description.trim() && (
                      <p className="mt-1 text-sm text-muted whitespace-pre-wrap">
                        {step.description.trim()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {cleanCheckForUnderstanding.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                ❓ Check for Understanding
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                {cleanCheckForUnderstanding.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {cleanAssessments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                📝 Suggested Assessments
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                {cleanAssessments.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {attachments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                📎 Attachments
              </h3>
              <div className="space-y-1">
                {attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary-900 hover:underline"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"
                      />
                    </svg>
                    {att.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            isLoading={saving}
            disabled={saving}
          >
            Save Draft
          </Button>
          <Button
            onClick={() => handleSave(true)}
            isLoading={saving}
            disabled={saving}
          >
            Publish
          </Button>
        </div>
      </div>
    );
  }

  // --- Editor mode ---

  return (
    <div className="py-8 flex items-start gap-6">
      {/* Floating AI button - mobile only, replaces the sidebar drawer button */}
      {!aiPanelOpen && isAvailable && (
        <button
          type="button"
          onClick={() => setAiPanelOpen(true)}
          aria-label="Open AI Assistant"
          className="lg:hidden fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary-900 text-white shadow-lg hover:bg-primary-800 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
          </svg>
        </button>
      )}
      {/* Form column */}
      <div className={["flex-1 min-w-0 transition-all duration-300", aiPanelOpen ? "" : "max-w-3xl mx-auto"].join(" ")}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/lesson-builder"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              ← Lesson Builder
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isEditMode ? "Edit Lesson" : "New Lesson Plan"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isEditMode
              ? "Update your existing lesson draft or publish it when ready."
              : "Create, save, and share a structured lesson plan with the community."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* AI Assistant toggle */}
          <button
            ref={aiToggleButtonRef}
            type="button"
            onClick={() => setAiPanelOpen((prev) => !prev)}
            aria-expanded={aiPanelOpen}
            aria-controls="ai-assistant-panel"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-800 hover:bg-primary-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
          >
            <svg
              className="h-4 w-4"
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
            AI Assistant
          </button>
          <Link href="/lesson-builder/drafts">
            <Button variant="outline" size="sm" type="button">
              View Drafts
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreview(true)}
            disabled={!title.trim() || sourceLoading}
          >
            Preview
          </Button>
        </div>
      </div>

      {sourceLoading && (
        <div className="mb-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          Loading lesson data...
        </div>
      )}

      <div ref={formTopRef} className="scroll-mt-24">
        {error && (
          <div className="mb-6 rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic info */}
        <Card padding="lg" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Basic Info</h2>

          <Input
            label="Lesson Title"
            placeholder="e.g. Introduction to Fractions"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Grade Level"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="Select grade level"
              options={GRADE_LEVELS.map((g) => ({ value: g, label: g }))}
              className={highlightBasicInfo ? "ring-2 ring-primary-500 ring-offset-1 transition-all" : ""}
            />
            <Select
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Select subject"
              options={SUBJECTS.map((s) => ({ value: s, label: s }))}
              className={highlightBasicInfo ? "ring-2 ring-primary-500 ring-offset-1 transition-all" : ""}
            />
          </div>

          <Input
            label="Duration"
            placeholder="e.g. 45 minutes, 2 class periods"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </Card>

        {/* Learning objectives */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              🎯 Learning Objectives
            </h2>
            <div className="flex items-center gap-2">
              {aiPanelOpen && isAvailable && (
                <button
                  type="button"
                  onClick={() => handleSuggestRequest("objectives")}
                  disabled={(isSuggesting && activeSuggestSection === "objectives") || remainingRequests === 0}
                  aria-label="Get AI suggestions for Learning Objectives"
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 hover:text-primary-900 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSuggesting && activeSuggestSection === "objectives" ? (
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                  )}
                  Suggest
                </button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setObjectives((prev) => [...prev, ""])}
              >
                + Add
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {objectives.map((obj, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs text-muted font-medium w-5 shrink-0">
                  {i + 1}.
                </span>
                <Textarea
                  ref={(el) => {
                    objectiveRefs.current[i] = el;
                  }}
                  placeholder={`Objective ${i + 1}`}
                  value={obj}
                  onChange={(e) =>
                    updateListItem(objectives, setObjectives, i, e.target.value)
                  }
                  onKeyDown={(e) =>
                    handleListInputEnter(e, objectives, setObjectives, i, objectiveRefs)
                  }
                  rows={1}
                  style={{ minHeight: "2.25rem", resize: "none", fieldSizing: "content" } as React.CSSProperties}
                  className="flex-1 min-h-0"
                />
                {objectives.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeListItem(objectives, setObjectives, i)}
                    className="mt-2 p-1 text-muted hover:text-error-500 transition-colors cursor-pointer"
                    aria-label="Remove objective"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Materials needed */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              📦 Materials Needed
            </h2>
            <div className="flex items-center gap-2">
              {aiPanelOpen && isAvailable && (
                <button
                  type="button"
                  onClick={() => handleSuggestRequest("materials")}
                  disabled={(isSuggesting && activeSuggestSection === "materials") || remainingRequests === 0}
                  aria-label="Get AI suggestions for Materials Needed"
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 hover:text-primary-900 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSuggesting && activeSuggestSection === "materials" ? (
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                  )}
                  Suggest
                </button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMaterials((prev) => [...prev, ""])}
              >
                + Add
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {materials.map((mat, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs text-muted font-medium w-5 shrink-0">
                  •
                </span>
                <Textarea
                  ref={(el) => {
                    materialRefs.current[i] = el;
                  }}
                  placeholder={`Material ${i + 1}`}
                  value={mat}
                  onChange={(e) =>
                    updateListItem(materials, setMaterials, i, e.target.value)
                  }
                  onKeyDown={(e) =>
                    handleListInputEnter(e, materials, setMaterials, i, materialRefs)
                  }
                  rows={1}
                  style={{ minHeight: "2.25rem", resize: "none", fieldSizing: "content" } as React.CSSProperties}
                  className="flex-1 min-h-0"
                />
                {materials.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeListItem(materials, setMaterials, i)}
                    className="mt-2 p-1 text-muted hover:text-error-500 transition-colors cursor-pointer"
                    aria-label="Remove material"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Step-by-step plan */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              📋 Step-by-Step Plan
            </h2>
            {aiPanelOpen && isAvailable && (
              <button
                type="button"
                onClick={() => handleSuggestRequest("steps")}
                disabled={(isSuggesting && activeSuggestSection === "steps") || remainingRequests === 0}
                aria-label="Get AI suggestions for Lesson Steps"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 hover:text-primary-900 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSuggesting && activeSuggestSection === "steps" ? (
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                )}
                Suggest
              </button>
            )}
          </div>

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
                      onClick={() => moveListItem(steps, setSteps, i, i - 1)}
                      disabled={i === 0}
                      className="p-1 text-muted hover:text-foreground disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                      aria-label="Move step up"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveListItem(steps, setSteps, i, i + 1)}
                      disabled={i === steps.length - 1}
                      className="p-1 text-muted hover:text-foreground disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
                      aria-label="Move step down"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeListItem(steps, setSteps, i)}
                        className="p-1 text-muted hover:text-error-500 transition-colors cursor-pointer"
                        aria-label="Remove step"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <Input
                  placeholder="Step title (e.g. Warm-Up Activity)"
                  value={step.title}
                  onChange={(e) =>
                    updateListItem(steps, setSteps, i, {
                      ...step,
                      title: e.target.value,
                    })
                  }
                />
                <Input
                  placeholder="Duration (e.g. 10 minutes)"
                  value={step.duration ?? ""}
                  onChange={(e) =>
                    updateListItem(steps, setSteps, i, {
                      ...step,
                      duration: e.target.value,
                    })
                  }
                />
                <Textarea
                  placeholder="Describe what happens in this step…"
                  value={step.description}
                  onChange={(e) =>
                    updateListItem(steps, setSteps, i, {
                      ...step,
                      description: e.target.value,
                    })
                  }
                  rows={2}
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                />

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSteps((prev) => {
                        const next = [...prev];
                        next.splice(i + 1, 0, { title: "", description: "" });
                        return next;
                      })
                    }
                  >
                    + Add Step Below
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Check for Understanding */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              ❓ Check for Understanding
            </h2>
            <div className="flex items-center gap-2">
              {aiPanelOpen && isAvailable && (
                <button
                  type="button"
                  onClick={() => handleSuggestRequest("checkForUnderstanding")}
                  disabled={(isSuggesting && activeSuggestSection === "checkForUnderstanding") || remainingRequests === 0}
                  aria-label="Get AI suggestions for Check for Understanding"
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 hover:text-primary-900 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSuggesting && activeSuggestSection === "checkForUnderstanding" ? (
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                  )}
                  Suggest
                </button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCheckForUnderstanding((prev) => [...prev, ""])}
              >
                + Add
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted -mt-2">
            Questions or activities to gauge student comprehension during the lesson.
          </p>

          <div className="space-y-3">
            {checkForUnderstanding.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs text-muted font-medium w-5 shrink-0">
                  {i + 1}.
                </span>
                <Textarea
                  ref={(el) => {
                    checkForUnderstandingRefs.current[i] = el;
                  }}
                  placeholder={`Question or activity ${i + 1}`}
                  value={item}
                  onChange={(e) =>
                    updateListItem(checkForUnderstanding, setCheckForUnderstanding, i, e.target.value)
                  }
                  onKeyDown={(e) =>
                    handleListInputEnter(e, checkForUnderstanding, setCheckForUnderstanding, i, checkForUnderstandingRefs)
                  }
                  rows={1}
                  style={{ minHeight: "2.25rem", resize: "none", fieldSizing: "content" } as React.CSSProperties}
                  className="flex-1 min-h-0"
                />
                {checkForUnderstanding.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeListItem(checkForUnderstanding, setCheckForUnderstanding, i)}
                    className="mt-2 p-1 text-muted hover:text-error-500 transition-colors cursor-pointer"
                    aria-label="Remove item"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Suggested Assessments */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              📝 Suggested Assessments
            </h2>
            <div className="flex items-center gap-2">
              {aiPanelOpen && isAvailable && (
                <button
                  type="button"
                  onClick={() => handleSuggestRequest("assessments")}
                  disabled={(isSuggesting && activeSuggestSection === "assessments") || remainingRequests === 0}
                  aria-label="Get AI suggestions for Assessments"
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 hover:text-primary-900 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSuggesting && activeSuggestSection === "assessments" ? (
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                  )}
                  Suggest
                </button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAssessments((prev) => [...prev, ""])}
              >
                + Add
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted -mt-2">
            Formal or informal ways to evaluate student learning at the end of the lesson.
          </p>

          <div className="space-y-3">
            {assessments.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs text-muted font-medium w-5 shrink-0">
                  {i + 1}.
                </span>
                <Textarea
                  ref={(el) => {
                    assessmentRefs.current[i] = el;
                  }}
                  placeholder={`Assessment ${i + 1} (e.g. Exit ticket, quiz, project)`}
                  value={item}
                  onChange={(e) =>
                    updateListItem(assessments, setAssessments, i, e.target.value)
                  }
                  onKeyDown={(e) =>
                    handleListInputEnter(e, assessments, setAssessments, i, assessmentRefs)
                  }
                  rows={1}
                  style={{ minHeight: "2.25rem", resize: "none", fieldSizing: "content" } as React.CSSProperties}
                  className="flex-1 min-h-0"
                />
                {assessments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeListItem(assessments, setAssessments, i)}
                    className="mt-2 p-1 text-muted hover:text-error-500 transition-colors cursor-pointer"
                    aria-label="Remove assessment"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Attachments */}
        <Card padding="lg" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            📎 Attachments
          </h2>

          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-900 hover:underline truncate flex-1 mr-2"
                  >
                    {att.name}
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="p-1 text-muted hover:text-error-500 transition-colors cursor-pointer shrink-0"
                    aria-label="Remove attachment"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <input
              type="file"
              onChange={handleAttachFile}
              disabled={uploading || !STORAGE_CONFIGURED}
              className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-100 file:text-primary-800 hover:file:bg-primary-200 file:cursor-pointer cursor-pointer disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-muted">
              {!STORAGE_CONFIGURED
                ? "File uploads are disabled until Firebase Storage is activated."
                : `Max file size: 25 MB${uploading ? ". Uploading..." : ""}`}
            </p>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave(false)}
            isLoading={saving}
            disabled={saving}
          >
            Save Draft
          </Button>
          <Button
            type="button"
            onClick={() => handleSave(true)}
            isLoading={saving}
            disabled={saving}
          >
            Publish
          </Button>
        </div>
      </form>
      </div>{/* end form column */}

      {/* AI Assistant Panel - sidebar on desktop, full-screen drawer on mobile */}
      <AIAssistantPanel
        isOpen={aiPanelOpen}
        onToggle={() => setAiPanelOpen((prev) => !prev)}
        isAvailable={isAvailable}
        lessonFormState={lessonFormState}
        onApplySuggestion={handleApplySuggestion}
        onGetToken={getToken}
        onHighlightBasicInfo={handleHighlightBasicInfo}
        activeSuggestSection={activeSuggestSection}
        isSuggesting={isSuggesting}
        suggestionItems={suggestionItems}
        suggestionError={suggestionError}
        onDismissSuggestion={handleDismissSuggestion}
        remainingRequests={remainingRequests}
        onRemainingUpdate={setRemainingRequests}
        userTier={userTier}
      />
    </div>
  );
}
