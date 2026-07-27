"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type User } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { getUser, followUser, unfollowUser, type UserProfile } from "@/lib/firestore/users";
import { computeProfileCompletion } from "@/lib/onboarding";
import {
  fetchAcceptedConnections,
  fetchConnectionQuota,
  fetchConnectionStatuses,
  fetchIncomingRequests,
  fetchNetworkSummary,
  fetchSentRequests,
} from "@/lib/network/client";
import { fetchConversations, fetchMessageQuota } from "@/lib/messages/client";
import { getFollowing } from "@/lib/firestore/follows";
import { getDiscoverCandidatePool } from "@/lib/discover/search";
import { isRecommendationEligible, rankRecommendedEducators, type RecommendationResult } from "@/lib/discover/recommendations";
import { getNotifications, normalizeNotificationLink, notifyNewFollower, type Notification } from "@/lib/notifications";
import { getCategories, getThreads, threadSlug, type ForumCategory, type ForumThread } from "@/lib/firestore/forums";
import { getResources, resourceSlug, type Resource } from "@/lib/firestore/resources";
import { getJobs, jobSlug, type Job } from "@/lib/firestore/jobs";
import DiscoverEducatorCard from "@/components/educators/discover/DiscoverEducatorCard";
import { Avatar, Badge, Card, EmptyState, Skeleton } from "@/components/ui";
import {
  buildActivationTasks,
  buildAttentionItems,
  classifyDashboardSectionOrder,
  classifyDashboardVariant,
  formatUsageSummary,
  getFirstName,
  resolveModuleState,
} from "@/lib/dashboard";
import { timeAgo } from "@/lib/utils";

type DashboardRecommendedEducator = RecommendationResult & {
  connectionState: "none" | "outgoing-pending" | "incoming-pending" | "connected";
  isFollowed: boolean;
};

type NetworkSummaryResponse = {
  connections: number;
  incoming: number;
  sent: number;
  quota: Awaited<ReturnType<typeof fetchConnectionQuota>>;
};

type AuthUser = User | null;

const RECOMMENDATION_LIMIT = 4;
const RESOURCE_LIMIT = 3;
const JOB_LIMIT = 3;
const COMMUNITY_LIMIT = 3;
const ACTIVITY_LIMIT = 4;

const ACTIVITY_TYPES = new Set<Notification["type"]>([
  "resource-shared",
  "lesson-shared",
  "comment",
  "comment-replied",
  "new-follower",
]);

function profileFallback(user: AuthUser): UserProfile {
  return {
    uid: user?.uid ?? "",
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
    photoURL: user?.photoURL ?? null,
    gradeLevel: "",
    gradeLevels: [],
    subjects: [],
    professionalRole: "",
    additionalRoles: [],
    professionalHeadline: "",
    curricula: [],
    country: "",
    city: "",
    languages: [],
    school: "",
    schoolType: "",
    yearsOfExperience: 0,
    bio: "",
    professionalInterests: [],
    networkingGoals: [],
    lookingFor: "",
    onboardingCompleted: false,
    onboardingVersion: 0,
    onboardingCurrentStep: 1,
    profileCompletion: 0,
    profileCardTheme: "classic",
    isVerified: false,
    createdAt: null,
    badges: [],
    followerCount: 0,
    followingCount: 0,
  };
}

function getProfileFilters(profile: UserProfile) {
  return {
    q: "",
    role: profile.professionalRole?.trim() ?? "",
    subject: profile.subjects?.[0] ?? "",
    grade: profile.gradeLevels?.[0] ?? profile.gradeLevel ?? "",
    curriculum: profile.curricula?.[0] ?? "",
    country: profile.country?.trim() ?? "",
    sort: "recommended" as const,
  };
}

function chooseRelevantCategories(profile: UserProfile | null, categories: ForumCategory[]): ForumCategory[] {
  const signals = [
    ...(profile?.subjects ?? []),
    ...(profile?.curricula ?? []),
    ...(profile?.professionalInterests ?? []),
    ...(profile?.networkingGoals ?? []),
    profile?.professionalRole ?? "",
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const scored = categories
    .map((category) => {
      const haystack = `${category.name} ${category.description} ${category.id}`.toLowerCase();
      const score = signals.reduce((sum, signal) => sum + (haystack.includes(signal) ? 1 : 0), 0);
      return { category, score };
    })
    .sort((a, b) => b.score - a.score || b.category.threadCount - a.category.threadCount || a.category.name.localeCompare(b.category.name));

  const matched = scored.filter((entry) => entry.score > 0).map((entry) => entry.category);
  if (matched.length > 0) return matched.slice(0, COMMUNITY_LIMIT);

  return [...categories]
    .sort((a, b) => b.threadCount - a.threadCount || a.name.localeCompare(b.name))
    .slice(0, COMMUNITY_LIMIT);
}

function safeTextPreview(value: string, max = 120): string {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function formatConversationTimestamp(value?: string): string {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Section({
  id,
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={className}>
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <h2 id={`${id}-title`} className="text-lg font-semibold text-foreground sm:text-xl">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
        {children}
      </Card>
    </section>
  );
}

function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
    >
      {label}
    </Link>
  );
}

export default function PersonalizedDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const [summary, setSummary] = useState<NetworkSummaryResponse | null>(null);
  const [conversations, setConversations] = useState<Awaited<ReturnType<typeof fetchConversations>>>([]);
  const [conversationError, setConversationError] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<Awaited<ReturnType<typeof fetchIncomingRequests>>>([]);
  const [sentRequests, setSentRequests] = useState<Awaited<ReturnType<typeof fetchSentRequests>>>([]);
  const [acceptedConnections, setAcceptedConnections] = useState<Awaited<ReturnType<typeof fetchAcceptedConnections>>>([]);
  const [followingProfiles, setFollowingProfiles] = useState<UserProfile[]>([]);
  const [connectionQuota, setConnectionQuota] = useState<Awaited<ReturnType<typeof fetchConnectionQuota>> | null>(null);
  const [messageQuota, setMessageQuota] = useState<Awaited<ReturnType<typeof fetchMessageQuota>> | null>(null);
  const [recommendations, setRecommendations] = useState<DashboardRecommendedEducator[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourcesError, setResourcesError] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState(false);
  const [communityThreads, setCommunityThreads] = useState<Array<{ category: ForumCategory; thread: ForumThread }>>([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [communityError, setCommunityError] = useState(false);
  const [activityItems, setActivityItems] = useState<Notification[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [followLoadingIds, setFollowLoadingIds] = useState<Set<string>>(new Set());
  const [connectionLoadingIds, setConnectionLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/login?redirect=${encodeURIComponent("/home")}`);
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user) {
        setProfile(null);
        setProfileResolved(true);
        return;
      }

      try {
        const data = await getUser(user.uid);
        if (!cancelled) {
          setProfile(data ?? profileFallback(user));
        }
      } catch {
        if (!cancelled) {
          setProfile(profileFallback(user));
        }
      } finally {
        if (!cancelled) {
          setProfileResolved(true);
        }
      }
    }

    setProfileResolved(false);
    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !profileResolved) return;

    let cancelled = false;
    setConversationError(false);

    async function loadNetworkData() {
      const currentUser = user;
      if (!currentUser) return;

      try {
        const token = await currentUser.getIdToken();
        const [summaryResult, conversationsResult, connectionQuotaResult, messageQuotaResult, incomingResult, acceptedResult, sentResult, followingResult] =
          await Promise.allSettled([
            fetchNetworkSummary(() => Promise.resolve(token)),
            fetchConversations(() => Promise.resolve(token)),
            fetchConnectionQuota(() => Promise.resolve(token)),
            fetchMessageQuota(() => Promise.resolve(token)),
            fetchIncomingRequests(() => Promise.resolve(token)),
            fetchAcceptedConnections(() => Promise.resolve(token)),
            fetchSentRequests(() => Promise.resolve(token)),
            getFollowing(currentUser.uid),
          ]);

        if (cancelled) return;

        if (summaryResult.status === "fulfilled") {
          setSummary(summaryResult.value);
        } else {
          setSummary(null);
        }

        if (conversationsResult.status === "fulfilled") {
          setConversations(conversationsResult.value);
        } else {
          setConversations([]);
          setConversationError(true);
        }

        setConnectionQuota(connectionQuotaResult.status === "fulfilled" ? connectionQuotaResult.value : null);
        setMessageQuota(messageQuotaResult.status === "fulfilled" ? messageQuotaResult.value : null);
        setIncomingRequests(incomingResult.status === "fulfilled" ? incomingResult.value : []);
        setAcceptedConnections(acceptedResult.status === "fulfilled" ? acceptedResult.value : []);
        setSentRequests(sentResult.status === "fulfilled" ? sentResult.value : []);
        setFollowingProfiles(followingResult.status === "fulfilled" ? followingResult.value : []);
      } catch {
        if (!cancelled) {
          setSummary(null);
          setConversationError(true);
          setIncomingRequests([]);
          setAcceptedConnections([]);
          setSentRequests([]);
          setFollowingProfiles([]);
          setConnectionQuota(null);
          setMessageQuota(null);
        }
      }
    }

    void loadNetworkData();

    return () => {
      cancelled = true;
    };
  }, [profileResolved, user]);

  useEffect(() => {
    if (!user || !profileResolved) return;

    let cancelled = false;
    setRecommendationsLoading(true);
    setRecommendationsError(false);

    async function loadRecommendations() {
      const currentUser = user;
      if (!currentUser) return;

      const currentProfile = profile ?? profileFallback(currentUser);

      if (!isRecommendationEligible(currentProfile)) {
        if (!cancelled) {
          setRecommendations([]);
          setRecommendationsLoading(false);
        }
        return;
      }

      try {
        const filters = getProfileFilters(currentProfile);
        const candidates = await getDiscoverCandidatePool(filters, 80);
        const excluded = new Set<string>([
          currentUser.uid,
          ...acceptedConnections.map((item) => item.otherUser?.uid ?? ""),
          ...incomingRequests.map((item) => item.otherUser?.uid ?? ""),
          ...sentRequests.map((item) => item.otherUser?.uid ?? ""),
          ...followingProfiles.map((item) => item.uid),
        ].filter(Boolean));

        const ranked = rankRecommendedEducators(currentProfile, candidates, {
          excludeUserIds: excluded,
          maxResults: RECOMMENDATION_LIMIT,
        });

        const ids = ranked.map((item) => item.educator.uid);
        const token = await currentUser.getIdToken();
        const connectionStates = ids.length > 0
          ? await fetchConnectionStatuses(() => Promise.resolve(token), ids)
          : {};
        const followingSet = new Set(followingProfiles.map((item) => item.uid));

        if (!cancelled) {
          setRecommendations(
            ranked.map((item) => ({
              ...item,
              connectionState: connectionStates[item.educator.uid]?.status ?? "none",
              isFollowed: followingSet.has(item.educator.uid),
            })),
          );
        }
      } catch {
        if (!cancelled) {
          setRecommendations([]);
          setRecommendationsError(true);
        }
      } finally {
        if (!cancelled) {
          setRecommendationsLoading(false);
        }
      }
    }

    void loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [acceptedConnections, followingProfiles, incomingRequests, profile, profileResolved, sentRequests, user]);

  useEffect(() => {
    if (!profileResolved) return;

    let cancelled = false;
    setResourcesLoading(true);
    setResourcesError(false);

    async function loadResources() {
      const currentProfile = profile ?? null;
      const filters = currentProfile
        ? {
            gradeLevel: currentProfile.gradeLevels?.[0] ?? currentProfile.gradeLevel ?? undefined,
            subject: currentProfile.subjects?.[0] || undefined,
            sortBy: "newest" as const,
          }
        : { sortBy: "newest" as const };

      try {
        const result = await getResources(filters, null, RESOURCE_LIMIT);
        if (!cancelled) {
          setResources(result.resources);
        }
      } catch {
        if (!cancelled) {
          setResources([]);
          setResourcesError(true);
        }
      } finally {
        if (!cancelled) {
          setResourcesLoading(false);
        }
      }
    }

    void loadResources();

    return () => {
      cancelled = true;
    };
  }, [profile, profileResolved]);

  useEffect(() => {
    if (!profileResolved) return;

    let cancelled = false;
    setJobsLoading(true);
    setJobsError(false);

    async function loadJobs() {
      const currentProfile = profile ?? null;
      const filters = currentProfile
        ? {
            gradeLevel: currentProfile.gradeLevels?.[0] ?? currentProfile.gradeLevel ?? undefined,
            subject: currentProfile.subjects?.[0] || undefined,
            location: currentProfile.country?.trim() || undefined,
          }
        : {};

      try {
        const result = await getJobs(filters, JOB_LIMIT);
        if (!cancelled) {
          setJobs(result.jobs);
        }
      } catch {
        if (!cancelled) {
          setJobs([]);
          setJobsError(true);
        }
      } finally {
        if (!cancelled) {
          setJobsLoading(false);
        }
      }
    }

    void loadJobs();

    return () => {
      cancelled = true;
    };
  }, [profile, profileResolved]);

  useEffect(() => {
    if (!profileResolved) return;

    let cancelled = false;
    setCommunityLoading(true);
    setCommunityError(false);

    async function loadCommunities() {
      try {
        const allCategories = await getCategories();
        const chosen = chooseRelevantCategories(profile, allCategories);
        const pairs = await Promise.all(
          chosen.map(async (category) => {
            try {
              const result = await getThreads(category.id);
              const thread = result.threads[0] ?? null;
              return thread ? { category, thread } : null;
            } catch {
              return null;
            }
          }),
        );

        if (!cancelled) {
          setCommunityThreads(pairs.filter((item): item is { category: ForumCategory; thread: ForumThread } => item !== null));
        }
      } catch {
        if (!cancelled) {
          setCommunityThreads([]);
          setCommunityError(true);
        }
      } finally {
        if (!cancelled) {
          setCommunityLoading(false);
        }
      }
    }

    void loadCommunities();

    return () => {
      cancelled = true;
    };
  }, [profile, profileResolved]);

  useEffect(() => {
    if (!user || !profileResolved) return;

    let cancelled = false;
    setActivityLoading(true);

    async function loadActivity() {
      const currentUser = user;
      if (!currentUser) return;

      try {
        const notifications = await getNotifications(currentUser.uid, 20);
        const actorIds = new Set<string>([
          ...acceptedConnections.map((item) => item.otherUser?.uid ?? ""),
          ...followingProfiles.map((item) => item.uid),
        ].filter(Boolean));

        const filtered = notifications.notifications
          .filter((item) => !item.dismissed)
          .filter((item) => ACTIVITY_TYPES.has(item.type))
          .filter((item) => actorIds.size === 0 || actorIds.has(item.actorId))
          .slice(0, ACTIVITY_LIMIT);

        if (!cancelled) {
          setActivityItems(filtered);
        }
      } catch {
        if (!cancelled) {
          setActivityItems([]);
        }
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
        }
      }
    }

    void loadActivity();

    return () => {
      cancelled = true;
    };
  }, [acceptedConnections, followingProfiles, profileResolved, user]);

  const effectiveProfile = profile ?? (user ? profileFallback(user) : null);
  const profileCompletion = computeProfileCompletion(effectiveProfile ?? profileFallback(user));
  const networkCounts = {
    connections: summary?.connections ?? acceptedConnections.length,
    incomingRequests: summary?.incoming ?? incomingRequests.length,
    sentRequests: summary?.sent ?? sentRequests.length,
    unreadConversations: conversations.reduce((sum, item) => sum + Math.max(0, item.unreadCount), 0),
    followers: effectiveProfile?.followerCount ?? 0,
    following: effectiveProfile?.followingCount ?? 0,
  };

  const dashboardVariant = classifyDashboardVariant({ profile: profileCompletion, counts: networkCounts });
  const sectionOrder = classifyDashboardSectionOrder(dashboardVariant);
  const attentionItems = buildAttentionItems({
    profile: profileCompletion,
    counts: networkCounts,
    connectionQuota,
    messageQuota,
  });
  const activationTasks = buildActivationTasks({
    profile: profileCompletion,
    counts: networkCounts,
    hasRecommendations: recommendations.length > 0,
    hasCommunities: communityThreads.length > 0,
  });
  const showCompletionModule = profileCompletion.percentage < 85 || !profileCompletion.minimumComplete;
  const firstName = getFirstName(effectiveProfile?.displayName ?? user?.displayName);
  const usageSummary = formatUsageSummary({
    tier: effectiveProfile?.tier === "plus" ? "plus" : "free",
    connectionQuota,
    messageQuota,
  });

  if (authLoading || !profileResolved) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const quickActions = [
    { href: "/discover", label: "Discover Educators" },
    { href: "/messages", label: "Open Messages" },
    { href: "/network", label: "Open Network" },
    { href: "/forums", label: "Explore Communities" },
  ].slice(0, 3);

  const resourceState = resolveModuleState({ loading: resourcesLoading, error: resourcesError, items: resources.length });
  const jobState = resolveModuleState({ loading: jobsLoading, error: jobsError, items: jobs.length });
  const communityState = resolveModuleState({ loading: communityLoading, error: communityError, items: communityThreads.length });
  const showExploreModule = sectionOrder.includes("communities") || sectionOrder.includes("resources") || sectionOrder.includes("jobs");

  return (
    <div className="space-y-6 pb-8">
      <div className="overflow-hidden rounded-3xl border border-primary-200 bg-linear-to-r from-primary-950 via-primary-900 to-primary-800 text-white shadow-card">
        <div className="flex flex-col gap-4 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="type-meta uppercase tracking-[0.22em] text-accent-300">Private dashboard</p>
            <h1 className="type-heading-strong mt-2 text-3xl font-extrabold text-white sm:text-4xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
              Your most useful updates, connections, and next steps in one place.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {profileCompletion.minimumComplete ? (
                <Badge variant="success" className="bg-white/12 text-white">Profile ready</Badge>
              ) : (
                <Badge variant="warning" className="bg-white/12 text-white">Profile needs attention</Badge>
              )}
              {effectiveProfile?.tier === "plus" ? (
                <Badge variant="success" className="bg-white/12 text-white">Plus member</Badge>
              ) : (
                <Badge variant="default" className="bg-white/12 text-white">Free member</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/discover" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-400 px-4 py-2 text-sm font-semibold text-primary-950 transition-colors hover:bg-accent-300">
              Discover Educators
            </Link>
            <Link href="/resources/upload" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15">
              Share Resource
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          {sectionOrder.includes("attention") && attentionItems.length > 0 && (
            <Section id="attention" title="Needs your attention" subtitle="Actionable items that help your network keep moving.">
              <div className="grid gap-3 md:grid-cols-2">
                {attentionItems.map((item) => (
                  <Card key={item.id} variant="stat" className="flex h-full flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                          <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                        </div>
                        {typeof item.count === "number" && <Badge variant="primary">{item.count}</Badge>}
                      </div>
                    </div>
                    <Link href={item.href} className="inline-flex w-fit min-h-10 items-center justify-center rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800">
                      {item.cta}
                    </Link>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {sectionOrder.includes("activation") && dashboardVariant === "new-user" && (
            <Section id="activation" title="Get started on VistaTeacher" subtitle="A short checklist for a strong first return.">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-secondary">Activation progress</p>
                    <p className="text-2xl font-bold text-foreground">
                      {activationTasks.filter((task) => task.completed).length}/{activationTasks.length}
                    </p>
                  </div>
                  <Link href="/profile/edit" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800">
                    Edit Profile
                  </Link>
                </div>

                <div className="space-y-3">
                  {activationTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
                      <p className="text-sm font-medium text-foreground">
                        <span className={task.completed ? "text-success-700" : "text-muted"} aria-hidden="true">
                          {task.completed ? "✓ " : "○ "}
                        </span>
                        {task.label}
                      </p>
                      <Link href={task.href} className="text-sm font-semibold text-primary-700 hover:underline">
                        {task.cta}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {sectionOrder.includes("recommendations") && (
            <Section id="recommendations" title="People you may want to meet" subtitle="Educators who share your professional context, interests, or goals." action={<SectionLink href="/discover" label="Discover More Educators" />}>
              {recommendationsLoading ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-72 rounded-2xl" />)}
                </div>
              ) : recommendationsError || recommendations.length === 0 ? (
                <Card>
                  <p className="text-sm font-semibold text-foreground">Improve your recommendations</p>
                  <p className="mt-1 text-sm text-text-secondary">Add your subjects, curriculum, interests, and networking goals.</p>
                  <div className="mt-4">
                    <Link href="/profile/edit" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800">
                      Complete Your Profile
                    </Link>
                  </div>
                </Card>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {recommendations.map((item) => (
                    <DiscoverEducatorCard
                      key={item.educator.uid}
                      educator={item.educator}
                      isOwnProfile={false}
                      isFollowed={item.isFollowed}
                      followLoading={followLoadingIds.has(item.educator.uid)}
                      connectionState={item.connectionState}
                      connectionLoading={connectionLoadingIds.has(item.educator.uid)}
                      connectionQuota={connectionQuota ?? null}
                      reasons={item.reasons.slice(0, 3).map((reason) => reason.label)}
                      onToggleFollow={async (educator) => {
                        if (!user) return;
                        setFollowLoadingIds((current) => new Set(current).add(educator.uid));
                        try {
                          if (item.isFollowed) {
                            await unfollowUser(user.uid, educator.uid);
                            setFollowingProfiles((current) => current.filter((entry) => entry.uid !== educator.uid));
                          } else {
                            await followUser(user.uid, educator.uid);
                            await notifyNewFollower({
                              recipientId: educator.uid,
                              actorId: user.uid,
                              actorName: user.displayName || "A VistaTeacher member",
                              actorPhotoURL: user.photoURL,
                            }).catch(() => {});
                            setFollowingProfiles((current) => [...current.filter((entry) => entry.uid !== educator.uid), educator]);
                          }
                        } finally {
                          setFollowLoadingIds((current) => {
                            const next = new Set(current);
                            next.delete(educator.uid);
                            return next;
                          });
                        }
                      }}
                      onSendConnectionRequest={async (educator, payload) => {
                        if (!user) return;
                        setConnectionLoadingIds((current) => new Set(current).add(educator.uid));
                        try {
                          const token = await user.getIdToken();
                          const result = await import("@/lib/network/client").then((mod) =>
                            mod.sendConnectionRequest(() => Promise.resolve(token), {
                              recipientId: educator.uid,
                              reason: payload.reason,
                              introMessage: payload.introMessage,
                            }),
                          );
                          setSentRequests((current) => [
                            {
                              participantKey: result.participantKey,
                              status: "pending",
                              requesterId: user.uid,
                              recipientId: educator.uid,
                              otherUser: {
                                uid: educator.uid,
                                displayName: educator.displayName,
                                photoURL: educator.photoURL,
                                professionalHeadline: educator.professionalHeadline,
                                professionalRole: educator.professionalRole,
                                country: educator.country,
                                city: educator.city,
                              },
                              reason: payload.reason,
                              introMessage: payload.introMessage,
                            },
                            ...current,
                          ]);
                        } finally {
                          setConnectionLoadingIds((current) => {
                            const next = new Set(current);
                            next.delete(educator.uid);
                            return next;
                          });
                        }
                      }}
                      onRespondToConnectionRequest={() => router.push("/network?tab=requests")}
                    />
                  ))}
                </div>
              )}
            </Section>
          )}

          {sectionOrder.includes("conversations") && (
            <Section id="conversations" title="Recent conversations" subtitle="Keep conversations moving with your accepted connections." action={<SectionLink href="/messages" label="Open Messages" />}>
              {conversationError ? (
                <Card>
                  <p className="text-sm text-text-secondary">We could not load your conversations right now.</p>
                  <div className="mt-3">
                    <Link href="/messages" className="text-sm font-semibold text-primary-700 hover:underline">Open Messages</Link>
                  </div>
                </Card>
              ) : conversations.length === 0 ? (
                <EmptyState
                  title="No conversations yet"
                  description="Connect with an educator and start exchanging ideas."
                  icon="✉️"
                  actionLabel="View Network"
                  onAction={() => router.push("/network")}
                />
              ) : (
                <div className="space-y-3">
                  {conversations.slice(0, 4).map((conversation) => (
                    <Link
                      key={conversation.conversationId}
                      href={`/messages/${conversation.conversationId}`}
                      className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-hover"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar
                          src={conversation.otherUser?.photoURL ?? null}
                          alt={conversation.otherUser?.displayName ?? "Deleted account"}
                          size="md"
                          userId={conversation.otherUser?.uid}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {conversation.otherUser?.displayName ?? "Deleted account"}
                              </p>
                              <p className="truncate text-xs text-text-secondary">
                                {conversation.otherUser?.professionalHeadline || conversation.otherUser?.professionalRole || "Professional educator"}
                              </p>
                            </div>
                            <p className="shrink-0 text-xs text-text-secondary">{formatConversationTimestamp(conversation.lastMessageAt)}</p>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-text-secondary">
                            {safeTextPreview(conversation.lastMessagePreview || "No messages yet", 150)}
                          </p>
                          {!conversation.canSend && <p className="mt-2 text-xs text-warning-700">Messaging is read-only because this connection is no longer active.</p>}
                          {conversation.unreadCount > 0 && (
                            <div className="mt-2">
                              <Badge variant="primary">{conversation.unreadCount} unread</Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Section>
          )}

          {sectionOrder.includes("network-activity") && (
            <Section id="network-activity" title="From your network" subtitle="Recent public contributions from educators you follow or connect with.">
              {activityLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)}
                </div>
              ) : activityItems.length === 0 ? (
                <Card>
                  <p className="text-sm text-text-secondary">Your network activity will appear here when connected educators share public work.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {activityItems.map((item) => (
                    <Link
                      key={item.id}
                      href={normalizeNotificationLink(item.linkURL)}
                      className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-hover"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar src={item.actorPhotoURL} alt={item.actorName} size="sm" userId={item.actorId} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-semibold text-foreground">{item.actorName}</p>
                            <p className="shrink-0 text-xs text-text-secondary">{timeAgo(item.createdAt as { seconds: number } | null)}</p>
                          </div>
                          <p className="mt-1 text-sm text-text-secondary">{safeTextPreview(item.message, 140)}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Section>
          )}

          {showExploreModule && (
            <Section id="explore" title="Explore" subtitle="A calmer view of communities, resources, and opportunities matched to your current profile.">
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-border bg-surface-subtle p-4">
                  <div className="border-b border-border/70 pb-3">
                    <h3 className="text-base font-semibold text-foreground">Communities</h3>
                    <p className="mt-1 text-sm text-text-secondary">Relevant discussions and educator conversation spaces.</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {communityState === "loading" ? (
                      Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-18 rounded-2xl" />)
                    ) : communityState === "error" ? (
                      <p className="text-sm text-text-secondary">Communities are temporarily unavailable.</p>
                    ) : communityThreads.length === 0 ? (
                      <p className="text-sm text-text-secondary">No relevant discussions yet.</p>
                    ) : (
                      communityThreads.slice(0, 2).map(({ category, thread }) => (
                        <Link
                          key={thread.id}
                          href={`/forums/${threadSlug(thread.title, thread.id)}`}
                          className="block rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-hover"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="primary">{category.name}</Badge>
                            <Badge variant="default">{thread.subject || thread.gradeLevel || "Discussion"}</Badge>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{thread.title}</p>
                          <p className="mt-1 text-xs text-text-secondary">{thread.commentCount} replies · {timeAgo(thread.createdAt as { seconds: number } | null)}</p>
                        </Link>
                      ))
                    )}
                    <SectionLink href="/forums" label="Explore Communities" />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface-subtle p-4">
                  <div className="border-b border-border/70 pb-3">
                    <h3 className="text-base font-semibold text-foreground">Resources</h3>
                    <p className="mt-1 text-sm text-text-secondary">Published teaching resources relevant to your context.</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {resourceState === "loading" ? (
                      Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
                    ) : resourceState === "error" ? (
                      <p className="text-sm text-text-secondary">Resources could not be loaded right now.</p>
                    ) : resources.length === 0 ? (
                      <p className="text-sm text-text-secondary">No matching resources yet.</p>
                    ) : (
                      resources.slice(0, 2).map((resource) => (
                        <Link
                          key={resource.id}
                          href={`/resources/${resourceSlug(resource.title, resource.id)}`}
                          className="block rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-hover"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="success">{resource.type}</Badge>
                            <Badge variant="default">{resource.gradeLevel}</Badge>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{resource.title}</p>
                          <p className="mt-1 text-xs text-text-secondary">{resource.authorName}</p>
                        </Link>
                      ))
                    )}
                    <SectionLink href="/resources" label="Browse Resources" />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface-subtle p-4">
                  <div className="border-b border-border/70 pb-3">
                    <h3 className="text-base font-semibold text-foreground">Opportunities</h3>
                    <p className="mt-1 text-sm text-text-secondary">Current public roles matched to your profile context.</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {jobState === "loading" ? (
                      Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
                    ) : jobState === "error" ? (
                      <p className="text-sm text-text-secondary">Jobs could not be loaded right now.</p>
                    ) : jobs.length === 0 ? (
                      <p className="text-sm text-text-secondary">No matching opportunities right now.</p>
                    ) : (
                      jobs.slice(0, 2).map((job) => (
                        <Link
                          key={job.id}
                          href={`/jobs/${jobSlug(job.title, job.id)}`}
                          className="block rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-hover"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="primary">{job.jobType}</Badge>
                            <Badge variant="default">{job.gradeLevel}</Badge>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{job.title}</p>
                          <p className="mt-1 text-xs text-text-secondary">{job.organization}</p>
                        </Link>
                      ))
                    )}
                    <SectionLink href="/jobs" label="Browse Jobs" />
                  </div>
                </div>
              </div>
            </Section>
          )}

          {showCompletionModule && (
            <Section id="profile-completion" title="Strengthen your profile" subtitle={`Your profile is ${profileCompletion.percentage}% complete.`} action={<SectionLink href="/profile/edit" label="Edit Profile" />}>
              <Card className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
                    <span>Profile completion</span>
                    <span>{profileCompletion.percentage}%</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary-100">
                    <div className="h-full rounded-full bg-primary-700" style={{ width: `${Math.min(100, profileCompletion.percentage)}%` }} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {profileCompletion.missingRecommended.slice(0, 3).map((field) => (
                    <div key={field} className="rounded-2xl border border-border bg-surface p-4">
                      <p className="text-sm font-semibold text-foreground">{field}</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {field === "Subjects"
                          ? "Helps educators find you by classroom focus."
                          : field === "Professional interests"
                            ? "Improves interest-based recommendations."
                            : field === "Curriculum"
                              ? "Clarifies the teaching context you work in."
                              : "Improves discoverability across the network."}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          )}

          {sectionOrder.includes("community-feed") && (
            <Section
              id="community-feed"
              title="Community feed"
              subtitle="The full feed lives on its own page so the dashboard can stay focused on network activity and next steps."
              action={<SectionLink href="/feed" label="Open Feed" />}
            >
              <div className="rounded-2xl border border-border bg-surface-subtle p-4">
                <p className="text-sm text-text-secondary">
                  Open the feed when you want a broader scan of posts from across the VistaTeacher community.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <SectionLink href="/feed" label="Open Full Feed" />
                </div>
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          {sectionOrder.includes("network-summary") && (
            <Section id="network-summary" title="Network summary" subtitle="Accurate counts and quick navigation." action={<SectionLink href="/network" label="Open Network" />}>
              <Card className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Connections", value: networkCounts.connections, href: "/network?tab=connections" },
                    { label: "Requests", value: networkCounts.incomingRequests, href: "/network?tab=requests" },
                    { label: "Following", value: networkCounts.following, href: "/network?tab=following" },
                    { label: "Followers", value: networkCounts.followers, href: "/network?tab=followers" },
                  ].map((item) => (
                    <Link key={item.label} href={item.href} className="rounded-2xl border border-border bg-surface p-3 transition-colors hover:bg-surface-hover">
                      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{item.label}</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{item.value}</p>
                    </Link>
                  ))}
                </div>
                <Link href="/messages" className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-hover">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Messages</p>
                    <p className="text-sm text-text-secondary">Unread conversations: {networkCounts.unreadConversations}</p>
                  </div>
                  <Badge variant="primary">{networkCounts.unreadConversations}</Badge>
                </Link>
                <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary">{usageSummary}</div>
              </Card>
            </Section>
          )}

          {sectionOrder.includes("quick-actions") && (
            <Section id="quick-actions" title="Quick actions" subtitle="Shortcuts to the next most useful surfaces.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {quickActions.map((action) => (
                  <Link key={action.href} href={action.href} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover">
                    {action.label}
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}