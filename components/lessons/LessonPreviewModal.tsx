"use client";

import { useEffect, useRef } from "react";
import type { Lesson } from "@/lib/firestore/lessons";
import Button from "@/components/ui/Button";

interface LessonPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: Lesson;
  authorName: string;
  onDownload: () => void;
}

export default function LessonPreviewModal({
  isOpen,
  onClose,
  lesson,
  authorName,
  onDownload,
}: LessonPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement;

    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled"));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const year = new Date().getFullYear();

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Lesson Plan Preview"
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-secondary-950"
    >
      {/* Sticky header bar — hidden on print */}
      <div className="lesson-preview-header flex items-center justify-between gap-3 border-b border-secondary-200 bg-white dark:bg-secondary-900 px-4 py-3 shrink-0 print:hidden">
        <h2 className="text-base font-semibold text-foreground truncate">
          Preview: {lesson.title}
        </h2>
        <div className="lesson-preview-actions flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onDownload}>
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
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Download PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
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
                d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-6 0h.008v.008H12V10.5Zm-6 0h.008v.008H6V10.5Z"
              />
            </svg>
            Print
          </Button>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="lesson-preview-close ml-1 rounded-md p-1.5 text-secondary-500 hover:bg-secondary-100 hover:text-foreground transition-colors focus-ring cursor-pointer print:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto bg-secondary-50 dark:bg-secondary-950 px-4 py-8">
        <div className="lesson-preview-content mx-auto max-w-3xl bg-white dark:bg-secondary-900 rounded-xl border border-secondary-200 p-8 space-y-6">

          {/* Lesson header */}
          <div className="border-b border-secondary-200 pb-4">
            <div className="flex flex-wrap gap-2 mb-2">
              {lesson.gradeLevel && (
                <span className="inline-flex items-center rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-medium text-secondary-700">
                  {lesson.gradeLevel}
                </span>
              )}
              {lesson.subject && (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {lesson.subject}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground">{lesson.title}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary-500">
              <span><strong className="text-secondary-700">Author:</strong> {authorName}</span>
              {lesson.duration && (
                <span><strong className="text-secondary-700">Duration:</strong> {lesson.duration}</span>
              )}
            </div>
          </div>

          {/* Learning Objectives */}
          {lesson.objectives.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">Learning Objectives</h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-secondary-700">
                {lesson.objectives.map((obj, i) => (
                  <li key={i}>{obj}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Materials Needed */}
          {lesson.materials.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">Materials Needed</h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-secondary-700">
                {lesson.materials.map((mat, i) => (
                  <li key={i}>{mat}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Lesson Plan Steps */}
          {lesson.steps.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-foreground mb-3">Lesson Plan</h2>
              <div className="space-y-4">
                {lesson.steps.map((step, i) => (
                  <div key={i} className="border-l-2 border-secondary-300 pl-4">
                    <p className="text-sm font-semibold text-foreground">
                      Step {i + 1}{step.title ? `: ${step.title}` : ""}
                      {step.duration && (
                        <span className="ml-2 font-normal text-secondary-500">({step.duration})</span>
                      )}
                    </p>
                    {step.description && (
                      <p className="mt-1 text-sm text-secondary-600 whitespace-pre-wrap">{step.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Check for Understanding */}
          {lesson.checkForUnderstanding.filter(Boolean).length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">Check for Understanding</h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-secondary-700">
                {lesson.checkForUnderstanding.filter(Boolean).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Assessment */}
          {lesson.assessments.filter(Boolean).length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">Assessment</h2>
              <ul className="list-disc list-inside space-y-1 text-sm text-secondary-700">
                {lesson.assessments.filter(Boolean).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Copyright footer */}
          <div className="border-t border-secondary-200 pt-4 text-center text-xs text-secondary-400">
            © {year} {authorName} — All rights reserved. Created on EduConnect.
          </div>
        </div>
      </div>
    </div>
  );
}
