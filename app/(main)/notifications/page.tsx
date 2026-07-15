"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
  type Notification,
  type NotificationType,
} from "@/lib/notifications";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { timeAgo } from "@/lib/utils";

const TYPE_ICON: Record<NotificationType, string> = {
  "new-follower": "👤",
  comment: "💬",
  upvote: "⬆️",
  "badge-earned": "🏅",
  "resource-liked": "❤️",
  mention: "@",
  "lesson-rated": "⭐",
  "lesson-downloaded": "📥",
  "resource-downloaded": "📥",
  "lesson-shared": "🔗",
  "resource-shared": "🔗",
  "comment-replied": "↩️",
};

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const cursorRef = useRef<DocumentSnapshot | null>(null);

  async function load(reset: boolean) {
    if (!user) return;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const { notifications: fetched, lastDoc } = await getNotifications(
        user.uid,
        PAGE_SIZE,
        reset ? null : cursorRef.current
      );
      cursorRef.current = lastDoc;
      setHasMore(lastDoc !== null);
      setNotifications((prev) => (reset ? fetched : [...prev, ...fetched]));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      load(true);
      // Mark all as read when the page is visited
      markAllAsRead(user.uid).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  async function handleClick(n: Notification) {
    if (!n.read && user) {
      await markAsRead(user.uid, n.id).catch(console.error);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      );
    }
    router.push(n.linkURL);
  }

  async function handleMarkAllRead() {
    if (!user || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllAsRead(user.uid);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingAll(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold text-foreground">Sign in to view notifications</h2>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => router.push("/auth/signup?redirect=/notifications")}>
            Create Account
          </Button>
          <Button variant="primary" onClick={() => router.push("/auth/login?redirect=/notifications")}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Header */}
      <div className="-mx-4 -mt-4 mb-6 flex items-center justify-between border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 rounded-t-2xl">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Inbox</p>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-primary-100/90 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllRead}
            isLoading={markingAll}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      )}

      {/* Empty */}
      {!loading && notifications.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-base font-medium text-foreground">No notifications yet</p>
          <p className="text-sm text-muted mt-1">You&apos;ll see activity here when others interact with your content.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => router.push("/resources")}>Explore Resources</Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/forums")}>Browse Forums</Button>
          </div>
        </div>
      )}

      {/* List */}
      {!loading && notifications.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleClick(n)}
              className={`w-full flex items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-hover cursor-pointer ${
                !n.read ? "bg-primary-50/40" : "bg-surface"
              }`}
            >
              {/* Avatar / icon */}
              <div className="shrink-0 mt-0.5">
                {n.actorPhotoURL || n.actorName !== "TeacherlyConnect" ? (
                  <Avatar src={n.actorPhotoURL} alt={n.actorName} size="sm" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-100 text-base">
                    {TYPE_ICON[n.type]}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${!n.read ? "font-medium text-foreground" : "text-secondary-700"}`}>
                  {n.message}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {timeAgo(n.createdAt as { seconds: number } | null)}
                </p>
              </div>

              {/* Unread dot */}
              {!n.read && (
                <span className="shrink-0 mt-2 h-2 w-2 rounded-full bg-primary-900" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center mt-6">
          <Button variant="outline" onClick={() => load(false)} isLoading={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
