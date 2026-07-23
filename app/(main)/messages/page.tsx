"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, EmptyState, ErrorState } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { fetchConversations } from "@/lib/messages/client";
import type { ConversationListItem } from "@/lib/messages/types";

function formatLastActivity(value?: string): string {
  if (!value) return "No messages yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No messages yet";
  return date.toLocaleString();
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ConversationListItem[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/login?redirect=${encodeURIComponent("/messages")}`);
      return;
    }

    if (!authLoading && user) {
      const currentUser = user;

      fetchConversations(() => currentUser.getIdToken())
        .then(setItems)
        .catch(() => {
          setError("We could not load your conversations right now. Please try again.");
          setItems([]);
        })
        .finally(() => setLoading(false));
    }
  }, [authLoading, router, user]);

  const unreadTotal = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.unreadCount), 0),
    [items],
  );

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  if (error) {
    return <ErrorState message={error} onRetry={() => router.refresh()} />;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="mt-2 text-sm text-muted">
          Keep conversations moving with your accepted connections.
        </p>
        <p className="mt-3 text-sm font-medium text-foreground">
          Unread conversations: {unreadTotal}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="✉️"
          title="No conversations yet"
          description="Message an accepted connection from Network or an educator profile."
          actionLabel="Open Network"
          onAction={() => router.push("/network")}
        />
      ) : (
        <section className="space-y-3" aria-label="Conversations">
          {items.map((item) => (
            <Card key={item.conversationId} className="flex items-start justify-between gap-3">
              <Link
                href={`/messages/${item.conversationId}`}
                className="flex min-w-0 flex-1 items-start gap-3"
              >
                <Avatar
                  src={item.otherUser?.photoURL ?? null}
                  alt={item.otherUser?.displayName ?? "Deleted account"}
                  size="md"
                  userId={item.otherUser?.uid}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {item.otherUser?.displayName ?? "Deleted account"}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {item.lastMessagePreview?.trim() || "No messages yet"}
                  </p>
                  <p className="mt-1 text-xs text-muted">{formatLastActivity(item.lastMessageAt)}</p>
                  {!item.canSend && (
                    <p className="mt-1 text-xs text-warning-700">
                      Messaging is read-only because this connection is no longer active.
                    </p>
                  )}
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-2">
                {item.unreadCount > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
                    {item.unreadCount}
                  </span>
                )}
                <Link href={`/messages/${item.conversationId}`}>
                  <Button size="sm" variant="outline">Open</Button>
                </Link>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
