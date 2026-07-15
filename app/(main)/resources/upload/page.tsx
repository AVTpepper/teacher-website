"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRef, useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { pdf } from "@react-pdf/renderer";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { GRADE_LEVELS, SUBJECTS } from "@/lib/firestore/users";
import {
  createResource,
  updateResource,
  getResource,
  resourceSlug,
  RESOURCE_TYPES,
  SUGGESTED_TAGS,
  type ResourceType,
} from "@/lib/firestore/resources";
import { Button, Card, Input, Select, Textarea, Tag } from "@/components/ui";
import ResourcePDFDocument from "@/components/resources/ResourcePDFDocument";
import LinkAttacher, { type AttachedLink } from "@/components/ui/LinkAttacher";
import { checkAndAwardBadges } from "@/lib/badges";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export default function UploadResourcePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>}>
      <UploadResourceForm />
    </Suspense>
  );
}

function UploadResourceForm() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditMode = Boolean(editId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [resType, setResType] = useState<string>("");
  const [isPublic, setIsPublic] = useState(true);
  const [sourceLessonId, setSourceLessonId] = useState<string | null>(null);
  const [sourceLessonTitle, setSourceLessonTitle] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [links, setLinks] = useState<AttachedLink[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [loadingEdit, setLoadingEdit] = useState(isEditMode);
  const formTopRef = useRef<HTMLDivElement>(null);

  // Pre-populate form when editing an existing resource
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    async function load() {
      try {
        const resource = await getResource(editId!);
        if (cancelled || !resource) return;
        if (user && resource.authorId !== user.uid) {
          setError("You can only edit resources you created.");
          return;
        }
        setTitle(resource.title ?? "");
        setDescription(resource.description ?? "");
        setGradeLevel(resource.gradeLevel ?? "");
        setSubject(resource.subject ?? "");
        setResType(resource.type ?? "");
        setIsPublic(resource.isPublic !== false);
        setSourceLessonId(resource.sourceLessonId ?? null);
        setSourceLessonTitle(resource.sourceLessonTitle ?? null);
        setTags(resource.tags ?? []);
        setLinks((resource.links as AttachedLink[]) ?? []);
      } catch {
        setError("Failed to load resource for editing.");
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [editId, user]);

  if (!user) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Sign in to upload a resource
        </h2>
        <p className="mt-1 text-sm text-muted">
          You need to be logged in to share resources with the community.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push("/auth/signup?redirect=/resources/upload")}>Create Account</Button>
          <Button variant="outline" size="sm" onClick={() => router.push("/auth/login?redirect=/resources/upload")}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  function addTag(value?: string) {
    const t = (value ?? tagInput).trim();
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags((prev) => [...prev, t]);
      if (!value) setTagInput("");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE) {
      setError("File must be under 25 MB.");
      setFile(null);
      return;
    }

    setError("");
    setFile(selected);
  }

  function showError(msg: string, errors: Record<string, boolean>) {
    setError(msg);
    setFieldErrors(errors);
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    setFieldErrors({});
    setError("");

    const errors: Record<string, boolean> = {};
    const missing: string[] = [];

    if (!title.trim()) { errors.title = true; missing.push("Title"); }
    if (!description.trim()) { errors.description = true; missing.push("Description"); }
    if (!gradeLevel) { errors.gradeLevel = true; missing.push("Grade Level"); }
    if (!subject) { errors.subject = true; missing.push("Subject"); }
    if (!resType) { errors.resType = true; missing.push("Resource Type"); }

    if (missing.length > 0) {
      return showError(
        missing.length === 1
          ? `${missing[0]} is required.`
          : `Please fill in the following fields: ${missing.join(", ")}.`,
        errors
      );
    }

    setError("");
    setSaving(true);

    try {
      let fileURL = "";
      let fileName = "";

      if (file && storage) {
        // User attached a real file - upload it as-is
        const storageRef = ref(
          storage,
          `resources/${user.uid}/${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        fileURL = await getDownloadURL(storageRef);
        fileName = file.name;
      } else if (!file && storage) {
        // No file attached - generate a formatted PDF from the form data
        const typeLabelObj = RESOURCE_TYPES.find((t) => t.value === resType);
        const typeLabel = typeLabelObj?.label ?? resType;
        const pdfBlob = await pdf(
          <ResourcePDFDocument
            title={title.trim()}
            description={description.trim()}
            gradeLevel={gradeLevel}
            subject={subject}
            type={typeLabel}
            tags={tags}
            authorName={user.displayName || "Anonymous"}
          />
        ).toBlob();
        const safeName = title.trim().replace(/[^a-z0-9]/gi, "_").toLowerCase();
        fileName = `${safeName}.pdf`;
        const storageRef = ref(
          storage,
          `resources/${user.uid}/${Date.now()}_${fileName}`
        );
        await uploadBytes(storageRef, pdfBlob, { contentType: "application/pdf" });
        fileURL = await getDownloadURL(storageRef);
      } else if (file && !storage) {
        console.warn("Firebase Storage not activated - skipping file upload");
      }

      if (isEditMode && editId) {
        await updateResource(editId, {
          title: title.trim(),
          description: description.trim(),
          gradeLevel,
          subject,
          type: resType as ResourceType,
          isPublic,
          tags,
          links,
          ...(fileURL ? { fileURL, fileName } : {}),
        });
        router.push(`/resources/${resourceSlug(title, editId)}`);
      } else {
        const id = await createResource({
          title: title.trim(),
          description: description.trim(),
          authorId: user.uid,
          authorName: user.displayName || "Anonymous",
          authorPhotoURL: user.photoURL,
          gradeLevel,
          subject,
          type: resType as ResourceType,
          fileURL,
          fileName,
          isPublic,
          sourceLessonId,
          sourceLessonTitle,
          tags,
          links,
        });
        checkAndAwardBadges(user.uid).catch(() => {});
        router.push(`/resources/${resourceSlug(title, id)}`);
      }
    } catch {
      showError(
        isEditMode
          ? "Failed to update resource. Please try again."
          : "Failed to upload resource. Please try again.",
        {}
      );
    } finally {
      setSaving(false);
    }
  }

  // Suggested tags that haven't been added yet
  const availableSuggestions = SUGGESTED_TAGS.filter(
    (t) => !tags.includes(t)
  );

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <div className="mb-4">
        <Link href="/resources">
          <Button type="button" variant="outline" size="sm">
            Back to Resources
          </Button>
        </Link>
      </div>

      <div className="-mx-4 -mt-4 mb-6 border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 rounded-t-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Creator Studio</p>
        <h1 className="text-2xl font-bold">
          {isEditMode ? "Edit Resource" : "Upload Resource"}
        </h1>
        <p className="mt-1 text-sm text-primary-100/90">
          {isEditMode
            ? "Update your resource details below."
            : "Share a teaching resource with the TeacherlyConnect community."}
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate className="space-y-5 p-6">
          <div ref={formTopRef} className="scroll-mt-32">
            {error && (
              <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
                {error}
              </div>
            )}
          </div>

          <Input
            label="Title"
            placeholder="e.g. Fractions Worksheet Pack"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={fieldErrors.title ? "Title is required" : undefined}
          />

          <Textarea
            label="Description"
            placeholder="Describe what this resource covers and how to use it..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            error={fieldErrors.description ? "Description is required" : undefined}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Grade Level"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="Select grade level"
              options={GRADE_LEVELS.map((g) => ({ value: g, label: g }))}
              error={fieldErrors.gradeLevel ? "Grade level is required" : undefined}
            />
            <Select
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Select subject"
              options={SUBJECTS.map((s) => ({ value: s, label: s }))}
              error={fieldErrors.subject ? "Subject is required" : undefined}
            />
          </div>

          <Select
            label="Resource Type"
            value={resType}
            onChange={(e) => setResType(e.target.value)}
            placeholder="Select type"
            options={RESOURCE_TYPES.map((t) => ({
              value: t.value,
              label: t.label,
            }))}
            error={fieldErrors.resType ? "Resource type is required" : undefined}
          />

          <div className="space-y-1.5">
            <label htmlFor="resource-visibility" className="text-sm font-medium text-foreground">
              Visibility
            </label>
            <select
              id="resource-visibility"
              value={isPublic ? "published" : "draft"}
              onChange={(e) => setIsPublic(e.target.value === "published")}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors focus-ring cursor-pointer"
            >
              <option value="published">Published to resource library</option>
              <option value="draft">Keep as private draft</option>
            </select>
            <p className="text-xs text-muted">
              Draft resources stay private to you until you publish them.
            </p>
          </div>

          {sourceLessonId && sourceLessonTitle && (
            <div className="rounded-lg border border-border bg-secondary-50 px-4 py-3 text-sm text-secondary-900">
              Linked to lesson: <Link href={`/lesson-builder/${sourceLessonId}`} className="font-medium underline underline-offset-2">{sourceLessonTitle}</Link>
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Tags (up to 10)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addTag()}
                disabled={!tagInput.trim() || tags.length >= 10}
              >
                Add
              </Button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tags.map((tag) => (
                  <Tag
                    key={tag}
                    label={tag}
                    removable
                    onRemove={() =>
                      setTags((prev) => prev.filter((t) => t !== tag))
                    }
                  />
                ))}
              </div>
            )}

            {/* Suggested tags */}
            {tags.length < 10 && availableSuggestions.length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-muted">Suggested:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {availableSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50 transition-colors cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* File upload */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">File</label>
            <div className={`relative rounded-lg ${fieldErrors.file ? "ring-2 ring-error-500" : ""}`}>
              <input
                type="file"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-100 file:text-primary-800 hover:file:bg-primary-200 file:cursor-pointer cursor-pointer"
              />
            </div>
            {fieldErrors.file && (
              <p className="text-xs text-error-500">Please select a file to upload</p>
            )}
            {file && (
              <p className="text-xs text-muted">
                {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
            <p className="text-xs text-muted">Max file size: 25 MB</p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Links (optional)
            </label>
            <p className="text-xs text-muted -mt-1">Attach external URLs that go with this resource.</p>
            <LinkAttacher links={links} onChange={setLinks} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                router.push(isEditMode && editId ? `/resources/${resourceSlug(title, editId)}` : "/resources")
              }
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {isEditMode ? "Save Changes" : "Upload Resource"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
