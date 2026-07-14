"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import CommentThread, { type CommentData } from "@/components/comments/CommentThread";
import {
  notifyComment,
  notifyCommentReplied,
  notifyMention,
} from "@/lib/notifications";
import type { DeleteCommentResult } from "@/lib/firestore/commentThreads";
import type { MentionRef } from "@/lib/utils";

interface AddCommentInput {
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  mentionedUsers: MentionRef[];
}

interface ContentCommentSectionProps {
  comments: CommentData[];
  loading?: boolean;
  mode?: "like" | "upvote";
  maxDepth?: number;
  title?: string;
  description?: string;
  ownerId: string | null;
  contentLabel: string;
  linkURL: string;
  composerPlaceholder?: string;
  emptyStateMessage?: string;
  emptyStateGuestMessage?: string;
  addComment: (input: AddCommentInput) => Promise<string>;
  updateComment: (commentId: string, text: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<DeleteCommentResult>;
  refreshComments?: () => Promise<void>;
  onCommentAdded?: () => void;
  onCommentRemoved?: () => void;
  onLikeComment?: (commentId: string) => Promise<void>;
  hasLikedComment?: (commentId: string) => Promise<boolean>;
}

export default function ContentCommentSection({
  comments,
  loading = false,
  mode = "like",
  maxDepth = 1,
  title = "Comments",
  description,
  ownerId,
  contentLabel,
  linkURL,
  composerPlaceholder,
  emptyStateMessage,
  emptyStateGuestMessage,
  addComment,
  updateComment,
  deleteComment,
  refreshComments,
  onCommentAdded,
  onCommentRemoved,
  onLikeComment,
  hasLikedComment,
}: ContentCommentSectionProps) {
  const { user } = useAuth();

  const commentIndex = useMemo(
    () => new Map(comments.map((comment) => [comment.id, comment])),
    [comments]
  );

  async function handleAddComment(
    content: string,
    parentId: string | null,
    mentionedUsers: MentionRef[] = []
  ) {
    if (!user) throw new Error("Not authenticated");

    const newId = await addComment({
      parentId,
      authorId: user.uid,
      authorName: user.displayName || "Anonymous",
      authorPhotoURL: user.photoURL,
      content,
      mentionedUsers,
    });

    if (!parentId && ownerId && ownerId !== user.uid) {
      notifyComment({
        recipientId: ownerId,
        actorId: user.uid,
        actorName: user.displayName || "Someone",
        actorPhotoURL: user.photoURL,
        contentLabel,
        linkURL,
      }).catch(() => {});
    }

    if (parentId) {
      const parentComment = commentIndex.get(parentId);
      if (parentComment && parentComment.authorId !== user.uid) {
        notifyCommentReplied({
          recipientId: parentComment.authorId,
          actorId: user.uid,
          actorName: user.displayName || "Someone",
          actorPhotoURL: user.photoURL,
          linkURL,
        }).catch(() => {});
      }
    }

    mentionedUsers.forEach(({ uid }) => {
      if (uid === user.uid) return;
      notifyMention({
        recipientId: uid,
        actorId: user.uid,
        actorName: user.displayName || "Anonymous",
        actorPhotoURL: user.photoURL,
        linkURL,
      }).catch(() => {});
    });

    onCommentAdded?.();
    if (refreshComments) {
      await refreshComments();
    }

    return newId;
  }

  async function handleDeleteComment(commentId: string) {
    const result = await deleteComment(commentId);
    if (result.removed) {
      onCommentRemoved?.();
    }
    if (refreshComments) {
      await refreshComments();
    }
  }

  return (
    <div className="space-y-4">
      {(title || description) && (
        <div className="space-y-1">
          {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
      )}

      <CommentThread
        comments={comments}
        loading={loading}
        maxDepth={maxDepth}
        mode={mode}
        composerPlaceholder={composerPlaceholder}
        emptyStateMessage={emptyStateMessage}
        emptyStateGuestMessage={emptyStateGuestMessage}
        onAddComment={handleAddComment}
        onLikeComment={onLikeComment}
        hasLikedComment={hasLikedComment}
        onUpdateComment={updateComment}
        onDeleteComment={handleDeleteComment}
      />
    </div>
  );
}