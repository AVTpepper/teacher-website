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
    <div className="pb-8">
      {/* Header */}
      <div className="-mx-4 -mt-4 mb-6 border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 rounded-t-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Directory</p>
        <h1 className="text-2xl font-bold">
          Discover Educators
        </h1>
        <p className="mt-1 text-sm text-primary-100/90">
          Find and connect with educators by grade level, subject, and more.
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <div className="flex flex-col gap-4">
          {/* Name search row */}
          <div>
            <Input
              label="Search by name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Type an educator's name…"
              type="search"
            />
          </div>
          {/* Grade + Subject + Country row */}
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
      </Card>

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
          {!user && (
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/auth/signup">
                <Button variant="secondary" size="sm">Create Account</Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" size="sm">Sign In</Button>
              </Link>
            </div>
          )}
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
    <Card hoverable className="flex flex-col items-center text-center">
      <Link href={`/educators/${educator.uid}`} className="flex flex-col items-center w-full">
        <Avatar
          src={educator.photoURL}
          alt={educator.displayName}
          size="xl"
        />

        <div className="mt-3 flex items-center gap-1.5">
          <h3 className="font-semibold text-foreground">
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

        {educator.gradeLevel && (
          <p className="mt-1 text-xs text-muted">{educator.gradeLevel}</p>
        )}

        {educator.country && (
          <p className="mt-0.5 text-xs text-muted flex items-center gap-1">
            <svg
              className="h-3 w-3"
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

        {educator.subjects.length > 0 && (
          <div className="mt-2.5 flex flex-wrap justify-center gap-1">
            {educator.subjects.slice(0, 3).map((s) => (
              <Badge key={s} variant="primary">
                {s}
              </Badge>
            ))}
            {educator.subjects.length > 3 && (
              <Badge variant="default">
                +{educator.subjects.length - 3}
              </Badge>
            )}
          </div>
        )}
      </Link>

      <p className="mt-2 text-xs text-muted">
        {educator.followerCount}{" "}
        {educator.followerCount === 1 ? "follower" : "followers"}
      </p>

      {currentUid && !isOwnProfile && (
        <Button
          size="sm"
          variant={isFollowed ? "outline" : "primary"}
          className="mt-3 w-full"
          onClick={handleFollow}
          isLoading={loading}
        >
          {isFollowed ? "Following" : "Follow"}
        </Button>
      )}
    </Card>
  );
}
