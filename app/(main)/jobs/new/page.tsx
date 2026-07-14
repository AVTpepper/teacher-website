"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { GRADE_LEVELS, SUBJECTS } from "@/lib/firestore/users";
import { createJob, JOB_TYPES, jobSlug, type JobType } from "@/lib/firestore/jobs";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

export default function PostJobPage() {
  const { user } = useAuth();
  const router = useRouter();

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

  if (!user) {
    return (
      <div className="py-16 text-center">
        <p className="text-foreground font-medium">You must be signed in to post a job.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => router.push("/auth/signup?redirect=/jobs/new")}>Create Account</Button>
          <Button variant="primary" onClick={() => router.push("/auth/login?redirect=/jobs/new")}>Sign In</Button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (
      !title.trim() || !organization.trim() || !location.trim() ||
      !gradeLevel || !subject || !jobType || !description.trim()
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const job = await createJob({
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
      router.push(`/jobs/${jobSlug(job.title, job.id)}`);
    } catch (err) {
      console.error(err);
      setError("Failed to post job. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="-mx-4 -mt-4 border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 sm:rounded-t-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Hiring</p>
        <h1 className="text-2xl font-bold">Post a Job</h1>
        <p className="mt-1 text-sm text-primary-100/90">
          Share a teaching or education-related position with the community.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Job Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 5th Grade Math Teacher"
            />
            <Input
              label="School / Organization *"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="e.g. Lincoln Elementary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Location *"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Austin, TX or Remote"
            />
            <Select
              label="Job Type *"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              options={[
                { value: "", label: "Select type" },
                ...JOB_TYPES.map((t) => ({ value: t.value, label: t.label })),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Grade Level *"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              options={[
                { value: "", label: "Select grade" },
                ...GRADE_LEVELS.map((g) => ({ value: g, label: g })),
              ]}
            />
            <Select
              label="Subject *"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              options={[
                { value: "", label: "Select subject" },
                ...SUBJECTS.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>

          <Textarea
            label="Job Description *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the role, responsibilities, and requirements…"
            rows={6}
          />

          <Input
            label="Apply URL (optional)"
            value={applyURL}
            onChange={(e) => setApplyURL(e.target.value)}
            placeholder="https://… (leave blank to handle applications in-app)"
            type="url"
          />

          {error && (
            <p className="text-sm text-error-700 font-medium">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/jobs")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saving}>
              Post Job
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
