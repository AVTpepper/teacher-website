"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getLesson,
  trackLessonDownload,
  getLessonComments,
  addLessonComment,
  type Lesson,
  type LessonComment,
} from "@/lib/firestore/lessons";
import { getUser, type UserProfile } from "@/lib/firestore/users";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import CommentThread, {
  type CommentData,
} from "@/components/comments/CommentThread";
import { timeAgo } from "@/lib/utils";
import { notifyComment, notifyMention } from "@/lib/notifications";
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

  // Download
  const [localDownloadCount, setLocalDownloadCount] = useState(0);
  const [copied, setCopied] = useState(false);

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

        const [authorData] = await Promise.all([
          getUser(res.authorId),
          loadComments(),
        ]);
        setAuthor(authorData);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, loadComments]);

  async function handleDownload() {
    if (!lesson) return;

    if (user) {
      trackLessonDownload(lesson.id, user.uid).catch(() => {});
      setLocalDownloadCount((c) => c + 1);
    }

    // Generate a PDF and trigger download
    const blob = await pdf(<LessonPDFDocument lesson={lesson} />).toBlob();
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

  return (
    <div className={`py-8 space-y-8 ${user ? "pb-24 sm:pb-8" : ""}`}>
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
            {lesson.objectives.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  🎯 Learning Objectives
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                  {lesson.objectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Materials */}
            {user ? (
              lesson.materials.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    📦 Materials Needed
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                    {lesson.materials.map((mat, i) => (
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
                    <Button variant="primary" size="sm">Create Account</Button>
                  </Link>
                  <Link href="/auth/login">
                    <Button variant="outline" size="sm">Sign In</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Steps */}
            {user && lesson.steps.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  📋 Lesson Plan
                </h3>
                <div className="space-y-4">
                  {lesson.steps.map((step, i) => (
                    <div
                      key={i}
                      className="border-l-2 border-primary-300 pl-4"
                    >
                      <p className="text-sm font-semibold text-foreground">
                        Step {i + 1}
                        {step.title ? `: ${step.title}` : ""}
                      </p>
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

            {/* Attachments */}
            {user && lesson.attachments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  📎 Attachments
                </h3>
                <div className="space-y-1">
                  {lesson.attachments.map((att, i) => (
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
                    <Button size="sm">Sign In</Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button variant="outline" size="sm">Create Account</Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Actions bar */}
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              {user && (
                <>
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
                    <Link href={`/lesson-builder/new?edit=${lesson.id}`}>
                      <Button variant="outline">Edit</Button>
                    </Link>
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
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Discussion
            </h2>
            <CommentThread
              comments={commentData}
              loading={commentsLoading}
              mode="like"
              maxDepth={2}
              onAddComment={async (content, parentId, mentionedUsers) => {
                if (!user) throw new Error("Must be logged in");
                const newId = await addLessonComment(lesson.id, {
                  parentId,
                  authorId: user.uid,
                  authorName: user.displayName || "Anonymous",
                  authorPhotoURL: user.photoURL,
                  content,
                  mentionedUsers: mentionedUsers ?? [],
                });
                // Notify lesson author (fire-and-forget)
                if (lesson.authorId !== user.uid && !parentId) {
                  notifyComment({
                    recipientId: lesson.authorId,
                    actorId: user.uid,
                    actorName: user.displayName || "Someone",
                    actorPhotoURL: user.photoURL,
                    contentLabel: `your lesson "${lesson.title}"`,
                    linkURL: window.location.href,
                  }).catch(() => {});
                }
                // Notify mentioned users (fire-and-forget)
                if (mentionedUsers?.length) {
                  mentionedUsers.forEach(({ uid }) => {
                    if (uid !== user.uid) {
                      notifyMention({
                        recipientId: uid,
                        actorId: user.uid,
                        actorName: user.displayName || "Anonymous",
                        actorPhotoURL: user.photoURL,
                        linkURL: window.location.href,
                      }).catch(() => {});
                    }
                  });
                }
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
                <div className="flex justify-between">
                  <dt className="text-muted">Grade Level</dt>
                  <dd className="text-foreground font-medium">
                    {lesson.gradeLevel}
                  </dd>
                </div>
              )}
              {lesson.subject && (
                <div className="flex justify-between">
                  <dt className="text-muted">Subject</dt>
                  <dd className="text-foreground font-medium">
                    {lesson.subject}
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

      {/* Mobile sticky action bar — logged-in only */}
      {user && (
        <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-surface/95 backdrop-blur-sm border-t border-border px-4 py-3 flex items-center gap-2">
          <Button onClick={handleDownload} className="flex-1 justify-center">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download
          </Button>
          <Button variant="outline" onClick={handleRemix} className="flex-1 justify-center">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
            </svg>
            Modify
          </Button>
          <Button variant="outline" onClick={handleShare} className="flex-1 justify-center">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
            {copied ? "✓" : "Share"}
          </Button>
        </div>
      )}
    </div>
  );
}
