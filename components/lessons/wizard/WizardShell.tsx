"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { WIZARD_STEPS, type WizardLessonState, type WizardStepKey, emptyWizardState, validateStep, type ValidationError } from "./LessonWizardState";
import { createLesson, getLesson, updateLesson, type LessonInput } from "@/lib/firestore/lessons";
import ReviewPage from "./ReviewPage";
import { useAIRefine, type AIRefineState, REFINE_LABEL_MAP } from "./useAIRefine";
import RefinePopover from "./RefinePopover";
import BasicInfoStep from "./steps/BasicInfoStep";
import ObjectivesStep from "./steps/ObjectivesStep";
import MaterialsStep from "./steps/MaterialsStep";
import LessonStepsStep from "./steps/LessonStepsStep";
import CFUStep from "./steps/CFUStep";
import AssessmentsStep from "./steps/AssessmentsStep";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardShellProps {
  user: User | null;
  initialDraftId?: string | null;
  onExit: () => void;
  /** Pre-populated lesson state (AI creation path) */
  initialState?: WizardLessonState;
  /** Steps to pre-mark as completed (AI creation path: steps 1–6) */
  initialCompletedSteps?: Set<number>;
  /** Which step to start on (AI creation path: step 7) */
  startAtStep?: number;
  /** Whether AI features are available in this environment */
  isAvailable?: boolean;
}

type StepState = "locked" | "active" | "completed";

function getStepState(
  stepId: number,
  activeStep: number,
  completedSteps: Set<number>
): StepState {
  if (completedSteps.has(stepId)) return "completed";
  if (stepId === activeStep) return "active";
  return "locked";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WizardShell({
  user,
  initialDraftId,
  onExit,
  initialState,
  initialCompletedSteps,
  startAtStep,
  isAvailable = false,
}: WizardShellProps) {
  const [lesson, setLesson] = useState<WizardLessonState>(
    () => initialState ?? emptyWizardState()
  );
  const [activeStep, setActiveStep] = useState(startAtStep ?? 1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    () => initialCompletedSteps ?? new Set()
  );
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftLoaded, setDraftLoaded] = useState(false);

  const router = useRouter();

  // Persists draft ID across renders without triggering re-renders
  const draftIdRef = useRef<string | null>(initialDraftId ?? null);

  // Refs for each section card (7 steps)
  const sectionRefs = useRef<Array<HTMLDivElement | null>>(Array(7).fill(null));
  // Refs for each section heading (for focus management)
  const headingRefs = useRef<Array<HTMLHeadingElement | null>>(Array(7).fill(null));
  // Ref for observer to avoid stale closure
  const activeStepRef = useRef(activeStep);
  activeStepRef.current = activeStep;

  // Ref to suppress IntersectionObserver updates during programmatic scrolls
  const isProgrammaticScrollRef = useRef(false);

  // Ref so the IntersectionObserver callback can read completedSteps without stale closure
  const completedStepsRef = useRef<Set<number>>(new Set());
  completedStepsRef.current = completedSteps;

  const setSectionRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      sectionRefs.current[index] = el;
    },
    []
  );

  const setHeadingRef = useCallback(
    (index: number) => (el: HTMLHeadingElement | null) => {
      headingRefs.current[index] = el;
    },
    []
  );

  const onChange = useCallback((patch: Partial<WizardLessonState>) => {
    setLesson((prev) => ({ ...prev, ...patch }));
  }, []);

  // AI refine/elaborate/undo state shared across all steps
  const ai = useAIRefine(lesson, onChange, user, isAvailable);

  // ── Intersection Observer for scroll sync ──────────────────────────────────

  useEffect(() => {
    const refs = sectionRefs.current;
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.25)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length === 0) return;
        // Ignore observer updates triggered by programmatic scrolls
        if (isProgrammaticScrollRef.current) return;

        const topEntry = visible[0];
        const idx = refs.findIndex((r) => r === topEntry.target);
        if (idx !== -1) {
          const stepId = idx + 1;
          // Only update activeStep if the step is already completed or currently active.
          // This prevents jumping to locked sections (e.g., skipping Assessments to Review).
          const cs = completedStepsRef.current;
          if (cs.has(stepId) || stepId === activeStepRef.current) {
            setActiveStep(stepId);
          }
        }
      },
      { threshold: [0.25, 0.5], rootMargin: "-96px 0px 0px 0px" }
    );

    refs.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goToStep(stepId: number, focusHeading = false) {
    setActiveStep(stepId);
    const idx = stepId - 1;
    // Suppress observer for the duration of the scroll animation (~600ms)
    isProgrammaticScrollRef.current = true;
    sectionRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => { isProgrammaticScrollRef.current = false; }, 650);
    if (focusHeading) {
      // Delay focus until after scroll
      setTimeout(() => {
        headingRefs.current[idx]?.focus();
      }, 350);
    }
  }

  function handleNext() {
    const next = activeStep + 1;
    if (next > 7) return;

    const currentKey = WIZARD_STEPS[activeStep - 1].key;
    const errors = validateStep(currentKey, lesson);

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setCompletedSteps((prev) => {
      const updated = new Set([...prev, activeStep]);
      // Mark Review as reachable permanently once the user navigates to it
      if (next === 7) updated.add(7);
      return updated;
    });
    goToStep(next, true);

    // Fire-and-forget save; errors are surfaced via saveState indicator
    void saveDraft(lesson);
  }

  async function saveDraft(currentLesson: WizardLessonState) {
    if (!user) return;

    setSaveState("saving");

    const lessonInput: LessonInput = {
      title: currentLesson.title,
      authorId: user.uid,
      authorName: user.displayName ?? "Anonymous",
      authorPhotoURL: user.photoURL,
      gradeLevel: currentLesson.gradeLevel,
      subject: currentLesson.subject,
      duration: currentLesson.duration,
      objectives: currentLesson.objectives.filter((o) => o.trim() !== ""),
      materials: currentLesson.materials.filter((m) => m.trim() !== ""),
      steps: currentLesson.steps.filter((s) => s.title.trim() !== ""),
      checkForUnderstanding: currentLesson.checkForUnderstanding.filter((c) => c.trim() !== ""),
      assessments: currentLesson.assessments.filter((a) => a.trim() !== ""),
      attachments: [],
      isPublic: false,
    };

    try {
      if (draftIdRef.current === null) {
        const newId = await createLesson(lessonInput);
        draftIdRef.current = newId;
      } else {
        await updateLesson(draftIdRef.current, lessonInput);
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }

  function handleBack() {
    const prev = activeStep - 1;
    if (prev < 1) return;
    goToStep(prev, true);
  }

  async function handlePublish() {
    if (!user) return;

    setSaveState("saving");

    const lessonInput: LessonInput = {
      title: lesson.title,
      authorId: user.uid,
      authorName: user.displayName ?? "Anonymous",
      authorPhotoURL: user.photoURL,
      gradeLevel: lesson.gradeLevel,
      subject: lesson.subject,
      duration: lesson.duration,
      objectives: lesson.objectives.filter((o) => o.trim() !== ""),
      materials: lesson.materials.filter((m) => m.trim() !== ""),
      steps: lesson.steps.filter((s) => s.title.trim() !== ""),
      checkForUnderstanding: lesson.checkForUnderstanding.filter((c) => c.trim() !== ""),
      assessments: lesson.assessments.filter((a) => a.trim() !== ""),
      attachments: [],
      isPublic: true,
    };

    try {
      if (draftIdRef.current === null) {
        const newId = await createLesson(lessonInput);
        draftIdRef.current = newId;
        router.push(`/lesson-builder/${newId}`);
      } else {
        await updateLesson(draftIdRef.current, lessonInput);
        router.push(`/lesson-builder/${draftIdRef.current}`);
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function handleStepperClick(stepId: number) {
    if (completedSteps.has(stepId)) {
      goToStep(stepId);
    }
    // Locked steps: do nothing
  }

  // ── Draft restore on mount ─────────────────────────────────────────────────

  useEffect(() => {
    // When the wizard is pre-populated from the AI path, skip the draft restore
    // (the state is already correct; loading from Firestore would be redundant).
    if (initialState) return;
    if (!initialDraftId) return;

    async function loadDraft() {
      try {
        const draft = await getLesson(initialDraftId!);
        if (!draft) return;

        setLesson({
          title: draft.title,
          gradeLevel: draft.gradeLevel,
          subject: draft.subject,
          duration: draft.duration,
          objectives: draft.objectives.length > 0 ? draft.objectives : [""],
          materials: draft.materials.length > 0 ? draft.materials : [""],
          steps: draft.steps.length > 0 ? draft.steps : [{ title: "", description: "" }],
          checkForUnderstanding:
            draft.checkForUnderstanding.length > 0 ? draft.checkForUnderstanding : [""],
          assessments: draft.assessments.length > 0 ? draft.assessments : [""],
        });

        const completed = new Set<number>();
        if (draft.title.trim()) completed.add(1); // basicInfo
        if (draft.objectives.some((o) => o.trim())) completed.add(2); // objectives
        if (draft.steps.some((s) => s.title.trim())) completed.add(4); // lessonSteps
        // Note: materials (3), CFU (5), assessments (6) are optional sections.
        // Only mark them complete if the user explicitly clicked Next past them
        // (which we can't know from the draft data alone), so leave them unset.

        setCompletedSteps(completed);

        // Resume at the first sequential step not yet completed
        let resumeStep = 1;
        for (let s = 1; s <= 7; s++) {
          if (!completed.has(s)) { resumeStep = s; break; }
        }
        setActiveStep(resumeStep);

        setDraftLoaded(true);
        setTimeout(() => setDraftLoaded(false), 3000);
      } catch {
        // Non-critical - silent failure; wizard continues with empty state
      }
    }

    loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step state helpers ─────────────────────────────────────────────────────

  const stepStates = useMemo(
    () =>
      WIZARD_STEPS.map((s) => ({
        ...s,
        state: getStepState(s.id, activeStep, completedSteps),
      })),
    [activeStep, completedSteps]
  );

  // ── Progress bar values ────────────────────────────────────────────────────

  const progressPercent = Math.round(
    ((completedSteps.size + (activeStep <= 7 ? 0 : 1)) / 7) * 100
  );
  const currentStepLabel =
    WIZARD_STEPS.find((s) => s.id === activeStep)?.label ?? "";

  // ── Shared step props ──────────────────────────────────────────────────────

  function stepProps(key: WizardStepKey) {
    const stepId = WIZARD_STEPS.find((s) => s.key === key)?.id;
    return {
      state: lesson,
      onChange,
      isActive: stepId === activeStep,
      errors: stepId === activeStep ? validationErrors : [],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 pb-6 max-w-6xl mx-auto">
      {/* Mobile: compact top bar */}
      <div className="md:hidden mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-foreground">
            Step {activeStep} of 7: {currentStepLabel}
          </span>
          <button
            type="button"
            onClick={onExit}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            ← Back
          </button>
        </div>
        <div
          role="progressbar"
          aria-valuenow={activeStep}
          aria-valuemin={1}
          aria-valuemax={7}
          aria-label={`Lesson builder progress: step ${activeStep} of 7`}
          className="h-2 w-full rounded-full bg-border overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-primary-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {/* Mobile save indicator */}
        <div aria-live="polite" className="mt-1.5 min-h-4">
          <SaveIndicator state={saveState} />
        </div>
      </div>

      <div className="flex items-start gap-6">
        {/* Desktop: sticky stepper */}
        <nav
          aria-label="Lesson builder steps"
          className="hidden md:flex flex-col gap-1 w-56 shrink-0 sticky top-22 self-start"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Progress
            </span>
            <button
              type="button"
              onClick={onExit}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              ← Exit
            </button>
          </div>

          {stepStates.map((s) => {
            const isCompleted = s.state === "completed";
            const isActive = s.state === "active";
            const isLocked = s.state === "locked";

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStepperClick(s.id)}
                disabled={isLocked}
                aria-current={isActive ? "step" : undefined}
                aria-disabled={isLocked ? "true" : undefined}
                aria-label={
                  isCompleted
                    ? `Step ${s.id}: ${s.label}, completed`
                    : `Step ${s.id}: ${s.label}${isActive ? ", current" : ""}`
                }
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors w-full",
                  isCompleted
                    ? "hover:bg-surface-hover cursor-pointer text-foreground"
                    : isActive
                    ? "bg-primary-50 text-primary-900 cursor-default"
                    : "cursor-default text-muted opacity-60",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/* Step icon */}
                <span
                  aria-hidden="true"
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isActive
                      ? "bg-primary-900 text-white"
                      : "bg-border text-muted",
                  ].join(" ")}
                >
                  {isCompleted ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                  ) : (
                    s.id
                  )}
                </span>
                <span className="leading-snug">{s.label}</span>
              </button>
            );
          })}

          {/* Desktop save indicator */}
          <div aria-live="polite" className="mt-3 min-h-4 px-1">
            <SaveIndicator state={saveState} />
          </div>
        </nav>

        {/* Scrollable content area */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Draft loaded notice */}
          {draftLoaded && (
            <p
              role="status"
              className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
            >
              Draft loaded. Welcome back!
            </p>
          )}
          {/* Step 1: Basic Info */}
          <SectionCard
            stepId={1}
            activeStep={activeStep}
            completedSteps={completedSteps}
            sectionRef={setSectionRef(0)}
            headingRef={setHeadingRef(0)}
            onNext={handleNext}
            onBack={handleBack}
          >
            <BasicInfoStep {...stepProps("basicInfo")} />
          </SectionCard>

          {/* Step 2: Objectives */}
          <SectionCard
            stepId={2}
            activeStep={activeStep}
            completedSteps={completedSteps}
            sectionRef={setSectionRef(1)}
            headingRef={setHeadingRef(1)}
            onNext={handleNext}
            onBack={handleBack}
          >
            <ObjectivesStep {...stepProps("objectives")} />
            {isAvailable && <StepAIBar sectionKey="objectives" label={REFINE_LABEL_MAP.objectives} ai={ai} />}
          </SectionCard>

          {/* Step 3: Materials */}
          <SectionCard
            stepId={3}
            activeStep={activeStep}
            completedSteps={completedSteps}
            sectionRef={setSectionRef(2)}
            headingRef={setHeadingRef(2)}
            onNext={handleNext}
            onBack={handleBack}
          >
            <MaterialsStep {...stepProps("materials")} />
            {isAvailable && <StepAIBar sectionKey="materials" label={REFINE_LABEL_MAP.materials} ai={ai} />}
          </SectionCard>

          {/* Step 4: Lesson Steps */}
          <SectionCard
            stepId={4}
            activeStep={activeStep}
            completedSteps={completedSteps}
            sectionRef={setSectionRef(3)}
            headingRef={setHeadingRef(3)}
            onNext={handleNext}
            onBack={handleBack}
          >
            <LessonStepsStep {...stepProps("lessonSteps")} />
            {isAvailable && <StepAIBar sectionKey="lessonSteps" label={REFINE_LABEL_MAP.lessonSteps} ai={ai} />}
          </SectionCard>

          {/* Step 5: CFU */}
          <SectionCard
            stepId={5}
            activeStep={activeStep}
            completedSteps={completedSteps}
            sectionRef={setSectionRef(4)}
            headingRef={setHeadingRef(4)}
            onNext={handleNext}
            onBack={handleBack}
          >
            <CFUStep {...stepProps("cfu")} />
            {isAvailable && <StepAIBar sectionKey="cfu" label={REFINE_LABEL_MAP.cfu} ai={ai} />}
          </SectionCard>

          {/* Step 6: Assessments */}
          <SectionCard
            stepId={6}
            activeStep={activeStep}
            completedSteps={completedSteps}
            sectionRef={setSectionRef(5)}
            headingRef={setHeadingRef(5)}
            onNext={handleNext}
            onBack={handleBack}
          >
            <AssessmentsStep {...stepProps("assessments")} />
            {isAvailable && <StepAIBar sectionKey="assessments" label={REFINE_LABEL_MAP.assessments} ai={ai} />}
          </SectionCard>

          {/* Step 7: Review & Publish */}
          <SectionCard
            stepId={7}
            activeStep={activeStep}
            completedSteps={completedSteps}
            sectionRef={setSectionRef(6)}
            headingRef={setHeadingRef(6)}
            onNext={handleNext}
            onBack={handleBack}
            isLast
          >
            <ReviewPage
              lesson={lesson}
              onChange={(patch) => setLesson((prev) => ({ ...prev, ...patch }))}
              onSaveDraft={() => saveDraft(lesson)}
              onPublish={handlePublish}
              isSaving={saveState === "saving"}
              saveState={saveState}
              onBackToEdit={handleBack}
              user={user}
              isAvailable={isAvailable}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ─── Step AI Bar ──────────────────────────────────────────────────────────────

interface StepAIBarProps {
  sectionKey: "objectives" | "materials" | "lessonSteps" | "cfu" | "assessments";
  label: string;
  ai: AIRefineState;
}

function StepAIBar({ sectionKey, label, ai }: StepAIBarProps) {
  const {
    showRefineButton,
    refiningSection,
    setRefiningSection,
    expandingSection,
    aiActionMap,
    undoMap,
    refineInstruction,
    setRefineInstruction,
    refineError,
    setRefineError,
    isRefining,
    handleRefineRequest,
    handleRefineSubmit,
    handleExpandRequest,
    handleUndo,
  } = ai;

  if (!showRefineButton) return null;

  const isRefiningThis = refiningSection === sectionKey;
  const isExpandingThis = expandingSection === sectionKey;
  const isAnyBusy = isRefining || expandingSection !== null;
  const hasUndo = undoMap.has(sectionKey);
  const aiAction = aiActionMap.get(sectionKey);

  return (
    <div className="mt-5 pt-4 border-t border-border space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted mr-auto">AI tools</span>

        {aiAction && (
          <span role="status" className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            aiAction === "refined" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700",
          ].join(" ")}>
            {aiAction === "refined" ? "Refined ✓" : "Elaborated ✓"}
          </span>
        )}

        {/* Undo */}
        {hasUndo && (
          <button
            type="button"
            onClick={() => handleUndo(sectionKey)}
            disabled={isAnyBusy}
            aria-label={`Undo last AI change to ${label}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
            Undo
          </button>
        )}

        {/* Elaborate */}
        <button
          type="button"
          onClick={() => handleExpandRequest(sectionKey)}
          disabled={isAnyBusy}
          aria-label={`Elaborate ${label} with AI`}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer disabled:opacity-50"
        >
          {isExpandingThis ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
          {isExpandingThis ? "Elaborating…" : "Elaborate"}
        </button>

        {/* Refine */}
        <button
          type="button"
          onClick={() => handleRefineRequest(sectionKey)}
          disabled={isAnyBusy && !isRefiningThis}
          aria-label={`Refine ${label} with AI`}
          aria-pressed={isRefiningThis}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 hover:text-primary-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer disabled:opacity-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
          </svg>
          {isRefiningThis ? "Refine ▾" : "Refine"}
        </button>
      </div>

      {/* Inline Refine popover */}
      {isRefiningThis && (
        <RefinePopover
          sectionTitle={label}
          instruction={refineInstruction}
          onInstructionChange={setRefineInstruction}
          onSubmit={handleRefineSubmit}
          onClose={() => {
            setRefiningSection(null);
            setRefineInstruction("");
            setRefineError("");
          }}
          isRefining={isRefining}
          error={refineError}
        />
      )}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  stepId: number;
  activeStep: number;
  completedSteps: Set<number>;
  sectionRef: (el: HTMLDivElement | null) => void;
  headingRef: (el: HTMLHeadingElement | null) => void;
  onNext: () => void;
  onBack: () => void;
  isLast?: boolean;
  children: React.ReactNode;
}

function SectionCard({
  stepId,
  activeStep,
  completedSteps,
  sectionRef,
  headingRef,
  onNext,
  onBack,
  isLast = false,
  children,
}: SectionCardProps) {
  const stepInfo = WIZARD_STEPS[stepId - 1];
  const state = getStepState(stepId, activeStep, completedSteps);
  const isActive = state === "active";
  const isLocked = state === "locked";

  const headingId = `wizard-step-${stepId}-heading`;

  return (
    <div
      ref={sectionRef}
      role="region"
      aria-labelledby={headingId}
      inert={isLocked || undefined}
      className={[
        "rounded-xl border bg-surface transition-all duration-200 scroll-mt-28",
        isActive
          ? "ring-2 ring-primary-500 border-primary-300 shadow-sm"
          : isLocked
          ? "border-border opacity-60 pointer-events-none"
          : "border-border",
      ].join(" ")}
    >
      {/* Card header */}
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={[
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              state === "completed"
                ? "bg-green-500 text-white"
                : isActive
                ? "bg-primary-900 text-white"
                : "bg-border text-muted",
            ].join(" ")}
          >
            {state === "completed" ? (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            ) : (
              stepId
            )}
          </span>
          <h2
            ref={headingRef}
            id={headingId}
            tabIndex={-1}
            className="text-base font-semibold text-foreground focus:outline-none"
          >
            {stepInfo.label}
          </h2>
        </div>
      </div>

      {/* Card body */}
      <div className="px-6 py-5">{children}</div>

      {/* Card footer: navigation */}
      {!isLast && (
        <div className="px-6 pb-5 flex items-center justify-between">
          {stepId > 1 ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 cursor-pointer"
          >
            Next
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m8.25 4.5 7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Review card: only Back */}
      {isLast && (
        <div className="px-6 pb-5 flex items-center">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
            Back
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Save Indicator ───────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;

  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {/* Inline 12px spinner */}
        <svg
          className="h-3 w-3 animate-spin text-muted"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        Saving…
      </span>
    );
  }

  if (state === "saved") {
    return (
      <span className="text-xs font-medium text-green-600">
        Saved <span aria-hidden="true">✓</span>
      </span>
    );
  }

  // error state
  return (
    <span role="alert" className="text-xs text-accent-700">
      Draft could not be saved - your changes are still here
    </span>
  );
}
