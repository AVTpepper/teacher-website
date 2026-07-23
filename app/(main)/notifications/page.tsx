"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
  markNotificationsAsRead,
  markNotificationsAsUnread,
  deleteNotifications,
  deleteNotification,
  normalizeNotificationLink,
  type Notification,
  type NotificationType,
} from "@/lib/notifications";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { timeAgo } from "@/lib/utils";

const TYPE_ICON: Record<NotificationType, string> = {
  "new-follower": "👤",
  "connection-request": "🤝",
  "connection-accepted": "✅",
  "message-received": "✉️",
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

const PAGE_SIZE = 30;
type NotificationFilter = "all" | "unread";

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingSelected, setMarkingSelected] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
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
    router.push(normalizeNotificationLink(n.linkURL));
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

  function toggleSelected(notificationId: string) {
    setSelectedIds((prev) =>
      prev.includes(notificationId)
        ? prev.filter((id) => id !== notificationId)
        : [...prev, notificationId]
    );
  }

  function toggleSelectAll(checked: boolean, ids: string[]) {
    setSelectedIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...ids]));
      }
      return prev.filter((id) => !ids.includes(id));
    });
  }

  async function handleToggleSelectedReadState() {
    if (!user || selectedIds.length === 0 || markingSelected) return;

    const selectedNotifications = notifications.filter((notification) =>
      selectedIds.includes(notification.id)
    );
    const shouldMarkUnread =
      selectedNotifications.length > 0 &&
      selectedNotifications.every((notification) => notification.read);

    setMarkingSelected(true);
    try {
      if (shouldMarkUnread) {
        await markNotificationsAsUnread(user.uid, selectedIds);
      } else {
        await markNotificationsAsRead(user.uid, selectedIds);
      }

      setNotifications((prev) =>
        prev.map((notification) =>
          selectedIds.includes(notification.id)
            ? { ...notification, read: !shouldMarkUnread }
            : notification
        )
      );
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingSelected(false);
    }
  }

  async function handleConfirmDelete() {
    if (!user || pendingDeleteIds.length === 0 || deletingSelected) return;
    setDeletingSelected(true);
    try {
      if (pendingDeleteIds.length === 1) {
        await deleteNotification(user.uid, pendingDeleteIds[0]);
      } else {
        await deleteNotifications(user.uid, pendingDeleteIds);
      }
      setNotifications((prev) =>
        prev.filter((notification) => !pendingDeleteIds.includes(notification.id))
      );
      setSelectedIds((prev) => prev.filter((id) => !pendingDeleteIds.includes(id)));
      setPendingDeleteIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingSelected(false);
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
        <Button variant="primary" className="mt-4" onClick={() => router.push("/auth/login?redirect=/notifications")}>
          Sign In
        </Button>
      </div>
    );
  }

  const baseNotifications = notifications.filter((n) => !n.dismissed);
  const visibleNotifications = baseNotifications.filter((notification) =>
    filter === "unread" ? !notification.read : true
  );
  const visibleIds = visibleNotifications.map((notification) => notification.id);
  const unreadCount = baseNotifications.filter((n) => !n.read).length;
  const selectedVisibleCount = selectedIds.filter((id) => visibleIds.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const selectedNotifications = notifications.filter((notification) =>
    selectedIds.includes(notification.id)
  );
  const selectedAllRead =
    selectedNotifications.length > 0 &&
    selectedNotifications.every((notification) => notification.read);

  return (
    <div className="mx-auto max-w-2xl py-8">
      <ConfirmDialog
        isOpen={pendingDeleteIds.length > 0}
        onClose={() => setPendingDeleteIds([])}
        onConfirm={handleConfirmDelete}
        title={pendingDeleteIds.length === 1 ? "Delete notification" : "Delete selected notifications"}
        description={pendingDeleteIds.length === 1
          ? "This notification will be permanently deleted. This cannot be undone."
          : `${pendingDeleteIds.length} notifications will be permanently deleted. This cannot be undone.`}
        confirmLabel={pendingDeleteIds.length === 1 ? "Delete" : "Delete all"}
        isDestructive
        isLoading={deletingSelected}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([
            { value: "all", label: "All" },
            { value: "unread", label: "Unread" },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                filter === option.value
                  ? "bg-primary-900 text-white"
                  : "bg-secondary-100 text-secondary-700 hover:bg-secondary-200"
              }`}
            >
              {option.label}
            </button>
          ))}
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              isLoading={markingAll}
            >
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      )}

      {/* Empty */}
      {!loading && visibleNotifications.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-base font-medium text-foreground">No notifications yet</p>
          <p className="text-sm text-muted mt-1">You&apos;ll see activity here when others interact with your content.</p>
        </div>
      )}

      {/* List */}
      {!loading && visibleNotifications.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-hover/70 px-4 py-3">
            <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(e) => toggleSelectAll(e.target.checked, visibleIds)}
                className="h-4 w-4 rounded border-border text-primary-700 focus:ring-primary-500"
              />
              <span>
                {selectedVisibleCount > 0 ? `${selectedVisibleCount} selected` : "Select all on this page"}
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSelectedReadState}
                isLoading={markingSelected}
                disabled={selectedVisibleCount === 0}
              >
                {selectedAllRead ? "Mark selected unread" : "Mark selected read"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setPendingDeleteIds(selectedIds)}
                disabled={selectedVisibleCount === 0}
              >
                Delete selected
              </Button>
              {selectedVisibleCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                >
                  Clear selection
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {visibleNotifications.map((n) => {
              const isSelected = selectedIds.includes(n.id);

              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-4 transition-colors ${
                    isSelected
                      ? "bg-secondary-50"
                      : !n.read
                        ? "bg-primary-50/40"
                        : "bg-surface"
                  }`}
                >
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(n.id)}
                      aria-label={`Select notification: ${n.message}`}
                      className="h-4 w-4 rounded border-border text-primary-700 focus:ring-primary-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className="flex flex-1 items-start gap-3 text-left cursor-pointer"
                  >
                    <div className="shrink-0 mt-0.5">
                      {n.actorPhotoURL || n.actorName !== "VistaTeacher" ? (
                        <Avatar
                          src={n.actorPhotoURL}
                          alt={n.actorName}
                          size="sm"
                          userId={n.actorId}
                          showPlusBadge
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-100 text-base">
                          {TYPE_ICON[n.type]}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.read ? "font-medium text-foreground" : "text-secondary-700"}`}>
                        {n.message}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {timeAgo(n.createdAt as { seconds: number } | null)}
                      </p>
                    </div>

                    {!n.read && (
                      <span className="shrink-0 mt-2 h-2 w-2 rounded-full bg-primary-900" />
                    )}
                  </button>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setPendingDeleteIds([n.id])}
                      aria-label={`Delete notification: ${n.message}`}
                      className="rounded-md p-1 text-muted hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
