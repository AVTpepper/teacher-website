"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getResource,
  updateResource,
  getAverageRating,
  trackDownload,
  saveResource,
  unsaveResource,
  hasSavedResource,
  rateResource,
  getUserRating,
  getRelatedResources,
  parseResourceSlug,
  resourceSlug,
  deleteResource,
  getResourceComments,
  addResourceComment,
  updateResourceComment,
  deleteResourceComment,
  likeResourceComment,
  unlikeResourceComment,
  hasLikedResourceComment,
  RESOURCE_TYPES,
  type Resource,
  type ResourceComment,
} from "@/lib/firestore/resources";
import { getUser, type UserProfile } from "@/lib/firestore/users";
import { Avatar, Badge, Button, Card, ConfirmDialog, IPNotice } from "@/components/ui";
import ContentCommentSection from "@/components/comments/ContentCommentSection";
import { type CommentData } from "@/components/comments/CommentThread";
import { timeAgo } from "@/lib/utils";
import { notifyResourceLiked, notifyResourceDownloaded, notifyResourceShared } from "@/lib/notifications";

export default function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = parseResourceSlug(rawId);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const resourcePath = `/resources/${rawId}`;

  const [resource, setResource] = useState<Resource | null>(null);
  const [author, setAuthor] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Save state
  const [saved, setSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [localSavedCount, setLocalSavedCount] = useState(0);

  // Rating state
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Download
  const [localDownloadCount, setLocalDownloadCount] = useState(0);

  // Related
  const [related, setRelated] = useState<Resource[]>([]);
  const [copied, setCopied] = useState(false);

  // Delete
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Comments
  const [comments, setComments] = useState<ResourceComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  async function loadComments(resourceId: string) {
    setCommentsLoading(true);
    try {
      const result = await getResourceComments(resourceId);
      setComments(result);
    } catch {
      // ignore
    } finally {
      setCommentsLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;

    async function load() {
      try {
        const res = await getResource(id);
        if (!res) {
          setNotFound(true);
          return;
        }
        if (res.isPublic === false && (!user || user.uid !== res.authorId)) {
          setNotFound(true);
          return;
        }
        setResource(res);
        setLocalDownloadCount(res.downloadCount);
        setLocalSavedCount(res.savedByCount);

        // Load author + related in parallel - failures are non-fatal
        const [authorData] = await Promise.all([
          getUser(res.authorId).catch(() => null),
          getRelatedResources(res).then(setRelated).catch(() => {}),
          loadComments(res.id),
        ]);
        setAuthor(authorData);
      } catch (err) {
        console.error("Failed to load resource:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, id, user]);

  // Load user-specific states
  useEffect(() => {
    if (!user || !resource) return;

    hasSavedResource(resource.id, user.uid)
      .then(setSaved)
      .catch(() => {});

    getUserRating(resource.id, user.uid)
      .then(setUserRating)
      .catch(() => {});
  }, [user, resource]);

  async function handleDeleteResource() {
    if (!resource || deleting) return;
    setDeleting(true);
    try {
      await deleteResource(resource.id);
      router.push("/resources");
    } catch {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }

  async function handleDownload() {
    if (!resource || !resource.fileURL) return;

    if (user) {
      trackDownload(resource.id, user.uid).catch(() => {});
      setLocalDownloadCount((c) => c + 1);
      // Notify resource author (fire-and-forget, skip self-download)
      if (resource.authorId !== user.uid) {
        notifyResourceDownloaded({
          recipientId: resource.authorId,
          actorId: user.uid,
          actorName: user.displayName || "Someone",
          actorPhotoURL: user.photoURL,
          resourceTitle: resource.title,
          linkURL: resourcePath,
        }).catch(() => {});
      }
    }

    // Open file in new tab
    window.open(resource.fileURL, "_blank", "noopener,noreferrer");
  }

  async function handlePublishResource() {
    if (!resource || publishing) return;
    setPublishing(true);
    try {
      await updateResource(resource.id, { isPublic: true });
      setResource({ ...resource, isPublic: true });
    } finally {
      setPublishing(false);
    }
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: resource?.title ?? "Resource", url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    // Notify resource author (fire-and-forget, skip self-share)
    if (user && resource && resource.authorId !== user.uid) {
      notifyResourceShared({
        recipientId: resource.authorId,
        actorId: user.uid,
        actorName: user.displayName || "Someone",
        actorPhotoURL: user.photoURL,
        resourceTitle: resource.title,
        linkURL: resourcePath,
      }).catch(() => {});
    }
  }

  async function handleToggleSave() {
    if (!user || !resource || savingToggle) return;
    setSavingToggle(true);
    try {
      if (saved) {
        await unsaveResource(resource.id, user.uid);
        setSaved(false);
        setLocalSavedCount((c) => c - 1);
      } else {
        await saveResource(resource.id, user.uid);
        setSaved(true);
        setLocalSavedCount((c) => c + 1);
        // Notify resource author (fire-and-forget)
        if (resource.authorId !== user.uid) {
          notifyResourceLiked({
            recipientId: resource.authorId,
            actorId: user.uid,
            actorName: user.displayName || "Someone",
            actorPhotoURL: user.photoURL,
            resourceTitle: resource.title,
            linkURL: resourcePath,
          }).catch(() => {});
        }
      }
    } catch {
      // ignore
    } finally {
      setSavingToggle(false);
    }
  }

  async function handleRate(rating: number) {
    if (!user || !resource || ratingLoading) return;
    setRatingLoading(true);
    try {
      await rateResource(resource.id, user.uid, rating);
      // Refresh the resource to get updated rating counters
      const updated = await getResource(resource.id);
      if (updated) setResource(updated);
      setUserRating(rating);
    } catch {
      // ignore
    } finally {
      setRatingLoading(false);
    }
  }

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

  // ─── Loading ───
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse py-8">
        <div className="h-4 w-24 bg-secondary-100 rounded" />
        <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <div className="h-6 w-2/3 bg-secondary-100 rounded" />
          <div className="h-3 w-full bg-secondary-100 rounded" />
          <div className="h-3 w-3/4 bg-secondary-100 rounded" />
        </div>
      </div>
    );
  }

  // ─── Not found ───
  if (notFound || !resource) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">📄</div>
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
          Resource Not Found
        </h1>
        <p className="text-sm text-muted mt-2">
          This resource may have been removed or the link is incorrect.
        </p>
        <Link href="/resources">
          <Button variant="outline" className="mt-4">
            Back to Resources
          </Button>
        </Link>
      </div>
    );
  }

  const avgRating = getAverageRating(resource);
  const typeLabel =
    RESOURCE_TYPES.find((t) => t.value === resource.type)?.label ??
    resource.type;
  const isOwner = user?.uid === resource.authorId;

  return (
    <div className={`py-8 space-y-8 ${user ? "pb-24 sm:pb-8" : ""}`}>
      {/* Breadcrumb + back */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Link
            href="/resources"
            className="hover:text-foreground transition-colors"
          >
            Resources
          </Link>
          <span>/</span>
          <span className="text-foreground truncate">{resource.title}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
              return;
            }
            router.push("/resources");
          }}
        >
          Back
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resource info card */}
          <Card padding="lg">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="primary">{typeLabel}</Badge>
              {resource.isPublic === false && <Badge variant="warning">Draft</Badge>}
              {resource.gradeLevel && (
                <Badge variant="default">{resource.gradeLevel}</Badge>
              )}
              {resource.subject && (
                <Badge variant="info">{resource.subject}</Badge>
              )}
            </div>

            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              {resource.title}
            </h1>

            <p className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {resource.description}
            </p>

            {resource.contentSections && resource.contentSections.length > 0 && (
              <div className="mt-5 space-y-4">
                {resource.contentSections.map((section) => (
                  <section key={section.heading} className="rounded-lg border border-border px-4 py-3">
                    <h2 className="text-sm font-semibold text-foreground">{section.heading}</h2>
                    <p className="mt-2 text-sm text-muted whitespace-pre-wrap">{section.body}</p>
                  </section>
                ))}
              </div>
            )}

            {/* Tags */}
            {resource.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {resource.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 text-xs rounded-full bg-secondary-100 text-secondary-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {resource.sourceLessonId && resource.sourceLessonTitle && (
              <div className="mt-4 rounded-lg border border-border bg-secondary-50 px-4 py-3 text-sm text-secondary-900">
                Linked lesson:{" "}
                <Link
                  href={`/lesson-builder/${resource.sourceLessonId}`}
                  className="font-medium underline underline-offset-2"
                >
                  {resource.sourceLessonTitle}
                </Link>
              </div>
            )}

            {/* Attached links */}
            {resource.links?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {resource.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-info-50 text-info-700 border border-info-200 hover:bg-info-100 transition-colors max-w-65 truncate"
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

            {/* Stats + actions bar */}
            <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border pt-4">
              {/* Rating display */}
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    disabled={!user || ratingLoading}
                    onClick={() => handleRate(star)}
                    className="disabled:cursor-not-allowed cursor-pointer"
                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  >
                    <svg
                      className={`h-5 w-5 transition-colors ${
                        star <= (userRating ?? 0)
                          ? "text-primary-400"
                          : star <= Math.round(avgRating)
                            ? "text-primary-300"
                            : "text-secondary-200"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
                <span className="ml-1 text-sm text-muted">
                  {avgRating > 0
                    ? `${avgRating.toFixed(1)} (${resource.ratingCount})`
                    : "No ratings"}
                </span>
              </div>

              <span className="text-secondary-300">|</span>

              {/* Download count */}
              <span className="flex items-center gap-1 text-sm text-muted">
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
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                {localDownloadCount} downloads
              </span>

              {/* Saved count */}
              <span className="flex items-center gap-1 text-sm text-muted">
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
                    d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
                  />
                </svg>
                {localSavedCount} saves
              </span>
            </div>

            {/* Action buttons */}
            <div className="mt-4 space-y-3">
              {!user && !authLoading && (
                <div className="rounded-xl border border-border bg-secondary-50 p-4">
                  <p className="text-sm font-semibold text-foreground mb-1">
                    🔒 Sign in to download and save this resource
                  </p>
                  <p className="text-xs text-muted mb-3">
                    Create a free account to access and save educational resources shared by real teachers.
                  </p>
                  <div className="flex gap-2">
                    <Link href="/auth/login">
                      <Button variant="outline" size="sm">Sign In</Button>
                    </Link>
                    <Link href="/auth/signup">
                      <Button variant="secondary" size="sm">Create Account</Button>
                    </Link>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {user && (
                  <>
                    <Button onClick={handleDownload} disabled={!resource.fileURL}>
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
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                        />
                      </svg>
                      {resource.fileURL ? "Download" : "Download unavailable"}
                    </Button>
                    <Button
                      variant={saved ? "secondary" : "outline"}
                      onClick={handleToggleSave}
                      isLoading={savingToggle}
                    >
                      <svg
                        className="h-4 w-4"
                        fill={saved ? "currentColor" : "none"}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
                        />
                      </svg>
                      {saved ? "Saved" : "Save"}
                    </Button>
                    {isOwner && (
                      <>
                        {resource.isPublic === false && (
                          <Button
                            variant="secondary"
                            onClick={handlePublishResource}
                            isLoading={publishing}
                          >
                            Publish
                          </Button>
                        )}
                        <Link href={`/resources/upload?edit=${resource.id}`}>
                          <Button variant="outline">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                            Edit
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          onClick={() => setConfirmDeleteOpen(true)}
                          className="text-destructive hover:bg-destructive/10 border-destructive/30"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                          Delete
                        </Button>
                      </>
                    )}
                  </>
                )}
                <Button variant="outline" onClick={handleShare}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                  </svg>
                  {copied ? "✓ Copied!" : "Share"}
                </Button>
              </div>
            </div>

            {/* File info */}
            {resource.fileName && (
              <div className="mt-4 text-xs text-muted">
                File: {resource.fileName}
              </div>
            )}

            {/* Timestamp */}
            <div className="mt-1 text-xs text-muted">
              Shared{" "}
              {timeAgo(resource.createdAt as { seconds: number } | null)}
            </div>
            {/* IP Notice */}
            <IPNotice />          </Card>

          <Card padding="lg">
            <ContentCommentSection
              comments={commentData}
              loading={commentsLoading}
              title="Comments"
              description="Ask a question, share how you'd use it, or suggest an improvement."
              ownerId={resource.authorId}
              contentLabel={`your resource "${resource.title}"`}
              linkURL={resourcePath}
              maxDepth={1}
              mode="like"
              composerPlaceholder="Add a comment..."
              addComment={async ({ parentId, authorId, authorName, authorPhotoURL, content, mentionedUsers }) => {
                return addResourceComment(resource.id, {
                  parentId,
                  authorId,
                  authorName,
                  authorPhotoURL,
                  content,
                  mentionedUsers,
                });
              }}
              updateComment={async (commentId, text) => {
                await updateResourceComment(resource.id, commentId, text);
              }}
              deleteComment={async (commentId) => {
                return deleteResourceComment(resource.id, commentId);
              }}
              refreshComments={async () => {
                await loadComments(resource.id);
              }}
              onLikeComment={async (commentId) => {
                if (!user) return;
                const alreadyLiked = await hasLikedResourceComment(resource.id, commentId, user.uid);
                if (alreadyLiked) {
                  await unlikeResourceComment(resource.id, commentId, user.uid);
                } else {
                  await likeResourceComment(resource.id, commentId, user.uid);
                }
              }}
              hasLikedComment={async (commentId) => {
                if (!user) return false;
                return hasLikedResourceComment(resource.id, commentId, user.uid);
              }}
            />
          </Card>

        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Author card */}
          <Card padding="lg">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Shared by
            </h3>
            <Link
              href={`/educators/${resource.authorId}`}
              className="flex items-center gap-3 group"
            >
              <Avatar
                src={author?.photoURL ?? resource.authorPhotoURL}
                alt={author?.displayName ?? resource.authorName}
                size="lg"
              />
              <div>
                <p className="font-semibold text-foreground group-hover:underline">
                  {author?.displayName ?? resource.authorName}
                </p>
                {author?.gradeLevel && (
                  <p className="text-xs text-muted">{author.gradeLevel}</p>
                )}
                {author?.school && (
                  <p className="text-xs text-muted">{author.school}</p>
                )}
              </div>
            </Link>
            {author?.bio && (
              <p className="mt-3 text-xs text-muted line-clamp-3">
                {author.bio}
              </p>
            )}
            <Link href={`/educators/${resource.authorId}`}>
              <Button variant="outline" size="sm" className="mt-3 w-full">
                View Profile
              </Button>
            </Link>
          </Card>

          {/* Related resources */}
          {related.length > 0 && (
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Related Resources
              </h3>
              <div className="space-y-3">
                {related.map((r) => (
                  <RelatedResourceItem key={r.id} resource={r} />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Mobile sticky action bar - logged-in only */}
      {user && (
        <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-surface/95 backdrop-blur-sm border-t border-border px-4 py-3 flex items-center gap-2">
          <Button onClick={handleDownload} className="flex-1 justify-center">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download
          </Button>
          <Button
            variant={saved ? "secondary" : "outline"}
            onClick={handleToggleSave}
            isLoading={savingToggle}
            className="flex-1 justify-center"
          >
            <svg className="h-4 w-4" fill={saved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
            </svg>
            {saved ? "Saved" : "Save"}
          </Button>
          <Button variant="outline" onClick={handleShare} className="flex-1 justify-center">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
            {copied ? "✓" : "Share"}
          </Button>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteResource}
        title="Delete resource"
        description="This will permanently delete this resource. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleting}
      />
    </div>
  );
}

function RelatedResourceItem({ resource }: { resource: Resource }) {
  const typeLabel =
    RESOURCE_TYPES.find((t) => t.value === resource.type)?.label ??
    resource.type;

  return (
    <Link
      href={`/resources/${resourceSlug(resource.title, resource.id)}`}
      className="block group rounded-lg p-2 -mx-2 hover:bg-surface-hover transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground group-hover:underline line-clamp-2">
            {resource.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="primary" className="text-[10px]">
              {typeLabel}
            </Badge>
            <span className="flex items-center gap-0.5 text-xs text-muted">
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              {resource.downloadCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
