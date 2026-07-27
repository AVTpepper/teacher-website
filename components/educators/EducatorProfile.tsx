"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getUser,
  followUser,
  unfollowUser,
  isFollowing as checkIsFollowing,
  type UserProfile,
} from "@/lib/firestore/users";
import {
  getLessonsByAuthor,
  getLessonCountByAuthor,
  type Lesson,
} from "@/lib/firestore/lessons";
import {
  getPostsByAuthor,
  getPostCountByAuthor,
  type Post,
} from "@/lib/firestore/posts";
import {
  getResourcesByAuthor,
  getResourceCountByAuthor,
  resourceSlug,
  RESOURCE_TYPES,
  type Resource,
} from "@/lib/firestore/resources";
import {
  getThreadsByAuthor,
  getThreadCountByAuthor,
  threadSlug,
  type ForumThread,
} from "@/lib/firestore/forums";
import { getFollowers, getFollowing, isFollowing } from "@/lib/firestore/follows";
import { Avatar, Badge, Button, Card, Modal, Tabs } from "@/components/ui";
import ConnectionButton from "@/components/network/ConnectionButton";
import { notifyNewFollower } from "@/lib/notifications";
import { timeAgo } from "@/lib/utils";
import { getProfileCardThemeStyle } from "@/lib/profile-card-theme";
import { getSharedContextReasons } from "@/lib/profile/sharedContext";
import {
  ConnectionClientError,
  fetchConnectionQuota,
  fetchConnectionStatuses,
  sendConnectionRequest,
} from "@/lib/network/client";
import type { ConnectionQuotaSummary, ConnectionRelationshipState, ConnectionRequestReason } from "@/lib/network/types";
import { getOrCreateConversation } from "@/lib/messages/client";

interface TabCounts {
  posts: number;
  resources: number;
  lessons: number;
  discussions: number;
}

interface OverviewFeed {
  posts: Post[];
  resources: Resource[];
  lessons: Lesson[];
  discussions: ForumThread[];
}

type FollowListType = "followers" | "following";

interface FollowListRow {
  profile: UserProfile;
  isFollowedByViewer: boolean;
}

function toList(values?: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values ?? []) {
    const clean = value.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    normalized.push(clean);
  }

  return normalized;
}

function formatYearsOfExperience(years: number): string {
  if (years <= 0) return "New to the profession";
  if (years === 1) return "1 year of experience";
  return `${years} years of experience`;
}

function formatRelativeTime(value: { seconds: number } | null | undefined): string {
  return timeAgo(value ?? null);
}

function roleHeading(profile: UserProfile): string {
  if (profile.professionalHeadline?.trim()) {
    return profile.professionalHeadline.trim();
  }
  if (profile.professionalRole?.trim()) {
    return profile.professionalRole.trim();
  }
  return "Educator";
}

export default function EducatorProfile({ userId }: { userId: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [viewerProfile, setViewerProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionRelationshipState>("none");
  const [connectionQuota, setConnectionQuota] = useState<ConnectionQuotaSummary | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const [tabCounts, setTabCounts] = useState<TabCounts>({
    posts: 0,
    resources: 0,
    lessons: 0,
    discussions: 0,
  });

  const [activeTab, setActiveTab] = useState("overview");
  const tabsSectionRef = useRef<HTMLDivElement>(null);

  const [overviewFeed, setOverviewFeed] = useState<OverviewFeed>({
    posts: [],
    resources: [],
    lessons: [],
    discussions: [],
  });
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewLoaded, setOverviewLoaded] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);

  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [lessonsLoaded, setLessonsLoaded] = useState(false);

  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsLoaded, setThreadsLoaded] = useState(false);

  const [followListType, setFollowListType] = useState<FollowListType | null>(null);
  const [followListRows, setFollowListRows] = useState<FollowListRow[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListError, setFollowListError] = useState<string | null>(null);
  const [followListActionLoadingIds, setFollowListActionLoadingIds] = useState<Set<string>>(new Set());

  const isOwnProfile = user?.uid === userId;
  const canViewSensitiveProfileInfo = Boolean(user);

  const profileTabs = useMemo(
    () => [
      { label: "Overview", value: "overview" },
      { label: `Posts (${tabCounts.posts})`, value: "posts" },
      { label: `Resources (${tabCounts.resources})`, value: "resources" },
      { label: `Lessons (${tabCounts.lessons})`, value: "lessons" },
      { label: `Discussions (${tabCounts.discussions})`, value: "discussions" },
    ],
    [tabCounts],
  );

  const completion = profile?.profileCompletion ?? 0;
  const showCompletionPrompt = isOwnProfile && completion < 85;

  const sharedContextReasons = useMemo(() => {
    if (!profile || !viewerProfile) return [];
    return getSharedContextReasons(viewerProfile, profile);
  }, [profile, viewerProfile]);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      const node = tabsSectionRef.current;
      if (node && typeof node.scrollIntoView === "function") {
        node.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      try {
        const data = await getUser(userId);
        if (!data) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!cancelled) {
          setProfile(data);
          setNotFound(false);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) {
      setViewerProfile(null);
      return;
    }

    getUser(user.uid)
      .then((data) => {
        if (!cancelled) setViewerProfile(data);
      })
      .catch(() => {
        if (!cancelled) setViewerProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !userId || isOwnProfile) return;
    checkIsFollowing(user.uid, userId).then(setFollowing).catch(() => {});
  }, [user, userId, isOwnProfile]);

  useEffect(() => {
    let cancelled = false;
    if (!user || isOwnProfile) {
      setConnectionState("none");
      setConnectionQuota(null);
      return;
    }
    const currentUser = user;

    async function loadConnectionData() {
      try {
        const token = await currentUser.getIdToken();
        const [statuses, quota] = await Promise.all([
          fetchConnectionStatuses(() => Promise.resolve(token), [userId]),
          fetchConnectionQuota(() => Promise.resolve(token)),
        ]);

        if (cancelled) return;
        setConnectionState(statuses[userId]?.status ?? "none");
        setConnectionQuota(quota);
      } catch {
        if (!cancelled) {
          setConnectionState("none");
          setConnectionQuota(null);
        }
      }
    }

    void loadConnectionData();

    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, user, userId]);

  useEffect(() => {
    let cancelled = false;

    async function loadTabCounts() {
      try {
        const [postsCount, resourcesCount, lessonsCount, discussionsCount] = await Promise.all([
          getPostCountByAuthor(userId),
          getResourceCountByAuthor(userId),
          getLessonCountByAuthor(userId, isOwnProfile),
          getThreadCountByAuthor(userId),
        ]);

        if (!cancelled) {
          setTabCounts({
            posts: postsCount,
            resources: resourcesCount,
            lessons: lessonsCount,
            discussions: discussionsCount,
          });
        }
      } catch {
        if (!cancelled) {
          setTabCounts({ posts: 0, resources: 0, lessons: 0, discussions: 0 });
        }
      }
    }

    void loadTabCounts();

    return () => {
      cancelled = true;
    };
  }, [userId, isOwnProfile]);

  useEffect(() => {
    if (activeTab !== "overview" || overviewLoaded) return;
    let cancelled = false;

    async function loadOverviewFeed() {
      setOverviewLoading(true);
      try {
        const [postsResult, resourcesResult, lessonsResult, threadsResult] = await Promise.all([
          getPostsByAuthor(userId, 3),
          getResourcesByAuthor(userId, false, 3),
          getLessonsByAuthor(userId, false, null, 3),
          getThreadsByAuthor(userId, 3),
        ]);

        if (cancelled) return;

        setOverviewFeed({
          posts: postsResult.posts.slice(0, 3),
          resources: resourcesResult.resources.slice(0, 3),
          lessons: lessonsResult.lessons.filter((lesson) => lesson.isPublic).slice(0, 3),
          discussions: threadsResult.threads.slice(0, 3),
        });
      } catch {
        if (!cancelled) {
          setOverviewFeed({ posts: [], resources: [], lessons: [], discussions: [] });
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
          setOverviewLoaded(true);
        }
      }
    }

    void loadOverviewFeed();

    return () => {
      cancelled = true;
    };
  }, [activeTab, overviewLoaded, userId]);

  useEffect(() => {
    if (activeTab !== "posts" || postsLoaded) return;
    let cancelled = false;

    async function loadPosts() {
      setPostsLoading(true);
      try {
        const result = await getPostsByAuthor(userId);
        if (!cancelled) setPosts(result.posts);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) {
          setPostsLoading(false);
          setPostsLoaded(true);
        }
      }
    }

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, [activeTab, postsLoaded, userId]);

  useEffect(() => {
    if (activeTab !== "resources" || resourcesLoaded) return;
    let cancelled = false;

    async function loadResources() {
      setResourcesLoading(true);
      try {
        const result = await getResourcesByAuthor(userId);
        if (!cancelled) setResources(result.resources);
      } catch {
        if (!cancelled) setResources([]);
      } finally {
        if (!cancelled) {
          setResourcesLoading(false);
          setResourcesLoaded(true);
        }
      }
    }

    void loadResources();

    return () => {
      cancelled = true;
    };
  }, [activeTab, resourcesLoaded, userId]);

  useEffect(() => {
    if (activeTab !== "lessons" || lessonsLoaded) return;
    let cancelled = false;

    async function loadLessons() {
      setLessonsLoading(true);
      try {
        const result = await getLessonsByAuthor(userId, isOwnProfile, null, 100);
        if (!cancelled) setLessons(result.lessons);
      } catch {
        if (!cancelled) setLessons([]);
      } finally {
        if (!cancelled) {
          setLessonsLoading(false);
          setLessonsLoaded(true);
        }
      }
    }

    void loadLessons();

    return () => {
      cancelled = true;
    };
  }, [activeTab, lessonsLoaded, userId, isOwnProfile]);

  useEffect(() => {
    if (activeTab !== "discussions" || threadsLoaded) return;
    let cancelled = false;

    async function loadThreads() {
      setThreadsLoading(true);
      try {
        const result = await getThreadsByAuthor(userId);
        if (!cancelled) setThreads(result.threads);
      } catch {
        if (!cancelled) setThreads([]);
      } finally {
        if (!cancelled) {
          setThreadsLoading(false);
          setThreadsLoaded(true);
        }
      }
    }

    void loadThreads();

    return () => {
      cancelled = true;
    };
  }, [activeTab, threadsLoaded, userId]);

  useEffect(() => {
    const list = searchParams.get("list");
    if (list === "followers" || list === "following") {
      setFollowListType(list);
      return;
    }

    setFollowListType((current) => (current ? null : current));
  }, [searchParams]);

  useEffect(() => {
    if (!followListType) return;

    let cancelled = false;

    async function loadFollowList() {
      setFollowListLoading(true);
      setFollowListError(null);

      if (!user) {
        setFollowListRows([]);
        setFollowListError("Sign in to view followers and following.");
        setFollowListLoading(false);
        return;
      }

      try {
        const list = followListType === "followers"
          ? await getFollowers(userId, 200)
          : await getFollowing(userId, 200);

        if (cancelled) return;

        const statuses = await Promise.all(
          list.map((entry) =>
            entry.uid === user.uid ? Promise.resolve(false) : isFollowing(user.uid, entry.uid),
          ),
        );

        if (cancelled) return;

        setFollowListRows(
          list.map((profile, index) => ({
            profile,
            isFollowedByViewer: statuses[index] ?? false,
          })),
        );
      } catch {
        if (!cancelled) {
          setFollowListRows([]);
          setFollowListError("Unable to load this list right now.");
        }
      } finally {
        if (!cancelled) {
          setFollowListLoading(false);
        }
      }
    }

    void loadFollowList();

    return () => {
      cancelled = true;
    };
  }, [followListType, user, userId]);

  async function handleFollowToggle() {
    if (!user || !profile) return;
    setFollowLoading(true);
    setFollowError(null);

    const wasFollowing = following;
    const countDelta = wasFollowing ? -1 : 1;

    setFollowing(!wasFollowing);
    setProfile((current) =>
      current
        ? {
            ...current,
            followerCount: Math.max(0, current.followerCount + countDelta),
          }
        : current,
    );

    try {
      if (wasFollowing) {
        await unfollowUser(user.uid, profile.uid);
      } else {
        await followUser(user.uid, profile.uid);
        notifyNewFollower({
          recipientId: profile.uid,
          actorId: user.uid,
          actorName: user.displayName || "Someone",
          actorPhotoURL: user.photoURL,
        }).catch(() => {});
      }
    } catch {
      setFollowing(wasFollowing);
      setProfile((current) =>
        current
          ? {
              ...current,
              followerCount: Math.max(0, current.followerCount - countDelta),
            }
          : current,
      );
      setFollowError(
        wasFollowing
          ? "Could not unfollow. Please try again."
          : "Could not follow. Please try again.",
      );
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleSendConnectionRequest(payload: {
    reason?: ConnectionRequestReason;
    introMessage?: string;
  }) {
    if (!user || isOwnProfile) return;

    setConnectionLoading(true);
    setConnectionError(null);

    try {
      const token = await user.getIdToken(true);
      const result = await sendConnectionRequest(() => Promise.resolve(token), {
        recipientId: userId,
        reason: payload.reason,
        introMessage: payload.introMessage,
      });

      setConnectionState(result.status);
      const quota = await fetchConnectionQuota(() => Promise.resolve(token));
      setConnectionQuota(quota);
    } catch (error) {
      if (error instanceof ConnectionClientError && error.code === "MONTHLY_LIMIT_REACHED") {
        setConnectionQuota((current) =>
          current
            ? { ...current, canSend: false, remaining: 0 }
            : current,
        );
      }

      const message = error instanceof Error ? error.message : "Could not send request.";
      setConnectionError(message === "Session expired. Please sign in again." ? "Your session expired. Please refresh and try again." : message);
      throw error;
    } finally {
      setConnectionLoading(false);
    }
  }

  async function handleShareProfile() {
    if (typeof window === "undefined") return;

    const shareUrl = window.location.href;
    const sharePayload = {
      title: profile?.displayName ? `${profile.displayName} | VistaTeacher` : "VistaTeacher profile",
      text: profile?.professionalHeadline || profile?.bio || "Connect with this educator on VistaTeacher.",
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
        setShareMessage("Profile shared.");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage("Profile link copied.");
        return;
      }

      setShareMessage("Copy link from your browser address bar.");
    } catch {
      setShareMessage("Could not share right now. Please try again.");
    }
  }

  async function handleMessageEducator() {
    if (!user || !profile || isOwnProfile || connectionState !== "connected") return;
    setMessageLoading(true);
    setMessageError(null);

    try {
      const token = await user.getIdToken();
      const conversation = await getOrCreateConversation(() => Promise.resolve(token), profile.uid);
      router.push(`/messages/${conversation.conversationId}`);
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not open conversation.");
    } finally {
      setMessageLoading(false);
    }
  }

  function openFollowListModal(type: FollowListType) {
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/educators/${userId}?list=${type}`)}`);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("list", type);
    router.replace(`/educators/${userId}?${params.toString()}`, { scroll: false });
    setFollowListType(type);
  }

  function closeFollowListModal() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("list");
    const query = params.toString();
    router.replace(query ? `/educators/${userId}?${query}` : `/educators/${userId}`, { scroll: false });
    setFollowListType(null);
  }

  async function handleToggleFollowInList(targetUid: string) {
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/educators/${userId}`)}`);
      return;
    }

    const index = followListRows.findIndex((row) => row.profile.uid === targetUid);
    if (index === -1) return;

    const wasFollowing = followListRows[index]?.isFollowedByViewer ?? false;

    setFollowListActionLoadingIds((current) => new Set(current).add(targetUid));
    setFollowListRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, isFollowedByViewer: !wasFollowing } : row,
      ),
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
      setFollowListRows((current) =>
        current.map((row, rowIndex) =>
          rowIndex === index ? { ...row, isFollowedByViewer: wasFollowing } : row,
        ),
      );
    } finally {
      setFollowListActionLoadingIds((current) => {
        const next = new Set(current);
        next.delete(targetUid);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">Educator Not Found</h1>
        <p className="mt-2 text-sm text-muted">
          This profile doesn&apos;t exist or has been removed.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => router.push("/educators")}
        >
          Browse Educators
        </Button>
      </div>
    );
  }

  const subjects = toList(profile.subjects);
  const gradeLevels = toList([...(profile.gradeLevels ?? []), profile.gradeLevel]);
  const cardTheme = getProfileCardThemeStyle(profile.profileCardTheme, profile.tier);

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <section className="overflow-hidden rounded-2xl border border-primary-900/20 shadow-[0_8px_24px_rgba(7,36,42,0.22)]">
        <div className={`${cardTheme.gradientClass} p-6 text-white sm:p-8`}>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <Avatar
                src={profile.photoURL}
                alt={profile.displayName}
                size="xl"
                className="h-24! w-24! text-2xl!"
                userId={profile.uid}
                showPlusBadge
                isPlus={profile.tier === "plus"}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {profile.displayName}
                  </h1>
                  {profile.isVerified && <Badge variant="success">Verified</Badge>}
                  {profile.tier === "plus" && <Badge variant="info">Plus Member</Badge>}
                </div>
                <p className="mt-1 text-sm text-primary-100 sm:text-base">{roleHeading(profile)}</p>
                {profile.professionalRole && profile.professionalHeadline && (
                  <p className="mt-1 text-xs text-primary-200">{profile.professionalRole}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-white/90">
              {gradeLevels.slice(0, 2).map((grade) => (
                <span key={grade} className={`rounded-full border px-2 py-0.5 ${cardTheme.chipClass}`}>
                  {grade}
                </span>
              ))}
              {subjects.slice(0, 3).map((subject) => (
                <span key={subject} className={`rounded-full border px-2 py-0.5 ${cardTheme.chipClass}`}>
                  {subject}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-5 text-sm">
              <button
                type="button"
                onClick={() => openFollowListModal("followers")}
                className="cursor-pointer underline-offset-4 hover:underline"
              >
                <strong>{profile.followerCount}</strong> {profile.followerCount === 1 ? "Follower" : "Followers"}
              </button>
              <button
                type="button"
                onClick={() => openFollowListModal("following")}
                className="cursor-pointer underline-offset-4 hover:underline"
              >
                <strong>{profile.followingCount}</strong> Following
              </button>
            </div>

            <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {!authLoading && !isOwnProfile && user && (
                <div className="shrink-0">
                  <ConnectionButton
                    targetDisplayName={profile.displayName}
                    relationshipState={connectionState}
                    quota={connectionQuota}
                    loading={connectionLoading}
                    onSendRequest={handleSendConnectionRequest}
                    onRespond={() => router.push("/network?tab=requests")}
                  />
                </div>
              )}
              {!authLoading && !isOwnProfile && user && (
                <Button
                  size="sm"
                  variant={following ? "outline" : "primary"}
                  isLoading={followLoading}
                  onClick={handleFollowToggle}
                  className={`shrink-0 ${following ? "border-white/55 bg-white/10 text-white hover:bg-white/20 hover:border-white/80" : "bg-accent-300 text-primary-950 hover:bg-accent-200"}`}
                >
                  {following ? "Following" : "Follow"}
                </Button>
              )}
              {!authLoading && !isOwnProfile && user && connectionState === "connected" && (
                <Button size="sm" variant="outline" onClick={handleMessageEducator} isLoading={messageLoading} className="shrink-0 border-white/55 bg-white/10 text-white hover:bg-white/20 hover:border-white/80">
                  Message
                </Button>
              )}
              {isOwnProfile && (
                <Button size="sm" variant="outline" onClick={() => router.push("/profile/edit", { scroll: true })} className="shrink-0 border-white/55 bg-white/10 text-white hover:bg-white/20 hover:border-white/80">
                  Edit Profile
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleShareProfile} className="shrink-0 border-white/55 bg-white/10 text-white hover:bg-white/20 hover:border-white/80">
                Share Profile
              </Button>
            </div>
          </div>

          {followError && <p role="alert" className="mt-3 text-xs text-warning-200">{followError}</p>}
          {connectionError && <p role="alert" className="mt-2 text-xs text-warning-200">{connectionError}</p>}
          {messageError && <p role="alert" className="mt-2 text-xs text-warning-200">{messageError}</p>}
          {shareMessage && <p role="status" className="mt-2 text-xs text-primary-100">{shareMessage}</p>}
        </div>
      </section>

      {showCompletionPrompt && (
        <Card className="border-accent-200 bg-accent-50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-primary-900">Complete your professional profile</h2>
              <p className="mt-1 text-sm text-primary-800">
                You are at {completion}%. Add more context to help educators understand your expertise.
              </p>
            </div>
            <Button onClick={() => router.push("/profile/edit")}>Continue Editing</Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Achievements</h2>
          <Link href={`/educators/${userId}/achievements`}>
            <Button variant="outline" size="sm">View Progress</Button>
          </Link>
        </div>

        {(profile.showcaseBadges ?? []).length === 0 ? (
          <p className="text-sm text-muted">
            No profile badges selected yet.
          </p>
        ) : (
          <div>
            <div className="flex flex-wrap gap-2">
              {(profile.showcaseBadges ?? []).slice(0, 4).map((badgeName) => (
                <span
                  key={badgeName}
                  className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-900"
                >
                  {badgeName}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div ref={tabsSectionRef}>
        <Tabs tabs={profileTabs} defaultValue="overview" onChange={handleTabChange} />
        <Card className="mt-4 min-h-80" padding="lg">
          {activeTab === "overview" && (
            <OverviewTabContent
              profile={profile}
              canViewSensitiveProfileInfo={canViewSensitiveProfileInfo}
              sharedContextReasons={sharedContextReasons}
              overviewFeed={overviewFeed}
              loading={overviewLoading}
            />
          )}

          {activeTab === "posts" && (
            <PostsTabContent
              posts={posts}
              loading={postsLoading}
              isOwnProfile={isOwnProfile}
              displayName={profile.displayName}
            />
          )}

          {activeTab === "resources" && (
            <ResourcesTabContent
              resources={resources}
              loading={resourcesLoading}
              isOwnProfile={isOwnProfile}
              displayName={profile.displayName}
            />
          )}

          {activeTab === "lessons" && (
            <LessonsTabContent
              lessons={lessons}
              loading={lessonsLoading}
              isOwnProfile={isOwnProfile}
              displayName={profile.displayName}
            />
          )}

          {activeTab === "discussions" && (
            <DiscussionsTabContent
              threads={threads}
              loading={threadsLoading}
              isOwnProfile={isOwnProfile}
              displayName={profile.displayName}
            />
          )}
        </Card>
      </div>

      <Modal
        open={Boolean(followListType)}
        onClose={closeFollowListModal}
        title={
          followListType === "followers"
            ? `${profile.displayName}'s followers`
            : followListType === "following"
              ? `${profile.displayName} is following`
              : "Connections"
        }
      >
        {followListLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-secondary-100" />
            ))}
          </div>
        ) : followListError ? (
          <p className="text-sm text-error-700">{followListError}</p>
        ) : followListRows.length === 0 ? (
          <p className="text-sm text-muted">
            {followListType === "followers" ? "No followers yet." : "Not following anyone yet."}
          </p>
        ) : (
          <ul className="space-y-2">
            {followListRows.map((row) => (
              <li
                key={row.profile.uid}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
              >
                <Link
                  href={`/educators/${row.profile.uid}`}
                  onClick={closeFollowListModal}
                  className="min-w-0 flex flex-1 items-center gap-3"
                >
                  <Avatar
                    src={row.profile.photoURL}
                    alt={row.profile.displayName}
                    size="sm"
                    userId={row.profile.uid}
                    showPlusBadge
                    isPlus={row.profile.tier === "plus"}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{row.profile.displayName}</p>
                    <p className="truncate text-xs text-muted">
                      {row.profile.professionalHeadline?.trim() || row.profile.professionalRole?.trim() || "Professional educator"}
                    </p>
                  </div>
                </Link>

                {user && user.uid !== row.profile.uid && (
                  <Button
                    type="button"
                    size="sm"
                    variant={row.isFollowedByViewer ? "outline" : "primary"}
                    isLoading={followListActionLoadingIds.has(row.profile.uid)}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleToggleFollowInList(row.profile.uid);
                    }}
                  >
                    {row.isFollowedByViewer ? "Following" : "Follow"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

function OverviewTabContent({
  profile,
  canViewSensitiveProfileInfo,
  sharedContextReasons,
  overviewFeed,
  loading,
}: {
  profile: UserProfile;
  canViewSensitiveProfileInfo: boolean;
  sharedContextReasons: { id: string; label: string; detail: string }[];
  overviewFeed: OverviewFeed;
  loading: boolean;
}) {
  const gradeLevels = toList([...(profile.gradeLevels ?? []), profile.gradeLevel]);
  const subjects = toList(profile.subjects);
  const curricula = toList(profile.curricula);
  const languages = toList(profile.languages);
  const interests = toList(profile.professionalInterests);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-base font-semibold text-foreground">About</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-secondary-700">
          {profile.bio?.trim() || "This educator has not added an introduction yet."}
        </p>
      </section>

      {profile.lookingFor?.trim() && (
        <section>
          <h3 className="text-base font-semibold text-foreground">Looking For</h3>
          <p className="mt-2 whitespace-pre-line text-sm text-secondary-700">{profile.lookingFor}</p>
        </section>
      )}

      <section>
        <h3 className="text-base font-semibold text-foreground">Professional Context</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ContextItem label="Primary Role" value={profile.professionalRole || "Not set"} />
          <ContextItem label="Experience" value={formatYearsOfExperience(profile.yearsOfExperience)} />
          <ContextItem label="Grade Levels" value={gradeLevels.length > 0 ? gradeLevels.join(", ") : "Not set"} />
          <ContextItem label="Subjects" value={subjects.length > 0 ? subjects.join(", ") : "Not set"} />
          <ContextItem label="Curriculum" value={curricula.length > 0 ? curricula.join(", ") : "Not set"} />
          <ContextItem
            label="Languages"
            value={languages.length > 0 ? languages.join(", ") : "Not set"}
          />
          {canViewSensitiveProfileInfo && (
            <>
              <ContextItem label="Country" value={profile.country || "Not set"} />
              <ContextItem label="City" value={profile.city || "Not set"} />
              <ContextItem label="School" value={profile.school || "Not set"} />
              <ContextItem label="School Type" value={profile.schoolType || "Not set"} />
            </>
          )}
        </div>

        {!canViewSensitiveProfileInfo && (
          <p className="mt-3 text-xs text-muted">
            Sign in to view location and school context.
          </p>
        )}
      </section>

      {interests.length > 0 && (
        <section>
          <h3 className="text-base font-semibold text-foreground">Professional Interests</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {interests.map((interest) => (
              <Badge key={interest} variant="primary">{interest}</Badge>
            ))}
          </div>
        </section>
      )}

      {sharedContextReasons.length > 0 && (
        <section>
          <h3 className="text-base font-semibold text-foreground">Shared Context</h3>
          <ul className="mt-2 space-y-2">
            {sharedContextReasons.map((reason) => (
              <li key={reason.id} className="rounded-lg border border-primary-100 bg-primary-50/50 p-3">
                <p className="text-sm font-medium text-primary-900">{reason.label}</p>
                <p className="mt-0.5 text-xs text-primary-800">{reason.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">Recent Contributions</h3>
          <Link href="/feed" className="text-xs font-medium text-primary-800 hover:underline">
            View all activity
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <RecentContributionCard
              title="Posts"
              count={overviewFeed.posts.length}
              link="/feed"
              items={overviewFeed.posts.map((item) => ({
                id: item.id,
                title: item.content,
                subtitle: formatRelativeTime(item.createdAt as { seconds: number } | null),
                href: `/feed?post=${item.id}`,
              }))}
            />
            <RecentContributionCard
              title="Resources"
              count={overviewFeed.resources.length}
              link="/resources"
              items={overviewFeed.resources.map((item) => ({
                id: item.id,
                title: item.title,
                subtitle: `${item.type} • ${formatRelativeTime(item.createdAt as { seconds: number } | null)}`,
                href: `/resources/${resourceSlug(item.title, item.id)}`,
              }))}
            />
            <RecentContributionCard
              title="Lessons"
              count={overviewFeed.lessons.length}
              link="/lesson-builder"
              items={overviewFeed.lessons.map((item) => ({
                id: item.id,
                title: item.title || "Untitled lesson",
                subtitle: `${item.subject || "General"} • ${formatRelativeTime(item.updatedAt as { seconds: number } | null)}`,
                href: `/lesson-builder/${item.id}`,
              }))}
            />
            <RecentContributionCard
              title="Discussions"
              count={overviewFeed.discussions.length}
              link="/forums"
              items={overviewFeed.discussions.map((item) => ({
                id: item.id,
                title: item.title,
                subtitle: `${item.commentCount} comments • ${formatRelativeTime(item.createdAt as { seconds: number } | null)}`,
                href: `/forums/${threadSlug(item.title, item.id)}`,
              }))}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

function RecentContributionCard({
  title,
  count,
  link,
  items,
}: {
  title: string;
  count: number;
  link: string;
  items: Array<{ id: string; title: string; subtitle: string; href: string }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <span className="text-xs text-muted">{count}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted">No recent activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="group block rounded p-1 transition-colors hover:bg-surface-hover">
                <p className="line-clamp-1 text-sm text-foreground group-hover:underline">{item.title}</p>
                <p className="text-xs text-muted">{item.subtitle}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href={link} className="mt-3 inline-block text-xs font-medium text-primary-800 hover:underline">
        Open {title.toLowerCase()}
      </Link>
    </div>
  );
}

function PostsTabContent({
  posts,
  loading,
  isOwnProfile,
  displayName,
}: {
  posts: Post[];
  loading: boolean;
  isOwnProfile: boolean;
  displayName: string;
}) {
  const POSTS_PER_PAGE = 5;
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <EmptyTabContent
        title="No Posts Yet"
        description={isOwnProfile ? "Share your first post with the community." : `${displayName} hasn&apos;t posted yet.`}
        cta={
          isOwnProfile ? (
            <Link href="/home">
              <Button size="sm" className="mt-4">Create a Post</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  const visiblePosts = posts.slice(0, visibleCount);
  const hasMore = visibleCount < posts.length;

  return (
    <div className="space-y-3">
      {visiblePosts.map((post) => (
        <Link
          key={post.id}
          href={`/home?post=${post.id}`}
          className="block rounded-lg border border-border px-4 py-3 transition-colors hover:bg-surface-hover"
        >
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="primary">{post.type}</Badge>
            {post.gradeLevel && <span className="text-xs text-muted">{post.gradeLevel}</span>}
            <span className="text-xs text-muted">• {formatRelativeTime(post.createdAt as { seconds: number } | null)}</span>
          </div>
          <p className="line-clamp-3 text-sm text-foreground">{post.content}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted">
            <span>{post.likesCount} likes</span>
            <span>{post.commentCount} comments</span>
            {post.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-secondary-100 px-2 py-0.5 text-xs">{tag}</span>
            ))}
          </div>
        </Link>
      ))}

      {hasMore && (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => setVisibleCount((current) => current + POSTS_PER_PAGE)}
        >
          Show more ({posts.length - visibleCount} remaining)
        </Button>
      )}
    </div>
  );
}

function ResourcesTabContent({
  resources,
  loading,
  isOwnProfile,
  displayName,
}: {
  resources: Resource[];
  loading: boolean;
  isOwnProfile: boolean;
  displayName: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <EmptyTabContent
        title="No Resources Shared"
        description={isOwnProfile ? "Share a resource to help fellow educators." : `${displayName} hasn&apos;t shared resources yet.`}
        cta={
          isOwnProfile ? (
            <Link href="/resources/upload">
              <Button size="sm" className="mt-4">Upload a Resource</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {resources.map((resource) => {
        const typeLabel = RESOURCE_TYPES.find((item) => item.value === resource.type)?.label ?? resource.type;
        return (
          <Link key={resource.id} href={`/resources/${resourceSlug(resource.title, resource.id)}`}>
            <div className="flex h-full flex-col rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary-300 hover:bg-primary-50/40">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="primary">{typeLabel}</Badge>
                {resource.gradeLevel && <span className="text-xs text-muted">{resource.gradeLevel}</span>}
              </div>
              <p className="line-clamp-2 text-sm font-medium text-foreground">{resource.title}</p>
              {resource.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{resource.description}</p>}
              <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                <span>{resource.downloadCount} downloads</span>
                <span>{formatRelativeTime(resource.createdAt as { seconds: number } | null)}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function DiscussionsTabContent({
  threads,
  loading,
  isOwnProfile,
  displayName,
}: {
  threads: ForumThread[];
  loading: boolean;
  isOwnProfile: boolean;
  displayName: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <EmptyTabContent
        title="No Discussions"
        description={isOwnProfile ? "Start a discussion in the forums." : `${displayName} hasn&apos;t started any discussions yet.`}
        cta={
          isOwnProfile ? (
            <Link href="/forums">
              <Button size="sm" className="mt-4">Browse Forums</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {threads.map((thread) => (
        <Link key={thread.id} href={`/forums/${threadSlug(thread.title, thread.id)}`}>
          <div className="rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary-300 hover:bg-primary-50/40">
            <p className="line-clamp-2 text-sm font-medium text-foreground">{thread.title}</p>
            {thread.content && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{thread.content}</p>}
            <div className="mt-2 flex items-center gap-4 text-xs text-muted">
              <span>{thread.commentCount} comments</span>
              <span>{thread.upvotes} upvotes</span>
              <span>{formatRelativeTime(thread.createdAt as { seconds: number } | null)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function LessonsTabContent({
  lessons,
  loading,
  isOwnProfile,
  displayName,
}: {
  lessons: Lesson[];
  loading: boolean;
  isOwnProfile: boolean;
  displayName: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <EmptyTabContent
        title="No Lessons Created"
        description={isOwnProfile ? "Create your first lesson plan." : `${displayName} hasn&apos;t created lessons yet.`}
        cta={
          isOwnProfile ? (
            <Link href="/lesson-builder/new">
              <Button size="sm" className="mt-4">Create a Lesson Plan</Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  const published = lessons.filter((lesson) => lesson.isPublic);
  const drafts = lessons.filter((lesson) => !lesson.isPublic);

  return (
    <div className="space-y-6">
      {published.length > 0 && (
        <div>
          {isOwnProfile && (
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Published ({published.length})</h3>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {published.map((lesson) => (
              <LessonMiniCard key={lesson.id} lesson={lesson} isOwnProfile={isOwnProfile} />
            ))}
          </div>
        </div>
      )}

      {isOwnProfile && drafts.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Drafts ({drafts.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {drafts.map((lesson) => (
              <LessonMiniCard key={lesson.id} lesson={lesson} isOwnProfile={isOwnProfile} />
            ))}
          </div>
        </div>
      )}

      {isOwnProfile && (
        <div className="flex justify-end">
          <Link href="/lesson-builder/new">
            <Button variant="outline" size="sm">+ New Lesson Plan</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function LessonMiniCard({
  lesson,
  isOwnProfile,
}: {
  lesson: Lesson;
  isOwnProfile: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {lesson.isPublic ? <Badge variant="success">Published</Badge> : <Badge variant="default">Draft</Badge>}
          {lesson.gradeLevel && <span className="text-xs text-muted">{lesson.gradeLevel}</span>}
          {lesson.subject && <span className="text-xs text-muted">· {lesson.subject}</span>}
        </div>
        <p className="line-clamp-2 text-sm font-medium text-foreground">{lesson.title || "Untitled lesson"}</p>
        {lesson.objectives.length > 0 && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{lesson.objectives[0]}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Link href={`/lesson-builder/${lesson.id}`}>
          <Button type="button" variant="outline" size="sm">View</Button>
        </Link>
        {isOwnProfile && (
          <Link href={`/lesson-builder/new?edit=${lesson.id}`}>
            <Button type="button" variant="ghost" size="sm">Edit</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyTabContent({
  title,
  description,
  cta,
}: {
  title: string;
  description: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg
        className="h-12 w-12 text-secondary-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
      <h3 className="mt-3 text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted">{description}</p>
      {cta}
    </div>
  );
}
