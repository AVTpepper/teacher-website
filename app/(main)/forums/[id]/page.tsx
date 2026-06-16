"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  findThreadById,
  parseThreadSlug,
  upvoteThread,
  getUserVote,
  getThreadComments,
  addThreadComment,
  upvoteComment,
  getUserCommentVote,
  FORUM_CATEGORIES,
  type ForumThread,
  type ThreadComment,
} from "@/lib/firestore/forums";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import CommentThread, { type CommentData } from "@/components/comments/CommentThread";
import { timeAgo } from "@/lib/utils";
import { notifyUpvote, notifyComment } from "@/lib/notifications";

// ─── Main page component ───

export default function ForumThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const threadId = parseThreadSlug(rawId);
  const { user } = useAuth();

  const [thread, setThread] = useState<ForumThread | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Thread voting
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [upvotes, setUpvotes] = useState(0);
  const [voteLoading, setVoteLoading] = useState(false);

  // Comments
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replySort, setReplySort] = useState<"newest" | "top">("newest");
  const [copied, setCopied] = useState(false);

  const loadComments = useCallback(
    async (catId: string) => {
      setLoadingComments(true);
      try {
        const result = await getThreadComments(catId, threadId);
        setComments(result);
      } catch {
        // ignore
      } finally {
        setLoadingComments(false);
      }
    },
    [threadId]
  );

  useEffect(() => {
    async function load() {
      try {
        const result = await findThreadById(threadId);
        if (!result) {
          setNotFound(true);
          return;
        }
        setThread(result.thread);
        setCategoryId(result.categoryId);
        setUpvotes(result.thread.upvotes);
        loadComments(result.categoryId);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [threadId, loadComments]);

  // Load user's vote on the thread
  useEffect(() => {
    if (user && categoryId) {
      getUserVote(categoryId, threadId, user.uid)
        .then(setVote)
        .catch(() => {});
    }
  }, [user, categoryId, threadId]);

  async function handleUpvote() {
    if (!user || !categoryId || voteLoading) return;
    if (thread?.authorId === user.uid) return; // no self-voting
    setVoteLoading(true);
    try {
      await upvoteThread(categoryId, threadId, user.uid);
      if (vote === "up") {
        setVote(null);
        setUpvotes((c) => c - 1);
      } else {
        setVote("up");
        setUpvotes((c) => c + 1);
        // Notify thread author (fire-and-forget, only on first upvote)
        if (thread && thread.authorId !== user.uid) {
          notifyUpvote({
            recipientId: thread.authorId,
            actorId: user.uid,
            actorName: user.displayName || "Someone",
            actorPhotoURL: user.photoURL,
            threadTitle: thread.title,
            linkURL: window.location.href,
          }).catch(() => {});
        }
      }
    } catch {
      // ignore
    } finally {
      setVoteLoading(false);
    }
  }

  function handleShare() {
    if (!thread) return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: thread.title, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 w-24 bg-secondary-100 rounded" />
        <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <div className="h-6 w-2/3 bg-secondary-100 rounded" />
          <div className="flex gap-2">
            <div className="h-10 w-10 rounded-full bg-secondary-100" />
            <div className="space-y-2 flex-1">
              <div className="h-3 w-32 bg-secondary-100 rounded" />
              <div className="h-3 w-20 bg-secondary-100 rounded" />
            </div>
          </div>
          <div className="h-3 w-full bg-secondary-100 rounded" />
          <div className="h-3 w-3/4 bg-secondary-100 rounded" />
        </div>
      </div>
    );
  }

  // ─── Not found ───
  if (notFound || !thread || !categoryId) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-foreground">Thread Not Found</h1>
        <p className="text-sm text-muted mt-2">
          This discussion may have been removed or the link is incorrect.
        </p>
        <Link href="/forums">
          <Button variant="outline" className="mt-4">
            Back to Forums
          </Button>
        </Link>
      </div>
    );
  }

  const categoryData = FORUM_CATEGORIES.find((c) => c.id === categoryId);
  const isOwnThread = user?.uid === thread.authorId;

  // Build CommentData - sort top-level by score when replySort === "top"
  const commentData: CommentData[] = comments.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    authorId: c.authorId,
    authorName: c.authorName,
    authorPhotoURL: c.authorPhotoURL,
    content: c.content,
    createdAt: c.createdAt as { seconds: number } | null,
    upvotes: c.upvotes,
    downvotes: c.downvotes,
  }));

  const sortedCommentData =
    replySort === "top"
      ? [
          ...commentData
            .filter((c) => !c.parentId)
            .sort((a, b) => (b.upvotes ?? 0) - (b.downvotes ?? 0) - ((a.upvotes ?? 0) - (a.downvotes ?? 0))),
          ...commentData.filter((c) => !!c.parentId),
        ]
      : commentData;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/forums" className="hover:text-foreground transition-colors">
          Forums
        </Link>
        <span>/</span>
        {categoryData && (
          <Link href="/forums" className="hover:text-foreground transition-colors">
            {categoryData.icon} {categoryData.name}
          </Link>
        )}
      </div>

      {/* Thread card */}
      <div className="rounded-xl border border-border bg-surface shadow-card">
        <div className="p-6">
          {/* Title */}
          <h1 className="text-xl font-bold text-foreground">{thread.title}</h1>

          {/* Author row */}
          <div className="flex items-center gap-3 mt-3">
            <Link href={`/educators/${thread.authorId}`}>
              <Avatar
                src={thread.authorPhotoURL}
                alt={thread.authorName}
                size="md"
              />
            </Link>
            <div>
              <Link
                href={`/educators/${thread.authorId}`}
                className="text-sm font-semibold text-foreground hover:underline"
              >
                {thread.authorName}
              </Link>
              <p className="text-xs text-muted">
                {timeAgo(thread.createdAt as { seconds: number } | null)}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="mt-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {thread.content}
          </div>

          {/* Tags */}
          {(thread.gradeLevel || thread.subject || thread.tags.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {thread.gradeLevel && (
                <Badge variant="default">{thread.gradeLevel}</Badge>
              )}
              {thread.subject && (
                <Badge variant="info">{thread.subject}</Badge>
              )}
              {thread.tags.map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
          )}

          {/* Attached links */}
          {thread.links?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {thread.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-info-50 text-info-700 border border-info-200 hover:bg-info-100 transition-colors max-w-[260px] truncate"
                  title={link.url}
                >
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="truncate">{link.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Vote bar */}
        <div className="px-6 py-3 border-t border-border flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUpvote}
              disabled={!user || isOwnThread}
              title={isOwnThread ? "You can't upvote your own discussion" : !user ? "Sign in to upvote" : undefined}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                vote === "up"
                  ? "text-primary-900 bg-primary-100"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
              aria-label="Upvote"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              <span>{upvotes}</span>
            </button>
          </div>

          <span className="text-sm text-muted">
            {thread.commentCount} {thread.commentCount === 1 ? "reply" : "replies"}
          </span>

          <button
            type="button"
            onClick={handleShare}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
            {copied ? "✓ Copied!" : "Share"}
          </button>
        </div>
      </div>

      {/* Comments section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Replies ({comments.length})
          </h2>
          {comments.length > 1 && (
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted mr-1">Sort:</span>
              {(["newest", "top"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setReplySort(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    replySort === s
                      ? "bg-primary-900 text-white"
                      : "bg-secondary-100 text-secondary-700 hover:bg-secondary-200"
                  }`}
                >
                  {s === "newest" ? "Newest" : "Top"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <CommentThread
            comments={sortedCommentData}
            loading={loadingComments}
            maxDepth={2}
            mode="upvote"
            onAddComment={async (content, parentId) => {
              if (!categoryId) throw new Error("No category");
              const newId = await addThreadComment(categoryId, threadId, {
                parentId,
                authorId: user!.uid,
                authorName: user!.displayName || "Anonymous",
                authorPhotoURL: user!.photoURL,
                content,
              });
              // Notify thread author when someone comments (fire-and-forget)
              if (thread && thread.authorId !== user!.uid && !parentId) {
                notifyComment({
                  recipientId: thread.authorId,
                  actorId: user!.uid,
                  actorName: user!.displayName || "Someone",
                  actorPhotoURL: user!.photoURL,
                  contentLabel: `your discussion "${thread.title}"`,
                  linkURL: window.location.href,
                }).catch(() => {});
              }
              return newId;
            }}
            onUpvote={async (commentId) => {
              if (!categoryId || !user) return;
              await upvoteComment(categoryId, threadId, commentId, user.uid);
            }}
            getUserVote={async (commentId) => {
              if (!categoryId || !user) return null;
              return getUserCommentVote(categoryId, threadId, commentId, user.uid);
            }}
          />
        </div>
      </div>
    </div>
  );
}
