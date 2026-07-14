"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { pdf } from "@react-pdf/renderer";
import { GRADE_LEVELS, SPECIFIC_GRADE_LEVELS } from "@/lib/constants";
import { SUBJECTS } from "@/lib/firestore/users";
import { storage } from "@/lib/firebase";
import { createLesson, updateLesson } from "@/lib/firestore/lessons";
import {
  createResource,
  type ResourceContentSection,
  type ResourceType,
} from "@/lib/firestore/resources";
import ResourcePDFDocument from "@/components/resources/ResourcePDFDocument";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { WizardLessonState } from "./LessonWizardState";

type AssetKind = "worksheet" | "rubric";

type AIGenerateScreenProps = {
  user: User | null;
  userTier: "free" | "plus";
  onGenerated: (state: WizardLessonState, draftId: string) => void;
  onBack: () => void;
};

type GeneratedAssetPreview = {
  type: AssetKind;
  title: string;
  description: string;
  sections: ResourceContentSection[];
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
  assets?: GeneratedAssetPreview[];
  remainingRequests?: number | null;
};

type GeneratedLessonPreview = GenerateResponse["lesson"];

type AssetOptionState = {
  selected: boolean;
  example: string;
};

const ACTIVITY_STYLE_OPTIONS = [
  "Hands-on exploration",
  "Discussion-based learning",
  "Direct instruction with practice",
  "Collaborative group work",
  "Inquiry-based learning",
  "Project-based learning",
] as const;

const LESSON_FLOW_OPTIONS = [
  "Mini-lesson",
  "Workshop",
  "Station rotation",
  "Direct instruction",
  "Lab",
] as const;

const ASSESSMENT_INTENT_OPTIONS = ["Formative only", "Summative only", "Mixed"] as const;

const TIME_PER_CLASS_OPTIONS = ["30 min", "45 min", "60 min", "75+ min"] as const;
const CLASS_SIZE_OPTIONS = ["1-15", "16-25", "26-35", "36+"] as const;
const ELL_OPTIONS = ["0-10%", "11-25%", "26-50%", "50%+"] as const;

const ASSET_LIMIT = 2;

const ASSET_LABELS: Record<AssetKind, string> = {
  worksheet: "Worksheet",
  rubric: "Rubric",
};

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
  if (responseStatus === 400 && typeof responseData?.error === "string") {
    return responseData.error;
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
        totalDuration !== null &&
        stepDurationTotal !== null &&
        totalDuration === stepDurationTotal
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

function buildAssetTags(type: AssetKind): string[] {
  if (type === "rubric") return ["Assessment", "Rubric", "Printable"];
  return ["Worksheet", "Printable", "Student Practice"];
}

function buildWizardState(
  lesson: GeneratedLessonPreview,
  gradeLevel: string,
  subject: string,
): WizardLessonState {
  return {
    title: lesson.title ?? "",
    gradeLevel,
    subject,
    duration: typeof lesson.duration === "string" ? lesson.duration : "",
    objectives: lesson.objectives?.length > 0 ? lesson.objectives : [""],
    materials: lesson.materials?.length > 0 ? lesson.materials : [""],
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
}

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
  const [activityStyles, setActivityStyles] = useState<string[]>([]);
  const [primaryActivityStyle, setPrimaryActivityStyle] = useState("");
  const [secondaryActivityStyle, setSecondaryActivityStyle] = useState("");
  const [estimatedLessonFlow, setEstimatedLessonFlow] = useState<string>(LESSON_FLOW_OPTIONS[0]);
  const [assessmentIntent, setAssessmentIntent] = useState<string>(ASSESSMENT_INTENT_OPTIONS[2]);
  const [timePerClass, setTimePerClass] = useState<string>(TIME_PER_CLASS_OPTIONS[1]);
  const [classSize, setClassSize] = useState<string>(CLASS_SIZE_OPTIONS[1]);
  const [ellPercent, setEllPercent] = useState<string>(ELL_OPTIONS[0]);
  const [iep504Supports, setIep504Supports] = useState<"yes" | "no">("no");
  const [techAvailable, setTechAvailable] = useState<"yes" | "no" | "limited">("yes");
  const [gradeLevelOverride, setGradeLevelOverride] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [assetOptions, setAssetOptions] = useState<Record<AssetKind, AssetOptionState>>({
    worksheet: { selected: false, example: "" },
    rubric: { selected: false, example: "" },
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAcceptingDrafts, setIsAcceptingDrafts] = useState(false);
  const [error, setError] = useState("");
  const [previewLesson, setPreviewLesson] = useState<GeneratedLessonPreview | null>(null);
  const [previewAssets, setPreviewAssets] = useState<GeneratedAssetPreview[]>([]);
  const [remainingRequests, setRemainingRequests] = useState<number | null>(null);

  const selectedAssetCount = useMemo(
    () => Object.values(assetOptions).filter((option) => option.selected).length,
    [assetOptions]
  );
  const isLimitReached = remainingRequests === 0;
  const isSubmitDisabled = !topic.trim() || isGenerating || isLimitReached;
  const remainsId = "ai-generate-remaining";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchUsage() {
      try {
        const token = await user.getIdToken();
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
        // Usage is enforced server-side; failure here is non-blocking.
      }
    }

    void fetchUsage();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function updateAssetOption(kind: AssetKind, patch: Partial<AssetOptionState>) {
    setAssetOptions((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], ...patch },
    }));
  }

  function toggleActivityStyle(style: string, checked: boolean) {
    setActivityStyles((prev) => {
      const next = checked
        ? Array.from(new Set([...prev, style]))
        : prev.filter((item) => item !== style);

      if (!next.includes(primaryActivityStyle)) {
        setPrimaryActivityStyle("");
      }
      if (!next.includes(secondaryActivityStyle)) {
        setSecondaryActivityStyle("");
      }
      return next;
    });
  }

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
      const assetRequests = (Object.entries(assetOptions) as Array<[AssetKind, AssetOptionState]>)
        .filter(([, option]) => option.selected)
        .map(([type, option]) => ({
          type,
          ...(option.example.trim() ? { example: option.example.trim() } : {}),
        }));

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
          ...(learningGoal.trim() ? { learningGoal: learningGoal.trim() } : {}),
          ...(studentSupports.trim() ? { studentSupports: studentSupports.trim() } : {}),
          ...(activityStyles.length > 0 ? { activityStyles } : {}),
          ...(primaryActivityStyle || secondaryActivityStyle
            ? {
                stylePriority: {
                  ...(primaryActivityStyle ? { primary: primaryActivityStyle } : {}),
                  ...(secondaryActivityStyle ? { secondary: secondaryActivityStyle } : {}),
                },
              }
            : {}),
          ...(estimatedLessonFlow ? { estimatedLessonFlow } : {}),
          ...(assessmentIntent ? { assessmentIntent } : {}),
          classConstraints: {
            timePerClass,
            classSize,
            ellPercent,
            iep504Supports,
            techAvailable,
          },
          ...(assetRequests.length > 0 ? { assetRequests } : {}),
          ...(userTier === "plus" && gradeLevelOverride ? { gradeLevelOverride } : {}),
          ...(userTier === "plus" && additionalContext.trim()
            ? { description: additionalContext.trim() }
            : {}),
        }),
        signal: controller.signal,
      });

      responseStatus = res.status;
      responseData = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) throw new Error("api_error");

      const remField = (responseData as GenerateResponse).remainingRequests;
      if (typeof remField === "number") setRemainingRequests(remField);
      else if (remField === null) setRemainingRequests(null);

      setPreviewLesson((responseData as GenerateResponse).lesson);
      setPreviewAssets(
        Array.isArray((responseData as GenerateResponse).assets)
          ? ((responseData as GenerateResponse).assets as GeneratedAssetPreview[])
          : []
      );
    } catch (err) {
      setError(mapErrorToMessage(err, responseStatus, responseData));
      if (responseStatus === 429 && typeof responseData.remainingRequests === "number") {
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

  async function handleAcceptPreview() {
    if (!previewLesson || !user) return;

    const wizardState = buildWizardState(previewLesson, gradeLevel, subject);
    setIsAcceptingDrafts(true);
    setError("");

    try {
      const lessonId = await createLesson({
        title: wizardState.title,
        authorId: user.uid,
        authorName: user.displayName ?? "Anonymous",
        authorPhotoURL: user.photoURL ?? null,
        gradeLevel: wizardState.gradeLevel,
        subject: wizardState.subject,
        duration: wizardState.duration,
        objectives: wizardState.objectives.filter((item) => item.trim() !== ""),
        materials: wizardState.materials.filter((item) => item.trim() !== ""),
        steps: wizardState.steps.filter((step) => step.title.trim() !== ""),
        attachments: [],
        checkForUnderstanding: wizardState.checkForUnderstanding.filter(
          (item) => item.trim() !== ""
        ),
        assessments: wizardState.assessments.filter((item) => item.trim() !== ""),
        linkedResourceIds: [],
        isPublic: false,
      });

      const linkedResourceIds = await Promise.all(
        previewAssets.map(async (asset) => {
          let fileURL = "";
          let fileName = "";

          if (storage) {
            const pdfBlob = await pdf(
              <ResourcePDFDocument
                title={asset.title}
                description={asset.description}
                gradeLevel={gradeLevel}
                subject={subject}
                type={ASSET_LABELS[asset.type]}
                tags={buildAssetTags(asset.type)}
                authorName={user.displayName || "Anonymous"}
                contentSections={asset.sections}
              />
            ).toBlob();
            const safeName = asset.title
              .trim()
              .replace(/[^a-z0-9]/gi, "_")
              .toLowerCase();
            fileName = `${safeName || asset.type}.pdf`;
            const storageRef = ref(
              storage,
              `resources/${user.uid}/${Date.now()}_${fileName}`
            );
            await uploadBytes(storageRef, pdfBlob, {
              contentType: "application/pdf",
            });
            fileURL = await getDownloadURL(storageRef);
          }

          return createResource({
            title: asset.title,
            description: asset.description,
            authorId: user.uid,
            authorName: user.displayName || "Anonymous",
            authorPhotoURL: user.photoURL ?? null,
            gradeLevel,
            subject,
            type: asset.type as ResourceType,
            fileURL,
            fileName,
            isPublic: false,
            sourceLessonId: lessonId,
            sourceLessonTitle: wizardState.title,
            generatedFromLesson: true,
            contentSections: asset.sections,
            tags: buildAssetTags(asset.type),
            links: [],
          });
        })
      );

      if (linkedResourceIds.length > 0) {
        await updateLesson(lessonId, { linkedResourceIds });
      }

      onGenerated(wizardState, lessonId);
    } catch {
      setError("We couldn't save your lesson draft and linked assets. Please try again.");
    } finally {
      setIsAcceptingDrafts(false);
    }
  }

  if (isGenerating) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-10 px-4">
        <div role="status" className="flex flex-col items-center gap-6">
          <Spinner className="h-12 w-12 border-[3px]" />
          <p aria-live="polite" className="text-base font-medium text-foreground">
            Generating your lesson plan…
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="space-y-5">
        <section className="-mx-4 -mt-4 rounded-t-2xl border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 px-5 py-5 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-4xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">AI Lesson Builder</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-primary-50">
                  Generate a Lesson with AI
                </h1>
                <p className="mt-2 text-sm text-primary-100/90">
                  Describe the lesson you need, then add a few teaching constraints so the first draft is easier to trust and edit.
                </p>
              </div>
              <div className="rounded-full bg-primary-50/10 px-3 py-1 text-xs font-medium text-primary-100 ring-1 ring-inset ring-primary-50/20">
                Worksheets and rubrics can be drafted with the lesson.
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-primary-100/80">
              Best results: name the topic, clarify the main learning outcome, and note any support or pacing needs the AI should respect.
            </p>
          </div>
        </section>

        <div className="mx-auto w-full max-w-4xl space-y-5">

          <div className="flex justify-start -mt-2">
            <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-1.5">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Back
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ai-grade-level" className="block text-sm font-medium text-foreground mb-1.5">
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

              <div>
                <label htmlFor="ai-subject" className="block text-sm font-medium text-foreground mb-1.5">
                  Subject
                </label>
                <select
                  id="ai-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {SUBJECTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="ai-topic" className="block text-sm font-medium text-foreground mb-1.5">
                Topic <span aria-hidden="true" className="text-red-500">*</span>
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
              <label htmlFor="ai-learning-goal" className="block text-sm font-medium text-foreground mb-1.5">
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
              <label htmlFor="ai-student-supports" className="block text-sm font-medium text-foreground mb-1.5">
                Student Support Needs
              </label>
              <textarea
                id="ai-student-supports"
                value={studentSupports}
                onChange={(e) => setStudentSupports(e.target.value.slice(0, 300))}
                maxLength={300}
                rows={2}
                placeholder="e.g. Include ELL scaffolds, sentence stems, and one extension task for fast finishers."
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <p className="mt-1 text-xs text-muted text-right" aria-live="polite">
                {studentSupports.length} / 300
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ai-lesson-flow" className="block text-sm font-medium text-foreground mb-1.5">
                  Estimated Lesson Flow
                </label>
                <select
                  id="ai-lesson-flow"
                  value={estimatedLessonFlow}
                  onChange={(e) => setEstimatedLessonFlow(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {LESSON_FLOW_OPTIONS.map((flow) => (
                    <option key={flow} value={flow}>
                      {flow}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ai-assessment-intent" className="block text-sm font-medium text-foreground mb-1.5">
                  Assessment Intent
                </label>
                <select
                  id="ai-assessment-intent"
                  value={assessmentIntent}
                  onChange={(e) => setAssessmentIntent(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {ASSESSMENT_INTENT_OPTIONS.map((intent) => (
                    <option key={intent} value={intent}>
                      {intent}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface px-4 py-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Class Constraints</h2>
                <p className="mt-1 text-sm text-muted">Quick classroom context to keep plans realistic for your setting.</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Time per class</p>
                <div className="flex flex-wrap gap-2">
                  {TIME_PER_CLASS_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setTimePerClass(opt)}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer",
                        timePerClass === opt
                          ? "bg-primary-100 text-primary-800 border-primary-300"
                          : "bg-surface text-muted border-border hover:border-primary-300 hover:text-foreground",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Class size</p>
                <div className="flex flex-wrap gap-2">
                  {CLASS_SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setClassSize(opt)}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer",
                        classSize === opt
                          ? "bg-primary-100 text-primary-800 border-primary-300"
                          : "bg-surface text-muted border-border hover:border-primary-300 hover:text-foreground",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">ELL %</p>
                <div className="flex flex-wrap gap-2">
                  {ELL_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setEllPercent(opt)}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer",
                        ellPercent === opt
                          ? "bg-primary-100 text-primary-800 border-primary-300"
                          : "bg-surface text-muted border-border hover:border-primary-300 hover:text-foreground",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">IEP/504 supports present?</p>
                  <div className="flex gap-2">
                    {(["yes", "no"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setIep504Supports(opt)}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer",
                          iep504Supports === opt
                            ? "bg-primary-100 text-primary-800 border-primary-300"
                            : "bg-surface text-muted border-border hover:border-primary-300 hover:text-foreground",
                        ].join(" ")}
                      >
                        {opt === "yes" ? "Yes" : "No"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Tech available?</p>
                  <div className="flex gap-2">
                    {(["yes", "limited", "no"] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTechAvailable(opt)}
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer",
                          techAvailable === opt
                            ? "bg-primary-100 text-primary-800 border-primary-300"
                            : "bg-surface text-muted border-border hover:border-primary-300 hover:text-foreground",
                        ].join(" ")}
                      >
                        {opt === "yes" ? "Yes" : opt === "limited" ? "Limited" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface px-4 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Preferred Activity Styles</h2>
                  <p className="mt-1 text-sm text-muted">
                    Select one or more approaches you want emphasized in the generated lesson.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-medium text-secondary-700">
                  {activityStyles.length} selected
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {ACTIVITY_STYLE_OPTIONS.map((style) => {
                  const checked = activityStyles.includes(style);
                  return (
                    <label key={style} className="flex items-start gap-3 rounded-lg border border-border px-3 py-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleActivityStyle(style, e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-foreground">{style}</span>
                    </label>
                  );
                })}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ai-primary-style" className="block text-xs font-medium text-foreground mb-1.5">
                    Primary style priority
                  </label>
                  <select
                    id="ai-primary-style"
                    value={primaryActivityStyle}
                    onChange={(e) => setPrimaryActivityStyle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">No priority</option>
                    {activityStyles.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ai-secondary-style" className="block text-xs font-medium text-foreground mb-1.5">
                    Secondary style priority
                  </label>
                  <select
                    id="ai-secondary-style"
                    value={secondaryActivityStyle}
                    onChange={(e) => setSecondaryActivityStyle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">No secondary</option>
                    {activityStyles
                      .filter((style) => style !== primaryActivityStyle)
                      .map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface px-4 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Optional teaching assets</h2>
                  <p className="mt-1 text-sm text-muted">
                    Ask AI to draft linked assets with your lesson. They will be saved as private resource drafts only after you accept the lesson.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-medium text-secondary-700">
                  {selectedAssetCount} / {ASSET_LIMIT} selected
                </span>
              </div>

              {(["worksheet", "rubric"] as AssetKind[]).map((kind) => {
                const option = assetOptions[kind];
                const limitReachedForNew = !option.selected && selectedAssetCount >= ASSET_LIMIT;
                return (
                  <div key={kind} className="rounded-lg border border-border px-3 py-3 space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={option.selected}
                        disabled={limitReachedForNew}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            updateAssetOption(kind, { selected: false });
                            return;
                          }
                          if (selectedAssetCount < ASSET_LIMIT) {
                            updateAssetOption(kind, { selected: true });
                          }
                        }}
                        className="mt-1 h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500"
                      />
                      <div>
                        <div className="text-sm font-medium text-foreground">{ASSET_LABELS[kind]}</div>
                        <p className="text-xs text-muted mt-0.5">
                          {kind === "worksheet"
                            ? "Create guided student practice tied to the lesson objectives and steps."
                            : "Create a clear assessment rubric with criteria and performance descriptors."}
                        </p>
                      </div>
                    </label>

                    {option.selected && (
                      <div>
                        <label htmlFor={`asset-example-${kind}`} className="block text-xs font-medium text-foreground mb-1.5">
                          Example or direction (optional)
                        </label>
                        <textarea
                          id={`asset-example-${kind}`}
                          value={option.example}
                          onChange={(e) => updateAssetOption(kind, { example: e.target.value.slice(0, 500) })}
                          maxLength={500}
                          rows={2}
                          placeholder={
                            kind === "worksheet"
                              ? "e.g. Include 6 mixed-practice problems and one short reflection question."
                              : "e.g. Use a 4-point rubric with criteria for accuracy, explanation, and participation."
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                        />
                        <p className="mt-1 text-xs text-muted text-right" aria-live="polite">
                          {option.example.length} / 500
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted">
                Slides outline is planned next. This first version ships with linked worksheets and rubrics.
              </div>
            </div>

            {userTier === "plus" && (
              <>
                <div>
                  <label htmlFor="ai-grade-override" className="block text-sm font-medium text-foreground mb-1.5">
                    Specific Grade <span className="ml-1 inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">Plus</span>
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
                  <label htmlFor="ai-context" className="block text-sm font-medium text-foreground mb-1.5">
                    Additional Context <span className="ml-1 inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">Plus</span>
                  </label>
                  <textarea
                    id="ai-context"
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value.slice(0, 500))}
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

            {error && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {remainingRequests !== null && (
              <p id={remainsId} className={`text-xs ${remainingRequests === 0 ? "text-red-600 font-medium" : "text-muted"}`}>
                {remainingRequests === 0
                  ? "You've reached your daily AI limit. Upgrade to Plus for unlimited access."
                  : `${remainingRequests} / 10 requests remaining today`}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitDisabled}
              aria-disabled={isSubmitDisabled ? "true" : undefined}
              aria-describedby={remainingRequests !== null ? remainsId : undefined}
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
        onClose={() => {
          setPreviewLesson(null);
          setPreviewAssets([]);
        }}
        title="Review AI Draft"
        className="max-w-4xl"
      >
        {previewLesson && (
          <div className="space-y-5">
            <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900">
              Review this draft before you adopt it. AI can speed up planning, but timing, rigor, and student fit still need a teacher check.
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.95fr]">
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
                  <h3 className="text-sm font-semibold text-foreground mb-2">Objectives</h3>
                  <ul className="space-y-1.5 list-disc list-inside text-sm text-foreground">
                    {previewLesson.objectives.filter((item) => item.trim() !== "").map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Lesson steps</h3>
                  <ol className="space-y-2">
                    {previewLesson.steps.filter((step) => step.title.trim() !== "").map((step, index) => (
                      <li key={`${step.title}-${index}`} className="rounded-lg border border-border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {index + 1}. {step.title}
                          </span>
                          {step.duration && <span className="ml-auto text-xs text-muted">{step.duration}</span>}
                        </div>
                        {step.description && <p className="mt-1 text-sm text-muted">{step.description}</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Quick quality check</h3>
                  <ul className="space-y-2">
                    {buildQualityChecks(previewLesson).map((check) => (
                      <li key={check.label} className="rounded-lg border border-border px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={[
                            "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                            check.status === "pass" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
                          ].join(" ")}>
                            {check.status === "pass" ? "✓" : "!"}
                          </span>
                          <span className="font-medium text-foreground">{check.label}</span>
                        </div>
                        <p className="mt-1 text-muted">{check.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                {previewAssets.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">Linked draft assets</h3>
                    <div className="space-y-2">
                      {previewAssets.map((asset) => (
                        <div key={asset.type} className="rounded-lg border border-border px-3 py-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground">{asset.title}</span>
                            <span className="inline-flex items-center rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-secondary-700">
                              {ASSET_LABELS[asset.type]}
                            </span>
                          </div>
                          <p className="mt-1 text-muted">{asset.description}</p>
                          {asset.sections.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-muted">
                              {asset.sections.slice(0, 3).map((section) => (
                                <li key={`${asset.type}-${section.heading}`}>• {section.heading}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Next step</h3>
                  <p className="text-sm text-muted">
                    Using this draft will create a lesson draft and any selected assets as private linked resource drafts.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPreviewLesson(null);
                  setPreviewAssets([]);
                }}
                disabled={isAcceptingDrafts}
              >
                Edit Inputs
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPreviewLesson(null);
                  setPreviewAssets([]);
                  void generateLesson();
                }}
                disabled={isAcceptingDrafts}
              >
                Regenerate
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleAcceptPreview()}
                isLoading={isAcceptingDrafts}
              >
                Use This Draft
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
