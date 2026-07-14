"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import BadgeIcon from "@/components/badges/BadgeIcon";
import MentionInput, { type MentionedUser } from "@/components/ui/MentionInput";
import { TextButton } from "@/components/ui";
import Dropdown from "@/components/ui/Dropdown";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { timeAgo, parseMentions, type MentionRef } from "@/lib/utils";

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
  editedAt?: { seconds: number } | null;
  deleted?: boolean;
  /** Mentioned users for rendering @Name as links. */
  mentionedUsers?: MentionRef[];
  /** Used for upvote-based interactions (forums). */
  upvotes?: number;
  downvotes?: number;
  /** Used for like-based interactions (posts). */
  likesCount?: number;
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
  composerPlaceholder?: string;
  replyPlaceholder?: string;
  emptyStateMessage?: string;
  emptyStateGuestMessage?: string;

  // --- Callbacks ---

  /** Called when user submits a new comment. Return the new comment ID. */
  onAddComment: (content: string, parentId: string | null, mentionedUsers?: MentionRef[]) => Promise<string>;
  /** Called when user upvotes a comment. Only used when mode="upvote". */
  onUpvote?: (commentId: string) => Promise<void>;
  /** Get the current user's vote on a comment. Only used when mode="upvote". */
  getUserVote?: (commentId: string) => Promise<"up" | "down" | null>;
  /** Called when user likes a comment. Only used when mode="like". */
  onLikeComment?: (commentId: string) => Promise<void>;
  /** Whether the current user has already liked a comment. Only used when mode="like". */
  hasLikedComment?: (commentId: string) => Promise<boolean>;
  /** Called to update the text of a comment the current user owns. */
  onUpdateComment?: (commentId: string, text: string) => Promise<void>;
  /** Called to delete a comment the current user owns. */
  onDeleteComment?: (commentId: string) => Promise<void>;
}

const MAX_COMMENT_LENGTH = 2000;

// ─── Single comment item (recursive) ───

interface CommentItemProps {
  comment: CommentData;
  replies: CommentData[];
  allComments: CommentData[];
  depth: number;
  maxDepth: number;
  mode: "like" | "upvote";
  onAddComment: (content: string, parentId: string | null, mentionedUsers?: MentionRef[]) => Promise<string>;
  onUpvote?: (commentId: string) => Promise<void>;
  getUserVote?: (commentId: string) => Promise<"up" | "down" | null>;
  onLikeComment?: (commentId: string) => Promise<void>;
  hasLikedComment?: (commentId: string) => Promise<boolean>;
  onUpdateComment?: (commentId: string, text: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onSelfDeleted?: (commentId: string, hasReplies: boolean) => void;
  onSelfUpdated?: (commentId: string, newText: string) => void;
  onAnyDeleted?: () => void;
  replyPlaceholder: string;
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
  onLikeComment,
  hasLikedComment,
  onUpdateComment,
  onDeleteComment,
  onSelfDeleted,
  onSelfUpdated,
  onAnyDeleted,
  replyPlaceholder,
}: CommentItemProps) {
  const { user } = useAuth();
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [upvotes, setUpvotes] = useState(comment.upvotes ?? 0);
  const [voteLoading, setVoteLoading] = useState(false);
  const [commentLiked, setCommentLiked] = useState(false);
  const [commentLikesCount, setCommentLikesCount] = useState(comment.likesCount ?? 0);
  const [commentLikeLoading, setCommentLikeLoading] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyMentions, setReplyMentions] = useState<MentionedUser[]>([]);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [localReplies, setLocalReplies] = useState<CommentData[]>(replies);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [editSaving, setEditSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (user && mode === "upvote" && getUserVote) {
      getUserVote(comment.id).then(setVote).catch(() => {});
    }
  }, [comment.id, user, mode, getUserVote]);

  useEffect(() => {
    if (user && mode === "like" && hasLikedComment) {
      hasLikedComment(comment.id).then(setCommentLiked).catch(() => {});
    }
  }, [comment.id, user, mode, hasLikedComment]);

  useEffect(() => {
    setLocalReplies(replies);
  }, [replies]);

  async function handleCommentLike() {
    if (!user || commentLikeLoading || !onLikeComment) return;
    setCommentLikeLoading(true);
    try {
      await onLikeComment(comment.id);
      if (commentLiked) {
        setCommentLiked(false);
        setCommentLikesCount((c) => c - 1);
      } else {
        setCommentLiked(true);
        setCommentLikesCount((c) => c + 1);
      }
    } catch {
      // ignore
    } finally {
      setCommentLikeLoading(false);
    }
  }

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
      const newId = await onAddComment(
        replyText.trim(),
        comment.id,
        replyMentions
      );
      setLocalReplies((prev) => [
        ...prev,
        {
          id: newId,
          parentId: comment.id,
          authorId: user.uid,
          authorName: user.displayName || "Anonymous",
          authorPhotoURL: user.photoURL,
          content: replyText.trim(),
          mentionedUsers: [...replyMentions],
          createdAt: { seconds: Date.now() / 1000 },
          upvotes: 0,
          downvotes: 0,
        },
      ]);
      setReplyText("");
      setReplyMentions([]);
      setShowReply(false);
    } catch {
      // ignore
    } finally {
      setSubmittingReply(false);
    }
  }

  useEffect(() => {
    if (isEditing) {
      editTextareaRef.current?.focus();
    }
  }, [isEditing]);

  async function handleSaveEdit() {
    if (!editText.trim() || editText.trim().length > MAX_COMMENT_LENGTH) return;
    setEditSaving(true);
    try {
      await onUpdateComment!(comment.id, editText.trim());
      onSelfUpdated?.(comment.id, editText.trim());
      setIsEditing(false);
    } catch {
      // ignore
    } finally {
      setEditSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditText(comment.content);
    setIsEditing(false);
  }

  async function handleConfirmDelete() {
    setDeleteLoading(true);
    try {
      await onDeleteComment!(comment.id);
      setShowDeleteConfirm(false);
      onSelfDeleted?.(comment.id, localReplies.length > 0);
      onAnyDeleted?.();
    } catch {
      // ignore
    } finally {
      setDeleteLoading(false);
    }
  }

  const isOwn = !!user && user.uid === comment.authorId;
  const canEdit = isOwn && !!onUpdateComment;
  const canDelete = isOwn && !!onDeleteComment;
  const showMenu = canEdit || canDelete;

  const score = upvotes - (comment.downvotes ?? 0);
  const canNest = depth < maxDepth;

  if (comment.deleted) {
    return (
      <div className={depth > 0 ? "ml-6 sm:ml-10 border-l-2 border-border pl-4" : ""}>
        <div className="py-3">
          <p className="text-sm italic text-muted">(Comment deleted)</p>
        </div>
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
                onLikeComment={onLikeComment}
                hasLikedComment={hasLikedComment}
                onUpdateComment={onUpdateComment}
                onDeleteComment={onDeleteComment}
                replyPlaceholder={replyPlaceholder}
                onSelfDeleted={(replyId, hasSubReplies) => {
                  if (hasSubReplies) {
                    setLocalReplies((prev) =>
                      prev.map((r) => (r.id === replyId ? { ...r, deleted: true } : r))
                    );
                  } else {
                    setLocalReplies((prev) => prev.filter((r) => r.id !== replyId));
                  }
                }}
                onSelfUpdated={(replyId, newText) => {
                  setLocalReplies((prev) =>
                    prev.map((r) =>
                      r.id === replyId
                        ? { ...r, content: newText, editedAt: { seconds: Date.now() / 1000 } }
                        : r
                    )
                  );
                }}
                onAnyDeleted={onAnyDeleted}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

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
            {showMenu && !isEditing && (
              <div className="ml-auto shrink-0">
                <Dropdown
                  trigger={
                    <span
                      aria-label="Comment options"
                      className="flex items-center justify-center w-6 h-6 rounded text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                      </svg>
                    </span>
                  }
                  align="right"
                  items={[
                    ...(canEdit
                      ? [
                          {
                            label: "Edit",
                            onClick: () => {
                              setEditText(comment.content);
                              setIsEditing(true);
                            },
                            icon: (
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                              </svg>
                            ),
                          },
                        ]
                      : []),
                    ...(canDelete
                      ? [
                          {
                            label: "Delete",
                            onClick: () => setShowDeleteConfirm(true),
                            destructive: true,
                            icon: (
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            )}
          </div>
          {isEditing ? (
            <div className="mt-1">
              <textarea
                ref={editTextareaRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                maxLength={MAX_COMMENT_LENGTH + 1}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-ring resize-none"
                aria-label="Edit comment"
              />
              <div className="flex items-center justify-between mt-1.5">
                <span
                  className={`text-xs ${
                    editText.length > MAX_COMMENT_LENGTH
                      ? "text-error-500 font-medium"
                      : "text-muted"
                  }`}
                >
                  {editText.length}/{MAX_COMMENT_LENGTH}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!editText.trim() || editText.length > MAX_COMMENT_LENGTH}
                    isLoading={editSaving}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                {parseMentions(comment.content, comment.mentionedUsers).map((seg, i) =>
                  typeof seg === "string" ? (
                    seg
                  ) : (
                    <Link
                      key={i}
                      href={`/educators/${seg.uid}`}
                      className="text-primary-900 font-semibold hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{seg.displayName}
                    </Link>
                  )
                )}
              </p>
              {comment.editedAt && (
                <span className="text-xs text-muted italic">(edited)</span>
              )}
            </>
          )}

          {!isEditing && (
            <>
              {/* Actions */}
              <div className="flex items-center gap-3 mt-2">
            {mode === "like" && (
              <button
                type="button"
                onClick={handleCommentLike}
                disabled={!user || commentLikeLoading}
                className={`flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                  commentLiked
                    ? "text-error-500"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill={commentLiked ? "currentColor" : "none"}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                {commentLikesCount > 0 && commentLikesCount}
              </button>
            )}
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
            {user && canNest && localReplies.length === 0 && (
              <TextButton
                type="button"
                onClick={() => setShowReply(!showReply)}
                className="p-0 text-xs text-muted hover:text-foreground"
              >
                Reply
              </TextButton>
            )}
          </div>

          {/* Reply input - only shown inline when there are no existing replies yet */}
          {showReply && localReplies.length === 0 && (
            <div className="mt-2 flex gap-2">
              <MentionInput
                value={replyText}
                onChange={setReplyText}
                onMentionsChange={setReplyMentions}
                placeholder={replyPlaceholder}
                className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-ring hover:border-border-strong"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
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
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete comment"
        description="This comment will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        isDestructive
        isLoading={deleteLoading}
      />

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
              onLikeComment={onLikeComment}
              hasLikedComment={hasLikedComment}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
                replyPlaceholder={replyPlaceholder}
              onSelfDeleted={(replyId, hasSubReplies) => {
                if (hasSubReplies) {
                  setLocalReplies((prev) =>
                    prev.map((r) => (r.id === replyId ? { ...r, deleted: true } : r))
                  );
                } else {
                  setLocalReplies((prev) => prev.filter((r) => r.id !== replyId));
                }
              }}
              onSelfUpdated={(replyId, newText) => {
                setLocalReplies((prev) =>
                  prev.map((r) =>
                    r.id === replyId
                      ? { ...r, content: newText, editedAt: { seconds: Date.now() / 1000 } }
                      : r
                  )
                );
              }}
              onAnyDeleted={onAnyDeleted}
            />
          ))}
          {/* Reply button/input sits below all existing replies */}
          {user && canNest && (
            <div className="ml-6 sm:ml-10 border-l-2 border-border pl-4 py-1">
              {!showReply ? (
                <TextButton
                  type="button"
                  onClick={() => setShowReply(true)}
                  className="p-0 text-xs text-muted hover:text-foreground"
                >
                  Reply
                </TextButton>
              ) : (
                <div className="flex gap-2">
                  <MentionInput
                    value={replyText}
                    onChange={setReplyText}
                    onMentionsChange={setReplyMentions}
                    placeholder={replyPlaceholder}
                    className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-ring hover:border-border-strong"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
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
          )}
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
  composerPlaceholder = "Add a comment...",
  replyPlaceholder = "Write a reply...",
  emptyStateMessage = "No comments yet. Be the first to join the conversation.",
  emptyStateGuestMessage = "No comments yet.",
  onAddComment,
  onUpvote,
  getUserVote,
  onLikeComment,
  hasLikedComment,
  onUpdateComment,
  onDeleteComment,
}: CommentThreadProps) {
  const { user } = useAuth();
  const [replyText, setReplyText] = useState("");
  const [topLevelMentions, setTopLevelMentions] = useState<MentionedUser[]>([]);
  const [deleteToast, setDeleteToast] = useState(false);
  const deleteToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localComments, setLocalComments] = useState<CommentData[]>(comments);

  useEffect(() => {
    setLocalComments(comments);
  }, [comments]);

  const topLevel = localComments.filter((c) => !c.parentId);

  function handleAnyDeleted() {
    if (deleteToastTimerRef.current) clearTimeout(deleteToastTimerRef.current);
    setDeleteToast(true);
    deleteToastTimerRef.current = setTimeout(() => setDeleteToast(false), 3000);
  }

  async function handleTopLevelComment() {
    if (!user || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const newId = await onAddComment(
        replyText.trim(),
        null,
        topLevelMentions
      );
      setLocalComments((prev) => [
        ...prev,
        {
          id: newId,
          parentId: null,
          authorId: user.uid,
          authorName: user.displayName || "Anonymous",
          authorPhotoURL: user.photoURL,
          content: replyText.trim(),
          mentionedUsers: topLevelMentions,
          createdAt: { seconds: Date.now() / 1000 },
          upvotes: 0,
          downvotes: 0,
        },
      ]);
      setReplyText("");
      setTopLevelMentions([]);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {deleteToast && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-border bg-secondary-50 px-3 py-2 text-sm text-muted"
        >
          Comment deleted
        </div>
      )}

      {/* Comment input */}
      {user && (
        <div className="flex gap-2">
          <Avatar
            src={user.photoURL}
            alt={user.displayName || "You"}
            size="sm"
          />
          <div className="flex-1 flex gap-2">
            <MentionInput
              value={replyText}
              onChange={setReplyText}
              onMentionsChange={setTopLevelMentions}
              placeholder={composerPlaceholder}
              className="w-full rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-ring hover:border-border-strong"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTopLevelComment();
                }
              }}
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
          {user ? emptyStateMessage : emptyStateGuestMessage}
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
              onLikeComment={onLikeComment}
              hasLikedComment={hasLikedComment}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
              replyPlaceholder={replyPlaceholder}
              onSelfDeleted={(commentId, hasReplies) => {
                if (hasReplies) {
                  setLocalComments((prev) =>
                    prev.map((c) => (c.id === commentId ? { ...c, deleted: true } : c))
                  );
                } else {
                  setLocalComments((prev) => prev.filter((c) => c.id !== commentId));
                }
              }}
              onSelfUpdated={(commentId, newText) => {
                setLocalComments((prev) =>
                  prev.map((c) =>
                    c.id === commentId
                      ? { ...c, content: newText, editedAt: { seconds: Date.now() / 1000 } }
                      : c
                  )
                );
              }}
              onAnyDeleted={handleAnyDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
