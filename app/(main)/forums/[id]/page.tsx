"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  findThreadById,
  upvoteThread,
  downvoteThread,
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

function timeAgo(timestamp: { seconds: number } | null): string {
  if (!timestamp) return "just now";
  const seconds = Math.floor(Date.now() / 1000 - timestamp.seconds);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ─── Nested comment component ───

interface CommentItemProps {
  comment: ThreadComment;
  replies: ThreadComment[];
  allComments: ThreadComment[];
  categoryId: string;
  threadId: string;
  depth: number;
}

function CommentItem({
  comment,
  replies,
  allComments,
  categoryId,
  threadId,
  depth,
}: CommentItemProps) {
  const { user } = useAuth();
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [upvotes, setUpvotes] = useState(comment.upvotes);
  const [downvotes, setDownvotes] = useState(comment.downvotes);
  const [voteLoading, setVoteLoading] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [localReplies, setLocalReplies] = useState<ThreadComment[]>(replies);

  useEffect(() => {
    if (user) {
      getUserCommentVote(categoryId, threadId, comment.id, user.uid)
        .then(setVote)
        .catch(() => {});
    }
  }, [categoryId, threadId, comment.id, user]);

  // Sync replies from parent
  useEffect(() => {
    setLocalReplies(replies);
  }, [replies]);

  async function handleUpvote() {
    if (!user || voteLoading) return;
    setVoteLoading(true);
    try {
      await upvoteComment(categoryId, threadId, comment.id, user.uid);
      if (vote === "up") {
        setVote(null);
        setUpvotes((c) => c - 1);
      } else if (vote === "down") {
        setVote("up");
        setUpvotes((c) => c + 1);
        setDownvotes((c) => c - 1);
      } else {
        setVote("up");
        setUpvotes((c) => c + 1);
      }
    } catch {
      // ignore
    } finally {
      setVoteLoading(false);
    }
  }

  async function handleReply() {
    if (!user || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const newId = await addThreadComment(categoryId, threadId, {
        parentId: comment.id,
        authorId: user.uid,
        authorName: user.displayName || "Anonymous",
        authorPhotoURL: user.photoURL,
        content: replyText.trim(),
      });
      setLocalReplies((prev) => [
        ...prev,
        {
          id: newId,
          threadId,
          parentId: comment.id,
          authorId: user.uid,
          authorName: user.displayName || "Anonymous",
          authorPhotoURL: user.photoURL,
          content: replyText.trim(),
          createdAt: { seconds: Date.now() / 1000 } as ThreadComment["createdAt"],
          upvotes: 0,
          downvotes: 0,
        },
      ]);
      setReplyText("");
      setShowReply(false);
    } catch {
      // ignore
    } finally {
      setSubmittingReply(false);
    }
  }

  const score = upvotes - downvotes;
  const canNest = depth < 2;

  return (
    <div className={depth > 0 ? "ml-6 sm:ml-10 border-l-2 border-border pl-4" : ""}>
      <div className="flex gap-3 py-3">
        <Link href={`/educators/${comment.authorId}`} className="shrink-0">
          <Avatar
            src={comment.authorPhotoURL}
            alt={comment.authorName}
            size="sm"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/educators/${comment.authorId}`}
              className="text-sm font-semibold text-foreground hover:underline"
            >
              {comment.authorName}
            </Link>
            <span className="text-xs text-muted">
              {timeAgo(comment.createdAt as { seconds: number } | null)}
            </span>
          </div>
          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Comment actions */}
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={handleUpvote}
              disabled={!user}
              className={`flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                vote === "up"
                  ? "text-primary-900"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              {score !== 0 && score}
            </button>
            {user && canNest && (
              <button
                type="button"
                onClick={() => setShowReply(!showReply)}
                className="text-xs font-medium text-muted hover:text-foreground transition-colors cursor-pointer"
              >
                Reply
              </button>
            )}
          </div>

          {/* Reply input */}
          {showReply && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
                placeholder="Write a reply..."
                className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-ring hover:border-border-strong"
              />
              <Button
                size="sm"
                onClick={handleReply}
                disabled={!replyText.trim()}
                isLoading={submittingReply}
              >
                Reply
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {canNest && localReplies.length > 0 && (
        <div>
          {localReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replies={allComments.filter((c) => c.parentId === reply.id)}
              allComments={allComments}
              categoryId={categoryId}
              threadId={threadId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page component ───

export default function ForumThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: threadId } = use(params);
  const { user } = useAuth();

  const [thread, setThread] = useState<ForumThread | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Thread voting
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [upvotes, setUpvotes] = useState(0);
  const [downvotes, setDownvotes] = useState(0);
  const [voteLoading, setVoteLoading] = useState(false);

  // Comments
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

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
        setDownvotes(result.thread.downvotes);
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
    setVoteLoading(true);
    try {
      await upvoteThread(categoryId, threadId, user.uid);
      if (vote === "up") {
        setVote(null);
        setUpvotes((c) => c - 1);
      } else if (vote === "down") {
        setVote("up");
        setUpvotes((c) => c + 1);
        setDownvotes((c) => c - 1);
      } else {
        setVote("up");
        setUpvotes((c) => c + 1);
      }
    } catch {
      // ignore
    } finally {
      setVoteLoading(false);
    }
  }

  async function handleDownvote() {
    if (!user || !categoryId || voteLoading) return;
    setVoteLoading(true);
    try {
      await downvoteThread(categoryId, threadId, user.uid);
      if (vote === "down") {
        setVote(null);
        setDownvotes((c) => c - 1);
      } else if (vote === "up") {
        setVote("down");
        setUpvotes((c) => c - 1);
        setDownvotes((c) => c + 1);
      } else {
        setVote("down");
        setDownvotes((c) => c + 1);
      }
    } catch {
      // ignore
    } finally {
      setVoteLoading(false);
    }
  }

  async function handleTopLevelReply() {
    if (!user || !categoryId || !replyText.trim()) return;
    setSubmittingReply(true);
    try {
      await addThreadComment(categoryId, threadId, {
        parentId: null,
        authorId: user.uid,
        authorName: user.displayName || "Anonymous",
        authorPhotoURL: user.photoURL,
        content: replyText.trim(),
      });
      setReplyText("");
      loadComments(categoryId);
    } catch {
      // ignore
    } finally {
      setSubmittingReply(false);
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
  const score = upvotes - downvotes;
  const topLevelComments = comments.filter((c) => !c.parentId);

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
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-secondary-100 text-secondary-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Vote bar */}
        <div className="px-6 py-3 border-t border-border flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUpvote}
              disabled={!user}
              className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed ${
                vote === "up"
                  ? "text-primary-900 bg-primary-100"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
              aria-label="Upvote"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <span
              className={`text-sm font-semibold min-w-[2ch] text-center ${
                score > 0
                  ? "text-primary-900"
                  : score < 0
                    ? "text-error-500"
                    : "text-muted"
              }`}
            >
              {score}
            </span>
            <button
              type="button"
              onClick={handleDownvote}
              disabled={!user}
              className={`p-1.5 rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed ${
                vote === "down"
                  ? "text-error-500 bg-error-50"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
              aria-label="Downvote"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <span className="text-sm text-muted">
            {thread.commentCount} {thread.commentCount === 1 ? "reply" : "replies"}
          </span>
        </div>
      </div>

      {/* Reply form (top-level) */}
      {user && (
        <div className="rounded-xl border border-border bg-surface shadow-card p-4">
          <div className="flex gap-3">
            <Avatar
              src={user.photoURL}
              alt={user.displayName || "You"}
              size="md"
            />
            <div className="flex-1">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                rows={3}
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-ring hover:border-border-strong min-h-16"
              />
              <div className="flex justify-end mt-2">
                <Button
                  size="sm"
                  onClick={handleTopLevelReply}
                  disabled={!replyText.trim()}
                  isLoading={submittingReply}
                >
                  Reply
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comments section */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Replies ({comments.length})
        </h2>

        {loadingComments ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 py-3">
                <div className="h-8 w-8 rounded-full bg-secondary-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-secondary-100 rounded" />
                  <div className="h-3 w-full bg-secondary-100 rounded" />
                  <div className="h-3 w-2/3 bg-secondary-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : topLevelComments.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-6 text-center">
            <p className="text-sm text-muted">
              {user
                ? "No replies yet. Be the first to respond!"
                : "No replies yet. Sign in to join the conversation."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface divide-y divide-border">
            <div className="px-4">
              {topLevelComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  replies={comments.filter((c) => c.parentId === comment.id)}
                  allComments={comments}
                  categoryId={categoryId}
                  threadId={threadId}
                  depth={0}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
