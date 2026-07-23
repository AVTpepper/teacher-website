"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { updateProfile } from "firebase/auth";
import Image from "next/image";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Tag,
  Textarea,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { storage } from "@/lib/firebase";
import {
  createUser,
  ensureUserProfile,
  getUser,
  markOnboardingCompleted,
  updateUser,
  GRADE_LEVELS,
  SUBJECTS,
  type UserProfile,
  type UserProfileInput,
} from "@/lib/firestore/users";
import {
  computeProfileCompletion,
  coerceOnboardingCurrentStep,
  COUNTRIES,
  CURRICULA,
  getOnboardingEligibility,
  getOnboardingStepCount,
  LANGUAGES,
  NETWORKING_GOALS,
  ONBOARDING_VERSION,
  PROFESSIONAL_INTERESTS,
  PROFESSIONAL_ROLES,
  roleRequiresSubject,
  SCHOOL_TYPES,
} from "@/lib/onboarding";
import { uploadProfilePhoto, validateProfilePhoto } from "@/lib/profile-photo";

type OnboardingFormState = {
  displayName: string;
  professionalRole: string;
  additionalRoles: string[];
  professionalHeadline: string;
  gradeLevels: string[];
  subjects: string[];
  curricula: string[];
  yearsOfExperience: string;
  schoolType: string;
  school: string;
  country: string;
  city: string;
  languages: string[];
  professionalInterests: string[];
  networkingGoals: string[];
  bio: string;
  lookingFor: string;
  photoURL: string | null;
};

const STEP_TITLES = [
  "Professional identity",
  "Teaching context",
  "Location and languages",
  "Professional interests",
  "Networking goals",
  "Profile introduction",
  "Completion",
];

const TOTAL_STEPS = getOnboardingStepCount();

function mapProfileToState(profile: UserProfile, fallbackDisplayName: string): OnboardingFormState {
  return {
    displayName: profile.displayName || fallbackDisplayName,
    professionalRole: profile.professionalRole || "",
    additionalRoles: profile.additionalRoles ?? [],
    professionalHeadline: profile.professionalHeadline || "",
    gradeLevels: profile.gradeLevels ?? (profile.gradeLevel ? [profile.gradeLevel] : []),
    subjects: profile.subjects ?? [],
    curricula: profile.curricula ?? [],
    yearsOfExperience:
      typeof profile.yearsOfExperience === "number" && profile.yearsOfExperience > 0
        ? String(profile.yearsOfExperience)
        : "",
    schoolType: profile.schoolType || "",
    school: profile.school || "",
    country: profile.country || "",
    city: profile.city || "",
    languages: profile.languages ?? [],
    professionalInterests: profile.professionalInterests ?? [],
    networkingGoals: profile.networkingGoals ?? [],
    bio: profile.bio || "",
    lookingFor: profile.lookingFor || "",
    photoURL: profile.photoURL,
  };
}

function toggleSelection(values: string[], value: string, max: number): string[] {
  if (values.includes(value)) return values.filter((item) => item !== value);
  if (values.length >= max) return values;
  return [...values, value];
}

function trimToMax(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function validateStep(step: number, state: OnboardingFormState): string[] {
  const errors: string[] = [];
  const subjectRequired = roleRequiresSubject(state.professionalRole);

  if (step === 1) {
    if (!state.displayName.trim()) errors.push("Display name is required.");
    if (!state.professionalRole) errors.push("Select your primary professional role.");
  }

  if (step === 2) {
    if (state.gradeLevels.length === 0 && subjectRequired) {
      errors.push("Add at least one grade level.");
    }
    if (state.subjects.length === 0 && subjectRequired) {
      errors.push("Add at least one subject for your role.");
    }

    if (state.yearsOfExperience) {
      const years = Number(state.yearsOfExperience);
      if (Number.isNaN(years) || years < 0 || years > 60) {
        errors.push("Years of experience must be between 0 and 60.");
      }
    }
  }

  if (step === 3 && !state.country) {
    errors.push("Country is required.");
  }

  if (step === 5 && state.networkingGoals.length === 0) {
    errors.push("Select at least one networking goal.");
  }

  if (step === 6 && state.bio.trim().length > 0 && state.bio.trim().length < 20) {
    errors.push("Bio should be at least 20 characters, or leave it empty for now.");
  }

  return errors;
}

function makeProfilePatch(user: { uid: string; email: string }, state: OnboardingFormState): UserProfileInput {
  const years = Number(state.yearsOfExperience);
  const yearsOfExperience = !state.yearsOfExperience || Number.isNaN(years) ? 0 : Math.max(0, Math.min(60, years));

  return {
    uid: user.uid,
    displayName: state.displayName.trim(),
    email: user.email,
    photoURL: state.photoURL,
    gradeLevel: state.gradeLevels[0] ?? "",
    gradeLevels: state.gradeLevels,
    subjects: state.subjects,
    professionalRole: state.professionalRole,
    additionalRoles: state.additionalRoles,
    professionalHeadline: trimToMax(state.professionalHeadline.trim(), 120),
    curricula: state.curricula,
    country: state.country,
    city: trimToMax(state.city.trim(), 80),
    languages: state.languages,
    school: trimToMax(state.school.trim(), 140),
    schoolType: state.schoolType,
    yearsOfExperience,
    bio: trimToMax(state.bio.trim(), 500),
    professionalInterests: state.professionalInterests,
    networkingGoals: state.networkingGoals,
    lookingFor: trimToMax(state.lookingFor.trim(), 240),
  };
}

function OnboardingPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/home";
  const userUid = user?.uid;
  const userEmail = user?.email || "";
  const userDisplayName = user?.displayName || "";
  const userPhotoURL = user?.photoURL ?? null;

  const [state, setState] = useState<OnboardingFormState | null>(null);
  const [step, setStep] = useState(1);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [pageError, setPageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [stepError, setStepError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [completionPreview, setCompletionPreview] = useState({ percentage: 0, minimumComplete: false, missingRecommended: [] as string[] });
  const [profileId, setProfileId] = useState<string | null>(null);
  const [completionSaved, setCompletionSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (authLoading) return;
    if (!userUid) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(pathname || "/onboarding")}`);
      return;
    }
    const ensuredUid = userUid;

    let cancelled = false;

    async function load() {
      setLoadingProfile(true);
      setPageError("");

      try {
        await ensureUserProfile({
          uid: ensuredUid,
          displayName: userDisplayName,
          email: userEmail,
          photoURL: userPhotoURL,
        });

        const profile = await getUser(ensuredUid);
        if (cancelled) return;

        if (!profile) {
          await createUser({
            uid: ensuredUid,
            displayName: userDisplayName,
            email: userEmail,
            photoURL: userPhotoURL,
            gradeLevel: "",
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
            yearsOfExperience: 0,
            bio: "",
            professionalInterests: [],
            networkingGoals: [],
            lookingFor: "",
            onboardingCompleted: false,
            onboardingVersion: 0,
            onboardingCurrentStep: 1,
            profileCompletion: 0,
          });
        }

        const latest = (await getUser(ensuredUid)) as UserProfile;
        const eligibility = getOnboardingEligibility(latest);
        const mapped = mapProfileToState(latest, userDisplayName);
        setState(mapped);
        setCompletionPreview(computeProfileCompletion(latest));
        setProfileId(latest.uid);

        if (eligibility === "completed" && latest.onboardingCompleted) {
          router.replace(redirectTo);
          return;
        }

        if (eligibility === "legacy-complete") {
          const completion = computeProfileCompletion(latest);
          await markOnboardingCompleted(ensuredUid, {
            onboardingVersion: ONBOARDING_VERSION,
            onboardingCurrentStep: TOTAL_STEPS,
            profileCompletion: completion.percentage,
            displayName: latest.displayName,
            gradeLevel: latest.gradeLevel,
            gradeLevels: latest.gradeLevels ?? (latest.gradeLevel ? [latest.gradeLevel] : []),
            subjects: latest.subjects ?? [],
            professionalRole: latest.professionalRole ?? "",
            additionalRoles: latest.additionalRoles ?? [],
            professionalHeadline: latest.professionalHeadline ?? "",
            curricula: latest.curricula ?? [],
            country: latest.country ?? "",
            city: latest.city ?? "",
            languages: latest.languages ?? [],
            school: latest.school ?? "",
            schoolType: latest.schoolType ?? "",
            yearsOfExperience: latest.yearsOfExperience ?? 0,
            bio: latest.bio ?? "",
            professionalInterests: latest.professionalInterests ?? [],
            networkingGoals: latest.networkingGoals ?? [],
            lookingFor: latest.lookingFor ?? "",
            photoURL: latest.photoURL ?? null,
            email: latest.email,
          });
          router.replace(redirectTo);
          return;
        }

        setStep(coerceOnboardingCurrentStep(latest.onboardingCurrentStep));
      } catch {
        if (!cancelled) {
          setPageError("We could not load onboarding right now. Please retry.");
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    pathname,
    redirectTo,
    router,
    userUid,
    userEmail,
    userDisplayName,
    userPhotoURL,
  ]);

  const canContinue = useMemo(() => {
    if (!state) return false;
    return validateStep(step, state).length === 0;
  }, [state, step]);

  async function persistDraft(nextStep: number): Promise<boolean> {
    if (!user || !state) return false;
    setSaving(true);
    setStepError("");
    setSaveNotice("");

    try {
      const patch = makeProfilePatch({ uid: user.uid, email: user.email || "" }, state);
      const completion = computeProfileCompletion({ ...patch, uid: user.uid });
      const { uid, ...updateData } = {
        ...patch,
        onboardingCurrentStep: nextStep,
        onboardingCompleted: false,
        onboardingVersion: ONBOARDING_VERSION,
        profileCompletion: completion.percentage,
      };

      await updateUser(uid, updateData);

      if (user.displayName !== patch.displayName || user.photoURL !== patch.photoURL) {
        await updateProfile(user, {
          displayName: patch.displayName,
          photoURL: patch.photoURL,
        });
      }

      setCompletionPreview(completion);
      setSaveNotice("Progress saved");
      return true;
    } catch {
      setStepError("We could not save your progress. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleContinue() {
    if (!state) return;
    const errors = validateStep(step, state);
    if (errors.length > 0) {
      setStepError(errors[0]);
      return;
    }

    if (step >= TOTAL_STEPS) return;

    const nextStep = Math.min(TOTAL_STEPS, step + 1);
    const ok = await persistDraft(nextStep);
    if (!ok) return;
    setStep(nextStep);
  }

  async function handleBack() {
    if (step <= 1) return;
    const nextStep = Math.max(1, step - 1);
    await persistDraft(nextStep);
    setStep(nextStep);
  }

  async function handleSkipOptional() {
    const optionalSteps = new Set([4, 6]);
    if (!optionalSteps.has(step)) return;
    const nextStep = Math.min(TOTAL_STEPS, step + 1);
    const ok = await persistDraft(nextStep);
    if (!ok) return;
    setStep(nextStep);
  }

  async function handleSaveAndExit() {
    if (!state || !user) return;
    const ok = await persistDraft(step);
    if (!ok) return;
    router.push("/home");
  }

  async function handleProfilePhoto(file: File) {
    if (!state || !user) return;

    const validation = validateProfilePhoto(file);
    if (validation) {
      setPhotoError(validation);
      return;
    }

    if (!storage) {
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
      setState((prev) => (prev ? { ...prev, photoURL: url } : prev));
    } catch {
      setPhotoError("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleCompleteOnboarding() {
    if (!state || !user) return;

    const allErrors = [1, 2, 3, 5].flatMap((requiredStep) => validateStep(requiredStep, state));
    if (allErrors.length > 0) {
      setStepError(allErrors[0]);
      setStep(1);
      return;
    }

    setSaving(true);
    setStepError("");

    try {
      const patch = makeProfilePatch({ uid: user.uid, email: user.email || "" }, state);
      const completion = computeProfileCompletion({ ...patch, uid: user.uid });

      if (!completion.minimumComplete) {
        setStepError("Please complete required profile details before finishing onboarding.");
        setStep(1);
        return;
      }

      const { uid, ...updateData } = {
        ...patch,
        onboardingVersion: ONBOARDING_VERSION,
        onboardingCurrentStep: TOTAL_STEPS,
        profileCompletion: completion.percentage,
      };

      await markOnboardingCompleted(uid, updateData);

      if (user.displayName !== patch.displayName || user.photoURL !== patch.photoURL) {
        await updateProfile(user, {
          displayName: patch.displayName,
          photoURL: patch.photoURL,
        });
      }

      setCompletionPreview(completion);
      setCompletionSaved(true);
      setSaveNotice("Onboarding complete");
    } catch {
      setStepError("We could not complete onboarding. Please retry.");
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

  if (pageError) {
    return (
      <ErrorState
        message={pageError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!state) {
    return (
      <EmptyState
        title="We need a moment"
        description="Your onboarding profile is still initializing."
        actionLabel="Reload"
        onAction={() => window.location.reload()}
      />
    );
  }

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);
  const stepTitle = STEP_TITLES[step - 1];
  const subjectRequired = roleRequiresSubject(state.professionalRole);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
      <Card className="space-y-4">
        <p className="type-meta text-primary-800">Onboarding</p>
        <h1 className="type-page-title text-3xl text-foreground">Let us build your educator network</h1>
        <p className="text-sm text-text-secondary">
          We use your profile details to personalize educator discovery and recommendations.
        </p>
        <div aria-live="polite" className="space-y-2">
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span>Step {step} of {TOTAL_STEPS}</span>
            <span>{progressPercent}% complete</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary-100">
            <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </Card>

      <Card className="space-y-5">
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-foreground focus:outline-none">
          {stepTitle}
        </h2>

        {step === 1 && (
          <div className="space-y-4">
            <Input
              label="Display name"
              value={state.displayName}
              onChange={(event) => setState((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))}
              required
              placeholder="How other educators see your name"
            />

            <Select
              label="Primary professional role"
              value={state.professionalRole}
              onChange={(event) => setState((prev) => (prev ? { ...prev, professionalRole: event.target.value } : prev))}
              options={PROFESSIONAL_ROLES.map((role) => ({ value: role, label: role }))}
              placeholder="Select one"
              required
              description="This role helps us adapt discovery and recommendations."
            />

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Additional roles (optional)</p>
              <div className="flex flex-wrap gap-2">
                {PROFESSIONAL_ROLES.filter((role) => role !== state.professionalRole).map((role) => (
                  <Tag
                    key={role}
                    label={role}
                    selected={state.additionalRoles.includes(role)}
                    onToggle={() =>
                      setState((prev) =>
                        prev
                          ? {
                              ...prev,
                              additionalRoles: toggleSelection(prev.additionalRoles, role, 3),
                            }
                          : prev
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <Input
              label="Professional headline"
              value={state.professionalHeadline}
              onChange={(event) =>
                setState((prev) =>
                  prev
                    ? { ...prev, professionalHeadline: trimToMax(event.target.value, 120) }
                    : prev
                )
              }
              placeholder="Primary Teacher | IB PYP | EdTech Enthusiast"
              description="A short line that helps others understand your professional focus."
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Grade levels {subjectRequired ? "(required)" : "(recommended)"}</p>
              <div className="flex flex-wrap gap-2">
                {GRADE_LEVELS.map((level) => (
                  <Tag
                    key={level}
                    label={level}
                    selected={state.gradeLevels.includes(level)}
                    onToggle={() =>
                      setState((prev) =>
                        prev
                          ? { ...prev, gradeLevels: toggleSelection(prev.gradeLevels, level, 6) }
                          : prev
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Subjects {subjectRequired ? "(required)" : "(optional)"}</p>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((subject) => (
                  <Tag
                    key={subject}
                    label={subject}
                    selected={state.subjects.includes(subject)}
                    onToggle={() =>
                      setState((prev) =>
                        prev
                          ? { ...prev, subjects: toggleSelection(prev.subjects, subject, 8) }
                          : prev
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Curriculum (optional)</p>
              <div className="flex flex-wrap gap-2">
                {CURRICULA.map((curriculum) => (
                  <Tag
                    key={curriculum}
                    label={curriculum}
                    selected={state.curricula.includes(curriculum)}
                    onToggle={() =>
                      setState((prev) =>
                        prev
                          ? { ...prev, curricula: toggleSelection(prev.curricula, curriculum, 6) }
                          : prev
                      )
                    }
                  />
                ))}
              </div>
            </div>

            <Input
              label="Years of experience (optional)"
              type="number"
              value={state.yearsOfExperience}
              onChange={(event) =>
                setState((prev) => (prev ? { ...prev, yearsOfExperience: event.target.value } : prev))
              }
              min={0}
              max={60}
              placeholder="e.g. 5"
            />

            <Select
              label="School type (optional)"
              value={state.schoolType}
              onChange={(event) => setState((prev) => (prev ? { ...prev, schoolType: event.target.value } : prev))}
              options={SCHOOL_TYPES.map((type) => ({ value: type, label: type }))}
              placeholder="Select school type"
            />

            <Input
              label="School or organization (optional)"
              value={state.school}
              onChange={(event) => setState((prev) => (prev ? { ...prev, school: event.target.value } : prev))}
              placeholder="Optional"
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Select
              label="Country"
              value={state.country}
              onChange={(event) => setState((prev) => (prev ? { ...prev, country: event.target.value } : prev))}
              options={COUNTRIES.map((country) => ({ value: country, label: country }))}
              placeholder="Select your country"
              required
              description="Country helps surface relevant educators and opportunities."
            />

            <Input
              label="City (optional)"
              value={state.city}
              onChange={(event) => setState((prev) => (prev ? { ...prev, city: event.target.value } : prev))}
              placeholder="City only, not full address"
            />

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Languages spoken (optional)</p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((language) => (
                  <Tag
                    key={language}
                    label={language}
                    selected={state.languages.includes(language)}
                    onToggle={() =>
                      setState((prev) =>
                        prev
                          ? { ...prev, languages: toggleSelection(prev.languages, language, 8) }
                          : prev
                      )
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Select the areas that matter most to your professional growth.</p>
            <div className="flex flex-wrap gap-2">
              {PROFESSIONAL_INTERESTS.map((interest) => (
                <Tag
                  key={interest}
                  label={interest}
                  selected={state.professionalInterests.includes(interest)}
                  onToggle={() =>
                    setState((prev) =>
                      prev
                        ? {
                            ...prev,
                            professionalInterests: toggleSelection(prev.professionalInterests, interest, 8),
                          }
                        : prev
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              We use these choices to personalize who and what you discover.
            </p>
            <div className="flex flex-wrap gap-2">
              {NETWORKING_GOALS.map((goal) => (
                <Tag
                  key={goal}
                  label={goal}
                  selected={state.networkingGoals.includes(goal)}
                  onToggle={() =>
                    setState((prev) =>
                      prev
                        ? { ...prev, networkingGoals: toggleSelection(prev.networkingGoals, goal, 6) }
                        : prev
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-secondary-100">
                {state.photoURL ? (
                  <Image src={state.photoURL} alt="Profile photo" fill sizes="64px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-secondary-500">
                    {state.displayName.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || saving}
                >
                  {state.photoURL ? "Replace photo" : "Upload photo"}
                </Button>
                {state.photoURL && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setState((prev) => (prev ? { ...prev, photoURL: null } : prev))}
                    disabled={uploading || saving}
                  >
                    Remove photo
                  </Button>
                )}
                <p className="text-xs text-text-secondary">JPEG or PNG. Maximum 2 MB.</p>
                {photoError && <p className="text-xs text-error-600">{photoError}</p>}
                {uploadProgress !== null && (
                  <p className="text-xs text-text-secondary" role="status">Uploading... {uploadProgress}%</p>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void handleProfilePhoto(file);
              }}
            />

            <Textarea
              label="Bio (optional)"
              value={state.bio}
              onChange={(event) =>
                setState((prev) =>
                  prev
                    ? { ...prev, bio: trimToMax(event.target.value, 500) }
                    : prev
                )
              }
              rows={5}
              maxLength={500}
              showCharacterCount
              placeholder="I teach upper-primary inquiry units and mentor teachers on project-based learning."
            />

            <Textarea
              label="What I am looking for (optional)"
              value={state.lookingFor}
              onChange={(event) =>
                setState((prev) =>
                  prev
                    ? { ...prev, lookingFor: trimToMax(event.target.value, 240) }
                    : prev
                )
              }
              rows={3}
              maxLength={240}
              showCharacterCount
              placeholder="I am looking to connect with educators interested in inquiry learning and educational technology."
            />

            <p className="text-xs text-text-secondary">
              Some profile fields may appear in educator discovery. Read our <Link href="/privacy" className="font-semibold text-primary-800 hover:underline">privacy policy</Link> for details.
            </p>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <h3 className="text-2xl font-semibold text-foreground">Your educator profile is ready.</h3>
            <p className="text-sm text-text-secondary">
              We will use your professional background, interests, and goals to help you discover relevant educators and opportunities.
            </p>

            <Card variant="profile" className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-full bg-secondary-100">
                  {state.photoURL ? (
                    <Image src={state.photoURL} alt={state.displayName} fill sizes="48px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-secondary-500">
                      {state.displayName.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{state.displayName || "Your profile"}</p>
                  <p className="text-sm text-text-secondary">{state.professionalHeadline || state.professionalRole || "Educator"}</p>
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                {[state.city, state.country].filter(Boolean).join(", ") || "Location not added"}
              </p>
              <p className="text-sm text-text-secondary">
                {(state.subjects.slice(0, 3).join(", ") || state.professionalRole || "Professional context")}
              </p>
              {state.curricula.length > 0 && <p className="text-sm text-text-secondary">Curriculum: {state.curricula.slice(0, 3).join(", ")}</p>}
              {state.professionalInterests.length > 0 && <p className="text-sm text-text-secondary">Interests: {state.professionalInterests.slice(0, 3).join(", ")}</p>}
              {state.networkingGoals.length > 0 && <p className="text-sm text-text-secondary">Goals: {state.networkingGoals.slice(0, 3).join(", ")}</p>}
            </Card>

            {completionSaved ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/discover" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800">
                  Discover Educators
                </Link>
                <Link href="/profile" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-hover">
                  View Your Profile
                </Link>
              </div>
            ) : (
              <Button type="button" onClick={() => void handleCompleteOnboarding()} isLoading={saving}>
                Complete onboarding
              </Button>
            )}
          </div>
        )}

        {stepError && (
          <p role="alert" className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">
            {stepError}
          </p>
        )}

        {saveNotice && (
          <p role="status" className="text-sm text-success-700">
            {saveNotice}
          </p>
        )}

        <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-3">
          <Button type="button" variant="outline" onClick={() => void handleBack()} disabled={step === 1 || saving || uploading}>
            Back
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {step !== 7 && (
              <Button type="button" variant="ghost" onClick={() => void handleSaveAndExit()} disabled={saving || uploading}>
                Save and exit
              </Button>
            )}
            {(step === 4 || step === 6) && (
              <Button type="button" variant="ghost" onClick={() => void handleSkipOptional()} disabled={saving || uploading}>
                Skip for now
              </Button>
            )}
            {step < 7 && (
              <Button type="button" onClick={() => void handleContinue()} isLoading={saving} disabled={uploading || !canContinue}>
                Continue
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-foreground">Profile completion</h3>
        <p className="mt-1 text-sm text-text-secondary">{completionPreview.percentage}% complete</p>
        {completionPreview.missingRecommended.length > 0 && (
          <p className="mt-1 text-xs text-text-secondary">
            Recommended next: {completionPreview.missingRecommended.slice(0, 3).join(", ")}
          </p>
        )}
      </Card>

      {profileId && (
        <p className="text-xs text-text-secondary">
          Your progress saves to your account and resumes across devices.
        </p>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}
