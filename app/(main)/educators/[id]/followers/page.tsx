"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getUser, type UserProfile } from "@/lib/firestore/users";
import {
  getFollowers,
  followUser,
  unfollowUser,
  isFollowing,
} from "@/lib/firestore/follows";
import { notifyNewFollower } from "@/lib/notifications";
import { Avatar, Button } from "@/components/ui";

interface FollowerRow {
  profile: UserProfile;
  isFollowedByViewer: boolean;
}

export default function FollowersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [pageOwner, setPageOwner] = useState<UserProfile | null>(null);
  const [rows, setRows] = useState<FollowerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isOwnPage = !authLoading && user?.uid === id;

  // Redirect unauthenticated visitors
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [owner, followers] = await Promise.all([
          getUser(id),
          getFollowers(id),
        ]);
        setPageOwner(owner);

        // Check which followers the viewer already follows (skip self)
        const followStatuses = await Promise.all(
          followers.map((f) =>
            f.uid === user!.uid ? Promise.resolve(false) : isFollowing(user!.uid, f.uid)
          )
        );

        setRows(
          followers.map((profile, i) => ({
            profile,
            isFollowedByViewer: followStatuses[i],
          }))
        );
      } catch {
        setError("Unable to load followers. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, user, authLoading]);

  async function handleToggleFollow(targetUid: string) {
    if (!user) return;

    const idx = rows.findIndex((r) => r.profile.uid === targetUid);
    if (idx === -1) return;

    const wasFollowing = rows[idx].isFollowedByViewer;

    // Optimistic update
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, isFollowedByViewer: !wasFollowing } : r
      )
    );

    try {
      if (wasFollowing) {
        await unfollowUser(user.uid, targetUid);
      } else {
        await followUser(user.uid, targetUid);
        notifyNewFollower({
          recipientId: targetUid,
          actorId: user.uid,
          actorName: user.displayName || "Someone",
          actorPhotoURL: user.photoURL,
        }).catch(() => {});
      }
    } catch {
      // Revert optimistic update
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, isFollowedByViewer: wasFollowing } : r
        )
      );
      showToast("Something went wrong. Please try again.");
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-error-600">{error}</p>
      </div>
    );
  }

  const ownerName = pageOwner?.displayName ?? "This educator";

  return (
    <div className="mx-auto max-w-2xl py-8 px-4">
      {/* Toast */}
      {toastMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-foreground text-background px-4 py-2 text-sm shadow-lg"
        >
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {ownerName}&apos;s Followers
        </h1>
        <p className="mt-1 text-sm text-muted">
          {rows.length} {rows.length === 1 ? "person follows" : "people follow"}{" "}
          {ownerName}
        </p>
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <p className="text-center text-sm text-muted py-16">
          No followers yet.
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Followers list">
          {rows.map(({ profile, isFollowedByViewer }) => (
            <li
              key={profile.uid}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-card"
            >
              <Link
                href={`/educators/${profile.uid}`}
                aria-label={`View ${profile.displayName}'s profile`}
                className="shrink-0 focus-ring rounded-full"
              >
                <Avatar
                  src={profile.photoURL}
                  alt={profile.displayName}
                  size="lg"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/educators/${profile.uid}`}
                  className="font-semibold text-foreground hover:underline focus-ring rounded"
                >
                  {profile.displayName}
                </Link>
                {profile.bio && (
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {profile.bio}
                  </p>
                )}
              </div>

              {/* Follow/Unfollow — hidden on own page and for viewer's own card */}
              {!isOwnPage && user?.uid !== profile.uid && (
                <Button
                  variant={isFollowedByViewer ? "outline" : "primary"}
                  size="sm"
                  onClick={() => handleToggleFollow(profile.uid)}
                  aria-label={
                    isFollowedByViewer
                      ? `Unfollow ${profile.displayName}`
                      : `Follow ${profile.displayName}`
                  }
                >
                  {isFollowedByViewer ? "Following" : "Follow"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
