"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getCategories,
  getThreads,
  threadSlug,
  FORUM_CATEGORIES,
  type ForumCategory,
  type ForumThread,
  type GetThreadsResult,
} from "@/lib/firestore/forums";
import type { DocumentSnapshot } from "firebase/firestore";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Tag from "@/components/ui/Tag";
import { timeAgo } from "@/lib/utils";

export default function ForumsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Category listing state
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Selected category + threads
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [threadsCursor, setThreadsCursor] = useState<DocumentSnapshot | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [hasMoreThreads, setHasMoreThreads] = useState(false);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoadingCategories(false));
  }, []);

  const loadThreads = useCallback(
    async (categoryId: string) => {
      setLoadingThreads(true);
      try {
        const result: GetThreadsResult = await getThreads(categoryId);
        setThreads(result.threads);
        setThreadsCursor(result.lastDoc);
        setHasMoreThreads(result.lastDoc !== null);
      } catch {
        // ignore
      } finally {
        setLoadingThreads(false);
      }
    },
    []
  );

  function selectCategory(categoryId: string) {
    setSelectedCategory(categoryId);
    setThreads([]);
    setThreadsCursor(null);
    loadThreads(categoryId);
  }

  function backToCategories() {
    setSelectedCategory(null);
    setThreads([]);
    setThreadsCursor(null);
  }

  async function loadMoreThreads() {
    if (!selectedCategory || !threadsCursor) return;
    setLoadingThreads(true);
    try {
      const result = await getThreads(selectedCategory, threadsCursor);
      setThreads((prev) => [...prev, ...result.threads]);
      setThreadsCursor(result.lastDoc);
      setHasMoreThreads(result.lastDoc !== null);
    } catch {
      // ignore
    } finally {
      setLoadingThreads(false);
    }
  }

  function openNewThread(categoryId?: string) {
    const cat = categoryId || selectedCategory || FORUM_CATEGORIES[0].id;
    router.push(`/forums/new?category=${cat}`);
  }

  const selectedCategoryData = FORUM_CATEGORIES.find(
    (c) => c.id === selectedCategory
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Forums</h1>
          <p className="mt-1 text-sm text-muted">
            Browse discussion categories and join conversations with fellow
            educators.
          </p>
        </div>
        {user && (
          <Button
            onClick={() => {
              if (selectedCategory) {
                openNewThread();
              } else {
                // If no category selected, pick the first one by default
                openNewThread(FORUM_CATEGORIES[0].id);
              }
            }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Discussion
          </Button>
        )}
      </div>

      {/* Category Grid or Thread Listing */}
      {!selectedCategory ? (
        /* ===== Category Cards ===== */
        loadingCategories ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-surface shadow-card p-5 animate-pulse"
              >
                <div className="h-10 w-10 rounded-lg bg-secondary-100 mb-3" />
                <div className="h-4 w-2/3 bg-secondary-100 rounded mb-2" />
                <div className="h-3 w-full bg-secondary-100 rounded mb-1" />
                <div className="h-3 w-3/4 bg-secondary-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <Card
                key={cat.id}
                padding="lg"
                hoverable
                onClick={() => selectCategory(cat.id)}
              >
                <div className="text-3xl mb-3">{cat.icon}</div>
                <h3 className="text-base font-semibold text-foreground">
                  {cat.name}
                </h3>
                <p className="text-sm text-muted mt-1 line-clamp-2">
                  {cat.description}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                  <span>
                    {cat.threadCount}{" "}
                    {cat.threadCount === 1 ? "thread" : "threads"}
                  </span>
                  <span>·</span>
                  <span>
                    {cat.lastActivityAt
                      ? timeAgo(cat.lastActivityAt as { seconds: number })
                      : "No activity yet"}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* ===== Thread Listing for Selected Category ===== */
        <div className="space-y-4">
          {/* Back button + category header */}
          <div className="flex items-center gap-3">
            <button
              onClick={backToCategories}
              className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              All Categories
            </button>
          </div>

          {selectedCategoryData && (
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedCategoryData.icon}</span>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {selectedCategoryData.name}
                </h2>
                <p className="text-sm text-muted">
                  {selectedCategoryData.description}
                </p>
              </div>
            </div>
          )}

          {/* Thread list */}
          {loadingThreads && threads.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-surface shadow-card p-4 animate-pulse"
                >
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-full bg-secondary-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/2 bg-secondary-100 rounded" />
                      <div className="h-3 w-full bg-secondary-100 rounded" />
                      <div className="h-3 w-3/4 bg-secondary-100 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <Card padding="lg" className="text-center">
              <div className="text-4xl mb-3">💬</div>
              <h3 className="text-lg font-semibold text-foreground">
                No discussions yet
              </h3>
              <p className="text-sm text-muted mt-1">
                {user
                  ? "Start the first discussion in this category!"
                  : "Sign in to start a discussion."}
              </p>
              {user && (
                <Button
                  className="mt-4"
                  onClick={() => openNewThread()}
                >
                  Start a Discussion
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/forums/${threadSlug(thread.title, thread.id)}`}
                >
                  <Card padding="md" hoverable className="mb-3">
                    <div className="flex gap-3">
                      <Avatar
                        src={thread.authorPhotoURL}
                        alt={thread.authorName}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                          {thread.title}
                        </h3>
                        <p className="text-xs text-muted mt-0.5">
                          {thread.authorName} ·{" "}
                          {timeAgo(
                            thread.createdAt as { seconds: number } | null
                          )}
                        </p>
                        <p className="text-sm text-muted mt-1 line-clamp-2">
                          {thread.content}
                        </p>

                        {/* Tags */}
                        {(thread.gradeLevel ||
                          thread.subject ||
                          thread.tags.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {thread.gradeLevel && (
                              <Badge variant="default">
                                {thread.gradeLevel}
                              </Badge>
                            )}
                            {thread.subject && (
                              <Badge variant="info">{thread.subject}</Badge>
                            )}
                            {thread.tags.map((tag) => (
                              <Tag key={tag} label={tag} />
                            ))}
                          </div>
                        )}

                        {/* Stats */}
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                          <span className="flex items-center gap-1">
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
                                d="M5 15l7-7 7 7"
                              />
                            </svg>
                            {thread.upvotes - thread.downvotes}
                          </span>
                          <span className="flex items-center gap-1">
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
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                              />
                            </svg>
                            {thread.commentCount}{" "}
                            {thread.commentCount === 1 ? "reply" : "replies"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}

              {hasMoreThreads && (
                <div className="text-center pt-2">
                  <Button
                    variant="outline"
                    onClick={loadMoreThreads}
                    isLoading={loadingThreads}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
