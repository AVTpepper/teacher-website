"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getLessonsByAuthor, type Lesson } from "@/lib/firestore/lessons";
import { Badge, Button, Card } from "@/components/ui";

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

export default function LessonDraftsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Lesson[]>([]);

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
        const result = await getLessonsByAuthor(user.uid, true, null, 100);
        setDrafts(result.lessons.filter((lesson) => !lesson.isPublic));
      } catch {
        setError("Failed to load drafts.");
      } finally {
        setLoading(false);
      }
    }

    loadDrafts();
  }, [user]);

  return (
    <div className="py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lesson Drafts</h1>
          <p className="mt-1 text-sm text-muted">
            Continue editing your saved lesson drafts.
          </p>
        </div>
        <Link href="/lesson-builder">
          <Button type="button" variant="outline" size="sm">
            New Lesson
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <Card padding="lg" className="space-y-3">
        {loading && <p className="text-sm text-muted">Loading drafts...</p>}

        {!loading && drafts.length === 0 && (
          <p className="text-sm text-muted">No drafts found yet.</p>
        )}

        {!loading && drafts.length > 0 && (
          <div className="space-y-2">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="rounded-lg border border-border px-3 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {draft.title || "Untitled draft"}
                    </p>
                    <Badge variant="warning">Draft</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    Updated {timeAgo(draft.updatedAt as { seconds: number } | null)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/lesson-builder/${draft.id}`}>
                    <Button type="button" variant="outline" size="sm">
                      Open
                    </Button>
                  </Link>
                  <Link href={`/lesson-builder/new?edit=${draft.id}`}>
                    <Button type="button" variant="ghost" size="sm">
                      Edit
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
