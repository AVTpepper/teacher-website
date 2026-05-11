"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  subscribeToNotifications,
  markAsRead,
  markAllAsRead,
  type Notification,
  type NotificationType,
} from "@/lib/notifications";
import Avatar from "@/components/ui/Avatar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { timeAgo } from "@/lib/utils";

const TYPE_ICON: Record<NotificationType, string> = {
  "new-follower": "👤",
  comment: "💬",
  upvote: "⬆️",
  "badge-earned": "🏅",
  "resource-liked": "❤️",
  mention: "@",
};

// ---------------------------------------------------------------------------
// NotificationDropdown
// ---------------------------------------------------------------------------

export default function NotificationDropdown() {
  const { user } = useAuth();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Real-time listener — only runs when user is logged in
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeToNotifications(user.uid, 20, setNotifications);
    return unsub;
  }, [user]);

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

  async function handleNotificationClick(n: Notification) {
    setOpen(false);
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

  // Don't render the bell at all if not logged in
  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-muted hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-white text-[10px] font-bold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-border bg-surface shadow-xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-error text-white text-[10px] font-bold px-1">
                  {unreadCount}
                </span>
              )}
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-xs text-primary hover:underline disabled:opacity-50 cursor-pointer"
              >
                {markingAll ? "Marking…" : "Mark all as read"}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-105 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-3xl mb-2">🔔</p>
                <p className="text-sm text-foreground font-medium">All caught up!</p>
                <p className="text-xs text-muted mt-1">No notifications yet.</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover cursor-pointer ${
                        !n.read ? "bg-primary-50/40" : ""
                      }`}
                    >
                      {/* Actor avatar or type icon */}
                      <div className="shrink-0 mt-0.5">
                        {n.actorPhotoURL || n.actorName !== "EduConnect" ? (
                          <Avatar
                            src={n.actorPhotoURL}
                            alt={n.actorName}
                            size="sm"
                          />
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
                        <span className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2.5 text-center">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="text-xs text-primary hover:underline"
              >
                View profile & activity
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
