"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { updateProfile } from "firebase/auth";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import { Button, Card, Input, Select, Tag, Textarea } from "@/components/ui";
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
import {
  PROFILE_CARD_THEME_OPTIONS,
  resolveProfileCardTheme,
  getProfileCardThemeStyle,
} from "@/lib/profile-card-theme";
import {
  computeProfileCompletion,
  CURRICULA,
  LANGUAGES,
  NETWORKING_GOALS,
  ONBOARDING_VERSION,
  PROFESSIONAL_INTERESTS,
  PROFESSIONAL_ROLES,
  SCHOOL_TYPES,
} from "@/lib/onboarding";
import { uploadProfilePhoto, validateProfilePhoto } from "@/lib/profile-photo";

type EditState = {
  displayName: string;
  photoURL: string | null;
  gradeLevels: string[];
  subjects: string[];
  professionalRole: string;
  additionalRoles: string[];
  professionalHeadline: string;
  curricula: string[];
  country: string;
  city: string;
  languages: string[];
  school: string;
  schoolType: string;
  yearsOfExperience: string;
  bio: string;
  professionalInterests: string[];
  networkingGoals: string[];
  lookingFor: string;
  profileCardTheme: "classic" | "ocean" | "forest" | "sunset" | "midnight";
};

function initialState(): EditState {
  return {
    displayName: "",
    photoURL: null,
    gradeLevels: [],
    subjects: [],
    professionalRole: "",
    additionalRoles: [],
    professionalHeadline: "",
    curricula: [],
    country: "",
    city: "",
    languages: [],
    school: "",
    schoolType: "",
    yearsOfExperience: "",
    bio: "",
    professionalInterests: [],
    networkingGoals: [],
    lookingFor: "",
    profileCardTheme: "classic",
  };
}

function toggleSelection(values: string[], value: string, max: number): string[] {
  if (values.includes(value)) return values.filter((item) => item !== value);
  if (values.length >= max) return values;
  return [...values, value];
}

export default function EditProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<EditState>(initialState());
  const [isExisting, setIsExisting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tier, setTier] = useState<"free" | "plus">("free");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;

    const currentUser = user;

    let cancelled = false;

    async function loadProfile() {
      try {
        const profile = await getUser(currentUser.uid);
        if (cancelled) return;

        if (profile) {
          setIsExisting(true);
          setTier(profile.tier === "plus" ? "plus" : "free");
          const safeTheme = resolveProfileCardTheme(
            profile.profileCardTheme,
            profile.tier
          );
          setState({
            displayName: profile.displayName || currentUser.displayName || "",
            photoURL: profile.photoURL ?? currentUser.photoURL,
            gradeLevels: profile.gradeLevels ?? (profile.gradeLevel ? [profile.gradeLevel] : []),
            subjects: profile.subjects ?? [],
            professionalRole: profile.professionalRole || "",
            additionalRoles: profile.additionalRoles ?? [],
            professionalHeadline: profile.professionalHeadline || "",
            curricula: profile.curricula ?? [],
            country: profile.country || "",
            city: profile.city || "",
            languages: profile.languages ?? [],
            school: profile.school || "",
            schoolType: profile.schoolType || "",
            yearsOfExperience:
              typeof profile.yearsOfExperience === "number" && profile.yearsOfExperience > 0
                ? String(profile.yearsOfExperience)
                : "",
            bio: profile.bio || "",
            professionalInterests: profile.professionalInterests ?? [],
            networkingGoals: profile.networkingGoals ?? [],
            lookingFor: profile.lookingFor || "",
            profileCardTheme: safeTheme,
          });
        } else {
          setTier("free");
          setState((prev) => ({
            ...prev,
            displayName: currentUser.displayName || "",
            photoURL: currentUser.photoURL,
            profileCardTheme: "classic",
          }));
        }
      } catch {
        setTier("free");
        setState((prev) => ({
          ...prev,
          displayName: currentUser.displayName || "",
          photoURL: currentUser.photoURL,
          profileCardTheme: "classic",
        }));
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handlePhotoFile(file: File) {
    const validation = validateProfilePhoto(file);
    if (validation) {
      setPhotoError(validation);
      return;
    }

    if (!storage || !user) {
      setPhotoError("File upload is not available right now.");
      return;
    }

    setUploading(true);
    setPhotoError("");
    setUploadProgress(0);

    try {
      const url = await uploadProfilePhoto({
        storage,
        uid: user.uid,
        file,
        onProgress: setUploadProgress,
      });
      setState((prev) => ({ ...prev, photoURL: url }));
    } catch {
      setPhotoError("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setError("");

    try {
      const years = Number(state.yearsOfExperience);
      const yearsOfExperience = !state.yearsOfExperience || Number.isNaN(years)
        ? 0
        : Math.max(0, Math.min(60, years));

      const profileData: UserProfileInput = {
        uid: user.uid,
        displayName: state.displayName.trim(),
        email: user.email || "",
        photoURL: state.photoURL,
        gradeLevel: state.gradeLevels[0] || "",
        gradeLevels: state.gradeLevels,
        subjects: state.subjects,
        professionalRole: state.professionalRole,
        additionalRoles: state.additionalRoles,
        professionalHeadline: state.professionalHeadline.trim(),
        curricula: state.curricula,
        country: state.country.trim(),
        city: state.city.trim(),
        languages: state.languages,
        school: state.school.trim(),
        schoolType: state.schoolType,
        yearsOfExperience,
        bio: state.bio.trim(),
        professionalInterests: state.professionalInterests,
        networkingGoals: state.networkingGoals,
        lookingFor: state.lookingFor.trim(),
        profileCardTheme:
          tier === "plus"
            ? resolveProfileCardTheme(state.profileCardTheme, "plus")
            : "classic",
        onboardingVersion: ONBOARDING_VERSION,
        onboardingCurrentStep: 7,
      };

      const completion = computeProfileCompletion(profileData);
      profileData.profileCompletion = completion.percentage;
      if (completion.minimumComplete) {
        profileData.onboardingCompleted = true;
      }

      if (isExisting) {
        const { uid, ...updateData } = profileData;
        await updateUser(uid, updateData);
      } else {
        await createUser({
          ...profileData,
          onboardingCompleted: Boolean(profileData.onboardingCompleted),
          profileCompletion: profileData.profileCompletion ?? 0,
          onboardingCurrentStep: 7,
        });
      }

      await updateProfile(user, {
        displayName: profileData.displayName,
        photoURL: profileData.photoURL,
      });

      setSuccessMsg("Profile updated");
      setTimeout(() => router.push("/profile"), 900);
    } catch {
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

  const themePreview = getProfileCardThemeStyle(state.profileCardTheme, tier);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Link href="/profile" className="transition-colors hover:text-foreground">Profile</Link>
          <span>/</span>
          <span className="text-foreground">Edit Profile</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <DiscoveryShell
        title={isExisting ? "Edit Profile" : "Complete Your Profile"}
        subtitle="Update your professional profile so VistaTeacher can personalize who and what you discover."
        eyebrow="Profile"
        className="mb-0"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-secondary-100">
            {state.photoURL ? (
              <Image src={state.photoURL} alt="Profile photo" fill sizes="80px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-secondary-500">
                {state.displayName.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading || saving}>
              {state.photoURL ? "Replace photo" : "Upload photo"}
            </Button>
            {state.photoURL && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setState((prev) => ({ ...prev, photoURL: null }))} disabled={uploading || saving}>
                Remove photo
              </Button>
            )}
            <p className="text-xs text-muted">JPEG or PNG. Maximum 2 MB.</p>
            {photoError && <p className="text-xs text-error-600">{photoError}</p>}
            {uploadProgress !== null && <p className="text-xs text-muted">Uploading... {uploadProgress}%</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void handlePhotoFile(file);
              }}
            />
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Professional identity</h2>
          <Input
            label="Display name"
            value={state.displayName}
            onChange={(event) => setState((prev) => ({ ...prev, displayName: event.target.value }))}
            required
          />
          <Select
            label="Primary professional role"
            value={state.professionalRole}
            onChange={(event) => setState((prev) => ({ ...prev, professionalRole: event.target.value }))}
            options={PROFESSIONAL_ROLES.map((role) => ({ value: role, label: role }))}
            placeholder="Select one"
          />
          <Input
            label="Professional headline"
            value={state.professionalHeadline}
            onChange={(event) => setState((prev) => ({ ...prev, professionalHeadline: event.target.value.slice(0, 120) }))}
            maxLength={120}
            placeholder="Primary Teacher | IB PYP | EdTech Enthusiast"
          />
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Additional roles</p>
            <div className="flex flex-wrap gap-2">
              {PROFESSIONAL_ROLES.filter((role) => role !== state.professionalRole).map((role) => (
                <Tag
                  key={role}
                  label={role}
                  selected={state.additionalRoles.includes(role)}
                  onToggle={() => setState((prev) => ({ ...prev, additionalRoles: toggleSelection(prev.additionalRoles, role, 3) }))}
                />
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Teaching context</h2>
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Grade levels</p>
            <div className="flex flex-wrap gap-2">
              {GRADE_LEVELS.map((level) => (
                <Tag
                  key={level}
                  label={level}
                  selected={state.gradeLevels.includes(level)}
                  onToggle={() => setState((prev) => ({ ...prev, gradeLevels: toggleSelection(prev.gradeLevels, level, 6) }))}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Subjects</p>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((subject) => (
                <Tag
                  key={subject}
                  label={subject}
                  selected={state.subjects.includes(subject)}
                  onToggle={() => setState((prev) => ({ ...prev, subjects: toggleSelection(prev.subjects, subject, 8) }))}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Curriculum</p>
            <div className="flex flex-wrap gap-2">
              {CURRICULA.map((curriculum) => (
                <Tag
                  key={curriculum}
                  label={curriculum}
                  selected={state.curricula.includes(curriculum)}
                  onToggle={() => setState((prev) => ({ ...prev, curricula: toggleSelection(prev.curricula, curriculum, 6) }))}
                />
              ))}
            </div>
          </div>
          <Input
            label="Years of experience"
            type="number"
            min={0}
            max={60}
            value={state.yearsOfExperience}
            onChange={(event) => setState((prev) => ({ ...prev, yearsOfExperience: event.target.value }))}
          />
          <Select
            label="School type"
            value={state.schoolType}
            onChange={(event) => setState((prev) => ({ ...prev, schoolType: event.target.value }))}
            options={SCHOOL_TYPES.map((value) => ({ value, label: value }))}
            placeholder="Select school type"
          />
          <Input
            label="School or organization"
            value={state.school}
            onChange={(event) => setState((prev) => ({ ...prev, school: event.target.value }))}
          />
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Location and languages</h2>
          <Input
            label="Country"
            value={state.country}
            onChange={(event) => setState((prev) => ({ ...prev, country: event.target.value }))}
          />
          <Input
            label="City"
            value={state.city}
            onChange={(event) => setState((prev) => ({ ...prev, city: event.target.value }))}
          />
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Languages</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((language) => (
                <Tag
                  key={language}
                  label={language}
                  selected={state.languages.includes(language)}
                  onToggle={() => setState((prev) => ({ ...prev, languages: toggleSelection(prev.languages, language, 8) }))}
                />
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Profile card style</h2>
          <p className="text-sm text-muted">
            Choose the header gradient shown on your public educator profile.
          </p>

          <div className={`overflow-hidden rounded-2xl border border-primary-900/20 ${themePreview.gradientClass}`}>
            <div className="bg-black/8 px-4 py-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Preview</p>
              <p className="mt-1 text-xl font-bold">
                {state.displayName.trim() || "Your name"}
              </p>
              <p className="text-sm text-white/85">
                {state.professionalHeadline.trim() || state.professionalRole || "Educator"}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {PROFILE_CARD_THEME_OPTIONS.map((option) => {
              const locked = option.plusOnly && tier !== "plus";
              const selected = state.profileCardTheme === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    if (locked) return;
                    setState((prev) => ({ ...prev, profileCardTheme: option.id }));
                  }}
                  disabled={locked}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${
                    selected
                      ? "border-primary-600 bg-primary-50"
                      : "border-border bg-surface"
                  } ${locked ? "opacity-60" : "hover:border-primary-300 hover:bg-surface-hover"}`}
                >
                  <span className={`mb-2 block h-8 w-full rounded-lg ${option.swatchClass}`} />
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {option.label}
                    {option.plusOnly && (
                      <span className="rounded-full border border-accent-300 bg-accent-100 px-2 py-0.5 text-[11px] font-bold text-primary-900">
                        Plus
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-muted">{option.description}</span>
                  {locked && (
                    <span className="mt-1 block text-xs font-medium text-primary-900">
                      Upgrade to Plus to unlock
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {tier !== "plus" && (
            <p className="text-xs text-muted">
              Plus members can choose premium profile gradients in addition to the Classic style.
            </p>
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Interests and goals</h2>
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Professional interests</p>
            <div className="flex flex-wrap gap-2">
              {PROFESSIONAL_INTERESTS.map((interest) => (
                <Tag
                  key={interest}
                  label={interest}
                  selected={state.professionalInterests.includes(interest)}
                  onToggle={() => setState((prev) => ({ ...prev, professionalInterests: toggleSelection(prev.professionalInterests, interest, 8) }))}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">Networking goals</p>
            <div className="flex flex-wrap gap-2">
              {NETWORKING_GOALS.map((goal) => (
                <Tag
                  key={goal}
                  label={goal}
                  selected={state.networkingGoals.includes(goal)}
                  onToggle={() => setState((prev) => ({ ...prev, networkingGoals: toggleSelection(prev.networkingGoals, goal, 6) }))}
                />
              ))}
            </div>
          </div>
          <Textarea
            label="Bio"
            value={state.bio}
            onChange={(event) => setState((prev) => ({ ...prev, bio: event.target.value.slice(0, 500) }))}
            maxLength={500}
            showCharacterCount
            rows={5}
          />
          <Textarea
            label="What I am looking for"
            value={state.lookingFor}
            onChange={(event) => setState((prev) => ({ ...prev, lookingFor: event.target.value.slice(0, 240) }))}
            maxLength={240}
            showCharacterCount
            rows={3}
          />
        </Card>

        {successMsg && (
          <div role="status" className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
            {successMsg}
          </div>
        )}

        {error && <p className="text-sm text-error-600">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={saving || uploading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saving} disabled={uploading || !state.displayName.trim()}>
            {isExisting ? "Save Changes" : "Create Profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
