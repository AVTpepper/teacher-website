"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { type DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { GRADE_LEVELS, SUBJECTS } from "@/lib/firestore/users";
import {
  getPublicLessons,
  getLessonsByAuthor,
  deleteLesson,
  type Lesson,
} from "@/lib/firestore/lessons";
import { Avatar, Badge, Button, Card, Select, Spinner } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

const PAGE_SIZE = 12;

function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <Link href={`/lesson-builder/${lesson.id}`}>
      <Card hoverable className="flex h-full flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="primary">Lesson Plan</Badge>
          {lesson.gradeLevel && <Badge variant="default">{lesson.gradeLevel}</Badge>}
        </div>
        <h3 className="font-semibold text-foreground line-clamp-2">{lesson.title}</h3>
        {lesson.objectives.length > 0 && (
          <p className="mt-1 text-xs text-muted line-clamp-2">
            {lesson.objectives[0]}
            {lesson.objectives.length > 1 && ` + ${lesson.objectives.length - 1} more`}
          </p>
        )}
        <div className="flex-1" />
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Avatar src={lesson.authorPhotoURL} alt={lesson.authorName} size="sm" />
            <span className="text-xs text-muted truncate max-w-28">{lesson.authorName}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {lesson.downloadCount}
            </span>
            {lesson.subject && <span className="truncate max-w-24">{lesson.subject}</span>}
          </div>
        </div>
      </Card>
    </Link>
  );
}

// ─── Draft row ────────────────────────────────────────────────────────────────

interface DraftRowProps {
  draft: Lesson;
  isAvailable: boolean;
  onDeleted: (id: string) => void;
}

function DraftRow({ draft, isAvailable, onDeleted }: DraftRowProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${draft.title || "Untitled draft"}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteLesson(draft.id);
      onDeleted(draft.id);
    } catch {
      alert("Failed to delete draft. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{draft.title || "Untitled draft"}</p>
        <p className="text-xs text-muted">
          Updated {timeAgo(draft.updatedAt as { seconds: number } | null)}
          {draft.gradeLevel && (
            <span className="ml-2">
              {draft.gradeLevel}{draft.subject ? ` · ${draft.subject}` : ""}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isAvailable && (
          <Link href={`/lesson-builder/new?draft=${draft.id}&complete=true`}>
            <Button type="button" variant="outline" size="sm" className="gap-1.5">
              <svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
              </svg>
              AI Complete
            </Button>
          </Link>
        )}
        <Link href={`/lesson-builder/new?draft=${draft.id}`}>
          <Button type="button" variant="outline" size="sm">Edit</Button>
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label={`Delete "${draft.title || "Untitled draft"}"`}
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {deleting
            ? <Spinner size="sm" />
            : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            )
          }
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LessonBuilderPage() {
  const { user } = useAuth();

  const isAvailable = process.env.NEXT_PUBLIC_AI_AVAILABLE === "true";

  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [drafts, setDrafts] = useState<Lesson[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsExpanded, setDraftsExpanded] = useState(false);

  const fetchLessons = useCallback(
    async (reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const filters = {
          gradeLevel: gradeLevel || undefined,
          subject: subject || undefined,
        };
        const result = await getPublicLessons(filters, reset ? null : cursor);
        setLessons((prev) => (reset ? result.lessons : [...prev, ...result.lessons]));
        setCursor(result.lastDoc);
        setHasMore(result.lastDoc !== null);
      } catch {
        if (reset) setLessons([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gradeLevel, subject]
  );

  useEffect(() => {
    setCursor(null);
    fetchLessons(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeLevel, subject]);

  useEffect(() => {
    async function loadDrafts() {
      if (!user) { setDrafts([]); return; }
      setDraftsLoading(true);
      try {
        const result = await getLessonsByAuthor(user.uid, true, null, 50);
        setDrafts(result.lessons.filter((l) => !l.isPublic));
      } catch {
        setDrafts([]);
      } finally {
        setDraftsLoading(false);
      }
    }
    loadDrafts();
  }, [user]);

  const hasFilters = gradeLevel || subject;
  const visibleDrafts = draftsExpanded ? drafts : drafts.slice(0, 3);
  // Latest draft for resume banner (most recently updated)
  const latestDraft = drafts[0] ?? null;
  const [bannerDismissed, setBannerDismissed] = useState(false);

  return (
    <div className="py-8">
      {/* Page header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Lesson Builder</h1>
        <p className="mt-2 text-base text-muted">How would you like to create your lesson?</p>
      </div>

      {/* Draft resume banner */}
      {user && !bannerDismissed && latestDraft && !draftsLoading && (
        <div
          role="alert"
          className="mb-6 w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm font-medium text-amber-800">
            You have an unfinished lesson draft{latestDraft.title ? `: "${latestDraft.title}"` : ""}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/lesson-builder/new?draft=${latestDraft.id}`}>
              <Button size="sm">Resume</Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => setBannerDismissed(true)}>
              Start fresh
            </Button>
          </div>
        </div>
      )}

      {/* Path cards */}
      <div className="grid w-full max-w-2xl mx-auto gap-4 sm:grid-cols-2 mb-10">
        {/* Create My Own */}
        <Link
          href="/lesson-builder/new?path=manual"
          className="group flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-surface p-8 text-center transition-colors hover:border-primary-500 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700 group-hover:bg-primary-200 transition-colors" aria-hidden="true">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </span>
          <span className="text-base font-semibold text-foreground">Create My Own</span>
          <span className="text-sm text-muted">Fill in each section at your own pace</span>
        </Link>

        {/* Create with AI Assistant */}
        {isAvailable ? (
          <Link
            href="/lesson-builder/new?path=ai"
            className="group flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-surface p-8 text-center transition-colors hover:border-primary-500 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700 group-hover:bg-primary-200 transition-colors" aria-hidden="true">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
              </svg>
            </span>
            <span className="text-base font-semibold text-foreground">Create with AI Assistant</span>
            <span className="text-sm text-muted">Let AI generate a starting plan for you</span>
          </Link>
        ) : (
          <div
            aria-disabled="true"
            title="AI features are not available in this environment"
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-surface p-8 text-center opacity-50 cursor-not-allowed"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700" aria-hidden="true">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
              </svg>
            </span>
            <span className="text-base font-semibold text-foreground">Create with AI Assistant</span>
            <span className="text-sm text-muted">Let AI generate a starting plan for you</span>
          </div>
        )}
      </div>

      {/* Drafts section */}
      {user && (
        <Card padding="lg" className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">
              Your Drafts
              {!draftsLoading && drafts.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-border text-muted text-xs font-medium h-5 px-1.5">
                  {drafts.length}
                </span>
              )}
            </h2>
          </div>

          {draftsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted py-2">
              <Spinner size="sm" />
              Loading drafts...
            </div>
          )}

          {!draftsLoading && drafts.length === 0 && (
            <p className="text-sm text-muted">No drafts yet. Use the options above to create your first lesson plan.</p>
          )}

          {!draftsLoading && drafts.length > 0 && (
            <div className="space-y-2">
              {visibleDrafts.map((draft) => (
                <DraftRow
                  key={draft.id}
                  draft={draft}
                  isAvailable={isAvailable}
                  onDeleted={(id) => setDrafts((prev) => prev.filter((d) => d.id !== id))}
                />
              ))}
              {drafts.length > 3 && (
                <button
                  type="button"
                  onClick={() => setDraftsExpanded((v) => !v)}
                  className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-muted hover:text-foreground hover:border-primary-400 transition-colors cursor-pointer"
                >
                  {draftsExpanded
                    ? "Show less"
                    : `Show ${drafts.length - 3} more draft${drafts.length - 3 === 1 ? "" : "s"}`}
                </button>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Select
            label="Grade Level"
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            placeholder="All Grade Levels"
            options={GRADE_LEVELS.map((g) => ({ value: g, label: g }))}
          />
        </div>
        <div className="flex-1">
          <Select
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="All Subjects"
            options={SUBJECTS.map((s) => ({ value: s, label: s }))}
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setGradeLevel(""); setSubject(""); }}>
            Clear Filters
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : lessons.length === 0 ? (
        <div className="py-20 text-center">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-sm font-medium text-foreground">No lesson plans found</h3>
          <p className="mt-1 text-xs text-muted">
            {hasFilters ? "Try adjusting your filters." : "Be the first to publish a lesson plan!"}
          </p>
          {!hasFilters && (
            <Link href="/lesson-builder/new?path=manual">
              <Button className="mt-4" size="sm">Create a Lesson Plan</Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} />)}
          </div>
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={() => fetchLessons(false)} isLoading={loadingMore}>
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
