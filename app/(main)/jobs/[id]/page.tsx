"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getJob,
  deactivateJob,
  parseJobSlug,
  JOB_TYPES,
  JOB_TYPE_COLOR,
  type Job,
} from "@/lib/firestore/jobs";
import { getUser, type UserProfile } from "@/lib/firestore/users";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = parseJobSlug(rawId);
  const { user } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [poster, setPoster] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    getJob(id)
      .then(async (j) => {
        if (!j) {
          setNotFound(true);
          return;
        }
        setJob(j);
        if (j.postedBy && j.postedBy !== "seed") {
          try {
            const profile = await getUser(j.postedBy);
            setPoster(profile);
          } catch {
            // poster profile unavailable - non-critical
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // --- Loading ---
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-4 w-24 bg-secondary-100 rounded" />
        <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <div className="h-6 w-2/3 bg-secondary-100 rounded" />
          <div className="h-3 w-full bg-secondary-100 rounded" />
          <div className="h-3 w-3/4 bg-secondary-100 rounded" />
        </div>
      </div>
    );
  }

  // --- Not found ---
  if (notFound || !job) {
    return (
      <div className="py-20 text-center">
        <p className="text-4xl mb-3">💼</p>
        <h2 className="text-xl font-semibold text-foreground">Job Not Found</h2>
        <p className="mt-2 text-sm text-muted">
          This listing may have been removed or the link is incorrect.
        </p>
        <Link href="/jobs">
          <Button variant="primary" className="mt-6">
            Browse All Jobs
          </Button>
        </Link>
      </div>
    );
  }

  const jobTypeLabel = JOB_TYPES.find((t) => t.value === job.jobType)?.label ?? job.jobType;
  const isExternalApply = job.applyURL && job.applyURL !== "#";
  const isOwner = user?.uid === job.postedBy;

  async function handleCloseListings() {
    if (!job) return;
    setClosing(true);
    try {
      await deactivateJob(job.id);
      setJob((prev) => prev ? { ...prev, isActive: false } : prev);
      setConfirmClose(false);
    } catch {
      // non-critical
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link */}
      <Link href="/jobs" className="text-sm text-primary hover:underline flex items-center gap-1">
        ← Back to Job Board
      </Link>

      {/* Header card */}
      <Card>
        <div className="flex flex-col gap-4">
          {/* Title + badges */}
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${JOB_TYPE_COLOR[job.jobType]}`}>
                {jobTypeLabel}
              </span>
              <Badge variant="default">{job.gradeLevel}</Badge>
              <Badge variant="default">{job.subject}</Badge>
            </div>
            <h1 className="text-2xl font-bold text-foreground leading-snug">{job.title}</h1>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏫</span>
              <span className="font-medium text-foreground">{job.organization}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">📍</span>
              <span>{job.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎓</span>
              <span>{job.gradeLevel} · {job.subject}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🕐</span>
              <span>Posted {timeAgo(job.createdAt as { seconds: number } | null)}</span>
            </div>
          </div>

          {/* Apply button */}
          <div className="pt-2 border-t border-border space-y-3">
            {!job.isActive && (
              <div className="rounded-lg bg-secondary-100 px-4 py-2 text-sm text-secondary-700 font-medium">
                This listing has been closed by the poster.
              </div>
            )}
            {job.isActive && (
              user ? (
                isExternalApply ? (
                  <a href={job.applyURL} target="_blank" rel="noopener noreferrer">
                    <Button variant="primary" size="lg">
                      Apply Now ↗
                    </Button>
                  </a>
                ) : (
                  <Button variant="primary" size="lg" disabled>
                    Contact School Directly
                  </Button>
                )
              ) : (
                <div className="flex items-center gap-3">
                  <Link href="/auth/login">
                    <Button variant="primary" size="lg">
                      Sign In to Apply
                    </Button>
                  </Link>
                  <p className="text-sm text-muted">You need an account to apply.</p>
                </div>
              )
            )}

            {/* Owner: close listing */}
            {isOwner && job.isActive && (
              <div className="pt-1">
                {confirmClose ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-muted">Close this listing? It won&apos;t appear in searches.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCloseListings}
                      isLoading={closing}
                      className="text-error-700 border-error-300 hover:bg-error-50"
                    >
                      Yes, Close Listing
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmClose(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClose(true)}
                    className="text-sm text-error-600 hover:underline cursor-pointer"
                  >
                    Close this listing
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Job description */}
      <Card>
        <h2 className="text-lg font-semibold text-foreground mb-3">Job Description</h2>
        <div className="prose prose-sm max-w-none text-foreground">
          {job.description.split("\n").map((para, i) =>
            para.trim() ? (
              <p key={i} className="mb-3 text-sm leading-relaxed">
                {para}
              </p>
            ) : null
          )}
        </div>
      </Card>

      {/* Poster info */}
      {poster && (
        <Card>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Posted By
          </h2>
          <Link
            href={`/educators/${poster.uid}`}
            className="flex items-center gap-3 group"
          >
            <Avatar
              src={poster.photoURL ?? null}
              alt={poster.displayName}
              size="md"
            />
            <div>
              <p className="font-semibold text-foreground group-hover:underline">
                {poster.displayName}
              </p>
              <p className="text-sm text-muted">
                {poster.gradeLevel} · {poster.school || poster.country}
              </p>
            </div>
          </Link>
        </Card>
      )}

      {/* School / org info */}
      <Card>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
          About the Organization
        </h2>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-secondary-100 flex items-center justify-center text-xl shrink-0">
            🏫
          </div>
          <div>
            <p className="font-semibold text-foreground">{job.organization}</p>
            <p className="text-sm text-muted">{job.location}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {job.gradeLevel} school · {job.subject} department
        </p>
      </Card>
    </div>
  );
}
