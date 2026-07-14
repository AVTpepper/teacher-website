"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  createThread,
  threadSlug,
  FORUM_CATEGORIES,
} from "@/lib/firestore/forums";
import { GRADE_LEVELS, SUBJECTS } from "@/lib/firestore/users";
import { checkAndAwardBadges } from "@/lib/badges";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import LinkAttacher, { type AttachedLink } from "@/components/ui/LinkAttacher";

const TAG_OPTIONS = [
  "Classroom Management",
  "Lesson Planning",
  "Student Engagement",
  "Technology",
  "Assessment",
  "Differentiation",
  "SEL",
  "STEM",
  "Literacy",
  "Professional Development",
];

export default function NewDiscussionPage() {
  return (
    <Suspense>
      <NewDiscussionForm />
    </Suspense>
  );
}

function NewDiscussionForm() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const defaultCategory = searchParams.get("category") || FORUM_CATEGORIES[0].id;

  const [categoryId, setCategoryId] = useState(defaultCategory);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [links, setLinks] = useState<AttachedLink[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">Sign In Required</h1>
        <p className="mt-2 text-sm text-muted">
          You need to be signed in to start a discussion.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => router.push("/auth/login?redirect=/forums/new")}
          >
            Sign In
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/auth/signup?redirect=/forums/new")}
          >
            Create Account
          </Button>
          <Button variant="outline" onClick={() => router.push("/forums")}>
            Back to Forums
          </Button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) return setError("Title is required.");
    if (!content.trim()) return setError("Content is required.");

    setSubmitting(true);
    try {
      const threadId = await createThread({
        categoryId,
        title: title.trim(),
        content: content.trim(),
        authorId: user!.uid,
        authorName: user!.displayName || "Anonymous",
        authorPhotoURL: user!.photoURL,
        tags,
        gradeLevel,
        subject,
        links,
      });
      checkAndAwardBadges(user!.uid).catch(() => {});
      router.push(`/forums/${threadSlug(title.trim(), threadId)}`);
    } catch {
      setError("Failed to post discussion. Please try again.");
      setSubmitting(false);
    }
  }

  const selectedCat = FORUM_CATEGORIES.find((c) => c.id === categoryId);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="-mx-4 -mt-4 border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 sm:rounded-t-2xl">
        <Link href="/forums" className="text-sm text-primary-200 hover:text-primary-50 transition-colors">
          ← Forums
        </Link>
        <h1 className="mt-2 text-2xl font-bold">New Discussion</h1>
        <p className="mt-1 text-sm text-primary-100/90">
          Start a conversation with the educator community.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card padding="lg" className="space-y-4">
          {/* Category */}
          <Select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={FORUM_CATEGORIES.map((c) => ({
              value: c.id,
              label: `${c.icon} ${c.name}`,
            }))}
          />

          {selectedCat && (
            <p className="text-xs text-muted -mt-2">{selectedCat.description}</p>
          )}

          {/* Title */}
          <Input
            label="Title"
            placeholder="What do you want to discuss?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* Content */}
          <Textarea
            label="Content"
            placeholder="Share your thoughts, questions, or ideas..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            required
          />
        </Card>

        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Optional Details</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Grade Level"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="All grades"
              options={[
                { value: "", label: "All grades" },
                ...GRADE_LEVELS.map((g) => ({ value: g, label: g })),
              ]}
            />
            <Select
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="All subjects"
              options={[
                { value: "", label: "All subjects" },
                ...SUBJECTS.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>

          {/* Tags */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    tags.includes(tag)
                      ? "bg-primary-900 text-white border-primary-900"
                      : "bg-surface border-border text-muted hover:border-primary-900 hover:text-primary-900"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Attached Links</h2>
          <p className="text-xs text-muted -mt-1">Add external URLs relevant to this discussion.</p>
          <LinkAttacher links={links} onChange={setLinks} />
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/forums">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" isLoading={submitting}>
            Post Discussion
          </Button>
        </div>
      </form>
    </div>
  );
}
