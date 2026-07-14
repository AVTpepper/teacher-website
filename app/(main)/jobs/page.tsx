"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { type DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { GRADE_LEVELS, SUBJECTS } from "@/lib/firestore/users";
import {
  getJobs,
  jobSlug,
  JOB_TYPES,
  JOB_TYPE_COLOR,
  type Job,
  type JobFilters,
  type JobType,
} from "@/lib/firestore/jobs";
import { Avatar, Badge, Button, Card, Input, Select } from "@/components/ui";

// --- Job Card ---

function JobCard({ job }: { job: Job }) {
  return (
    <Link href={`/jobs/${jobSlug(job.title, job.id)}`} className="block group">
      <Card className="hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${JOB_TYPE_COLOR[job.jobType]}`}>
                {JOB_TYPES.find((t) => t.value === job.jobType)?.label ?? job.jobType}
              </span>
              <Badge variant="default">{job.gradeLevel}</Badge>
              <Badge variant="default">{job.subject}</Badge>
            </div>
            <h3 className="text-base font-semibold text-foreground group-hover:underline leading-snug">
              {job.title}
            </h3>
            <p className="text-sm text-muted mt-0.5">{job.organization}</p>
            <p className="text-xs text-muted mt-1 flex items-center gap-1">
              <span>📍</span> {job.location}
            </p>
          </div>
          <div className="shrink-0 self-start">
            <Button variant="outline" size="sm">View Job</Button>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted line-clamp-2">{job.description}</p>
      </Card>
    </Link>
  );
}

// --- Main page ---

export default function JobsPage() {
  const { user } = useAuth();

  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [jobType, setJobType] = useState("");
  const [locationQuery, setLocationQuery] = useState("");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<DocumentSnapshot | null>(null);

  const fetchJobs = useCallback(
    async (reset: boolean) => {
      if (reset) {
        cursorRef.current = null;
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const filters: JobFilters = {
          gradeLevel: gradeLevel || undefined,
          subject: subject || undefined,
          jobType: (jobType as JobType) || undefined,
          location: locationQuery.trim() || undefined,
        };
        const { jobs: fetched, cursor } = await getJobs(filters, 10, reset ? null : cursorRef.current);
        cursorRef.current = cursor;
        setHasMore(cursor !== null);
        setJobs((prev) => (reset ? fetched : [...prev, ...fetched]));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [gradeLevel, subject, jobType, locationQuery]
  );

  useEffect(() => {
    fetchJobs(true);
  }, [fetchJobs]);

  const visibleJobs = jobs.filter((j) => {
    if (gradeLevel && j.gradeLevel !== gradeLevel) return false;
    if (subject && j.subject !== subject) return false;
    if (jobType && j.jobType !== jobType) return false;
    if (locationQuery && !j.location.toLowerCase().includes(locationQuery.toLowerCase())) return false;
    return true;
  });

  function clearFilters() {
    setGradeLevel("");
    setSubject("");
    setJobType("");
    setLocationQuery("");
  }

  const hasFilters = !!(gradeLevel || subject || jobType || locationQuery);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="-mx-4 -mt-4 flex flex-col gap-3 border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 sm:rounded-t-2xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Opportunities</p>
          <h1 className="text-2xl font-bold">Job Board</h1>
          <p className="mt-1 text-sm text-primary-100/90">
            Find education job opportunities for full time, part time, contract, and substitute positions.
          </p>
        </div>
        {user ? (
          <Link href="/jobs/new">
            <Button variant="secondary">+ Post Job</Button>
          </Link>
        ) : (
          <div className="flex items-center gap-2 text-sm text-primary-100/90">
            <Link href="/auth/signup"><Button variant="secondary" size="sm">Create Account</Button></Link>
            <Link href="/auth/login"><Button variant="outline" size="sm">Sign In</Button></Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            label="Location"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            placeholder="City, state, or Remote…"
          />
          <Select
            label="Grade Level"
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            options={[{ value: "", label: "All grade levels" }, ...GRADE_LEVELS.map((g) => ({ value: g, label: g }))]}
          />
          <Select
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            options={[{ value: "", label: "All subjects" }, ...SUBJECTS.map((s) => ({ value: s, label: s }))]}
          />
          <Select
            label="Job Type"
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            options={[{ value: "", label: "All types" }, ...JOB_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
          />
        </div>
        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        )}
      </Card>

      {/* Loading */}
      {loading && (
        <div className="py-16 text-center text-sm text-muted">Loading jobs…</div>
      )}

      {/* Empty */}
      {!loading && visibleJobs.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3">💼</p>
          <p className="text-foreground font-medium">No jobs found</p>
          <p className="text-sm text-muted mt-1">
            {hasFilters ? "Try adjusting your filters." : "No job listings yet. Be the first to post one!"}
          </p>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-3">
              Clear Filters
            </Button>
          )}
          {!hasFilters && (
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/auth/signup"><Button variant="secondary" size="sm">Create Account</Button></Link>
              <Link href="/auth/login"><Button variant="outline" size="sm">Sign In</Button></Link>
            </div>
          )}
        </div>
      )}

      {/* Job list */}
      {!loading && visibleJobs.length > 0 && (
        <div className="space-y-3">
          {visibleJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => fetchJobs(false)} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load More"}
          </Button>
        </div>
      )}

    </div>
  );
}
