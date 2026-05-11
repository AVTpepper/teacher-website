"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  type Lesson,
} from "@/lib/firestore/lessons";
import {
  getPostsByAuthor,
  type Post,
} from "@/lib/firestore/posts";
import {
  getResourcesByAuthor,
  resourceSlug,
  RESOURCE_TYPES,
  type Resource,
} from "@/lib/firestore/resources";
import {
  getThreadsByAuthor,
  threadSlug,
  type ForumThread,
} from "@/lib/firestore/forums";
import { Avatar, Badge, Button, Card, Tabs, Tag } from "@/components/ui";
import { BadgeList } from "@/components/badges/BadgeIcon";
import { BADGE_LIST } from "@/lib/badges";
import { notifyNewFollower } from "@/lib/notifications";

const PROFILE_TABS = [
  { label: "Posts", value: "posts" },
  { label: "Resources Shared", value: "resources" },
  { label: "Lessons Created", value: "lessons" },
  { label: "Discussions", value: "discussions" },
];

export default function EducatorProfile({ userId }: { userId: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [lessonsLoaded, setLessonsLoaded] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);

  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);

  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsLoaded, setThreadsLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState("posts");
  const tabsSectionRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 160);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    // After content settles, scroll so the tab bar is visible without losing the header
    requestAnimationFrame(() => {
      tabsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  const isOwnProfile = user?.uid === userId;

  useEffect(() => {
    async function load() {
      try {
        const data = await getUser(userId);
        if (!data) {
          setNotFound(true);
        } else {
          setProfile(data);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  // Check follow status
  useEffect(() => {
    if (!user || !userId || isOwnProfile) return;
    checkIsFollowing(user.uid, userId).then(setFollowing).catch(() => {});
  }, [user, userId, isOwnProfile]);

  // Lazy-load lessons when the tab becomes active
  useEffect(() => {
    if (activeTab !== "lessons" || lessonsLoaded) return;

    async function loadLessons() {
      setLessonsLoading(true);
      try {
        if (isOwnProfile) {
          // Own profile: show all lessons (published + drafts)
          const result = await getLessonsByAuthor(userId, true, null, 100);
          setLessons(result.lessons);
        } else {
          // Other profiles: only published
          const result = await getLessonsByAuthor(userId, false, null, 100);
          setLessons(result.lessons);
        }
      } catch {
        setLessons([]);
      } finally {
        setLessonsLoading(false);
        setLessonsLoaded(true);
      }
    }

    loadLessons();
  }, [activeTab, lessonsLoaded, isOwnProfile, userId]);

  // Lazy-load posts when the tab becomes active
  useEffect(() => {
    if (activeTab !== "posts" || postsLoaded) return;
    async function loadPosts() {
      setPostsLoading(true);
      try {
        const result = await getPostsByAuthor(userId);
        setPosts(result.posts);
      } catch {
        setPosts([]);
      } finally {
        setPostsLoading(false);
        setPostsLoaded(true);
      }
    }
    loadPosts();
  }, [activeTab, postsLoaded, userId]);

  // Lazy-load resources when the tab becomes active
  useEffect(() => {
    if (activeTab !== "resources" || resourcesLoaded) return;
    async function loadResources() {
      setResourcesLoading(true);
      try {
        const result = await getResourcesByAuthor(userId);
        setResources(result.resources);
      } catch {
        setResources([]);
      } finally {
        setResourcesLoading(false);
        setResourcesLoaded(true);
      }
    }
    loadResources();
  }, [activeTab, resourcesLoaded, userId]);

  // Lazy-load forum threads when the tab becomes active
  useEffect(() => {
    if (activeTab !== "discussions" || threadsLoaded) return;
    async function loadThreads() {
      setThreadsLoading(true);
      try {
        const result = await getThreadsByAuthor(userId);
        setThreads(result.threads);
      } catch {
        setThreads([]);
      } finally {
        setThreadsLoading(false);
        setThreadsLoaded(true);
      }
    }
    loadThreads();
  }, [activeTab, threadsLoaded, userId]);

  async function handleFollowToggle() {
    if (!user || !profile) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(user.uid, profile.uid);
        setFollowing(false);
        setProfile((p) =>
          p ? { ...p, followerCount: Math.max(0, p.followerCount - 1) } : p
        );
      } else {
        await followUser(user.uid, profile.uid);
        setFollowing(true);
        setProfile((p) =>
          p ? { ...p, followerCount: p.followerCount + 1 } : p
        );
        // Notify the followed user (fire-and-forget)
        notifyNewFollower({
          recipientId: profile.uid,
          actorId: user.uid,
          actorName: user.displayName || "Someone",
          actorPhotoURL: user.photoURL,
        }).catch(() => {});
      }
    } catch {
      // Silently fail
    } finally {
      setFollowLoading(false);
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
        <h1 className="text-2xl font-bold text-foreground">
          Educator Not Found
        </h1>
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

  return (
    <div className="mx-auto max-w-3xl py-8">
      {/* Profile Header */}
      <Card
        padding="none"
        className={`sticky top-14 z-10 ${isScrolled ? "p-3 sm:p-6" : "p-6"}`}
      >
        {/* Compact header — mobile only, visible when scrolled past full header */}
        {isScrolled && (
          <div className="flex sm:hidden items-center gap-3">
            <Avatar src={profile.photoURL} alt={profile.displayName} size="sm" />
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground truncate">
                {profile.displayName}
              </span>
              {profile.isVerified && (
                <svg className="h-3.5 w-3.5 shrink-0 text-success-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            {!authLoading && (
              <div className="shrink-0">
                {!isOwnProfile ? (
                  <Button
                    size="sm"
                    variant={following ? "outline" : "primary"}
                    onClick={handleFollowToggle}
                    isLoading={followLoading}
                  >
                    {following ? "Following" : "Follow"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push("/profile/edit")}
                  >
                    Edit
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Full header — always on sm+, mobile only when not scrolled */}
        <div className={isScrolled ? "hidden sm:block" : undefined}>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar */}
          <Avatar
            src={profile.photoURL}
            alt={profile.displayName}
            size="xl"
            className="h-24! w-24! text-2xl!"
          />

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <h1 className="text-2xl font-bold text-foreground">
                {profile.displayName}
              </h1>
              {profile.isVerified && (
                <Badge variant="success">
                  <span className="flex items-center gap-1">
                    <svg
                      className="h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Verified
                  </span>
                </Badge>
              )}
            </div>

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted sm:justify-start">
              {profile.gradeLevel && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"
                    />
                  </svg>
                  {profile.gradeLevel}
                </span>
              )}
              {profile.school && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"
                    />
                  </svg>
                  {profile.school}
                </span>
              )}
              {profile.location && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
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
                  {profile.location}
                </span>
              )}
              {profile.yearsOfExperience > 0 && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  {profile.yearsOfExperience} yr{profile.yearsOfExperience !== 1 && "s"} experience
                </span>
              )}
            </div>

            {/* Subjects */}
            {profile.subjects.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {profile.subjects.map((s) => (
                  <Badge key={s} variant="primary">
                    {s}
                  </Badge>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="mt-4 flex items-center justify-center gap-6 text-sm sm:justify-start">
              <span>
                <strong className="text-foreground">
                  {profile.followerCount}
                </strong>{" "}
                <span className="text-muted">
                  {profile.followerCount === 1 ? "Follower" : "Followers"}
                </span>
              </span>
              <span>
                <strong className="text-foreground">
                  {profile.followingCount}
                </strong>{" "}
                <span className="text-muted">Following</span>
              </span>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="mt-4 whitespace-pre-line text-sm text-secondary-600">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {!authLoading && !isOwnProfile && (
          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
            <Button
              variant={following ? "outline" : "primary"}
              isLoading={followLoading}
              onClick={handleFollowToggle}
            >
              {following ? "Following" : "Follow"}
            </Button>
            <Button variant="secondary" disabled>
              Message
            </Button>
          </div>
        )}

        {isOwnProfile && (
          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => router.push("/profile/edit")}
            >
              Edit Profile
            </Button>
          </div>
        )}
        </div> {/* /full header wrapper */}
      </Card>

      {/* Badges Section */}
      {profile.badges.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Achievements</h2>
          {(["verification", "contribution", "milestone", "expertise"] as const).map((cat) => {
            const catBadges = profile.badges.filter(
              (id) => BADGE_LIST.find((b) => b.id === id)?.category === cat
            );
            if (catBadges.length === 0) return null;
            const catLabel = { verification: "Verification", contribution: "Contribution", milestone: "Milestones", expertise: "Expertise" }[cat];
            return (
              <div key={cat} className="mb-4 last:mb-0">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{catLabel}</p>
                <BadgeList badgeIds={catBadges} />
              </div>
            );
          })}
        </Card>
      )}

      {/* Content Tabs */}
      <div className="mt-6" ref={tabsSectionRef}>
        <Tabs
          tabs={PROFILE_TABS}
          defaultValue="posts"
          onChange={handleTabChange}
        />
        <Card className="mt-4 min-h-[320px]" padding="lg">
          {!user ? (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3">🔒</div>
              <h3 className="text-base font-semibold text-foreground">
                Sign in to view {isOwnProfile ? "your" : `${profile.displayName}'s`} content
              </h3>
              <p className="text-sm text-muted mt-1">
                Create a free account to see posts, resources, and lessons from educators on EduConnect.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Button variant="primary" onClick={() => window.location.href = "/auth/signup"}>
                  Create Account
                </Button>
                <Button variant="outline" onClick={() => window.location.href = `/auth/login?redirect=/educators/${userId}`}>
                  Sign In
                </Button>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// --- Posts tab ---

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
        description={
          isOwnProfile
            ? "Share your first post with the community."
            : `${displayName} hasn't posted yet.`
        }
        cta={
          isOwnProfile ? (
            <Link href="/">
              <Button size="sm" className="mt-4">
                Create a Post
              </Button>
            </Link>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <div
          key={post.id}
          className="rounded-lg border border-border px-4 py-3"
        >
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="primary">{post.type}</Badge>
            {post.gradeLevel && (
              <span className="text-xs text-muted">{post.gradeLevel}</span>
            )}
          </div>
          <p className="text-sm text-foreground line-clamp-3">{post.content}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
              {post.likesCount}
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              {post.commentsCount}
            </span>
            {post.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-secondary-100 px-2 py-0.5 text-xs">
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Resources tab ---

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
        description={
          isOwnProfile
            ? "Share a resource to help fellow educators."
            : `${displayName} hasn't shared resources yet.`
        }
        cta={
          isOwnProfile ? (
            <Link href="/resources/upload">
              <Button size="sm" className="mt-4">
                Upload a Resource
              </Button>
            </Link>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {resources.map((resource) => {
        const typeLabel =
          RESOURCE_TYPES.find((t) => t.value === resource.type)?.label ??
          resource.type;
        return (
          <Link
            key={resource.id}
            href={`/resources/${resourceSlug(resource.title, resource.id)}`}
          >
            <div className="flex h-full flex-col rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary-300 hover:bg-primary-50/40">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="primary">{typeLabel}</Badge>
                {resource.gradeLevel && (
                  <span className="text-xs text-muted">{resource.gradeLevel}</span>
                )}
              </div>
              <p className="text-sm font-medium text-foreground line-clamp-2">
                {resource.title}
              </p>
              {resource.description && (
                <p className="mt-0.5 text-xs text-muted line-clamp-2">
                  {resource.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {resource.downloadCount}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// --- Discussions tab ---

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
        description={
          isOwnProfile
            ? "Start a discussion in the forums."
            : `${displayName} hasn't started any discussions yet.`
        }
        cta={
          isOwnProfile ? (
            <Link href="/forums">
              <Button size="sm" className="mt-4">
                Browse Forums
              </Button>
            </Link>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      {threads.map((thread) => (
        <Link
          key={thread.id}
          href={`/forums/${thread.categoryId}/${threadSlug(thread.title, thread.id)}`}
        >
          <div className="rounded-lg border border-border px-4 py-3 transition-colors hover:border-primary-300 hover:bg-primary-50/40">
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {thread.title}
            </p>
            {thread.content && (
              <p className="mt-0.5 text-xs text-muted line-clamp-2">
                {thread.content}
              </p>
            )}
            <div className="mt-2 flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
                {thread.commentCount}
              </span>
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
                {thread.upvotes}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// --- Lessons tab ---

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
        description={
          isOwnProfile
            ? "Create your first lesson plan."
            : `${displayName} hasn't created lessons yet.`
        }
        cta={
          isOwnProfile ? (
            <Link href="/lesson-builder/new">
              <Button size="sm" className="mt-4">
                Create a Lesson Plan
              </Button>
            </Link>
          ) : undefined
        }
      />
    );
  }

  const published = lessons.filter((l) => l.isPublic);
  const drafts = lessons.filter((l) => !l.isPublic);

  return (
    <div className="space-y-6">
      {/* Published */}
      {published.length > 0 && (
        <div>
          {isOwnProfile && (
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Published ({published.length})
            </h3>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {published.map((lesson) => (
              <LessonMiniCard key={lesson.id} lesson={lesson} isOwnProfile={isOwnProfile} />
            ))}
          </div>
        </div>
      )}

      {/* Drafts – own profile only */}
      {isOwnProfile && drafts.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Drafts ({drafts.length})
          </h3>
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
            <Button variant="outline" size="sm">
              + New Lesson Plan
            </Button>
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
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          {lesson.isPublic ? (
            <Badge variant="success">Published</Badge>
          ) : (
            <Badge variant="default">Draft</Badge>
          )}
          {lesson.gradeLevel && (
            <span className="text-xs text-muted">{lesson.gradeLevel}</span>
          )}
          {lesson.subject && (
            <span className="text-xs text-muted">· {lesson.subject}</span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground line-clamp-2">
          {lesson.title || "Untitled lesson"}
        </p>
        {lesson.objectives.length > 0 && (
          <p className="mt-0.5 text-xs text-muted line-clamp-1">
            {lesson.objectives[0]}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Link href={`/lesson-builder/${lesson.id}`}>
          <Button type="button" variant="outline" size="sm">
            View
          </Button>
        </Link>
        {isOwnProfile && (
          <Link href={`/lesson-builder/new?edit=${lesson.id}`}>
            <Button type="button" variant="ghost" size="sm">
              Edit
            </Button>
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
