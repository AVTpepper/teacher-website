"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button, Card } from "@/components/ui";
import HorizontalScrollHint from "@/components/ui/HorizontalScrollHint";
import { BADGE_LIST, checkAndAwardBadges } from "@/lib/badges";
import { getUser, type UserProfile } from "@/lib/firestore/users";
import { getPostCountByAuthor } from "@/lib/firestore/posts";
import { getResourceCountByAuthor } from "@/lib/firestore/resources";
import { getLessonCountByAuthor } from "@/lib/firestore/lessons";
import { getThreadCountByAuthor } from "@/lib/firestore/forums";

interface ContentSummary {
  posts: number;
  resources: number;
  lessons: number;
  discussions: number;
}

type AchievementTier = "common" | "rare" | "epic";
type AchievementCategory = "verification" | "contribution" | "milestone" | "expertise";

const TIER_CLASS_MAP: Record<AchievementTier, string> = {
  common: "bg-secondary-100 text-secondary-800",
  rare: "bg-info-50 text-info-700",
  epic: "bg-warning-50 text-warning-700",
};

const CATEGORY_LABEL_MAP: Record<AchievementCategory, string> = {
  verification: "Verification",
  contribution: "Contribution",
  milestone: "Milestones",
  expertise: "Expertise",
};

function getAchievementTier(category: AchievementCategory): AchievementTier {
  if (category === "verification") return "epic";
  if (category === "milestone" || category === "expertise") return "rare";
  return "common";
}

function getReputationScore(contentSummary: ContentSummary | null, earnedCount: number): number {
  if (!contentSummary) return earnedCount * 8;
  const contentScore =
    contentSummary.posts * 2 +
    contentSummary.resources * 3 +
    contentSummary.lessons * 4 +
    contentSummary.discussions * 2;
  return contentScore + earnedCount * 8;
}

function getReputationLabel(score: number): string {
  if (score >= 220) return "Master Mentor";
  if (score >= 140) return "Community Leader";
  if (score >= 80) return "Trusted Contributor";
  if (score >= 30) return "Rising Educator";
  return "New Contributor";
}

function getBadgeProgress(
  badgeId: string,
  contentSummary: ContentSummary | null,
  earnedIds: Set<string>
): { current: number; target: number; label: string } | null {
  if (!contentSummary) return null;
  switch (badgeId) {
    case "resource-creator":
    case "first-resource":
      return { current: contentSummary.resources, target: 1, label: "resources shared" };
    case "lesson-builder":
      return { current: contentSummary.lessons, target: 1, label: "lessons created" };
    case "ten-lessons":
      return { current: contentSummary.lessons, target: 10, label: "lessons created" };
    case "discussion-starter":
      return { current: contentSummary.discussions, target: 1, label: "discussions started" };
    case "top-contributor": {
      const contributionIds = ["resource-creator", "lesson-builder", "discussion-starter", "community-helper"];
      const current = contributionIds.filter((id) => earnedIds.has(id)).length;
      return { current, target: 3, label: "contribution badges" };
    }
    default:
      return null;
  }
}

export default function EducatorAchievementsPage({ userId }: { userId: string }) {
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contentSummary, setContentSummary] = useState<ContentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [achievementCategoryFilter, setAchievementCategoryFilter] = useState<"all" | AchievementCategory>("all");
  const [achievementStatusFilter, setAchievementStatusFilter] = useState<"all" | "earned" | "locked">("all");
  const unlockCheckRef = useRef(false);

  const isOwnProfile = user?.uid === userId;

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [userProfile, postsCount, resourcesCount, lessonsCount, discussionsCount] = await Promise.all([
          getUser(userId),
          getPostCountByAuthor(userId),
          getResourceCountByAuthor(userId),
          getLessonCountByAuthor(userId, isOwnProfile),
          getThreadCountByAuthor(userId),
        ]);

        if (cancelled) return;

        if (userProfile) {
          setProfile(userProfile);
          setContentSummary({
            posts: postsCount,
            resources: resourcesCount,
            lessons: lessonsCount,
            discussions: discussionsCount,
          });
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setContentSummary({ posts: 0, resources: 0, lessons: 0, discussions: 0 });
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

  useEffect(() => {
    if (!isOwnProfile || unlockCheckRef.current) return;
    unlockCheckRef.current = true;

    let cancelled = false;
    async function refreshEarnedBadges() {
      try {
        const newlyAwarded = await checkAndAwardBadges(userId);
        if (cancelled || newlyAwarded.length === 0) return;

        setProfile((current) => {
          if (!current) return current;
          const merged = Array.from(new Set([...current.badges, ...newlyAwarded]));
          return { ...current, badges: merged };
        });
      } catch {
        // Keep page render stable if badge refresh fails.
      }
    }

    void refreshEarnedBadges();

    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, userId]);

  const earnedBadgeIds = useMemo(() => profile?.badges ?? [], [profile?.badges]);
  const earnedBadgeSet = useMemo(() => new Set(earnedBadgeIds), [earnedBadgeIds]);

  const allAchievementItems = useMemo(
    () =>
      BADGE_LIST.map((badge) => {
        const earned = earnedBadgeSet.has(badge.id);
        const tier = getAchievementTier(badge.category);
        const progress = earned
          ? null
          : getBadgeProgress(badge.id, contentSummary, earnedBadgeSet);
        const progressPercent =
          progress && progress.target > 0
            ? Math.min(100, Math.round((Math.min(progress.current, progress.target) / progress.target) * 100))
            : 0;
        return {
          ...badge,
          earned,
          tier,
          progress,
          progressPercent,
        };
      }),
    [earnedBadgeSet, contentSummary]
  );

  const filteredAchievementItems = useMemo(() => {
    return allAchievementItems.filter((item) => {
      if (achievementCategoryFilter !== "all" && item.category !== achievementCategoryFilter) {
        return false;
      }
      if (achievementStatusFilter === "earned" && !item.earned) return false;
      if (achievementStatusFilter === "locked" && item.earned) return false;
      return true;
    });
  }, [allAchievementItems, achievementCategoryFilter, achievementStatusFilter]);

  const reputationScore = useMemo(
    () => getReputationScore(contentSummary, earnedBadgeIds.length),
    [contentSummary, earnedBadgeIds.length]
  );
  const reputationLabel = useMemo(() => getReputationLabel(reputationScore), [reputationScore]);

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
          <h1 className="text-2xl font-bold text-foreground">{profile.displayName}&apos;s Achievements</h1>
          <p className="mt-1 text-sm text-muted">
            {earnedBadgeIds.length} earned of {BADGE_LIST.length} total
          </p>
        </div>
      </div>

      <Card className="mt-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryPill label="Reputation" value={reputationScore.toLocaleString()} subLabel={reputationLabel} />
          <SummaryPill label="Posts" value={(contentSummary?.posts ?? 0).toLocaleString()} />
          <SummaryPill label="Resources" value={(contentSummary?.resources ?? 0).toLocaleString()} />
          <SummaryPill label="Lessons" value={(contentSummary?.lessons ?? 0).toLocaleString()} />
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <div className="flex flex-col gap-3">

          <HorizontalScrollHint nudgeKey="achievements-status-filter">
            <div className="inline-flex min-w-max rounded-lg border border-border bg-background p-1">
            {(["all", "earned", "locked"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setAchievementStatusFilter(status)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  achievementStatusFilter === status
                    ? "bg-primary-900 text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {status}
              </button>
            ))}
            </div>
          </HorizontalScrollHint>

          <HorizontalScrollHint nudgeKey="achievements-category-filter">
            <div className="inline-flex min-w-max rounded-lg border border-border bg-background p-1">
            {(["all", "contribution", "milestone", "expertise", "verification"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setAchievementCategoryFilter(cat)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  achievementCategoryFilter === cat
                    ? "bg-primary-900 text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {cat === "all" ? "All" : CATEGORY_LABEL_MAP[cat]}
              </button>
            ))}
            </div>
          </HorizontalScrollHint>
        </div>

        {filteredAchievementItems.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border bg-background px-4 py-8 text-center text-sm text-muted">
            No achievements match your filters.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAchievementItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border px-4 py-3 ${
                  item.earned
                    ? "border-success-200 bg-success-50/40"
                    : "border-border bg-background"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.icon} {item.label}</p>
                    <p className="mt-1 text-xs text-muted">{item.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TIER_CLASS_MAP[item.tier]}`}>
                    {item.tier}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted">{CATEGORY_LABEL_MAP[item.category]}</span>
                  <span className={item.earned ? "font-semibold text-success-700" : "text-muted"}>
                    {item.earned ? "Earned" : "Locked"}
                  </span>
                </div>

                {!item.earned && item.progress && (
                  <div className="mt-2">
                    <p className="text-[11px] text-muted">
                      {Math.min(item.progress.current, item.progress.target)} / {item.progress.target} {item.progress.label}
                    </p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-secondary-100">
                      <div
                        className="h-1.5 rounded-full bg-primary-900"
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
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
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      {subLabel ? <p className="text-xs text-muted">{subLabel}</p> : null}
    </div>
  );
}
