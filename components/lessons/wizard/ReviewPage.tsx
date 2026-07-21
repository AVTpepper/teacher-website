"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { User } from "firebase/auth";
import type { WizardLessonState } from "./LessonWizardState";
import { useAIRefine, type SectionKey, SECTION_FIELD_MAP, REFINE_LABEL_MAP } from "./useAIRefine";
import RefinePopover from "./RefinePopover";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import BasicInfoStep from "./steps/BasicInfoStep";
import ObjectivesStep from "./steps/ObjectivesStep";
import MaterialsStep from "./steps/MaterialsStep";
import LessonStepsStep from "./steps/LessonStepsStep";
import CFUStep from "./steps/CFUStep";
import AssessmentsStep from "./steps/AssessmentsStep";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewPageProps = {
  lesson: WizardLessonState;
  onChange: (patch: Partial<WizardLessonState>) => void;
  onSaveDraft: () => Promise<void>;
  onPublish: () => Promise<void>;
  isSaving: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  onBackToEdit: () => void;
  user: User | null;
  isAvailable?: boolean;
};

type ValidationError = { field: string; message: string };

// ─── Pencil icon ──────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
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
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
      />
    </svg>
  );
}

// ─── Sparkles icon ────────────────────────────────────────────────────────────

function SparklesIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

interface ReviewSectionProps {
  id: string;
  title: string;
  sectionKey: SectionKey;
  editingSection: SectionKey | null;
  onEditRequest: (key: SectionKey) => void;
  // Refine
  refiningSection: SectionKey | null;
  onRefineRequest: (key: SectionKey) => void;
  showRefineButton: boolean;
  aiActionMap: Map<SectionKey, "refined" | "elaborated">;
  // Expand
  expandingSection: SectionKey | null;
  onExpandRequest: (key: SectionKey) => void;
  // Undo
  undoMap: Map<SectionKey, unknown>;
  onUndo: (key: SectionKey) => void;
  children: React.ReactNode;
}

function ReviewSection({
  id,
  title,
  sectionKey,
  editingSection,
  onEditRequest,
  refiningSection,
  onRefineRequest,
  showRefineButton,
  aiActionMap,
  expandingSection,
  onExpandRequest,
  undoMap,
  onUndo,
  children,
}: ReviewSectionProps) {
  const isEditing = editingSection === sectionKey;
  const isRefining = refiningSection === sectionKey;
  const isExpanding = expandingSection === sectionKey;
  const refineBusy = isRefining || isExpanding || (expandingSection !== null && expandingSection !== sectionKey);
  const aiAction = aiActionMap.get(sectionKey);
  const isRefinable = SECTION_FIELD_MAP[sectionKey] !== null;
  const hasUndo = undoMap.has(sectionKey);

  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-border bg-surface overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <h3 id={id} className="text-sm font-semibold text-foreground">
            {title}
          </h3>
          {aiAction && (
            <span role="status" className={[
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              aiAction === "refined" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700",
            ].join(" ")}>
              {aiAction === "refined" ? "Refined ✓" : "Elaborated ✓"}
            </span>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-1">
            {/* Undo last AI change */}
            {hasUndo && (
              <button
                type="button"
                onClick={() => onUndo(sectionKey)}
                disabled={refineBusy}
                aria-label={`Undo last AI change to ${title}`}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                </svg>
                Undo
              </button>
            )}
            {showRefineButton && isRefinable && (
              <>
                <button
                  type="button"
                  onClick={() => onExpandRequest(sectionKey)}
                  disabled={refineBusy}
                  aria-label={`Elaborate ${title} with AI`}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer disabled:opacity-50"
                >
                  {isExpanding ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  )}
                  {isExpanding ? "Elaborating…" : "Elaborate"}
                </button>
                <button
                  type="button"
                  onClick={() => onRefineRequest(sectionKey)}
                  disabled={refineBusy}
                  aria-label={`Refine ${title} with AI`}
                  aria-pressed={isRefining}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 hover:text-primary-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer disabled:opacity-50"
                >
                  <SparklesIcon />
                  Refine
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onEditRequest(sectionKey)}
              aria-label={`Edit ${title}`}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer"
            >
              <PencilIcon />
              Edit
            </button>
          </div>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

// ─── Read-only displays ───────────────────────────────────────────────────────

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-800">
      {label}
    </span>
  );
}

function BulletList({ items, emptyText }: { items: string[]; emptyText: string }) {
  const filled = items.filter((i) => i.trim() !== "");
  if (filled.length === 0) {
    return <p className="text-sm text-muted italic">{emptyText}</p>;
  }
  return (
    <ul className="space-y-1.5 list-disc list-inside">
      {filled.map((item, i) => (
        <li key={i} className="text-sm text-foreground">
          {item}
        </li>
      ))}
    </ul>
  );
}

// ─── Inline edit wrapper ──────────────────────────────────────────────────────

interface InlineEditProps {
  sectionKey: SectionKey;
  sectionTitle: string;
  editingSection: SectionKey | null;
  editSnapshot: WizardLessonState | null;
  currentLesson: WizardLessonState;
  onChange: (patch: Partial<WizardLessonState>) => void;
  onSave: (key: SectionKey) => void;
  onCancel: (key: SectionKey) => void;
  children: React.ReactNode;
}

function InlineEditWrapper({
  sectionKey,
  sectionTitle,
  editingSection,
  editSnapshot,
  currentLesson,
  onChange,
  onSave,
  onCancel,
  children,
}: InlineEditProps) {
  const isEditing = editingSection === sectionKey;
  void editSnapshot;
  void currentLesson;
  void onChange;

  if (!isEditing) return <>{children}</>;

  return (
    <div className="space-y-4">
      {children}
      <div className="flex items-center gap-2 pt-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => onSave(sectionKey)}
          aria-label={`Save ${sectionTitle} changes`}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCancel(sectionKey)}
          aria-label={`Cancel ${sectionTitle} editing`}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Main ReviewPage ──────────────────────────────────────────────────────────

export default function ReviewPage({
  lesson,
  onChange,
  onSaveDraft,
  onPublish,
  isSaving,
  saveState,
  onBackToEdit,
  user,
  isAvailable = false,
}: ReviewPageProps) {
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  // Snapshot of lesson state taken when Edit is clicked - used for Cancel
  const [editSnapshot, setEditSnapshot] = useState<WizardLessonState | null>(null);
  // Local edit state while a section is open
  const [editDraft, setEditDraft] = useState<WizardLessonState | null>(null);

  const [unsavedWarningOpen, setUnsavedWarningOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  // All AI refine/elaborate/undo state lives in the shared hook
  const {
    refiningSection,
    setRefiningSection,
    expandingSection,
    aiActionMap,
    clearUndoForSection,
    undoMap,
    refineInstruction,
    setRefineInstruction,
    refineError,
    setRefineError,
    isRefining,
    remainingRefines,
    showRefineButton,
    handleRefineRequest,
    handleRefineSubmit,
    handleExpandRequest,
    handleUndo,
  } = useAIRefine(lesson, onChange, user, isAvailable);

  // Ref for the first validation error - focus management
  const firstErrorRef = useRef<HTMLLIElement>(null);

  // Focus first validation error when list appears
  useEffect(() => {
    if (validationErrors.length > 0) {
      firstErrorRef.current?.focus();
    }
  }, [validationErrors]);

  // ── Editing helpers ──────────────────────────────────────────────────────────

  function handleEditRequest(key: SectionKey) {
    if (editingSection !== null) {
      // One section is already open
      setUnsavedWarningOpen(true);
      return;
    }
    setEditSnapshot({ ...lesson });
    setEditDraft({ ...lesson });
    setEditingSection(key);
  }

  const handleEditChange = useCallback((patch: Partial<WizardLessonState>) => {
    setEditDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  function handleSave(key: SectionKey) {
    if (!editDraft) return;
    onChange(editDraft);
    // Clear undo since the user manually replaced the AI content
    clearUndoForSection(key);
    setEditingSection(null);
    setEditSnapshot(null);
    setEditDraft(null);
  }

  function handleCancel(key: SectionKey) {
    void key;
    if (editSnapshot) {
      onChange(editSnapshot);
    }
    setEditingSection(null);
    setEditSnapshot(null);
    setEditDraft(null);
  }

  // ── Publish validation ───────────────────────────────────────────────────────

  function validate(): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!lesson.title.trim()) {
      errors.push({ field: "title", message: "Lesson title is required" });
    }
    if (!lesson.gradeLevel.trim()) {
      errors.push({ field: "gradeLevel", message: "Grade level is required" });
    }
    if (!lesson.subject.trim()) {
      errors.push({ field: "subject", message: "Subject is required" });
    }
    if (!lesson.objectives.some((o) => o.trim() !== "")) {
      errors.push({ field: "objectives", message: "At least one learning objective is required" });
    }
    if (!lesson.steps.some((s) => s.title.trim() !== "")) {
      errors.push({ field: "steps", message: "At least one lesson step with a title is required" });
    }
    return errors;
  }

  async function handlePublish() {
    const errors = validate();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  }

  // ── Section IDs ──────────────────────────────────────────────────────────────

  const sectionIds = {
    basicInfo: "review-section-basic-info",
    objectives: "review-section-objectives",
    materials: "review-section-materials",
    lessonSteps: "review-section-steps",
    cfu: "review-section-cfu",
    assessments: "review-section-assessments",
  };

  // The lesson to display in forms (edit draft while editing; live lesson otherwise)
  const displayLesson = editDraft ?? lesson;

  // Helper to render the refine popover for a given section
  function renderRefinePopover(key: SectionKey) {
    if (refiningSection !== key) return null;
    return (
      <div className="px-5 pb-4">
        <RefinePopover
          sectionTitle={REFINE_LABEL_MAP[key]}
          instruction={refineInstruction}
          onInstructionChange={setRefineInstruction}
          onSubmit={handleRefineSubmit}
          onClose={() => { setRefiningSection(null); setRefineInstruction(""); setRefineError(""); }}
          isRefining={isRefining}
          error={refineError}
        />
      </div>
    );
  }

  // Shared ReviewSection props for refine + expand + undo
  const refineProps = {
    refiningSection,
    onRefineRequest: handleRefineRequest,
    showRefineButton,
    aiActionMap,
    expandingSection,
    onExpandRequest: handleExpandRequest,
    undoMap,
    onUndo: handleUndo,
  };

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <ConfirmDialog
        isOpen={unsavedWarningOpen}
        onClose={() => setUnsavedWarningOpen(false)}
        onConfirm={() => setUnsavedWarningOpen(false)}
        title="Unsaved Changes"
        description="Please save or cancel the current section before editing another."
        confirmLabel="OK"
        cancelLabel="Dismiss"
        isDestructive={false}
      />
      {/* Back to Edit link */}
      <button
        type="button"
        onClick={onBackToEdit}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded cursor-pointer"
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
        Back to edit
      </button>

      {/* Remaining refines banner (free tier) */}
      {isAvailable && remainingRefines !== null && (
        <p className="text-xs text-muted text-right" aria-live="polite">
          {remainingRefines > 0
            ? `${remainingRefines} / 20 AI refines remaining this month`
            : "Monthly refine limit reached - upgrade to Plus for unlimited refines"}
        </p>
      )}

      {/* ── Section 1: Basic Info ─────────────────────────────────────────────── */}
      <ReviewSection
        id={sectionIds.basicInfo}
        title="Basic Info"
        sectionKey="basicInfo"
        editingSection={editingSection}
        onEditRequest={handleEditRequest}
        {...refineProps}
      >
        <InlineEditWrapper
          sectionKey="basicInfo"
          sectionTitle="Basic Info"
          editingSection={editingSection}
          editSnapshot={editSnapshot}
          currentLesson={displayLesson}
          onChange={handleEditChange}
          onSave={handleSave}
          onCancel={handleCancel}
        >
          {editingSection === "basicInfo" ? (
            <BasicInfoStep
              state={displayLesson}
              onChange={handleEditChange}
              isActive
            />
          ) : (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">
                {lesson.title || <span className="text-muted italic">Untitled</span>}
              </h2>
              <div className="flex flex-wrap gap-2">
                {lesson.gradeLevel && <Badge label={lesson.gradeLevel} />}
                {lesson.subject && <Badge label={lesson.subject} />}
                {lesson.duration && (
                  <span className="text-sm text-muted">{lesson.duration}</span>
                )}
              </div>
            </div>
          )}
        </InlineEditWrapper>
      </ReviewSection>

      {/* ── Section 2: Learning Objectives ───────────────────────────────────── */}
      <ReviewSection
        id={sectionIds.objectives}
        title="Learning Objectives"
        sectionKey="objectives"
        editingSection={editingSection}
        onEditRequest={handleEditRequest}
        {...refineProps}
      >
        <InlineEditWrapper
          sectionKey="objectives"
          sectionTitle="Learning Objectives"
          editingSection={editingSection}
          editSnapshot={editSnapshot}
          currentLesson={displayLesson}
          onChange={handleEditChange}
          onSave={handleSave}
          onCancel={handleCancel}
        >
          {editingSection === "objectives" ? (
            <ObjectivesStep
              state={displayLesson}
              onChange={handleEditChange}
              isActive
            />
          ) : (
            <BulletList items={lesson.objectives} emptyText="No objectives added" />
          )}
        </InlineEditWrapper>
      </ReviewSection>
      {renderRefinePopover("objectives")}

      {/* ── Section 3: Materials Needed ───────────────────────────────────────── */}
      <ReviewSection
        id={sectionIds.materials}
        title="Materials Needed"
        sectionKey="materials"
        editingSection={editingSection}
        onEditRequest={handleEditRequest}
        {...refineProps}
      >
        <InlineEditWrapper
          sectionKey="materials"
          sectionTitle="Materials Needed"
          editingSection={editingSection}
          editSnapshot={editSnapshot}
          currentLesson={displayLesson}
          onChange={handleEditChange}
          onSave={handleSave}
          onCancel={handleCancel}
        >
          {editingSection === "materials" ? (
            <MaterialsStep
              state={displayLesson}
              onChange={handleEditChange}
              isActive
            />
          ) : (
            <BulletList items={lesson.materials} emptyText="No materials listed" />
          )}
        </InlineEditWrapper>
      </ReviewSection>
      {renderRefinePopover("materials")}

      {/* ── Section 4: Lesson Steps ───────────────────────────────────────────── */}
      <ReviewSection
        id={sectionIds.lessonSteps}
        title="Lesson Steps"
        sectionKey="lessonSteps"
        editingSection={editingSection}
        onEditRequest={handleEditRequest}
        {...refineProps}
      >
        <InlineEditWrapper
          sectionKey="lessonSteps"
          sectionTitle="Lesson Steps"
          editingSection={editingSection}
          editSnapshot={editSnapshot}
          currentLesson={displayLesson}
          onChange={handleEditChange}
          onSave={handleSave}
          onCancel={handleCancel}
        >
          {editingSection === "lessonSteps" ? (
            <LessonStepsStep
              state={displayLesson}
              onChange={handleEditChange}
              isActive
            />
          ) : (
            <ol className="space-y-3">
              {lesson.steps.filter((s) => s.title.trim() !== "").length === 0 ? (
                <p className="text-sm text-muted italic">No steps added</p>
              ) : (
                lesson.steps
                  .filter((s) => s.title.trim() !== "")
                  .map((step, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-border p-3 space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-800">
                          {i + 1}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {step.title}
                        </span>
                        {step.duration && (
                          <span className="ml-auto text-xs text-muted">
                            {step.duration}
                          </span>
                        )}
                      </div>
                      {step.description && (
                        <p className="text-sm text-muted pl-7">{step.description}</p>
                      )}
                    </li>
                  ))
              )}
            </ol>
          )}
        </InlineEditWrapper>
      </ReviewSection>
      {renderRefinePopover("lessonSteps")}

      {/* ── Section 5: Check for Understanding ───────────────────────────────── */}
      <ReviewSection
        id={sectionIds.cfu}
        title="Check for Understanding"
        sectionKey="cfu"
        editingSection={editingSection}
        onEditRequest={handleEditRequest}
        {...refineProps}
      >
        <InlineEditWrapper
          sectionKey="cfu"
          sectionTitle="Check for Understanding"
          editingSection={editingSection}
          editSnapshot={editSnapshot}
          currentLesson={displayLesson}
          onChange={handleEditChange}
          onSave={handleSave}
          onCancel={handleCancel}
        >
          {editingSection === "cfu" ? (
            <CFUStep
              state={displayLesson}
              onChange={handleEditChange}
              isActive
            />
          ) : (
            <BulletList
              items={lesson.checkForUnderstanding}
              emptyText="None added"
            />
          )}
        </InlineEditWrapper>
      </ReviewSection>
      {renderRefinePopover("cfu")}

      {/* ── Section 6: Suggested Assessments ──────────────────────────────────── */}
      <ReviewSection
        id={sectionIds.assessments}
        title="Suggested Assessments"
        sectionKey="assessments"
        editingSection={editingSection}
        onEditRequest={handleEditRequest}
        {...refineProps}
      >
        <InlineEditWrapper
          sectionKey="assessments"
          sectionTitle="Suggested Assessments"
          editingSection={editingSection}
          editSnapshot={editSnapshot}
          currentLesson={displayLesson}
          onChange={handleEditChange}
          onSave={handleSave}
          onCancel={handleCancel}
        >
          {editingSection === "assessments" ? (
            <AssessmentsStep
              state={displayLesson}
              onChange={handleEditChange}
              isActive
            />
          ) : (
            <BulletList items={lesson.assessments} emptyText="None added" />
          )}
        </InlineEditWrapper>
      </ReviewSection>
      {renderRefinePopover("assessments")}

      {/* ── Section 7: Attachments (read-only notice) ─────────────────────────── */}
      <section
        aria-labelledby="review-section-attachments"
        className="rounded-xl border border-border bg-surface overflow-hidden"
      >
        <div className="flex items-center px-5 py-3 border-b border-border bg-surface">
          <h3
            id="review-section-attachments"
            className="text-sm font-semibold text-foreground"
          >
            Attachments
          </h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted italic">
            Attachments can be added after publishing.
          </p>
        </div>
      </section>

      {/* ── Validation errors ─────────────────────────────────────────────────── */}
      {validationErrors.length > 0 && (
        <ul
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 space-y-1"
        >
          {validationErrors.map((error, i) => (
            <li
              key={error.field}
              ref={i === 0 ? firstErrorRef : undefined}
              tabIndex={i === 0 ? -1 : undefined}
              className="text-sm text-error-700"
            >
              <a
                href={`#${sectionIds[error.field as SectionKey] ?? ""}`}
                className="underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500 rounded"
                onClick={(e) => {
                  e.preventDefault();
                  const sectionKey = error.field as SectionKey;
                  if (sectionKey in sectionIds) {
                    handleEditRequest(sectionKey);
                  }
                }}
              >
                {error.message}
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* ── Action buttons ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={onSaveDraft}
          isLoading={saveState === "saving"}
          disabled={isSaving || isPublishing}
          aria-label="Save draft"
        >
          Save Draft
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handlePublish}
          isLoading={isPublishing}
          disabled={isSaving || isPublishing}
          aria-label="Publish lesson"
        >
          Publish
        </Button>
      </div>

      {/* Save indicator */}
      {saveState === "saved" && (
        <p role="status" className="text-xs text-green-600 text-right">
          Draft saved <span aria-hidden="true">✓</span>
        </p>
      )}
      {saveState === "error" && (
        <p role="alert" className="text-xs text-amber-600 text-right">
          Draft could not be saved - your changes are still here
        </p>
      )}
    </div>
  );
}
