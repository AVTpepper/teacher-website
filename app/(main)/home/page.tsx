"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getPosts,
  getPost,
  type Post,
  type GetPostsResult,
  type PostType,
} from "@/lib/firestore/posts";
import type { DocumentSnapshot } from "firebase/firestore";
import CreatePost from "@/components/posts/CreatePost";
import PostCard from "@/components/posts/PostCard";
import Button from "@/components/ui/Button";
import DiscoveryShell from "@/components/layout/DiscoveryShell";

const TYPE_FILTERS: { label: string; value: PostType | "" }[] = [
  { label: "All", value: "" },
  { label: "💡 Ideas", value: "idea" },
  { label: "📚 Resources", value: "resource" },
  { label: "💬 Discussions", value: "discussion" },
  { label: "🌐 General", value: "general" },
  { label: "❓ Questions", value: "question" },
  { label: "💭 Other", value: "other" },
];

const GUEST_POST_LIMIT = 3;

export default function HomePage() {
  return (
    <Suspense>
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pinnedPostId, setPinnedPostId] = useState<string | null>(() => searchParams.get("post"));

  const [posts, setPosts] = useState<Post[]>([]);
  const [sharedPost, setSharedPost] = useState<Post | null>(null);
  const [sharedPostLoading, setSharedPostLoading] = useState(false);
  const sharedPostRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typeFilter, setTypeFilter] = useState<PostType | "">("");

  const loadPosts = useCallback(async (reset: boolean, type: PostType | "") => {
    if (reset) {
      cursorRef.current = null;
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const result: GetPostsResult = await getPosts(
        reset ? null : cursorRef.current,
        type || null
      );
      cursorRef.current = result.lastDoc;
      setPosts((prev) => (reset ? result.posts : [...prev, ...result.posts]));
      setHasMore(result.lastDoc !== null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      loadPosts(true, typeFilter);
    }
  }, [authLoading, typeFilter, loadPosts]);

  useEffect(() => {
    const linkedPostId = searchParams.get("post");
    if (linkedPostId) {
      setPinnedPostId(linkedPostId);
    }
  }, [searchParams]);

  // Fetch linked post whenever the target ID changes
  useEffect(() => {
    if (!pinnedPostId) return;
    setSharedPostLoading(true);
    getPost(pinnedPostId)
      .then(setSharedPost)
      .catch(() => setSharedPost(null))
      .finally(() => setSharedPostLoading(false));
  }, [pinnedPostId]);

  // Once the post loads: scroll to it, then strip ?post= so refresh shows normal feed
  useEffect(() => {
    if (sharedPost && sharedPostRef.current) {
      sharedPostRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      router.replace("/home");
    }
  }, [sharedPost, router]);

  function handleTypeChange(value: PostType | "") {
    setTypeFilter(value);
  }

  async function loadMore() {
    if (!cursorRef.current || loadingMore) return;
    loadPosts(false, typeFilter);
  }

  // For guests: only show limited posts
  const feedPosts = pinnedPostId
    ? posts.filter((p) => p.id !== pinnedPostId)
    : posts;
  const visiblePosts = !user ? feedPosts.slice(0, GUEST_POST_LIMIT) : feedPosts;
  const showGuestWall = !user && feedPosts.length > 0;

  return (
    <div className="space-y-6">
      <DiscoveryShell
        title="Home Feed"
        subtitle="Your personalized educator feed - posts, trending discussions, and more."
        eyebrow="Daily Hub"
        controls={
          <div className="space-y-4">
            {user && <CreatePost embedded onPostCreated={() => loadPosts(true, typeFilter)} />}
            <div className="relative">
              <div className="flex gap-2 overflow-x-auto pb-0.5 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => handleTypeChange(f.value)}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium cursor-pointer ${
                      typeFilter === f.value
                        ? "border-primary-300 bg-primary-50 text-primary-900"
                        : "border-primary-100 bg-surface text-primary-800 hover:border-primary-200 hover:bg-surface-hover"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 sm:hidden">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-primary-100 bg-surface/95 text-primary-500 shadow-sm">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        }
      />

      {/* Shared / linked post - pinned below the create form */}
      {pinnedPostId && (
        <div ref={sharedPostRef} className="scroll-mt-28">
          {sharedPostLoading ? (
            <div className="rounded-xl border border-info-300 bg-info-50 shadow-card p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-info-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-info-200 rounded" />
                  <div className="h-3 w-20 bg-info-200 rounded" />
                </div>
              </div>
            </div>
          ) : sharedPost ? (
            <div className="rounded-xl ring-1 ring-info-200">
              <div className="rounded-t-xl bg-info-50 border-b border-info-100 px-3 py-1 flex items-center gap-1.5 text-xs text-info-500">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Linked post
              </div>
              <PostCard post={sharedPost} textOnlyAvatars />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface shadow-card p-6 text-center text-sm text-muted">
              Post not found.
            </div>
          )}
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface shadow-card p-4 animate-pulse"
            >
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-secondary-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-secondary-100 rounded" />
                  <div className="h-3 w-20 bg-secondary-100 rounded" />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full bg-secondary-100 rounded" />
                <div className="h-3 w-3/4 bg-secondary-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface shadow-card p-8 text-center">
          <div className="text-4xl mb-3">📝</div>
          <h3 className="text-lg font-semibold text-foreground">
            No posts yet
          </h3>
          <p className="text-sm text-muted mt-1">
            {user
              ? "Be the first to share an idea, resource, or start a discussion!"
              : "Sign in to start sharing with the educator community."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              textOnlyAvatars
              onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
            />
          ))}

          {/* Guest wall */}
          {showGuestWall && (
            <div className="rounded-xl border border-border bg-surface shadow-card p-8 text-center">
              <div className="text-4xl mb-3">🔒</div>
              <h3 className="text-lg font-semibold text-foreground">
                Sign in to see more
              </h3>
              <p className="text-sm text-muted mt-1">
                Create a free account to view the full educator feed and join the conversation.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Button variant="primary" onClick={() => router.push("/auth/signup?redirect=/home")}>
                  Create Account
                </Button>
                <Button variant="outline" onClick={() => router.push("/auth/login?redirect=/home")}>
                  Sign In
                </Button>
              </div>
            </div>
          )}

          {/* Load more (only for authenticated users) */}
          {user && hasMore && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                onClick={loadMore}
                isLoading={loadingMore}
              >
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
