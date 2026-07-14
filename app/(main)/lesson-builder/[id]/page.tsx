"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getLesson,
  deleteLesson,
  trackLessonDownload,
  getLessonComments,
  addLessonComment,
  likeLessonComment,
  unlikeLessonComment,
  hasLikedLessonComment,
  updateLessonComment,
  deleteLessonComment,
  type Lesson,
  type LessonComment,
} from "@/lib/firestore/lessons";
import {
  getResourcesByIds,
  resourceSlug,
  RESOURCE_TYPES,
  type Resource,
} from "@/lib/firestore/resources";
import { getUser, type UserProfile } from "@/lib/firestore/users";
import { getUserRating, submitRating } from "@/lib/firestore/ratings";
import { Avatar, Badge, Button, Card, ConfirmDialog, IPNotice } from "@/components/ui";
import ContentCommentSection from "@/components/comments/ContentCommentSection";
import { type CommentData } from "@/components/comments/CommentThread";
import { timeAgo } from "@/lib/utils";
import { notifyLessonRated, notifyLessonDownloaded, notifyLessonShared } from "@/lib/notifications";
import { pdf } from "@react-pdf/renderer";
import LessonPDFDocument from "@/components/lessons/LessonPDFDocument";

export default function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [author, setAuthor] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [linkedResources, setLinkedResources] = useState<Resource[]>([]);

  // Download
  const [localDownloadCount, setLocalDownloadCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // Delete
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Ratings
  const [ratingAverage, setRatingAverage] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingHover, setRatingHover] = useState<number | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Comments
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const result = await getLessonComments(id);
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
        const res = await getLesson(id);
        if (!res) {
          setNotFound(true);
          return;
        }
        setLesson(res);
        setLocalDownloadCount(res.downloadCount);
        setRatingAverage(res.ratingAverage ?? 0);
        setRatingCount(res.ratingCount ?? 0);

        if (res.linkedResourceIds && res.linkedResourceIds.length > 0) {
          const resources = await getResourcesByIds(res.linkedResourceIds);
          setLinkedResources(resources);
        } else {
          setLinkedResources([]);
        }

        const [authorData] = await Promise.all([
          getUser(res.authorId),
          loadComments(),
        ]);
        setAuthor(authorData);

        // Load user's existing rating
        if (user) {
          getUserRating(user.uid, id).then(setUserRating).catch(() => {});
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, loadComments, user]);

  async function handleDeleteLesson() {
    if (!lesson || deleting) return;
    setDeleting(true);
    try {
      await deleteLesson(lesson.id);
      router.push("/lesson-builder");
    } catch {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }

  async function handleRate(value: number) {
    if (!user || !lesson || ratingSubmitting) return;
    setRatingSubmitting(true);
    try {
      await submitRating(user.uid, lesson.id, value);
      const wasRated = userRating !== null;
      const prevTotal = ratingAverage * ratingCount;
      const newCount = wasRated ? ratingCount : ratingCount + 1;
      const newAvg = wasRated
        ? (prevTotal - (userRating ?? 0) + value) / newCount
        : (prevTotal + value) / newCount;
      setUserRating(value);
      setRatingCount(newCount);
      setRatingAverage(Math.round(newAvg * 10) / 10);
      // Notify lesson author (fire-and-forget, skip self-rating)
      if (lesson.authorId !== user.uid) {
        notifyLessonRated({
          recipientId: lesson.authorId,
          actorId: user.uid,
          actorName: user.displayName || "Someone",
          actorPhotoURL: user.photoURL,
          lessonTitle: lesson.title,
          linkURL: window.location.href,
        }).catch(() => {});
      }
    } finally {
      setRatingSubmitting(false);
    }
  }

  async function handleDownload() {
    if (!lesson) return;

    if (user) {
      trackLessonDownload(lesson.id, user.uid).catch(() => {});
      setLocalDownloadCount((c) => c + 1);
      // Notify lesson author (fire-and-forget, skip self-download)
      if (lesson.authorId !== user.uid) {
        notifyLessonDownloaded({
          recipientId: lesson.authorId,
          actorId: user.uid,
          actorName: user.displayName || "Someone",
          actorPhotoURL: user.photoURL,
          lessonTitle: lesson.title,
          linkURL: window.location.href,
        }).catch(() => {});
      }
    }

    // Generate a PDF and trigger download
    const blob = await pdf(<LessonPDFDocument lesson={lesson} authorName={lesson.authorName} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lesson.title.replace(/[^a-zA-Z0-9 ]/g, "").trim()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleRemix() {
    if (!lesson) return;
    router.push(`/lesson-builder/new?remix=${lesson.id}`);
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: lesson?.title ?? "Lesson", url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    // Notify lesson author (fire-and-forget, skip self-share)
    if (user && lesson && lesson.authorId !== user.uid) {
      notifyLessonShared({
        recipientId: lesson.authorId,
        actorId: user.uid,
        actorName: user.displayName || "Someone",
        actorPhotoURL: user.photoURL,
        lessonTitle: lesson.title,
        linkURL: window.location.href,
      }).catch(() => {});
    }
  }

  // Map comments for CommentThread
  const commentData: CommentData[] = comments.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    authorId: c.authorId,
    authorName: c.authorName,
    authorPhotoURL: c.authorPhotoURL,
    content: c.content,
    mentionedUsers: c.mentionedUsers,
    createdAt: c.createdAt as { seconds: number } | null,
    editedAt: c.editedAt as { seconds: number } | null,
    deleted: c.deleted,
    likesCount: c.likesCount ?? 0,
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
  if (notFound || !lesson) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">📝</div>
        <h1 className="text-2xl font-bold text-foreground">
          Lesson Not Found
        </h1>
        <p className="text-sm text-muted mt-2">
          This lesson may have been removed or the link is incorrect.
        </p>
        <Link href="/lesson-builder">
          <Button variant="outline" className="mt-4">
            Back to Lesson Builder
          </Button>
        </Link>
      </div>
    );
  }

  const isOwner = user?.uid === lesson.authorId;
  const objectives = lesson.objectives ?? [];
  const materials = lesson.materials ?? [];
  const steps = lesson.steps ?? [];
  const checkForUnderstanding = lesson.checkForUnderstanding ?? [];
  const assessments = lesson.assessments ?? [];
  const attachments = lesson.attachments ?? [];
  const visibleLinkedResources = linkedResources.filter(
    (resource) => resource.isPublic !== false || isOwner
  );

  return (
    <div className="py-8 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link
          href="/lesson-builder"
          className="hover:text-foreground transition-colors"
        >
          Lesson Builder
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{lesson.title}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lesson card */}
          <Card padding="lg" className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {lesson.gradeLevel && (
                  <Badge variant="default">{lesson.gradeLevel}</Badge>
                )}
                {lesson.subject && (
                  <Badge variant="info">{lesson.subject}</Badge>
                )}
                {!lesson.isPublic && (
                  <Badge variant="warning">Draft</Badge>
                )}
                {lesson.remixedFromId && (
                  <Badge variant="success">Modified</Badge>
                )}
              </div>

              <h1 className="text-2xl font-bold text-foreground">
                {lesson.title}
              </h1>

              {/* Rating display + interactive widget */}
              <div className="mt-2 flex flex-wrap items-center gap-4">
                {/* Aggregate display */}
                {ratingCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`h-4 w-4 shrink-0 ${
                            ratingAverage >= star - 0.25
                              ? "text-amber-400"
                              : ratingAverage >= star - 0.75
                              ? "text-amber-300"
                              : "text-border"
                          }`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z" />
                        </svg>
                      ))}
                    </span>
                    <span className="text-sm font-medium text-foreground">{ratingAverage.toFixed(1)}</span>
                    <span className="text-xs text-muted">({ratingCount} rating{ratingCount !== 1 ? "s" : ""})</span>
                  </div>
                )}

                {/* Interactive stars for logged-in non-owners */}
                {user && !isOwner && (
                  <div className="flex items-center gap-1" role="group" aria-label="Rate this lesson">
                    <span className="text-xs text-muted mr-1">{userRating ? "Your rating:" : "Rate:"}</span>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (ratingHover ?? userRating ?? 0) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          disabled={ratingSubmitting}
                          onClick={() => handleRate(star)}
                          onMouseEnter={() => setRatingHover(star)}
                          onMouseLeave={() => setRatingHover(null)}
                          aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                          className="cursor-pointer disabled:opacity-50 transition-transform hover:scale-110"
                        >
                          <svg
                            className={`h-5 w-5 transition-colors ${active ? "text-amber-400" : "text-border"}`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z" />
                          </svg>
                        </button>
                      );
                    })}
                    {ratingSubmitting && <span className="ml-1 text-xs text-muted">Saving...</span>}
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center gap-3">
                <Link href={`/educators/${lesson.authorId}`}>
                  <Avatar
                    src={lesson.authorPhotoURL}
                    alt={lesson.authorName}
                    size="sm"
                  />
                </Link>
                <div>
                  <Link
                    href={`/educators/${lesson.authorId}`}
                    className="text-sm font-semibold text-foreground hover:underline"
                  >
                    {lesson.authorName}
                  </Link>
                  <p className="text-xs text-muted">
                    {timeAgo(
                      lesson.createdAt as { seconds: number } | null
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Objectives */}
            {/* IP attribution notice — below metadata, above content */}
            <p className="text-xs text-muted">
              The content of this lesson plan is the intellectual property of{" "}
              <span className="font-medium text-foreground">{lesson.authorName}</span>. All rights reserved.
            </p>

            {objectives.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  🎯 Learning Objectives
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                  {objectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Materials */}
            {user ? (
              materials.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    📦 Materials Needed
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                    {materials.map((mat, i) => (
                      <li key={i}>{mat}</li>
                    ))}
                  </ul>
                </div>
              )
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-secondary-50 p-5 text-center">
                <p className="text-sm font-medium text-foreground mb-1">📦 Materials &amp; Lesson Steps are members-only</p>
                <p className="text-xs text-muted mb-3">Create a free account to view the full lesson plan.</p>
                <div className="flex justify-center gap-2">
                  <Link href="/auth/signup">
                    <Button variant="secondary" size="sm">Create Account</Button>
                  </Link>
                  <Link href="/auth/login">
                    <Button variant="outline" size="sm">Sign In</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Duration */}
            {user && lesson.duration && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">⏱</span>
                <span className="font-medium text-foreground">{lesson.duration}</span>
              </div>
            )}

            {/* Steps */}
            {user && steps.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  📋 Lesson Plan
                </h3>
                <div className="space-y-4">
                  {steps.map((step, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-primary-300 pl-4"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          Step {i + 1}
                          {step.title ? `: ${step.title}` : ""}
                        </p>
                        {step.duration && (
                          <span className="shrink-0 text-xs text-muted">{step.duration}</span>
                        )}
                      </div>
                      {step.description && (
                        <p className="mt-1 text-sm text-muted whitespace-pre-wrap">
                          {step.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Check for Understanding */}
            {user && checkForUnderstanding.filter(Boolean).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  🤔 Check for Understanding
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                  {checkForUnderstanding.filter(Boolean).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Assessment */}
            {user && assessments.filter(Boolean).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  📝 Assessment
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                  {assessments.filter(Boolean).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Attachments */}
            {user && attachments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  📎 Attachments
                </h3>
                <div className="space-y-1">
                  {attachments.map((att, i) => (
                    <a
                      key={i}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary-900 hover:underline"
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
                          d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"
                        />
                      </svg>
                      {att.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {visibleLinkedResources.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  🧰 Linked Teaching Assets
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {visibleLinkedResources.map((resource) => {
                    const typeLabel =
                      RESOURCE_TYPES.find((type) => type.value === resource.type)?.label ?? resource.type;

                    return (
                      <Link
                        key={resource.id}
                        href={`/resources/${resourceSlug(resource.title, resource.id)}`}
                        className="rounded-lg border border-border bg-surface-hover px-4 py-3 transition-colors hover:border-primary-300"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{resource.title}</span>
                          {resource.isPublic === false && <Badge variant="warning">Draft</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted">{typeLabel}</p>
                        <p className="mt-2 text-sm text-muted line-clamp-3">
                          {resource.description}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Auth wall for guests */}
            {!user && !authLoading && (
              <div className="rounded-xl border border-border bg-secondary-50 p-6 text-center">
                <div className="text-3xl mb-2">🔒</div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  Sign in to view the full lesson plan
                </p>
                <p className="text-xs text-muted mb-4">
                  Create a free account to view lesson steps, materials, and download complete lesson plans.
                </p>
                <div className="flex justify-center gap-2">
                  <Link href="/auth/login">
                    <Button variant="outline" size="sm">Sign In</Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button variant="secondary" size="sm">Create Account</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Actions bar */}
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              {user && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/lesson-builder/${lesson.id}/preview`, { scroll: true })}
                  >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                      </svg>
                      Preview
                  </Button>

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

                  {!isOwner && (
                    <Button variant="outline" onClick={handleRemix}>
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
                          d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3"
                        />
                      </svg>
                      Modify
                    </Button>
                  )}

                  {isOwner && (
                    <>
                      <Link href={`/lesson-builder/new?edit=${lesson.id}`}>
                        <Button variant="outline">Edit</Button>
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

                  <Button variant="outline" onClick={handleShare}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                    </svg>
                    {copied ? "✓ Copied!" : "Share"}
                  </Button>

                  <span className="flex items-center gap-1 text-sm text-muted ml-auto">
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
                </>
              )}
            </div>
          </Card>

          {/* Comments */}
          <Card padding="lg">
            <ContentCommentSection
              comments={commentData}
              loading={commentsLoading}
              title="Comments"
              description="Ask a question, share how you'd use it, or suggest an improvement."
              ownerId={lesson.authorId}
              contentLabel={`your lesson "${lesson.title}"`}
              linkURL={typeof window !== "undefined" ? window.location.href : `/lesson-builder/${lesson.id}`}
              mode="like"
              maxDepth={1}
              composerPlaceholder="Add a comment..."
              addComment={async ({ parentId, authorId, authorName, authorPhotoURL, content, mentionedUsers }) => {
                return addLessonComment(lesson.id, {
                  parentId,
                  authorId,
                  authorName,
                  authorPhotoURL,
                  content,
                  mentionedUsers,
                });
              }}
              updateComment={async (commentId, text) => {
                await updateLessonComment(lesson.id, commentId, text);
              }}
              deleteComment={async (commentId) => {
                return deleteLessonComment(lesson.id, commentId);
              }}
              refreshComments={loadComments}
              onLikeComment={async (commentId) => {
                if (!user) return;
                const alreadyLiked = await hasLikedLessonComment(lesson.id, commentId, user.uid);
                if (alreadyLiked) {
                  await unlikeLessonComment(lesson.id, commentId, user.uid);
                } else {
                  await likeLessonComment(lesson.id, commentId, user.uid);
                }
              }}
              hasLikedComment={async (commentId) => {
                if (!user) return false;
                return hasLikedLessonComment(lesson.id, commentId, user.uid);
              }}
            />
          </Card>

          {/* IP Notice */}
          <IPNotice />
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Author card */}
          <Card padding="lg">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Created by
            </h3>
            <Link
              href={`/educators/${lesson.authorId}`}
              className="flex items-center gap-3 group"
            >
              <Avatar
                src={author?.photoURL ?? lesson.authorPhotoURL}
                alt={author?.displayName ?? lesson.authorName}
                size="lg"
              />
              <div>
                <p className="font-semibold text-foreground group-hover:underline">
                  {author?.displayName ?? lesson.authorName}
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
            <Link href={`/educators/${lesson.authorId}`}>
              <Button variant="outline" size="sm" className="mt-3 w-full">
                View Profile
              </Button>
            </Link>
          </Card>

          {/* Lesson details sidebar */}
          <Card padding="lg">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Lesson Details
            </h3>
            <dl className="space-y-2 text-sm">
              {lesson.gradeLevel && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted shrink-0">Grade Level</dt>
                  <dd className="text-foreground font-medium text-right">
                    {lesson.gradeLevel}
                  </dd>
                </div>
              )}
              {lesson.subject && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted shrink-0">Subject</dt>
                  <dd className="text-foreground font-medium text-right">
                    {lesson.subject}
                  </dd>
                </div>
              )}
              {lesson.duration && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted shrink-0">Duration</dt>
                  <dd className="text-foreground font-medium text-right">
                    {lesson.duration}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Objectives</dt>
                <dd className="text-foreground font-medium">
                  {lesson.objectives.length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Steps</dt>
                <dd className="text-foreground font-medium">
                  {lesson.steps.length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Attachments</dt>
                <dd className="text-foreground font-medium">
                  {lesson.attachments.length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Downloads</dt>
                <dd className="text-foreground font-medium">
                  {localDownloadCount}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Status</dt>
                <dd>
                  <Badge variant={lesson.isPublic ? "success" : "warning"}>
                    {lesson.isPublic ? "Published" : "Draft"}
                  </Badge>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteLesson}
        title="Delete lesson plan"
        description="This will permanently delete this lesson plan. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleting}
      />
    </div>
  );
}
