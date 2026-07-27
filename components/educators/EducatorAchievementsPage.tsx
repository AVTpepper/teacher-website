"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button, Card } from "@/components/ui";
import {
  collectionGroup,
  documentId,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import { getUser, updateUser, type UserProfile } from "@/lib/firestore/users";
import { getPostCountByAuthor } from "@/lib/firestore/posts";
import { getResourceCountByAuthor } from "@/lib/firestore/resources";
import { getLessonCountByAuthor } from "@/lib/firestore/lessons";
import { getThreadCountByAuthor } from "@/lib/firestore/forums";
import { db } from "@/lib/firebase";

const MAX_PROFILE_BADGES = 4;

interface InteractionSummary {
  likesGiven: number;
  commentsGiven: number;
  posts: number;
  resources: number;
  lessons: number;
  discussions: number;
  followers: number;
  following: number;
}

type InteractionKey = keyof InteractionSummary;

interface MilestoneDefinition {
  target: number;
  badgeName: string;
}

interface TrackDefinition {
  id: InteractionKey;
  title: string;
  valueLabel: string;
  milestones: MilestoneDefinition[];
}

interface TrackProgress extends TrackDefinition {
  value: number;
  currentMilestoneIndex: number;
  nextMilestone: MilestoneDefinition | null;
  previousTarget: number;
  progressToNextPercent: number;
  latestBadgeName: string | null;
}

const TRACK_DEFINITIONS: TrackDefinition[] = [
  {
    id: "likesGiven",
    title: "Giving Likes",
    valueLabel: "likes given",
    milestones: [
      { target: 10, badgeName: "Supporter" },
      { target: 50, badgeName: "Sore Thumb" },
      { target: 100, badgeName: "Cheerleader" },
      { target: 250, badgeName: "Hype Captain" },
      { target: 500, badgeName: "Community Amplifier" },
    ],
  },
  {
    id: "commentsGiven",
    title: "Commenting",
    valueLabel: "comments",
    milestones: [
      { target: 10, badgeName: "Reply Rookie" },
      { target: 30, badgeName: "Thread Weaver" },
      { target: 60, badgeName: "Feedback Friend" },
      { target: 120, badgeName: "Conversation Catalyst" },
      { target: 250, badgeName: "Comment Sensei" },
    ],
  },
  {
    id: "resources",
    title: "Resource Impact",
    valueLabel: "resources",
    milestones: [
      { target: 1, badgeName: "Spark Sharer" },
      { target: 5, badgeName: "Toolkit Starter" },
      { target: 15, badgeName: "Resource Ranger" },
      { target: 30, badgeName: "Library Builder" },
      { target: 60, badgeName: "Curriculum Curator" },
    ],
  },
  {
    id: "lessons",
    title: "Lesson Creation",
    valueLabel: "lessons",
    milestones: [
      { target: 1, badgeName: "Plan Sprinter" },
      { target: 5, badgeName: "Lesson Crafter" },
      { target: 12, badgeName: "Scope Commander" },
      { target: 25, badgeName: "Unit Architect" },
      { target: 50, badgeName: "Master Planner" },
    ],
  },
  {
    id: "discussions",
    title: "Forum Discussions",
    valueLabel: "discussions",
    milestones: [
      { target: 1, badgeName: "Icebreaker" },
      { target: 5, badgeName: "Prompt Pro" },
      { target: 12, badgeName: "Debate Driver" },
      { target: 25, badgeName: "Forum Flamekeeper" },
      { target: 50, badgeName: "Roundtable Host" },
    ],
  },
  {
    id: "followers",
    title: "Audience Growth",
    valueLabel: "followers",
    milestones: [
      { target: 5, badgeName: "Noticed" },
      { target: 25, badgeName: "Crowd Magnet" },
      { target: 75, badgeName: "Faculty Favorite" },
      { target: 150, badgeName: "Campus Voice" },
      { target: 300, badgeName: "Edu Influencer" },
    ],
  },
  {
    id: "following",
    title: "Network Reach",
    valueLabel: "following",
    milestones: [
      { target: 10, badgeName: "Explorer" },
      { target: 30, badgeName: "Connector" },
      { target: 75, badgeName: "Network Navigator" },
      { target: 150, badgeName: "Bridge Builder" },
      { target: 300, badgeName: "Community Cartographer" },
    ],
  },
  {
    id: "posts",
    title: "Posting",
    valueLabel: "posts",
    milestones: [
      { target: 3, badgeName: "Starter Voice" },
      { target: 10, badgeName: "Daily Dropper" },
      { target: 25, badgeName: "Feed Builder" },
      { target: 50, badgeName: "Conversation Engine" },
      { target: 100, badgeName: "Thought Leader" },
    ],
  },
];

async function getLikesGivenCount(uid: string): Promise<number> {
  if (!db) return 0;
  try {
    const likesQuery = query(
      collectionGroup(db, "likes"),
      where(documentId(), "==", uid),
    );
    const likesSnap = await getCountFromServer(likesQuery);
    return likesSnap.data().count;
  } catch {
    return 0;
  }
}

async function getCommentsGivenCount(uid: string): Promise<number> {
  if (!db) return 0;
  try {
    const commentsQuery = query(
      collectionGroup(db, "comments"),
      where("authorId", "==", uid),
    );
    const commentsSnap = await getCountFromServer(commentsQuery);
    return commentsSnap.data().count;
  } catch {
    return 0;
  }
}

function getTrackProgress(definition: TrackDefinition, value: number): TrackProgress {
  let currentMilestoneIndex = -1;
  for (let index = 0; index < definition.milestones.length; index += 1) {
    if (value >= definition.milestones[index]!.target) {
      currentMilestoneIndex = index;
    }
  }

  const nextMilestone = definition.milestones[currentMilestoneIndex + 1] ?? null;
  const previousTarget = currentMilestoneIndex >= 0
    ? (definition.milestones[currentMilestoneIndex]?.target ?? 0)
    : 0;

  let progressToNextPercent = 100;
  if (nextMilestone) {
    const range = Math.max(1, nextMilestone.target - previousTarget);
    progressToNextPercent = Math.min(
      100,
      Math.max(0, Math.round(((value - previousTarget) / range) * 100)),
    );
  }

  const latestBadgeName = currentMilestoneIndex >= 0
    ? (definition.milestones[currentMilestoneIndex]?.badgeName ?? null)
    : null;

  return {
    ...definition,
    value,
    currentMilestoneIndex,
    nextMilestone,
    previousTarget,
    progressToNextPercent,
    latestBadgeName,
  };
}

export default function EducatorAchievementsPage({ userId }: { userId: string }) {
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [interactionSummary, setInteractionSummary] = useState<InteractionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [savingBadges, setSavingBadges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const isOwnProfile = user?.uid === userId;

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [
          userProfile,
          postsCount,
          resourcesCount,
          lessonsCount,
          discussionsCount,
          likesGivenCount,
          commentsGivenCount,
        ] = await Promise.all([
          getUser(userId),
          getPostCountByAuthor(userId),
          getResourceCountByAuthor(userId),
          getLessonCountByAuthor(userId, isOwnProfile),
          getThreadCountByAuthor(userId),
          getLikesGivenCount(userId),
          getCommentsGivenCount(userId),
        ]);

        if (cancelled) return;

        if (userProfile) {
          setProfile(userProfile);
          setSelectedBadges((userProfile.showcaseBadges ?? []).slice(0, MAX_PROFILE_BADGES));
          setInteractionSummary({
            likesGiven: likesGivenCount,
            commentsGiven: commentsGivenCount,
            posts: postsCount,
            resources: resourcesCount,
            lessons: lessonsCount,
            discussions: discussionsCount,
            followers: userProfile.followerCount,
            following: userProfile.followingCount,
          });
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setInteractionSummary({
            likesGiven: 0,
            commentsGiven: 0,
            posts: 0,
            resources: 0,
            lessons: 0,
            discussions: 0,
            followers: 0,
            following: 0,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [userId, isOwnProfile]);

  const interactionTracks = useMemo(() => {
    if (!interactionSummary) return [];

    return TRACK_DEFINITIONS.map((definition) => {
      const value = interactionSummary[definition.id] ?? 0;
      return getTrackProgress(definition, value);
    });
  }, [interactionSummary]);

  const totalMilestones = useMemo(
    () => TRACK_DEFINITIONS.reduce((sum, track) => sum + track.milestones.length, 0),
    [],
  );

  const completedMilestones = useMemo(
    () => interactionTracks.reduce((sum, track) => sum + Math.max(0, track.currentMilestoneIndex + 1), 0),
    [interactionTracks],
  );

  const completionPercent = useMemo(() => {
    if (totalMilestones === 0) return 0;
    return Math.round((completedMilestones / totalMilestones) * 100);
  }, [completedMilestones, totalMilestones]);

  const earnedMilestoneBadges = useMemo(() => {
    const seen = new Set<string>();
    const earned: string[] = [];

    for (const track of interactionTracks) {
      for (let index = 0; index <= track.currentMilestoneIndex; index += 1) {
        const milestone = track.milestones[index];
        if (!milestone) continue;
        if (seen.has(milestone.badgeName)) continue;
        seen.add(milestone.badgeName);
        earned.push(milestone.badgeName);
      }
    }

    return earned;
  }, [interactionTracks]);

  const selectedBadgesSet = useMemo(() => new Set(selectedBadges), [selectedBadges]);

  const hasSelectionChanges = useMemo(() => {
    const current = (profile?.showcaseBadges ?? []).slice(0, MAX_PROFILE_BADGES);
    if (current.length !== selectedBadges.length) return true;
    return current.some((badge, index) => badge !== selectedBadges[index]);
  }, [profile?.showcaseBadges, selectedBadges]);

  function toggleBadgeSelection(badgeName: string) {
    setSaveMessage(null);
    setSelectedBadges((current) => {
      if (current.includes(badgeName)) {
        return current.filter((item) => item !== badgeName);
      }
      if (current.length >= MAX_PROFILE_BADGES) {
        return current;
      }
      return [...current, badgeName];
    });
  }

  async function saveSelectedBadges() {
    if (!isOwnProfile || !user) return;

    setSavingBadges(true);
    setSaveMessage(null);

    try {
      const nextBadges = selectedBadges
        .filter((badge) => earnedMilestoneBadges.includes(badge))
        .slice(0, MAX_PROFILE_BADGES);

      await updateUser(user.uid, { showcaseBadges: nextBadges });
      setProfile((current) => (current ? { ...current, showcaseBadges: nextBadges } : current));
      setSaveMessage("Profile badges updated.");
    } catch {
      setSaveMessage("Unable to save profile badges right now.");
    } finally {
      setSavingBadges(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl py-10 text-center">
        <p className="text-sm text-muted">Unable to load achievements right now.</p>
        <div className="mt-4">
          <Link href={`/educators/${userId}`}>
            <Button variant="outline">Back to profile</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Link href={`/educators/${userId}`} className="hover:text-foreground transition-colors">
            Profile
          </Link>
          <span>/</span>
          <span className="text-foreground">Achievements</span>
        </div>
        <Link href={`/educators/${userId}`}>
          <Button variant="outline" size="sm">Back</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{profile.displayName}&apos;s Progress</h1>
        </div>
      </div>

      <div className="mt-5">
        <SummaryPill label="Badges Unlocked" value={`${completedMilestones.toLocaleString()} / ${totalMilestones.toLocaleString()}`} subLabel={`${completionPercent}% complete`} />
      </div>

      <div className="mt-5 space-y-3">
        {interactionTracks.map((track) => (
          <Card key={track.id} className="border-accent-200 bg-accent-50/45 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{track.title}</p>
              <span className="shrink-0 rounded-full border border-accent-400 bg-white px-2 py-0.5 text-[11px] font-semibold text-accent-700">
                {Math.max(0, track.currentMilestoneIndex + 1)}/{track.milestones.length}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>Current</span>
              <span className="font-semibold text-foreground">{track.value.toLocaleString()} {track.valueLabel}</span>
            </div>

            <div className="mt-2 h-2 w-full rounded-full border border-accent-200 bg-white/90">
              <div className="h-2 rounded-full bg-accent-300" style={{ width: `${track.progressToNextPercent}%` }} />
            </div>

            <p className="mt-2 text-[11px] text-muted">
              {track.nextMilestone
                ? `${Math.min(track.value, track.nextMilestone.target)} / ${track.nextMilestone.target} ${track.valueLabel}`
                : "All milestones completed"}
            </p>

            <p className="mt-1 text-[11px] text-accent-700">
              {track.nextMilestone
                ? `Next badge: ${track.nextMilestone.badgeName}`
                : `Latest badge: ${track.latestBadgeName ?? "Completed"}`}
            </p>
          </Card>
        ))}
      </div>

      <div className="surface-panel mt-5 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Earned Badges</h2>
            <p className="text-xs text-muted">
              {isOwnProfile
                ? `Select up to ${MAX_PROFILE_BADGES} badges to show on your profile.`
                : "All badges unlocked so far."}
            </p>
          </div>

          {isOwnProfile && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{selectedBadges.length}/{MAX_PROFILE_BADGES} selected</span>
              <Button size="sm" onClick={saveSelectedBadges} isLoading={savingBadges} disabled={!hasSelectionChanges}>
                Save to Profile
              </Button>
            </div>
          )}
        </div>

        {earnedMilestoneBadges.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No badges earned yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {earnedMilestoneBadges.map((badgeName) => {
              const selected = selectedBadgesSet.has(badgeName);
              const selectionFull = !selected && selectedBadges.length >= MAX_PROFILE_BADGES;

              return (
                <button
                  key={badgeName}
                  type="button"
                  onClick={() => {
                    if (isOwnProfile) toggleBadgeSelection(badgeName);
                  }}
                  disabled={!isOwnProfile || selectionFull}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    selected
                      ? "border-primary-700 bg-primary-900 text-white"
                      : "border-secondary-300 bg-white text-foreground"
                  } ${
                    !isOwnProfile || selectionFull
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer hover:border-primary-400"
                  }`}
                >
                  {badgeName}
                </button>
              );
            })}
          </div>
        )}

        {saveMessage && <p className="mt-3 text-xs text-muted">{saveMessage}</p>}
      </div>

    </div>
  );
}

function SummaryPill({
  label,
  value,
  subLabel,
}: {
  label: string;
  value: string;
  subLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-secondary-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      {subLabel ? <p className="text-xs text-muted">{subLabel}</p> : null}
    </div>
  );
}
