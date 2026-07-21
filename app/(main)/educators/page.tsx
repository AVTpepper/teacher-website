"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, type DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import {
  searchEducators,
  followUser,
  unfollowUser,
  GRADE_LEVELS,
  SUBJECTS,
  type UserProfile,
  type SearchEducatorsFilters,
} from "@/lib/firestore/users";
import { Avatar, Badge, Button, Card, Input, Select } from "@/components/ui";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import { notifyNewFollower } from "@/lib/notifications";
import { db } from "@/lib/firebase";

export default function EducatorsPage() {
  const { user } = useAuth();

  const [nameInput, setNameInput] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [country, setCountry] = useState("");

  // Debounce name input → nameQuery (400 ms)
  useEffect(() => {
    const timer = setTimeout(() => setNameQuery(nameInput), 400);
    return () => clearTimeout(timer);
  }, [nameInput]);

  const [educators, setEducators] = useState<UserProfile[]>([]);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());

  const filters: SearchEducatorsFilters = {
    gradeLevel: gradeLevel || undefined,
    subject: subject || undefined,
    country: country.trim() || undefined,
    nameQuery: nameQuery.trim() || undefined,
  };

  const fetchEducators = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const result = await searchEducators(
          filters,
          reset ? null : cursor
        );

        setEducators((prev) =>
          reset ? result.educators : [...prev, ...result.educators]
        );
        setCursor(result.lastDoc);
        setHasMore(result.lastDoc !== null);
      } catch (err) {
        console.error("searchEducators error:", err);
        setEducators([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gradeLevel, subject, country, nameQuery, cursor]
  );

  // Initial load + re-fetch on filter change
  useEffect(() => {
    setCursor(null);
    fetchEducators(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeLevel, subject, country, nameQuery]);

  // Load which educators the current user is already following
  useEffect(() => {
    if (!user || !db) return;
    getDocs(collection(db, "users", user.uid, "following"))
      .then((snap) => setFollowingSet(new Set(snap.docs.map((d) => d.id))))
      .catch(() => {});
  }, [user]);

  async function handleFollowToggle(educator: UserProfile) {
    if (!user) return;
    const isCurrentlyFollowing = followingSet.has(educator.uid);
    // Optimistic updates
    setFollowingSet((prev) => {
      const next = new Set(prev);
      if (isCurrentlyFollowing) next.delete(educator.uid);
      else next.add(educator.uid);
      return next;
    });
    setEducators((prev) =>
      prev.map((e) =>
        e.uid === educator.uid
          ? { ...e, followerCount: e.followerCount + (isCurrentlyFollowing ? -1 : 1) }
          : e
      )
    );
    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(user.uid, educator.uid);
      } else {
        await followUser(user.uid, educator.uid);
        notifyNewFollower({
          recipientId: educator.uid,
          actorId: user.uid,
          actorName: user.displayName ?? "Someone",
          actorPhotoURL: user.photoURL ?? null,
        }).catch(() => {});
      }
    } catch {
      // Revert on error
      setFollowingSet((prev) => {
        const next = new Set(prev);
        if (isCurrentlyFollowing) next.add(educator.uid);
        else next.delete(educator.uid);
        return next;
      });
      setEducators((prev) =>
        prev.map((e) =>
          e.uid === educator.uid
            ? { ...e, followerCount: e.followerCount + (isCurrentlyFollowing ? 1 : -1) }
            : e
        )
      );
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <DiscoveryShell
        title="Discover Educators"
        subtitle="Built for educators who plan boldly, share generously, and grow together."
        controls={
          <div className="flex flex-col gap-4">
            <div>
              <Input
                label="Search by name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Type an educator's name…"
                type="search"
              />
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
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
              <div className="flex-1">
                <Input
                  label="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Norway"
                />
              </div>
              {(gradeLevel || subject || country || nameInput) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGradeLevel("");
                    setSubject("");
                    setCountry("");
                    setNameInput("");
                    setNameQuery("");
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        }
      />

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : educators.length === 0 ? (
        <div className="py-20 text-center">
          <svg
            className="mx-auto h-12 w-12 text-secondary-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </svg>
          <h3 className="mt-3 text-sm font-medium text-foreground">
            No educators found
          </h3>
          <p className="mt-1 text-xs text-muted">
            {gradeLevel || subject || country.trim() || nameQuery
              ? "Try adjusting your search or filters."
              : "Be the first to create a profile!"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {educators.map((educator) => (
              <EducatorCard
                key={educator.uid}
                educator={educator}
                isOwnProfile={user?.uid === educator.uid}
                currentUid={user?.uid ?? null}
                isFollowed={followingSet.has(educator.uid)}
                onFollowToggle={handleFollowToggle}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                onClick={() => fetchEducators(false)}
                isLoading={loadingMore}
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EducatorCard({
  educator,
  isOwnProfile,
  currentUid,
  isFollowed,
  onFollowToggle,
}: {
  educator: UserProfile;
  isOwnProfile: boolean;
  currentUid: string | null;
  isFollowed: boolean;
  onFollowToggle: (educator: UserProfile) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleFollow() {
    if (loading) return;
    setLoading(true);
    try {
      await onFollowToggle(educator);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card hoverable className="flex h-full flex-col overflow-hidden border-primary-200 bg-linear-to-b from-surface to-secondary-50/35 p-0 text-center">
      <div className="h-2 w-full bg-linear-to-r from-primary-400 via-primary-600 to-primary-800" />
      <Link href={`/educators/${educator.uid}`} className="flex h-full flex-col items-center px-5 pt-6 pb-4 w-full min-w-0">
        <Avatar
          src={educator.photoURL}
          alt={educator.displayName}
          size="xl"
          className="ring-4 ring-surface shadow-[0_10px_24px_rgba(15,76,92,0.12)]"
        />

        <div className="mt-4 flex min-h-8 items-center justify-center gap-1.5">
          <h3 className="line-clamp-2 text-xl font-semibold leading-tight text-foreground">
            {educator.displayName}
          </h3>
          {educator.isVerified && (
            <svg
              className="h-4 w-4 text-success-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {isOwnProfile && (
            <Badge variant="default">You</Badge>
          )}
        </div>

        <div className="mt-2 min-h-11 space-y-1 rounded-xl px-3 py-2">
          {educator.gradeLevel && (
            <p className="text-sm font-medium text-muted">{educator.gradeLevel}</p>
          )}

          {educator.country && (
            <p className="flex items-center justify-center gap-1 text-sm text-muted">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z"
                />
              </svg>
              {educator.country}
            </p>
          )}
        </div>

        <div className="mt-3 flex min-h-16 flex-wrap content-start justify-center gap-1.5">
          {educator.subjects.length > 0 ? (
            <>
              {educator.subjects.slice(0, 3).map((s) => (
                <Badge key={s} variant="primary" className="bg-primary-50 text-primary-800">
                  {s}
                </Badge>
              ))}
              {educator.subjects.length > 3 && (
                <Badge variant="default" className="bg-secondary-50 text-secondary-800">
                  +{educator.subjects.length - 3}
                </Badge>
              )}
            </>
          ) : (
            <span className="rounded-full bg-secondary-50 px-3 py-1 text-xs text-muted">No subjects added yet</span>
          )}
        </div>
      </Link>

      <div className="mt-auto border-t border-primary-100/80 px-5 pb-5 pt-4">
        <p className="mb-4 text-sm text-muted">
          {educator.followerCount}{" "}
          {educator.followerCount === 1 ? "follower" : "followers"}
        </p>

        {currentUid && !isOwnProfile && (
          <Button
            size="sm"
            variant={isFollowed ? "outline" : "primary"}
            className={`w-full ${isFollowed ? "border-primary-200 bg-primary-50 text-primary-900 hover:bg-primary-100" : "bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900"}`}
            onClick={handleFollow}
            isLoading={loading}
          >
            {isFollowed ? "Following" : "Follow"}
          </Button>
        )}

        {isOwnProfile && (
          <div className="w-full rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-900">
            Your profile
          </div>
        )}
      </div>
    </Card>
  );
}
