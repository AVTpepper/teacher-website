"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  createInspirationItem,
  INSPIRATION_CATEGORIES,
  type InspirationCategory,
} from "@/lib/firestore/inspiration";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export default function NewInspirationPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [creator, setCreator] = useState("");
  const [sourceURL, setSourceURL] = useState("");
  const [thumbnailURL, setThumbnailURL] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const formTopRef = useRef<HTMLFormElement>(null);

  if (!user) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold text-foreground">Sign in to submit content</h2>
        <p className="mt-1 text-sm text-muted">
          You need to be logged in to share inspiration with the community.
        </p>
        <Button
          variant="primary"
          className="mt-4"
          onClick={() => router.push("/auth/login?redirect=/inspiration/new")}
        >
          Sign In
        </Button>
      </div>
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError("Thumbnail image must be under 5 MB.");
      setThumbnailFile(null);
      setThumbnailPreview(null);
      return;
    }
    setError("");
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  }

  function clearFile() {
    setThumbnailFile(null);
    setThumbnailPreview(null);
  }

  function showError(msg: string, errors: Record<string, boolean> = {}) {
    setError(msg);
    setFieldErrors(errors);
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      showError("You must be logged in to submit.");
      return;
    }
    const errors: Record<string, boolean> = {};
    if (!title.trim()) errors.title = true;
    if (!description.trim()) errors.description = true;
    if (!category) errors.category = true;
    if (!creator.trim()) errors.creator = true;
    if (!sourceURL.trim()) errors.sourceURL = true;

    if (Object.keys(errors).length > 0) {
      showError("Please fill in all required fields.", errors);
      return;
    }

    // Validate source URL
    try {
      const u = new URL(sourceURL.trim().startsWith("http") ? sourceURL.trim() : `https://${sourceURL.trim()}`);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
    } catch {
      showError("Source link must be a valid http/https URL.", { sourceURL: true });
      return;
    }

    // Validate thumbnail URL if provided
    if (thumbnailURL.trim() && !thumbnailFile) {
      try {
        const u = new URL(thumbnailURL.trim().startsWith("http") ? thumbnailURL.trim() : `https://${thumbnailURL.trim()}`);
        if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      } catch {
        showError("Thumbnail link must be a valid http/https URL.", { thumbnailURL: true });
        return;
      }
    }

    setSaving(true);
    setError("");
    setFieldErrors({});

    try {
      let thumbnailStorageURL: string | null = null;

      // Upload file if provided (takes priority over URL)
      if (thumbnailFile && storage && user) {
        const path = `inspiration/${user.uid}/${Date.now()}_${thumbnailFile.name}`;
        const fileRef = storageRef(storage, path);
        const snap = await uploadBytes(fileRef, thumbnailFile);
        thumbnailStorageURL = await getDownloadURL(snap.ref);
      }

      const normalizedSourceURL = sourceURL.trim().startsWith("http")
        ? sourceURL.trim()
        : `https://${sourceURL.trim()}`;

      const normalizedThumbnailURL =
        thumbnailURL.trim() && !thumbnailFile
          ? thumbnailURL.trim().startsWith("http")
            ? thumbnailURL.trim()
            : `https://${thumbnailURL.trim()}`
          : null;

      await createInspirationItem({
        title: title.trim(),
        description: description.trim(),
        category: category as InspirationCategory,
        creator: creator.trim(),
        sourceURL: normalizedSourceURL,
        thumbnailURL: normalizedThumbnailURL,
        thumbnailStorageURL,
        submittedBy: user.uid,
      });

      router.push("/inspiration");
    } catch (err) {
      console.error(err);
      showError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Submit Inspiration Content</h1>
        <p className="mt-1 text-sm text-muted">
          Share a podcast, article, video, or story that has inspired your teaching.
        </p>
      </div>

      <Card>
        <form ref={formTopRef} onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-error-50 border border-error-200 px-4 py-3 text-sm text-error-700">
              {error}
            </div>
          )}

          <Input
            label="Title *"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setFieldErrors((p) => ({ ...p, title: false })); }}
            placeholder="e.g. Teaching Tolerance Podcast"
            error={fieldErrors.title ? "Required" : undefined}
          />

          <Textarea
            label="Short Description *"
            value={description}
            onChange={(e) => { setDescription(e.target.value); setFieldErrors((p) => ({ ...p, description: false })); }}
            placeholder="A brief summary of what this is and why it's valuable…"
            rows={3}
            error={fieldErrors.description ? "Required" : undefined}
          />

          <Select
            label="Category *"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setFieldErrors((p) => ({ ...p, category: false })); }}
            options={[
              { value: "", label: "Select a category" },
              ...INSPIRATION_CATEGORIES.map((c) => ({ value: c.value, label: `${c.icon} ${c.label}` })),
            ]}
            error={fieldErrors.category ? "Required" : undefined}
          />

          <Input
            label="Creator / Source *"
            value={creator}
            onChange={(e) => { setCreator(e.target.value); setFieldErrors((p) => ({ ...p, creator: false })); }}
            placeholder="e.g. Edutopia, Jennifer Gonzalez, Your Name…"
            error={fieldErrors.creator ? "Required" : undefined}
          />

          <Input
            label="Source Link *"
            value={sourceURL}
            onChange={(e) => { setSourceURL(e.target.value); setFieldErrors((p) => ({ ...p, sourceURL: false })); }}
            placeholder="https://…"
            type="url"
            error={fieldErrors.sourceURL ? "Required" : undefined}
          />

          {/* Thumbnail section */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Thumbnail <span className="text-muted font-normal">(optional)</span></p>

            {/* File upload */}
            <div>
              <label className="text-xs text-muted mb-1 block">Upload an image</label>
              {thumbnailPreview ? (
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnailPreview} alt="Thumbnail preview" className="h-20 w-32 rounded-md object-cover border border-border" />
                  <button type="button" onClick={clearFile} className="text-xs text-error-600 hover:underline mt-1">Remove</button>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-secondary-100 file:text-foreground hover:file:bg-secondary-200 cursor-pointer"
                />
              )}
              <p className="mt-1 text-xs text-muted">Max 5 MB. JPG, PNG, or WebP.</p>
            </div>

            {/* URL field - only when no file */}
            {!thumbnailFile && (
              <div>
                <label className="text-xs text-muted mb-1 block">Or paste an image URL</label>
                <Input
                  value={thumbnailURL}
                  onChange={(e) => { setThumbnailURL(e.target.value); setFieldErrors((p) => ({ ...p, thumbnailURL: false })); }}
                  placeholder="https://example.com/image.jpg"
                  type="url"
                  error={fieldErrors.thumbnailURL ? "Must be a valid https:// URL" : undefined}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/inspiration")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={saving}>
              {saving ? "Submitting…" : "Submit Content"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
