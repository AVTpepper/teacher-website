"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  likePost,
  unlikePost,
  hasLikedPost,
  commentOnPost,
  getPostComments,
  likeComment,
  unlikeComment,
  hasLikedComment,
  updatePostComment,
  deletePostComment,
  updatePost,
  deletePost,
  type Post,
  type PostComment,
} from "@/lib/firestore/posts";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Dropdown from "@/components/ui/Dropdown";
import ContentCommentSection from "@/components/comments/ContentCommentSection";
import { type CommentData } from "@/components/comments/CommentThread";
import { timeAgo, normalizeMultilineText, getCollapsedPreview } from "@/lib/utils";
import Tag from "@/components/ui/Tag";
import type { MentionedUserRef } from "@/lib/firestore/posts";

const MAX_POST_LENGTH = 4000;
const MAX_POST_LINES = 40;
const MAX_POST_BLANK_RUN = 2;

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderContent(
  content: string,
  mentionedUsers?: MentionedUserRef[]
): React.ReactNode {
  if (!mentionedUsers?.length) return content;
  const sorted = [...mentionedUsers].sort((a, b) => b.displayName.length - a.displayName.length);
  const pattern = sorted.map((u) => `@${escapeRegex(u.displayName)}`).join("|");
  const regex = new RegExp(`(${pattern})`, "g");
  const segments = content.split(regex);
  return segments.map((seg, i) => {
    const match = sorted.find((u) => seg === `@${u.displayName}`);
    if (match) {
      return (
        <Link
          key={i}
          href={`/educators/${match.uid}`}
          className="text-primary-900 font-semibold hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {seg}
        </Link>
      );
    }
    return seg;
  });
}

const TYPE_LABELS: Record<string, { label: string; variant: "info" | "success" | "warning" | "default" }> = {
  idea: { label: "💡 Idea", variant: "info" },
  resource: { label: "📚 Resource", variant: "success" },
  discussion: { label: "💬 Discussion", variant: "warning" },
  general: { label: "🌐 General", variant: "default" },
  question: { label: "❓ Question", variant: "info" },
  other: { label: "💭 Other", variant: "default" },
};

interface PostCardProps {
  post: Post;
  onDelete?: (postId: string) => void;
  onUpdate?: (updated: Post) => void;
  textOnlyAvatars?: boolean;
}

export default function PostCard({ post, onDelete, onUpdate, textOnlyAvatars = false }: PostCardProps) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editSaving, setEditSaving] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localContent, setLocalContent] = useState(post.content);
  const [localUpdatedAt, setLocalUpdatedAt] = useState(post.updatedAt);
  const [showFullContent, setShowFullContent] = useState(false);
  const isAuthor = user?.uid === post.authorId;

  useEffect(() => {
    if (user) {
      hasLikedPost(post.id, user.uid).then(setLiked).catch(() => {});
    }
  }, [post.id, user]);

  useEffect(() => {
    setCommentCount(post.commentCount);
  }, [post.id, post.commentCount]);

  const displayedCommentCount = showComments ? comments.length : commentCount;

  async function handleLike() {
    if (!user || likeLoading) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await unlikePost(post.id, user.uid);
        setLiked(false);
        setLikesCount((c) => c - 1);
      } else {
        await likePost(post.id, user.uid);
        setLiked(true);
        setLikesCount((c) => c + 1);
      }
    } catch {
      // Revert on error
    } finally {
      setLikeLoading(false);
    }
  }

  async function toggleComments() {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setShowComments(true);
    setLoadingComments(true);
    try {
      const result = await getPostComments(post.id);
      setComments(result);
      setCommentCount(result.length);
    } catch {
      // ignore
    } finally {
      setLoadingComments(false);
    }
  }

  function handleShare() {
    const url = `${window.location.origin}/home?post=${post.id}`;
    if (navigator.share) {
      navigator.share({ title: `Post by ${post.authorName}`, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSaveEdit() {
    const normalized = normalizeMultilineText(editContent, {
      maxLength: MAX_POST_LENGTH,
      maxLines: MAX_POST_LINES,
      maxConsecutiveBlankLines: MAX_POST_BLANK_RUN,
    });
    if (!normalized || editSaving) return;

    setEditSaving(true);
    try {
      await updatePost(post.id, {
        content: normalized,
        type: post.type,
        tags: post.tags,
        gradeLevel: post.gradeLevel,
        links: post.links,
      });
      setLocalContent(normalized);
      setLocalUpdatedAt({ seconds: Date.now() / 1000 } as typeof post.updatedAt);
      setEditing(false);
      onUpdate?.({ ...post, content: normalized });
    } catch {
      // ignore
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
      setDeleted(true);
      onDelete?.(post.id);
    } catch {
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const typeInfo = TYPE_LABELS[post.type] || TYPE_LABELS.idea;
  const createdSeconds = post.createdAt?.seconds ?? 0;
  const updatedSeconds = localUpdatedAt?.seconds ?? 0;
  const wasEdited = updatedSeconds > createdSeconds;
  const normalizedContent = normalizeMultilineText(localContent, {
    maxConsecutiveBlankLines: MAX_POST_BLANK_RUN,
  });
  const collapsed = getCollapsedPreview(normalizedContent, 360, 8);
  const renderedContent = showFullContent || !collapsed.truncated
    ? normalizedContent
    : collapsed.preview;

  if (deleted) return null;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/educators/${post.authorId}`}>
          <Avatar
            src={post.authorPhotoURL}
            alt={post.authorName}
            size="md"
            preferInitials={textOnlyAvatars}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/educators/${post.authorId}`}
              className="type-body-medium text-sm font-semibold text-foreground hover:underline"
            >
              {post.authorName}
            </Link>
            <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
            {post.gradeLevel && (
              <Badge variant="default">{post.gradeLevel}</Badge>
            )}
          </div>
          <p className="type-body-light text-xs text-muted mt-0.5">
            {timeAgo(post.createdAt as { seconds: number } | null)}
            {wasEdited && <span className="ml-1 italic">(edited)</span>}
          </p>
        </div>
        {isAuthor && (
          <Dropdown
            align="right"
            trigger={
              <span className="flex items-center justify-center w-7 h-7 rounded-full text-muted hover:bg-surface-hover hover:text-foreground transition-colors text-lg leading-none">
                ···
              </span>
            }
            items={[
              {
                label: "Edit",
                onClick: () => {
                  setEditContent(localContent);
                  setEditing(true);
                },
              },
              {
                label: "Delete",
                destructive: true,
                onClick: () => setConfirmDelete(true),
              },
            ]}
          />
        )}
      </div>

      {/* Inline edit form */}
      {editing && (
        <div className="mt-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
          <div className="mt-2 flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={!editContent.trim()}
              isLoading={editSaving}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete post?"
        description="This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleting}
      />

      {/* Content - click to expand comments */}
      {!editing && (
        <div className="mt-3">
          <p className="type-body-medium text-sm text-foreground whitespace-pre-wrap">
            {renderContent(renderedContent, post.mentionedUsers)}
          </p>
          {collapsed.truncated && (
            <button
              type="button"
              onClick={() => setShowFullContent((prev) => !prev)}
              className="mt-1 text-xs font-medium text-primary-900 hover:underline cursor-pointer"
            >
              {showFullContent ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </div>
      )}

      {/* Attached links */}
      {post.links?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-info-50 text-info-700 border border-info-200 hover:bg-info-100 transition-colors max-w-55 truncate"
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

      {/* Stats bar */}
      <div className="type-body-light mt-3 flex items-center gap-4 text-xs text-muted">
        {likesCount > 0 && (
          <span>
            {likesCount} {likesCount === 1 ? "like" : "likes"}
          </span>
        )}
        {displayedCommentCount > 0 && (
          <button
            type="button"
            onClick={toggleComments}
            className="hover:underline cursor-pointer"
          >
            {displayedCommentCount} {displayedCommentCount === 1 ? "comment" : "comments"}
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-2 pt-2 border-t border-border flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={handleLike}
          disabled={!user}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer ${
            liked
              ? "text-error-700 bg-error-100 hover:bg-error-200"
              : "text-muted hover:bg-surface-hover hover:text-foreground"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <svg
            className="h-4 w-4"
            fill={liked ? "currentColor" : "none"}
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
          Like
        </button>

        <button
          type="button"
          onClick={toggleComments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
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
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Comment
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
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
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          {copied ? "✓ Copied!" : "Share"}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-border">
          <ContentCommentSection
            comments={comments.map(
              (c): CommentData => ({
                id: c.id,
                parentId: c.parentId ?? null,
                authorId: c.authorId,
                authorName: c.authorName,
                authorPhotoURL: textOnlyAvatars ? null : c.authorPhotoURL,
                content: c.content,
                mentionedUsers: c.mentionedUsers,
                createdAt: c.createdAt as { seconds: number } | null,
                editedAt: c.editedAt as { seconds: number } | null,
                deleted: c.deleted,
                likesCount: c.likesCount ?? 0,
              })
            )}
            loading={loadingComments}
            title="Comments"
            ownerId={post.authorId}
            contentLabel="your post"
            linkURL={`/home?post=${post.id}`}
            maxDepth={1}
            mode="like"
            composerPlaceholder="Add a comment..."
            onLikeComment={async (commentId) => {
              if (!user) return;
              const alreadyLiked = await hasLikedComment(post.id, commentId, user.uid);
              if (alreadyLiked) {
                await unlikeComment(post.id, commentId, user.uid);
              } else {
                await likeComment(post.id, commentId, user.uid);
              }
            }}
            hasLikedComment={async (commentId) => {
              if (!user) return false;
              return hasLikedComment(post.id, commentId, user.uid);
            }}
            addComment={async ({ parentId, authorId, authorName, authorPhotoURL, content, mentionedUsers }) => {
              return commentOnPost(post.id, {
                parentId,
                authorId,
                authorName,
                authorPhotoURL,
                content,
                mentionedUsers,
              });
            }}
            updateComment={async (commentId, text) => {
              await updatePostComment(post.id, commentId, text);
            }}
            deleteComment={async (commentId) => {
              return deletePostComment(post.id, commentId);
            }}
            refreshComments={async () => {
              const result = await getPostComments(post.id);
              setComments(result);
              setCommentCount(result.length);
            }}
          />
        </div>
      )}
    </div>
  );
}
