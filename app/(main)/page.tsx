"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getPosts,
  type Post,
  type GetPostsResult,
} from "@/lib/firestore/posts";
import type { DocumentSnapshot } from "firebase/firestore";
import CreatePost from "@/components/posts/CreatePost";
import PostCard from "@/components/posts/PostCard";
import Button from "@/components/ui/Button";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const result: GetPostsResult = await getPosts();
      setPosts(result.posts);
      setCursor(result.lastDoc);
      setHasMore(result.lastDoc !== null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      loadPosts();
    }
  }, [authLoading, loadPosts]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result: GetPostsResult = await getPosts(cursor);
      setPosts((prev) => [...prev, ...result.posts]);
      setCursor(result.lastDoc);
      setHasMore(result.lastDoc !== null);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Home Feed</h1>
        <p className="mt-1 text-sm text-muted">
          Your personalized educator feed - posts, trending discussions, and
          more.
        </p>
      </div>

      {/* Create post (logged in only) */}
      {user && <CreatePost onPostCreated={loadPosts} />}

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
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}

          {hasMore && (
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
