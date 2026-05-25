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
  type LessonStep,
  type LessonAttachment,
} from "@/lib/firestore/lessons";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";

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
      <LessonBuilderNewInner />
    </Suspense>
  );
}

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
  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);

  // UI state
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);

  const formTopRef = useRef<HTMLDivElement>(null);
  const objectiveRefs = useRef<Array<HTMLInputElement | null>>([]);
  const materialRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    objectiveRefs.current = objectiveRefs.current.slice(0, objectives.length);
  }, [objectives.length]);

  useEffect(() => {
    materialRefs.current = materialRefs.current.slice(0, materials.length);
  }, [materials.length]);

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
    event: KeyboardEvent<HTMLInputElement>,
    list: string[],
    setList: Dispatch<SetStateAction<string[]>>,
    index: number,
    refs: MutableRefObject<Array<HTMLInputElement | null>>
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
        })),
        attachments,
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
    } catch (err) {
      console.error("Create lesson error:", err);
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
                    <p className="text-sm font-semibold text-foreground">
                      Step {i + 1}
                      {step.title.trim() ? `: ${step.title.trim()}` : ""}
                    </p>
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
    <div className="py-8 max-w-3xl mx-auto">
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
            />
            <Select
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Select subject"
              options={SUBJECTS.map((s) => ({ value: s, label: s }))}
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setObjectives((prev) => [...prev, ""])}
            >
              + Add
            </Button>
          </div>

          <div className="space-y-3">
            {objectives.map((obj, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs text-muted font-medium w-5 shrink-0">
                  {i + 1}.
                </span>
                <Input
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
                  className="flex-1"
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMaterials((prev) => [...prev, ""])}
            >
              + Add
            </Button>
          </div>

          <div className="space-y-3">
            {materials.map((mat, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs text-muted font-medium w-5 shrink-0">
                  •
                </span>
                <Input
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
                  className="flex-1"
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
          <h2 className="text-lg font-semibold text-foreground">
            📋 Step-by-Step Plan
          </h2>

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
                <Textarea
                  placeholder="Describe what happens in this step…"
                  value={step.description}
                  onChange={(e) =>
                    updateListItem(steps, setSteps, i, {
                      ...step,
                      description: e.target.value,
                    })
                  }
                  rows={3}
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
                : `Max file size: 25 MB${uploading ? " - Uploading..." : ""}`}
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
    </div>
  );
}
