"use client";

import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";
import { TextButton } from "@/components/ui";

export interface RefinePopoverProps {
  sectionTitle: string;
  instruction: string;
  onInstructionChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  isRefining: boolean;
  error: string;
}

export default function RefinePopover({
  sectionTitle,
  instruction,
  onInstructionChange,
  onSubmit,
  onClose,
  isRefining,
  error,
}: RefinePopoverProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  return (
    <div
      role="dialog"
      aria-label={`Refine ${sectionTitle}`}
      className="mt-2 rounded-lg border border-primary-200 bg-primary-50 p-3 space-y-2 shadow-sm"
      onKeyDown={handleKeyDown}
    >
      <label
        htmlFor={`refine-instruction-${sectionTitle}`}
        className="block text-xs font-medium text-foreground"
      >
        How should this be changed?
      </label>
      <textarea
        id={`refine-instruction-${sectionTitle}`}
        ref={inputRef}
        value={instruction}
        onChange={(e) => onInstructionChange(e.target.value.slice(0, 300))}
        disabled={isRefining}
        maxLength={300}
        rows={2}
        placeholder="e.g. Make it more concise, add a hands-on activity…"
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 resize-none"
        aria-describedby={error ? `refine-error-${sectionTitle}` : undefined}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{instruction.length} / 300</p>
        <div className="flex items-center gap-1.5">
          <TextButton
            type="button"
            onClick={onClose}
            disabled={isRefining}
            aria-label="Close refine popover"
            className="rounded p-1 text-muted hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </TextButton>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onSubmit}
            isLoading={isRefining}
            disabled={!instruction.trim() || isRefining}
          >
            Refine
          </Button>
        </div>
      </div>
      {error && (
        <p
          id={`refine-error-${sectionTitle}`}
          role="alert"
          className="text-xs text-error-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
