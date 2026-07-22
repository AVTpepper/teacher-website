"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  addInspirationComment,
  deleteInspirationComment,
  getInspirationComments,
  getInspirationItem,
  hasLikedInspirationComment,
  likeInspirationComment,
  unlikeInspirationComment,
  updateInspirationComment,
  INSPIRATION_CATEGORIES,
  type InspirationComment,
  type InspirationItem,
} from "@/lib/firestore/inspiration";
import { Button, Card, IPNotice } from "@/components/ui";
import ContentCommentSection from "@/components/comments/ContentCommentSection";
import { type CommentData } from "@/components/comments/CommentThread";

function cleanDisplayText(value: string | null | undefined): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (/^[\W_]+$/.test(trimmed)) return "";
  return trimmed;
}

function categoryLabel(category: InspirationItem["category"]): string {
  return INSPIRATION_CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
}

function categoryIcon(category: InspirationItem["category"]): string {
  return INSPIRATION_CATEGORIES.find((entry) => entry.value === category)?.icon ?? "📌";
}

function sourceHost(url: string): string {
  if (!url) return "External source";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "External source";
  }
}

function getYouTubeEmbedUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (host.endsWith("youtube.com")) {
      const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)/);
      if (embedMatch?.[1]) {
        return `https://www.youtube.com/embed/${embedMatch[1]}`;
      }

      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/]+)/);
      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      }

      const videoId = parsed.searchParams.get("v");
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getYouTubeWatchUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
    }

    if (host.endsWith("youtube.com")) {
      const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)/);
      if (embedMatch?.[1]) {
        return `https://www.youtube.com/watch?v=${embedMatch[1]}`;
      }

      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/]+)/);
      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
      }

      const videoId = parsed.searchParams.get("v");
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function formatCreatedAt(item: InspirationItem): string | null {
  if (!item.createdAt) return null;
  try {
    return item.createdAt.toDate().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export default function InspirationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [item, setItem] = useState<InspirationItem | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [comments, setComments] = useState<InspirationComment[]>([]);
  const [commentsLoadedFor, setCommentsLoadedFor] = useState<string | null>(null);

  const loading = loadedId !== id;
  const commentsLoading = !item || commentsLoadedFor !== item.id;

  useEffect(() => {
    if (!id) return;

    getInspirationItem(id)
      .then((result) => {
        if (!result || !result.isApproved) {
          setNotFound(true);
          setItem(null);
          setLoadedId(id);
          return;
        }

        setItem(result);
        setNotFound(false);
        setLoadedId(id);
      })
      .catch(() => {
        setNotFound(true);
        setItem(null);
        setLoadedId(id);
      });
  }, [id]);

  useEffect(() => {
    if (!item) return;

    getInspirationComments(item.id)
      .then((latest) => {
        setComments(latest);
        setCommentsLoadedFor(item.id);
      })
      .catch(() => {})
      .finally(() => {
        setCommentsLoadedFor(item.id);
      });
  }, [item]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-4 animate-pulse">
        <div className="h-4 w-28 rounded bg-secondary-100" />
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="h-64 bg-secondary-100" />
            <div className="p-6 space-y-3">
              <div className="h-4 w-24 rounded bg-secondary-100" />
              <div className="h-7 w-3/4 rounded bg-secondary-100" />
              <div className="h-4 w-full rounded bg-secondary-100" />
              <div className="h-4 w-5/6 rounded bg-secondary-100" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
              <div className="h-4 w-32 rounded bg-secondary-100" />
              <div className="h-4 w-full rounded bg-secondary-100" />
              <div className="h-4 w-3/4 rounded bg-secondary-100" />
            </div>
            <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
              <div className="h-4 w-28 rounded bg-secondary-100" />
              <div className="h-4 w-full rounded bg-secondary-100" />
              <div className="h-4 w-5/6 rounded bg-secondary-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="py-20 text-center">
        <p className="text-4xl mb-3">✨</p>
        <h2 className="text-xl font-semibold text-foreground">Inspiration Not Found</h2>
        <p className="mt-2 text-sm text-muted">
          This item may have been removed or the link is incorrect.
        </p>
        <Link href="/inspiration">
          <Button variant="primary" className="mt-6">
            Browse Inspiration
          </Button>
        </Link>
      </div>
    );
  }

  const displayTitle = cleanDisplayText(item.title) || "Untitled inspiration";
  const displayDescription = cleanDisplayText(item.description) || "No description provided.";
  const displayCreator = cleanDisplayText(item.creator) || "Community";
  const source = sourceHost(item.sourceURL || item.videoURL || "");
  const mediaUrl = item.videoURL || item.sourceURL || null;
  const youtubeEmbedUrl = getYouTubeEmbedUrl(item.videoURL || item.sourceURL);
  const youtubeWatchUrl = getYouTubeWatchUrl(item.videoURL || item.sourceURL);
  const createdAt = formatCreatedAt(item);
  const thumb = item.thumbnailStorageURL || item.thumbnailURL;
  const commentData: CommentData[] = comments.map((comment) => ({
    id: comment.id,
    parentId: comment.parentId,
    authorId: comment.authorId,
    authorName: comment.authorName,
    authorPhotoURL: comment.authorPhotoURL,
    content: comment.content,
    mentionedUsers: comment.mentionedUsers,
    createdAt: comment.createdAt as { seconds: number } | null,
    editedAt: comment.editedAt as { seconds: number } | null,
    deleted: comment.deleted,
    likesCount: comment.likesCount ?? 0,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Link href="/inspiration" className="hover:text-foreground transition-colors">
            Inspiration
          </Link>
          <span>/</span>
          <span className="text-foreground truncate">{displayTitle}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
              return;
            }
            router.push("/inspiration");
          }}
        >
          Back
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div
            className="h-72 flex items-center justify-center text-6xl"
            style={{ background: "var(--color-secondary-50, #f3f4f6)" }}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="w-full h-full object-cover" />
            ) : (
              <span role="img" aria-label={categoryLabel(item.category)}>
                {categoryIcon(item.category)}
              </span>
            )}
          </div>
          <div className="p-6 space-y-5">
            <div className="space-y-3">
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800">
                {categoryLabel(item.category)}
              </span>
              <h1 className="text-2xl font-bold text-foreground leading-snug">
                {displayTitle}
              </h1>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">
                {displayDescription}
              </p>
            </div>

            {youtubeEmbedUrl ? (
              <div className="overflow-hidden rounded-xl border border-border bg-black">
                <div className="aspect-video">
                  <iframe
                    src={youtubeEmbedUrl}
                    title={displayTitle}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                {youtubeWatchUrl && (
                  <div className="border-t border-border bg-surface px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted">If playback is blocked, open the video directly.</p>
                    <a href={youtubeWatchUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">Open on YouTube</Button>
                    </a>
                  </div>
                )}
              </div>
            ) : mediaUrl ? (
              <div className="rounded-xl border border-border bg-secondary-50 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Open the linked source</p>
                  <p className="text-xs text-muted">{source}</p>
                </div>
                <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="primary">Open Source</Button>
                </a>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Details</p>
              <div className="mt-3 space-y-2 text-sm text-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Creator</span>
                  <span className="font-medium text-right">{displayCreator}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Source</span>
                  <span className="font-medium text-right">{source}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Format</span>
                  <span className="font-medium text-right">{item.videoURL ? "Video" : item.sourceURL ? "External source" : "Community post"}</span>
                </div>
                {createdAt && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">Added</span>
                    <span className="font-medium text-right">{createdAt}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card padding="lg">
        <ContentCommentSection
          comments={commentData}
          loading={commentsLoading}
          title="Discussion"
          description="Share how this idea could be used, ask a question, or add context for other educators."
          ownerId={item.submittedBy ?? null}
          contentLabel={`this inspiration post "${displayTitle}"`}
          linkURL={`/inspiration/${item.id}`}
          mode="like"
          maxDepth={1}
          composerPlaceholder="Add a comment..."
          emptyStateMessage="No comments yet. Start the discussion."
          emptyStateGuestMessage="Sign in to join the discussion."
          addComment={async ({ parentId, authorId, authorName, authorPhotoURL, content, mentionedUsers }) => {
            return addInspirationComment(item.id, {
              parentId,
              authorId,
              authorName,
              authorPhotoURL,
              content,
              mentionedUsers,
            });
          }}
          updateComment={async (commentId, text) => {
            await updateInspirationComment(item.id, commentId, text);
          }}
          deleteComment={async (commentId) => {
            return deleteInspirationComment(item.id, commentId);
          }}
          refreshComments={async () => {
            const latest = await getInspirationComments(item.id);
            setComments(latest);
          }}
          onLikeComment={async (commentId) => {
            if (!user) return;
            const alreadyLiked = await hasLikedInspirationComment(item.id, commentId, user.uid);
            if (alreadyLiked) {
              await unlikeInspirationComment(item.id, commentId, user.uid);
            } else {
              await likeInspirationComment(item.id, commentId, user.uid);
            }
          }}
          hasLikedComment={async (commentId) => {
            if (!user) return false;
            return hasLikedInspirationComment(item.id, commentId, user.uid);
          }}
        />
      </Card>

      <IPNotice />
    </div>
  );
}
