"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { GRADE_LEVELS, SUBJECTS } from "@/lib/firestore/users";
import {
  createResource,
  RESOURCE_TYPES,
  SUGGESTED_TAGS,
  type ResourceType,
} from "@/lib/firestore/resources";
import { Button, Card, Input, Select, Textarea, Tag } from "@/components/ui";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export default function UploadResourcePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [resType, setResType] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Sign in to upload a resource
        </h2>
        <p className="mt-1 text-sm text-muted">
          You need to be logged in to share resources with the community.
        </p>
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!title.trim()) return setError("Title is required.");
    if (!description.trim()) return setError("Description is required.");
    if (!gradeLevel) return setError("Grade level is required.");
    if (!subject) return setError("Subject is required.");
    if (!resType) return setError("Resource type is required.");
    if (!file) return setError("Please select a file to upload.");

    setError("");
    setSaving(true);

    try {
      let fileURL = "";
      if (storage) {
        const storageRef = ref(
          storage,
          `resources/${user.uid}/${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        fileURL = await getDownloadURL(storageRef);
      }

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
        fileName: file.name,
        tags,
      });

      router.push(`/resources/${id}`);
    } catch (err) {
      console.error("Upload resource error:", err);
      setError("Failed to upload resource. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Suggested tags that haven't been added yet
  const availableSuggestions = SUGGESTED_TAGS.filter(
    (t) => !tags.includes(t)
  );

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Upload Resource</h1>
        <p className="mt-1 text-sm text-muted">
          Share a teaching resource with the EduConnect community.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">
              {error}
            </div>
          )}

          <Input
            label="Title"
            placeholder="e.g. Fractions Worksheet Pack"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Textarea
            label="Description"
            placeholder="Describe what this resource covers and how to use it…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Grade Level"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="Select grade level"
              options={GRADE_LEVELS.map((g) => ({ value: g, label: g }))}
            />
            <Select
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Select subject"
              options={SUBJECTS.map((s) => ({ value: s, label: s }))}
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
          />

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Tags (up to 10)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag…"
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
            <div className="relative">
              <input
                type="file"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-100 file:text-primary-800 hover:file:bg-primary-200 file:cursor-pointer cursor-pointer"
              />
            </div>
            {file && (
              <p className="text-xs text-muted">
                {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
            <p className="text-xs text-muted">Max file size: 25 MB</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/resources")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Upload Resource
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
