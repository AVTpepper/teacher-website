"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { type DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { GRADE_LEVELS, SUBJECTS } from "@/lib/firestore/users";
import {
  getPublicLessons,
  getLessonsByAuthor,
  type Lesson,
} from "@/lib/firestore/lessons";
import { Avatar, Badge, Button, Card, Select } from "@/components/ui";

const PAGE_SIZE = 12;

function timeAgo(timestamp: { seconds: number } | null): string {
  if (!timestamp) return "just now";
  const seconds = Math.floor(Date.now() / 1000 - timestamp.seconds);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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

export default function LessonBuilderPage() {
  const { user } = useAuth();

  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [drafts, setDrafts] = useState<Lesson[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

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

  return (
    <div className="py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lesson Builder</h1>
          <p className="mt-1 text-sm text-muted">Browse community lesson plans or create your own.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/lesson-builder/drafts">
            <Button variant="outline" size="sm" type="button">Your Drafts</Button>
          </Link>
          <Link href="/lesson-builder/new">
            <Button type="button">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Lesson Plan
            </Button>
          </Link>
        </div>
      </div>

      {user && (
        <Card padding="lg" className="mb-8 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Your Drafts</h2>
            <Link href="/lesson-builder/drafts" className="text-sm text-primary-900 hover:underline">See all</Link>
          </div>
          {draftsLoading && <p className="text-sm text-muted">Loading drafts...</p>}
          {!draftsLoading && drafts.length === 0 && (
            <p className="text-sm text-muted">
              No drafts yet.{" "}
              <Link href="/lesson-builder/new" className="text-primary-900 hover:underline">Create your first lesson plan</Link>.
            </p>
          )}
          {!draftsLoading && drafts.length > 0 && (
            <div className="space-y-2">
              {drafts.slice(0, 4).map((draft) => (
                <div key={draft.id} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{draft.title || "Untitled draft"}</p>
                    <p className="text-xs text-muted">Updated {timeAgo(draft.updatedAt as { seconds: number } | null)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/lesson-builder/${draft.id}`}>
                      <Button type="button" variant="outline" size="sm">Open</Button>
                    </Link>
                    <Link href={`/lesson-builder/new?edit=${draft.id}`}>
                      <Button type="button" variant="ghost" size="sm">Edit</Button>
                    </Link>
                  </div>
                </div>
              ))}
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
          <Link href="/lesson-builder/new">
            <Button className="mt-4" size="sm">Create a Lesson Plan</Button>
          </Link>
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
