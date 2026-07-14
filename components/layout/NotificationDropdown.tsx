"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeToNotifications,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  dismissAllVisible,
  type Notification,
  type NotificationType,
} from "@/lib/notifications";
import Avatar from "@/components/ui/Avatar";
import { TextButton } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const DROPDOWN_LIMIT = 5;

// ---------------------------------------------------------------------------
// NotificationDropdown
// ---------------------------------------------------------------------------

export default function NotificationDropdown() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Hydration guard — don't render auth-dependent UI until client has mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [open, setOpen] = useState(false);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const [removingAll, setRemovingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Non-dismissed notifications shown in the dropdown
  const visibleNotifications = allNotifications
    .filter((n) => !n.dismissed)
    .slice(0, DROPDOWN_LIMIT);

  // Unread badge: total unread non-dismissed across all fetched
  const unreadTotal = allNotifications.filter((n) => !n.dismissed && !n.read).length;

  // Unread among the visible slice
  const unreadVisible = visibleNotifications.filter((n) => !n.read).length;

  // Extra unread beyond what the dropdown shows
  const extraUnread = unreadTotal - visibleNotifications.filter((n) => !n.read).length;

  // Real-time listener
  useEffect(() => {
    if (!user) { setAllNotifications([]); return; }
    const unsub = subscribeToNotifications(user.uid, DROPDOWN_LIMIT, setAllNotifications);
    return unsub;
  }, [user]);

  // Auto mark-all-read when dropdown is opened
  useEffect(() => {
    if (!open || !user) return;
    markAllAsRead(user.uid).catch(console.error);
    setAllNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [open, user]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleView(n: Notification) {
    if (!n.read && user) {
      markAsRead(user.uid, n.id).catch(console.error);
      setAllNotifications((prev) =>
        prev.map((item) => item.id === n.id ? { ...item, read: true } : item)
      );
    }
    setOpen(false);
    router.push(n.linkURL);
  }

  function handleMarkRead(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    if (n.read || !user) return;
    markAsRead(user.uid, n.id).catch(console.error);
    setAllNotifications((prev) =>
      prev.map((item) => item.id === n.id ? { ...item, read: true } : item)
    );
  }

  function handleDismiss(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    if (!user) return;
    dismissNotification(user.uid, n.id).catch(console.error);
    setAllNotifications((prev) =>
      prev.map((item) => item.id === n.id ? { ...item, dismissed: true } : item)
    );
  }

  async function handleMarkAllRead() {
    if (!user || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllAsRead(user.uid);
      setAllNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleRemoveAll() {
    if (!user || removingAll) return;
    setRemovingAll(true);
    try {
      const ids = visibleNotifications.map((n) => n.id);
      await dismissAllVisible(user.uid, ids);
      setAllNotifications((prev) =>
        prev.map((n) => ids.includes(n.id) ? { ...n, dismissed: true } : n)
      );
    } catch (err) {
      console.error(err);
    } finally {
      setRemovingAll(false);
    }
  }

  // Don't render until mounted (prevents hydration mismatch) or while auth resolves
  if (!mounted || authLoading || !user) return null;

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 transition-colors cursor-pointer text-primary-100 hover:bg-primary-800 hover:text-white"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadTotal > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error-500 text-white text-[10px] font-bold leading-none">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notifications"
          className="fixed left-4 right-4 top-14 rounded-xl border border-border bg-surface shadow-xl z-50 overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            {visibleNotifications.length > 0 && (
              <div className="flex items-center gap-3">
                {unreadVisible > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    className="text-xs text-primary-700 hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    {markingAll ? "Marking..." : "Mark all as read"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRemoveAll}
                  disabled={removingAll}
                  className="text-xs text-muted hover:text-foreground hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {removingAll ? "Removing..." : "Remove all"}
                </button>
              </div>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-105">
            {visibleNotifications.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-3xl mb-2">🔔</p>
                <p className="text-sm text-foreground font-medium">All caught up!</p>
                <p className="text-xs text-muted mt-1">No notifications yet.</p>
              </div>
            ) : (
              <ul>
                {visibleNotifications.map((n) => (
                  <li
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors ${
                      !n.read ? "bg-primary-50/40" : ""
                    }`}
                  >
                    {/* Avatar / type icon */}
                    <div className="shrink-0 mt-0.5">
                      {n.actorPhotoURL || n.actorName !== "EduConnect" ? (
                        <Avatar src={n.actorPhotoURL} alt={n.actorName} size="sm" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-100 text-base">
                          {TYPE_ICON[n.type]}
                        </span>
                      )}
                    </div>

                    {/* Message + actions */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleView(n)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleView(n);
                        }
                      }}
                    >
                      <p className={`text-sm leading-snug ${!n.read ? "font-medium text-foreground" : "text-secondary-700"}`}>
                        {n.message}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {timeAgo(n.createdAt as { seconds: number } | null)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        {!n.read && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkRead(e, n)}
                            className="text-xs text-muted hover:text-foreground cursor-pointer"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right side: unread dot + dismiss */}
                    <div className="shrink-0 flex flex-col items-center gap-2 mt-0.5">
                      {!n.read && (
                        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                      )}
                      <TextButton
                        type="button"
                        onClick={(e) => handleDismiss(e, n)}
                        aria-label="Dismiss notification"
                        className="p-0 text-muted hover:text-foreground"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </TextButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs text-primary-700 hover:underline"
            >
              View all notifications
              {extraUnread > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-error-500 text-white text-[10px] font-bold h-4 px-1.5 leading-none">
                  +{extraUnread}
                </span>
              )}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
