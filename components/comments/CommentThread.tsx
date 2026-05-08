"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import BadgeIcon from "@/components/badges/BadgeIcon";

// ─── Generic comment type ───

export interface CommentData {
  id: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  /** Optional badges to show next to the author's name. */
  authorBadges?: string[];
  content: string;
  createdAt: { seconds: number } | null;
  /** Used for upvote-based interactions (forums). */
  upvotes?: number;
  downvotes?: number;
}

// ─── Callback props ───

export interface CommentThreadProps {
  /** All comments (flat list; nesting derived from parentId). */
  comments: CommentData[];
  /** Whether comments are still loading. */
  loading?: boolean;
  /** Max nesting depth (default 2). */
  maxDepth?: number;
  /** Interaction mode: "like" shows a heart; "upvote" shows arrows. */
  mode?: "like" | "upvote";

  // --- Callbacks ---

  /** Called when user submits a new comment. Return the new comment ID. */
  onAddComment: (content: string, parentId: string | null) => Promise<string>;
  /** Called when user upvotes a comment. Only used when mode="upvote". */
  onUpvote?: (commentId: string) => Promise<void>;
  /** Get the current user's vote on a comment. Only used when mode="upvote". */
  getUserVote?: (commentId: string) => Promise<"up" | "down" | null>;
}

// ─── Helper ───

import { timeAgo } from "@/lib/utils";

// ─── Single comment item (recursive) ───

interface CommentItemProps {
  comment: CommentData;
  replies: CommentData[];
  allComments: CommentData[];
  depth: number;
  maxDepth: number;
  mode: "like" | "upvote";
  onAddComment: (content: string, parentId: string | null) => Promise<string>;
  onUpvote?: (commentId: string) => Promise<void>;
  getUserVote?: (commentId: string) => Promise<"up" | "down" | null>;
}

function CommentItem({
  comment,
  replies,
  allComments,
  depth,
  maxDepth,
  mode,
  onAddComment,
  onUpvote,
  getUserVote,
}: CommentItemProps) {
  const { user } = useAuth();
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [upvotes, setUpvotes] = useState(comment.upvotes ?? 0);
  const [voteLoading, setVoteLoading] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [localReplies, setLocalReplies] = useState<CommentData[]>(replies);

  useEffect(() => {
    if (user && mode === "upvote" && getUserVote) {
      getUserVote(comment.id).then(setVote).catch(() => {});
    }
  }, [comment.id, user, mode, getUserVote]);

  useEffect(() => {
    setLocalReplies(replies);
  }, [replies]);

  async function handleUpvote() {
    if (!user || voteLoading || !onUpvote) return;
    setVoteLoading(true);
    try {
      await onUpvote(comment.id);
      if (vote === "up") {
        setVote(null);
        setUpvotes((c) => c - 1);
      } else {
        setVote("up");
        setUpvotes((c) => c + (vote === "down" ? 2 : 1));
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
      const newId = await onAddComment(replyText.trim(), comment.id);
      setLocalReplies((prev) => [
        ...prev,
        {
          id: newId,
          parentId: comment.id,
          authorId: user.uid,
          authorName: user.displayName || "Anonymous",
          authorPhotoURL: user.photoURL,
          content: replyText.trim(),
          createdAt: { seconds: Date.now() / 1000 },
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

  const score = upvotes - (comment.downvotes ?? 0);
  const canNest = depth < maxDepth;

  return (
    <div
      className={
        depth > 0 ? "ml-6 sm:ml-10 border-l-2 border-border pl-4" : ""
      }
    >
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
            {comment.authorBadges && comment.authorBadges.length > 0 && (
              <span className="flex items-center gap-0.5">
                {comment.authorBadges.slice(0, 3).map((id) => (
                  <BadgeIcon key={id} badgeId={id} compact />
                ))}
              </span>
            )}
            <span className="text-xs text-muted">
              {timeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-2">
            {mode === "upvote" && (
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
                {score !== 0 && score}
              </button>
            )}
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
              depth={depth + 1}
              maxDepth={maxDepth}
              mode={mode}
              onAddComment={onAddComment}
              onUpvote={onUpvote}
              getUserVote={getUserVote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main CommentThread component ───

export default function CommentThread({
  comments,
  loading = false,
  maxDepth = 2,
  mode = "like",
  onAddComment,
  onUpvote,
  getUserVote,
}: CommentThreadProps) {
  const { user } = useAuth();
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localComments, setLocalComments] = useState<CommentData[]>(comments);

  useEffect(() => {
    setLocalComments(comments);
  }, [comments]);

  const topLevel = localComments.filter((c) => !c.parentId);

  async function handleTopLevelComment() {
    if (!user || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const newId = await onAddComment(replyText.trim(), null);
      setLocalComments((prev) => [
        ...prev,
        {
          id: newId,
          parentId: null,
          authorId: user.uid,
          authorName: user.displayName || "Anonymous",
          authorPhotoURL: user.photoURL,
          content: replyText.trim(),
          createdAt: { seconds: Date.now() / 1000 },
          upvotes: 0,
          downvotes: 0,
        },
      ]);
      setReplyText("");
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Comment input */}
      {user && (
        <div className="flex gap-2">
          <Avatar
            src={user.photoURL}
            alt={user.displayName || "You"}
            size="sm"
          />
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTopLevelComment();
                }
              }}
              placeholder="Write a comment..."
              className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-ring hover:border-border-strong"
            />
            <Button
              size="sm"
              onClick={handleTopLevelComment}
              disabled={!replyText.trim()}
              isLoading={submitting}
            >
              Post
            </Button>
          </div>
        </div>
      )}

      {/* Comment list */}
      {loading ? (
        <p className="text-xs text-muted">Loading comments...</p>
      ) : topLevel.length === 0 ? (
        <p className="text-xs text-muted">
          {user ? "No comments yet. Be the first!" : "No comments yet."}
        </p>
      ) : (
        <div>
          {topLevel.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={localComments.filter((c) => c.parentId === comment.id)}
              allComments={localComments}
              depth={0}
              maxDepth={maxDepth}
              mode={mode}
              onAddComment={onAddComment}
              onUpvote={onUpvote}
              getUserVote={getUserVote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
