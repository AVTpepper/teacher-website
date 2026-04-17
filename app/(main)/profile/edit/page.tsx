"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import Image from "next/image";

import { useAuth } from "@/lib/auth-context";
import { storage } from "@/lib/firebase";
import {
  getUser,
  createUser,
  updateUser,
  GRADE_LEVELS,
  SUBJECTS,
  type UserProfileInput,
} from "@/lib/firestore/users";
import { Button, Input, Select, Textarea, Tag, Card } from "@/components/ui";

export default function EditProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [school, setSchool] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [isExisting, setIsExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [authLoading, user, router]);

  // Load existing profile
  useEffect(() => {
    if (!user) return;

    async function loadProfile() {
      try {
        const profile = await getUser(user!.uid);
        if (profile) {
          setIsExisting(true);
          setDisplayName(profile.displayName);
          setGradeLevel(profile.gradeLevel);
          setSubjects(profile.subjects);
          setLocation(profile.location);
          setSchool(profile.school);
          setYearsOfExperience(
            profile.yearsOfExperience > 0
              ? String(profile.yearsOfExperience)
              : ""
          );
          setBio(profile.bio);
          setPhotoURL(profile.photoURL);
        } else {
          // Pre-fill from auth data
          setDisplayName(user!.displayName || "");
          setPhotoURL(user!.photoURL || null);
        }
      } catch {
        // Firestore may not be configured yet — just pre-fill from auth
        setDisplayName(user!.displayName || "");
        setPhotoURL(user!.photoURL || null);
      } finally {
        setLoadingProfile(false);
      }
    }

    loadProfile();
  }, [user]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size (max 5MB)
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5 MB.");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
  }

  function toggleSubject(subject: string) {
    setSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    setError("");
    setSaving(true);

    try {
      let finalPhotoURL = photoURL;

      // Upload photo if a new one was selected
      if (photoFile) {
        if (!storage) {
          // Storage not activated — skip upload, keep existing photo
          console.warn("Firebase Storage not activated — skipping photo upload");
        } else {
          const storageRef = ref(
            storage,
            `avatars/${user.uid}/${Date.now()}_${photoFile.name}`
          );
          await uploadBytes(storageRef, photoFile);
          finalPhotoURL = await getDownloadURL(storageRef);
        }
      }

      const profileData: UserProfileInput = {
        uid: user.uid,
        displayName: displayName.trim(),
        email: user.email || "",
        photoURL: finalPhotoURL,
        gradeLevel,
        subjects,
        location: location.trim(),
        school: school.trim(),
        yearsOfExperience: yearsOfExperience
          ? parseInt(yearsOfExperience, 10)
          : 0,
        bio: bio.trim(),
      };

      if (isExisting) {
        const { uid, ...updateData } = profileData;
        await updateUser(uid, updateData);
      } else {
        await createUser(profileData);
      }

      // Update Firebase Auth display name + photo
      await updateProfile(user, {
        displayName: profileData.displayName,
        photoURL: finalPhotoURL,
      });

      router.push("/profile");
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loadingProfile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const currentPhoto = photoPreview || photoURL;

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-2xl font-bold text-foreground">
        {isExisting ? "Edit Profile" : "Complete Your Profile"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {isExisting
          ? "Update your profile information."
          : "Tell the community about yourself to get started."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Profile Photo */}
        <Card className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-secondary-100 transition-opacity hover:opacity-80"
          >
            {currentPhoto ? (
              <Image
                src={currentPhoto}
                alt="Profile photo"
                fill
                className="object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-secondary-500">
                {displayName.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </button>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {currentPhoto ? "Change Photo" : "Upload Photo"}
            </Button>
            <p className="mt-1 text-xs text-muted">JPG, PNG, GIF — max 5 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </Card>

        {/* Basic Info */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Basic Information
          </h2>
          <div className="space-y-4">
            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              required
            />

            <Select
              label="Grade Level"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="Select your grade level"
              options={GRADE_LEVELS.map((g) => ({ value: g, label: g }))}
            />

            <Input
              label="School"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="Your school or institution"
            />

            <Input
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, State/Province, Country"
            />

            <Input
              label="Years of Experience"
              type="number"
              value={yearsOfExperience}
              onChange={(e) => setYearsOfExperience(e.target.value)}
              placeholder="e.g. 5"
              min={0}
              max={60}
            />
          </div>
        </Card>

        {/* Subjects */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Subjects You Teach
          </h2>
          <p className="mb-3 text-sm text-muted">
            Select all that apply.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((subject) => (
              <Tag
                key={subject}
                label={subject}
                selected={subjects.includes(subject)}
                onToggle={() => toggleSubject(subject)}
              />
            ))}
          </div>
        </Card>

        {/* Bio */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            About You
          </h2>
          <Textarea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Share a bit about your teaching philosophy, interests, or experience..."
            rows={5}
            maxLength={500}
          />
          <p className="mt-1 text-right text-xs text-muted">
            {bio.length}/500
          </p>
        </Card>

        {/* Error */}
        {error && (
          <p className="text-sm text-error-500">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={saving}>
            {isExisting ? "Save Changes" : "Create Profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
