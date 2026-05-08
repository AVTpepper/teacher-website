"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getResource,
  getAverageRating,
  trackDownload,
  saveResource,
  unsaveResource,
  hasSavedResource,
  rateResource,
  getUserRating,
  getResourceComments,
  addResourceComment,
  getRelatedResources,
  parseResourceSlug,
  resourceSlug,
  RESOURCE_TYPES,
  type Resource,
  type ResourceComment,
} from "@/lib/firestore/resources";
import { getUser, type UserProfile } from "@/lib/firestore/users";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import CommentThread, {
  type CommentData,
} from "@/components/comments/CommentThread";
import { timeAgo } from "@/lib/utils";

export default function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = parseResourceSlug(rawId);
  const { user } = useAuth();

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

  // Comments
  const [comments, setComments] = useState<ResourceComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Related
  const [related, setRelated] = useState<Resource[]>([]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const result = await getResourceComments(id);
      setComments(result);
    } catch {
      // ignore
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    async function load() {
      try {
        const res = await getResource(id);
        if (!res) {
          setNotFound(true);
          return;
        }
        setResource(res);
        setLocalDownloadCount(res.downloadCount);
        setLocalSavedCount(res.savedByCount);

        // Load author, comments, related in parallel — failures are non-fatal
        const [authorData] = await Promise.all([
          getUser(res.authorId).catch(() => null),
          loadComments().catch(() => {}),
          getRelatedResources(res).then(setRelated).catch(() => {}),
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
  }, [id, loadComments]);

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

  async function handleDownload() {
    if (!resource) return;

    if (user) {
      trackDownload(resource.id, user.uid).catch(() => {});
      setLocalDownloadCount((c) => c + 1);
    }

    // Open file in new tab
    window.open(resource.fileURL, "_blank", "noopener,noreferrer");
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

  // Map comments for the CommentThread component
  const commentData: CommentData[] = comments.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    authorId: c.authorId,
    authorName: c.authorName,
    authorPhotoURL: c.authorPhotoURL,
    content: c.content,
    createdAt: c.createdAt as { seconds: number } | null,
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
        <h1 className="text-2xl font-bold text-foreground">
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

  return (
    <div className="py-8 space-y-8">
      {/* Breadcrumb */}
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

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resource info card */}
          <Card padding="lg">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="primary">{typeLabel}</Badge>
              {resource.gradeLevel && (
                <Badge variant="default">{resource.gradeLevel}</Badge>
              )}
              {resource.subject && (
                <Badge variant="info">{resource.subject}</Badge>
              )}
            </div>

            <h1 className="text-2xl font-bold text-foreground">
              {resource.title}
            </h1>

            <p className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {resource.description}
            </p>

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
                          ? "text-warning-500"
                          : star <= Math.round(avgRating)
                            ? "text-warning-300"
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
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={handleDownload}>
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
                Download
              </Button>

              {user && (
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
              )}
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
          </Card>

          {/* Comments section */}
          <Card padding="lg">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Discussion
            </h2>
            <CommentThread
              comments={commentData}
              loading={commentsLoading}
              mode="like"
              maxDepth={2}
              onAddComment={async (content, parentId) => {
                if (!user) throw new Error("Must be logged in");
                const newId = await addResourceComment(resource.id, {
                  parentId,
                  authorId: user.uid,
                  authorName: user.displayName || "Anonymous",
                  authorPhotoURL: user.photoURL,
                  content,
                });
                await loadComments();
                return newId;
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
