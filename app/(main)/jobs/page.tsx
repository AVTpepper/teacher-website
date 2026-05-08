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
  type Job,
  type JobFilters,
  type JobType,
} from "@/lib/firestore/jobs";
import { Avatar, Badge, Button, Card, Input, Modal, Select, Textarea } from "@/components/ui";
import { createJob } from "@/lib/firestore/jobs";



const JOB_TYPE_COLOR: Record<JobType, string> = {
  "full-time": "bg-emerald-100 text-emerald-700",
  "part-time": "bg-blue-100 text-blue-700",
  contract: "bg-amber-100 text-amber-700",
  substitute: "bg-purple-100 text-purple-700",
};

// --- Post Job Modal ---

function PostJobModal({
  open,
  onClose,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [location, setLocation] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [jobType, setJobType] = useState("");
  const [description, setDescription] = useState("");
  const [applyURL, setApplyURL] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setTitle(""); setOrganization(""); setLocation(""); setGradeLevel("");
    setSubject(""); setJobType(""); setDescription(""); setApplyURL("");
    setError(""); setSaving(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !organization.trim() || !location.trim() || !gradeLevel || !subject || !jobType || !description.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createJob({
        title: title.trim(),
        organization: organization.trim(),
        location: location.trim(),
        gradeLevel,
        subject,
        jobType: jobType as JobType,
        description: description.trim(),
        applyURL: applyURL.trim() || "#",
        postedBy: user.uid,
      });
      reset();
      onPosted();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to post job. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Post a Job">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Job Title *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 5th Grade Math Teacher" />
          <Input label="School / Organization *" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="e.g. Lincoln Elementary" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Location *" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Austin, TX or Remote" />
          <Select
            label="Job Type *"
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            options={[{ value: "", label: "Select type" }, ...JOB_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Grade Level *"
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            options={[{ value: "", label: "Select grade" }, ...GRADE_LEVELS.map((g) => ({ value: g, label: g }))]}
          />
          <Select
            label="Subject *"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            options={[{ value: "", label: "Select subject" }, ...SUBJECTS.map((s) => ({ value: s, label: s }))]}
          />
        </div>
        <Textarea
          label="Job Description *"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the role, responsibilities, and requirements…"
          rows={5}
        />
        <Input
          label="Apply URL (optional)"
          value={applyURL}
          onChange={(e) => setApplyURL(e.target.value)}
          placeholder="https://… (leave blank to handle applications in-app)"
          type="url"
        />

        {error && <p className="text-sm text-error font-medium">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Posting…" : "Post Job"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

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
  const [showPostJob, setShowPostJob] = useState(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Job Board</h1>
          <p className="mt-1 text-sm text-muted">
            Find education job opportunities — full-time, part-time, contract, and substitute positions.
          </p>
        </div>
        {user ? (
          <Button variant="primary" onClick={() => setShowPostJob(true)}>
            + Post Job
          </Button>
        ) : (
          <p className="text-sm text-muted">
            <a href="/auth/login" className="text-primary underline">Sign in</a> to post a job.
          </p>
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
            <button onClick={clearFilters} className="text-sm text-primary underline">
              Clear Filters
            </button>
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
            {hasFilters ? "Try adjusting your filters." : "No job listings yet — be the first to post one!"}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-3 text-sm text-primary underline">
              Clear Filters
            </button>
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

      {/* Post Job modal */}
      <PostJobModal
        open={showPostJob}
        onClose={() => setShowPostJob(false)}
        onPosted={() => fetchJobs(true)}
      />
    </div>
  );
}
