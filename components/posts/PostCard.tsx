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
  type Post,
  type PostComment,
} from "@/lib/firestore/posts";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import CommentThread, { type CommentData } from "@/components/comments/CommentThread";
import { notifyMention } from "@/lib/notifications";
import { timeAgo } from "@/lib/utils";
import Tag from "@/components/ui/Tag";

const TYPE_LABELS: Record<string, { label: string; variant: "info" | "success" | "warning" }> = {
  idea: { label: "💡 Idea", variant: "info" },
  resource: { label: "📚 Resource", variant: "success" },
  discussion: { label: "💬 Discussion", variant: "warning" },
};

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  useEffect(() => {
    if (user) {
      hasLikedPost(post.id, user.uid).then(setLiked).catch(() => {});
    }
  }, [post.id, user]);

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
    } catch {
      // ignore
    } finally {
      setLoadingComments(false);
    }
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: `Post by ${post.authorName}`,
        url: `${window.location.origin}/post/${post.id}`,
      });
    } else {
      navigator.clipboard.writeText(
        `${window.location.origin}/post/${post.id}`
      );
    }
  }

  const typeInfo = TYPE_LABELS[post.type] || TYPE_LABELS.idea;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/educators/${post.authorId}`}>
          <Avatar
            src={post.authorPhotoURL}
            alt={post.authorName}
            size="md"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/educators/${post.authorId}`}
              className="text-sm font-semibold text-foreground hover:underline"
            >
              {post.authorName}
            </Link>
            <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
            {post.gradeLevel && (
              <Badge variant="default">{post.gradeLevel}</Badge>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">
            {timeAgo(post.createdAt as { seconds: number } | null)}
          </p>
        </div>
      </div>

      {/* Content — click to expand comments */}
      <p
        className="mt-3 text-sm text-foreground whitespace-pre-wrap cursor-pointer"
        onClick={toggleComments}
        title="Click to view comments"
      >
        {post.content}
      </p>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </div>
      )}

      {/* Stats bar */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted">
        {likesCount > 0 && (
          <span>
            {likesCount} {likesCount === 1 ? "like" : "likes"}
          </span>
        )}
        {commentsCount > 0 && (
          <button
            type="button"
            onClick={toggleComments}
            className="hover:underline cursor-pointer"
          >
            {commentsCount} {commentsCount === 1 ? "comment" : "comments"}
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-2 pt-2 border-t border-border flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={handleLike}
          disabled={!user}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            liked
              ? "text-error-500 bg-error-50 hover:bg-error-100"
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
          Share
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-border">
          <CommentThread
            comments={comments.map(
              (c): CommentData => ({
                id: c.id,
                parentId: c.parentId ?? null,
                authorId: c.authorId,
                authorName: c.authorName,
                authorPhotoURL: c.authorPhotoURL,
                content: c.content,
                createdAt: c.createdAt as { seconds: number } | null,
              })
            )}
            loading={loadingComments}
            maxDepth={1}
            mode="like"
            onAddComment={async (content, parentId, mentionedUids) => {
              if (!user) throw new Error("Not authenticated");
              const newId = await commentOnPost(post.id, {
                parentId: parentId ?? null,
                authorId: user.uid,
                authorName: user.displayName || "Anonymous",
                authorPhotoURL: user.photoURL,
                content,
              });
              if (!parentId) setCommentsCount((c) => c + 1);
              // Send mention notifications (fire-and-forget)
              if (mentionedUids?.length) {
                mentionedUids.forEach((uid) => {
                  notifyMention({
                    recipientId: uid,
                    actorId: user.uid,
                    actorName: user.displayName || "Anonymous",
                    actorPhotoURL: user.photoURL,
                    linkURL: `/`,
                  }).catch(() => {});
                });
              }
              const result = await getPostComments(post.id);
              setComments(result);
              return newId;
            }}
          />
        </div>
      )}
    </div>
  );
}
