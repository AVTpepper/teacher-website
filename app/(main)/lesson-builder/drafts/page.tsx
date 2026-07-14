"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getLessonsByAuthor, deleteLesson, type Lesson } from "@/lib/firestore/lessons";
import { Badge, Button, Card, ConfirmDialog, Spinner } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export default function LessonDraftsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Lesson[]>([]);

  const isAvailable = process.env.NEXT_PUBLIC_AI_AVAILABLE === "true";

  useEffect(() => {
    async function loadDrafts() {
      if (!user) {
        setDrafts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const result = await getLessonsByAuthor(user.uid, true, null);
        setDrafts(result.lessons.filter((lesson) => !lesson.isPublic));
      } catch {
        setError("Failed to load drafts.");
      } finally {
        setLoading(false);
      }
    }

    loadDrafts();
  }, [user]);

  async function handleDelete(draft: Lesson) {
    try {
      await deleteLesson(draft.id);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    } catch {
      alert("Failed to delete draft. Please try again.");
    }
  }

  return (
    <div className="py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lesson Drafts</h1>
          <p className="mt-1 text-sm text-muted">
            Continue editing your saved lesson drafts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/lesson-builder">
            <Button type="button" variant="outline" size="sm">
              Back to Lesson Builder
            </Button>
          </Link>
          <Link href="/lesson-builder/new">
            <Button type="button" size="sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Lesson Plan
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <Card padding="lg" className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted py-2">
            <Spinner size="sm" />
            Loading drafts...
          </div>
        )}

        {!loading && drafts.length === 0 && (
          <p className="text-sm text-muted">No drafts found yet.</p>
        )}

        {!loading && drafts.length > 0 && (
          <div className="space-y-2">
            {drafts.map((draft) => (
              <DraftRow
                key={draft.id}
                draft={draft}
                isAvailable={isAvailable}
                onDelete={() => handleDelete(draft)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Draft row ─────────────────────────────────────────────────────────────

interface DraftRowProps {
  draft: Lesson;
  isAvailable: boolean;
  onDelete: () => void;
}

function DraftRow({ draft, isAvailable, onDelete }: DraftRowProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConfirmedDelete() {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmedDelete}
        title={`Delete "${draft.title || "Untitled draft"}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleting}
      />
      <div className="rounded-lg border border-border px-3 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">
            {draft.title || "Untitled draft"}
          </p>
          <Badge variant="warning">Draft</Badge>
        </div>
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
          <Button type="button" variant="outline" size="sm">
            Edit
          </Button>
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
