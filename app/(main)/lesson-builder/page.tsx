"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { GRADE_LEVELS, SUBJECTS } from "@/lib/firestore/users";
import {
  getPublicLessons,
  getLessonsByAuthor,
  getLesson,
  deleteLesson,
  type Lesson,
} from "@/lib/firestore/lessons";
import { Avatar, Badge, Button, Card, ConfirmDialog, Select, Spinner } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

import { addBookmark, removeBookmark, getUserBookmarks } from "@/lib/firestore/bookmarks";

const LESSON_BUILDER_PREVIEW_LIMIT = 6;
const OBJECTIVE_CHAR_LIMIT = 120;

// --- Star display -------------------------------------------------------------

function StarRating({ average, count }: { average: number; count: number }) {
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-0.5" title={`${average.toFixed(1)} out of 5 (${count} rating${count !== 1 ? "s" : ""})`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = average >= star - 0.25;
        const half = !filled && average >= star - 0.75;
        return (
          <svg key={star} className={`h-3.5 w-3.5 shrink-0 ${filled ? "text-amber-400" : half ? "text-amber-300" : "text-border"}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z" />
          </svg>
        );
      })}
      <span className="ml-0.5 text-xs text-muted">{average.toFixed(1)}</span>
    </span>
  );
}

interface LessonCardProps {
  lesson: Lesson;
  userId: string | null;
  initialBookmarked?: boolean;
}

function LessonCard({ lesson, userId, initialBookmarked = false }: LessonCardProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(lesson.bookmarkCount ?? 0);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const objective = lesson.objectives[0] ?? "";
  const objectiveTruncated = objective.length > OBJECTIVE_CHAR_LIMIT
    ? objective.slice(0, OBJECTIVE_CHAR_LIMIT).trimEnd() + "..."
    : objective;

  async function handleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    if (!userId || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await removeBookmark(userId, lesson.id);
        setBookmarked(false);
        setBookmarkCount((c) => Math.max(0, c - 1));
      } else {
        await addBookmark(userId, lesson.id, lesson.title);
        setBookmarked(true);
        setBookmarkCount((c) => c + 1);
      }
    } finally {
      setBookmarkLoading(false);
    }
  }

  return (
    <Link href={`/lesson-builder/${lesson.id}`} className="group">
      <Card hoverable className="relative flex h-full flex-col gap-0">
        {/* Bookmark button */}
        {userId && (
          <button
            type="button"
            onClick={handleBookmark}
            disabled={bookmarkLoading}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark this lesson"}
            aria-pressed={bookmarked}
            className="absolute top-3 right-3 z-10 rounded-full p-1 text-muted hover:text-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className={`h-4 w-4 ${bookmarked ? "fill-primary-600 text-primary-600" : "fill-none"}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
            </svg>
          </button>
        )}

        {/* Badges */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5 pr-6">
          <Badge variant="primary">Lesson Plan</Badge>
          {lesson.gradeLevel && <Badge variant="default">{lesson.gradeLevel}</Badge>}
          {lesson.subject && <Badge variant="default">{lesson.subject}</Badge>}
          {lesson.remixedFromId && (
            <Badge variant="default">
              <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
              </svg>
              Remix
            </Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary-700 transition-colors">
          {lesson.title || "Untitled"}
        </h3>

        {/* First objective */}
        {objective && (
          <p className="mt-1.5 text-xs text-muted">
            {objectiveTruncated}
            {lesson.objectives.length > 1 && (
              <span className="text-muted/70"> +{lesson.objectives.length - 1} more</span>
            )}
          </p>
        )}

        {/* Step count */}
        {lesson.steps.length > 0 && (
          <p className="mt-1 text-xs text-muted flex items-center gap-1">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            {lesson.steps.length} step{lesson.steps.length !== 1 ? "s" : ""}
          </p>
        )}

        <div className="flex-1" />

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted border-t border-border pt-3">
          {(lesson.ratingCount ?? 0) > 0 && (
            <StarRating average={lesson.ratingAverage ?? 0} count={lesson.ratingCount ?? 0} />
          )}
          {lesson.duration && (
            <span className="flex items-center gap-1 shrink-0">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {lesson.duration}
            </span>
          )}
          <span className="flex items-center gap-1 shrink-0">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {lesson.downloadCount}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <svg className={`h-3.5 w-3.5 ${bookmarked ? "fill-primary-600 text-primary-600" : "fill-none"}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
            </svg>
            {bookmarkCount}
          </span>
        </div>

        {/* Author row */}
        <div className="mt-2 flex items-center gap-2">
          <Avatar src={lesson.authorPhotoURL} alt={lesson.authorName} size="sm" />
          <span className="text-xs text-muted truncate">{lesson.authorName}</span>
        </div>
      </Card>
    </Link>
  );
}

// --- Published lesson row ----------------------------------------------------

interface PublishedRowProps {
  lesson: Lesson;
  onDeleted: (id: string) => void;
}

function PublishedRow({ lesson, onDeleted }: PublishedRowProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      await deleteLesson(lesson.id);
      onDeleted(lesson.id);
    } catch {
      alert("Failed to delete lesson. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <>
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title={`Delete "${lesson.title || "Untitled"}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleting}
      />
      <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link href={`/lesson-builder/${lesson.id}`} className="text-sm font-medium text-foreground hover:text-primary-700 hover:underline truncate block">
            {lesson.title || "Untitled"}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            {lesson.gradeLevel && <span>{lesson.gradeLevel}</span>}
            {lesson.subject && <span>{lesson.subject}</span>}
            {lesson.duration && <span>{lesson.duration}</span>}
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {lesson.downloadCount}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link href={`/lesson-builder/new?edit=${lesson.id}`}>
            <Button type="button" variant="outline" size="sm">Edit</Button>
          </Link>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            aria-label={`Delete "${lesson.title || "Untitled"}"`}
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
    </>
  );
}

// --- Bookmarked lesson row ---------------------------------------------------

function BookmarkedRow({ lesson, onUnbookmarked }: { lesson: Lesson; onUnbookmarked: (id: string) => void }) {
  const { user } = useAuth();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!user) return;
    setRemoving(true);
    try {
      await removeBookmark(user.uid, lesson.id);
      onUnbookmarked(lesson.id);
    } catch {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={`/lesson-builder/${lesson.id}`} className="text-sm font-medium text-foreground hover:text-primary-700 hover:underline truncate block">
          {lesson.title || "Untitled"}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          {lesson.gradeLevel && <span>{lesson.gradeLevel}</span>}
          {lesson.subject && <span>{lesson.subject}</span>}
          {lesson.duration && <span>{lesson.duration}</span>}
          <span>by {lesson.authorName}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link href={`/lesson-builder/${lesson.id}`}>
          <Button type="button" variant="outline" size="sm">View</Button>
        </Link>
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          aria-label={`Remove bookmark for "${lesson.title || "Untitled"}"`}
          className="inline-flex items-center justify-center rounded-lg p-1.5 text-amber-500 hover:text-muted hover:bg-secondary-100 transition-colors disabled:opacity-50 cursor-pointer"
          title="Remove bookmark"
        >
          {removing ? <Spinner size="sm" /> : (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// --- Draft row ----------------------------------------------------------------

interface DraftRowProps {
  draft: Lesson;
  isAvailable: boolean;
  onDeleted: (id: string) => void;
}

function DraftRow({ draft, isAvailable, onDeleted }: DraftRowProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    setConfirmOpen(false);
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
    <>
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title={`Delete "${draft.title || "Untitled draft"}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleting}
      />
      <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{draft.title || "Untitled draft"}</p>
          <p className="text-xs text-muted">
            Updated {timeAgo(draft.updatedAt as { seconds: number } | null)}
            {draft.gradeLevel && (
              <span className="ml-2">
                {draft.gradeLevel}{draft.subject ? ` | ${draft.subject}` : ""}
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
            onClick={() => setConfirmOpen(true)}
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
    </>
  );
}

// --- Page ---------------------------------------------------------------------

export default function LessonBuilderPage() {
  const { user } = useAuth();

  const isAvailable = process.env.NEXT_PUBLIC_AI_AVAILABLE === "true";

  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  const [myLessonsTab, setMyLessonsTab] = useState<"drafts" | "published" | "bookmarked">("drafts");

  const [drafts, setDrafts] = useState<Lesson[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsExpanded, setDraftsExpanded] = useState(false);

  const [published, setPublished] = useState<Lesson[]>([]);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [publishedExpanded, setPublishedExpanded] = useState(false);

  const [bookmarkedLessons, setBookmarkedLessons] = useState<Lesson[]>([]);
  const [bookmarkedLoading, setBookmarkedLoading] = useState(false);
  const [bookmarkedExpanded, setBookmarkedExpanded] = useState(false);

  const [userBookmarkedIds, setUserBookmarkedIds] = useState<Set<string>>(new Set());
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const fetchLessons = useCallback(
    async () => {
      setLoading(true);
      try {
        const filters = {
          gradeLevel: gradeLevel || undefined,
          subject: subject || undefined,
        };
        const result = await getPublicLessons(filters);
        setLessons(result.lessons);
      } catch {
        setLessons([]);
      } finally {
        setLoading(false);
      }
    },
    [gradeLevel, subject]
  );

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  useEffect(() => {
    async function loadMyLessons() {
      if (!user) { setDrafts([]); setPublished([]); setBookmarkedLessons([]); setUserBookmarkedIds(new Set()); return; }
      setDraftsLoading(true);
      setPublishedLoading(true);
      setBookmarkedLoading(true);
      try {
        const [lessonsResult, bookmarks] = await Promise.all([
          getLessonsByAuthor(user.uid, true, null),
          getUserBookmarks(user.uid),
        ]);
        setDrafts(lessonsResult.lessons.filter((l) => !l.isPublic));
        setPublished(lessonsResult.lessons.filter((l) => l.isPublic));
        const bookmarkIds = bookmarks.map((b) => b.lessonId);
        setUserBookmarkedIds(new Set(bookmarkIds));
        // Fetch full lesson docs for bookmarks (excluding own lessons already loaded)
        const ownIds = new Set(lessonsResult.lessons.map((l) => l.id));
        const foreignIds = bookmarkIds.filter((id) => !ownIds.has(id));
        const fetched = await Promise.all(foreignIds.map((id) => getLesson(id)));
        const allBookmarked = [
          ...lessonsResult.lessons.filter((l) => bookmarkIds.includes(l.id)),
          ...(fetched.filter(Boolean) as Lesson[]),
        ];
        setBookmarkedLessons(allBookmarked);
      } catch {
        setDrafts([]);
        setPublished([]);
        setBookmarkedLessons([]);
      } finally {
        setDraftsLoading(false);
        setPublishedLoading(false);
        setBookmarkedLoading(false);
      }
    }
    loadMyLessons();
  }, [user]);

  const hasFilters = gradeLevel || subject;
  const visibleRecentLessons = lessons.slice(0, LESSON_BUILDER_PREVIEW_LIMIT);
  const visibleDrafts = draftsExpanded ? drafts : drafts.slice(0, 3);
  const visiblePublished = publishedExpanded ? published : published.slice(0, 3);
  const visibleBookmarked = bookmarkedExpanded ? bookmarkedLessons : bookmarkedLessons.slice(0, 3);
  // Latest draft for resume banner (most recently updated)
  const latestDraft = drafts[0] ?? null;

  return (
    <div className="flex-1 min-w-0 pb-8 space-y-6">
      <div className="rounded-2xl border border-border bg-surface/75 p-4 shadow-sm backdrop-blur-sm sm:p-6">
      {/* Page header */}
      <div className="-mx-4 -mt-4 mb-8 border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-center text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 rounded-t-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Lesson Studio</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Lesson Builder</h1>
        <p className="mt-2 text-base text-primary-100/90">How would you like to create your lesson?</p>
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
          className="group flex flex-col items-center gap-3 rounded-xl border-2 border-primary-200 bg-secondary-50/70 p-8 text-center transition-colors hover:border-primary-500 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
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
            className="group flex flex-col items-center gap-3 rounded-xl border-2 border-primary-200 bg-secondary-50/70 p-8 text-center transition-colors hover:border-primary-500 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
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
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-primary-200 bg-secondary-50/70 p-8 text-center opacity-50 cursor-not-allowed"
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

      {/* My Lessons tabbed section */}
      {user && (
        <Card padding="lg" className="mb-8 border-primary-200 bg-secondary-50/70">
          {/* Tab bar */}
          <div className="flex items-center gap-1 border-b border-border mb-4 -mx-6 px-6" role="tablist" aria-label="My lessons">
            <button
              role="tab"
              aria-selected={myLessonsTab === "drafts"}
              aria-controls="tab-panel-drafts"
              onClick={() => setMyLessonsTab("drafts")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                myLessonsTab === "drafts"
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-muted hover:text-foreground hover:border-border"
              }`}
            >
              Drafts
              {!draftsLoading && drafts.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-border text-muted text-xs font-medium h-4 px-1.5">
                  {drafts.length}
                </span>
              )}
            </button>
            <button
              role="tab"
              aria-selected={myLessonsTab === "published"}
              aria-controls="tab-panel-published"
              onClick={() => setMyLessonsTab("published")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                myLessonsTab === "published"
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-muted hover:text-foreground hover:border-border"
              }`}
            >
              Published
              {!publishedLoading && published.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-border text-muted text-xs font-medium h-4 px-1.5">
                  {published.length}
                </span>
              )}
            </button>
            <button
              role="tab"
              id="tab-bookmarked"
              aria-selected={myLessonsTab === "bookmarked"}
              aria-controls="tab-panel-bookmarked"
              onClick={() => setMyLessonsTab("bookmarked")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                myLessonsTab === "bookmarked"
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-muted hover:text-foreground hover:border-border"
              }`}
            >
              Bookmarked
              {!bookmarkedLoading && bookmarkedLessons.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-border text-muted text-xs font-medium h-4 px-1.5">
                  {bookmarkedLessons.length}
                </span>
              )}
            </button>
          </div>

          {/* Drafts panel */}
          <div id="tab-panel-drafts" role="tabpanel" aria-labelledby="tab-drafts" hidden={myLessonsTab !== "drafts"}>
            {draftsLoading && (
              <div className="flex items-center gap-2 text-sm text-muted py-2">
                <Spinner size="sm" />
                Loading drafts...
              </div>
            )}
            {!draftsLoading && drafts.length === 0 && (
              <p className="text-sm text-muted">No drafts yet. Use the options above to start a lesson plan.</p>
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
                    {draftsExpanded ? "Show less" : `Show ${drafts.length - 3} more draft${drafts.length - 3 === 1 ? "" : "s"}`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Published panel */}
          <div id="tab-panel-published" role="tabpanel" aria-labelledby="tab-published" hidden={myLessonsTab !== "published"}>
            {publishedLoading && (
              <div className="flex items-center gap-2 text-sm text-muted py-2">
                <Spinner size="sm" />
                Loading published lessons...
              </div>
            )}
            {!publishedLoading && published.length === 0 && (
              <p className="text-sm text-muted">No published lessons yet. Finish a draft and hit Publish to share it with the community.</p>
            )}
            {!publishedLoading && published.length > 0 && (
              <div className="space-y-2">
                {visiblePublished.map((lesson) => (
                  <PublishedRow
                    key={lesson.id}
                    lesson={lesson}
                    onDeleted={(id) => setPublished((prev) => prev.filter((l) => l.id !== id))}
                  />
                ))}
                {published.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setPublishedExpanded((v) => !v)}
                    className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-muted hover:text-foreground hover:border-primary-400 transition-colors cursor-pointer"
                  >
                    {publishedExpanded ? "Show less" : `Show ${published.length - 3} more`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bookmarked panel */}
          <div id="tab-panel-bookmarked" role="tabpanel" aria-labelledby="tab-bookmarked" hidden={myLessonsTab !== "bookmarked"}>
            {bookmarkedLoading && (
              <div className="flex items-center gap-2 text-sm text-muted py-2">
                <Spinner size="sm" />
                Loading bookmarks...
              </div>
            )}
            {!bookmarkedLoading && bookmarkedLessons.length === 0 && (
              <p className="text-sm text-muted">No bookmarks yet. Click the bookmark icon on any lesson card to save it here.</p>
            )}
            {!bookmarkedLoading && bookmarkedLessons.length > 0 && (
              <div className="space-y-2">
                {visibleBookmarked.map((lesson) => (
                  <BookmarkedRow
                    key={lesson.id}
                    lesson={lesson}
                    onUnbookmarked={(id) => setBookmarkedLessons((prev) => prev.filter((l) => l.id !== id))}
                  />
                ))}
                {bookmarkedLessons.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setBookmarkedExpanded((v) => !v)}
                    className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-muted hover:text-foreground hover:border-primary-400 transition-colors cursor-pointer"
                  >
                    {bookmarkedExpanded ? "Show less" : `Show ${bookmarkedLessons.length - 3} more`}
                  </button>
                )}
              </div>
            )}
          </div>
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

      </div>

      <div>
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
            {visibleRecentLessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                userId={user?.uid ?? null}
                initialBookmarked={userBookmarkedIds.has(lesson.id)}
              />
            ))}
          </div>
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-xs text-muted">
              Showing the most recent {Math.min(LESSON_BUILDER_PREVIEW_LIMIT, lessons.length)} lesson plans.
            </p>
            <div className="flex items-center justify-center">
              <Link href="/resources">
                <Button variant="outline">Browse Resource Library</Button>
              </Link>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
