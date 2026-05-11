"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getPosts,
  type Post,
  type GetPostsResult,
  type PostType,
} from "@/lib/firestore/posts";
import type { DocumentSnapshot } from "firebase/firestore";
import CreatePost from "@/components/posts/CreatePost";
import PostCard from "@/components/posts/PostCard";
import Button from "@/components/ui/Button";

const TYPE_FILTERS: { label: string; value: PostType | "" }[] = [
  { label: "All", value: "" },
  { label: "💡 Ideas", value: "idea" },
  { label: "📚 Resources", value: "resource" },
  { label: "💬 Discussions", value: "discussion" },
];

const GUEST_POST_LIMIT = 3;

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
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

  function handleTypeChange(value: PostType | "") {
    setTypeFilter(value);
  }

  async function loadMore() {
    if (!cursorRef.current || loadingMore) return;
    loadPosts(false, typeFilter);
  }

  // For guests: only show limited posts
  const visiblePosts = !user ? posts.slice(0, GUEST_POST_LIMIT) : posts;
  const showGuestWall = !user && posts.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Home Feed</h1>
        <p className="mt-1 text-sm text-muted">
          Your personalized educator feed — posts, trending discussions, and
          more.
        </p>
      </div>

      {/* Create post (logged in only) */}
      {user && <CreatePost onPostCreated={() => loadPosts(true, typeFilter)} />}

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => handleTypeChange(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
              typeFilter === f.value
                ? "bg-primary-900 text-white border-primary-900"
                : "bg-surface border-border text-muted hover:border-primary-900 hover:text-primary-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

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
            <PostCard key={post.id} post={post} />
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
                <Button variant="primary" onClick={() => window.location.href = "/auth/signup"}>
                  Create Account
                </Button>
                <Button variant="outline" onClick={() => window.location.href = "/auth/login"}>
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
