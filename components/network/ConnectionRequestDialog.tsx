"use client";

import { useMemo, useState } from "react";
import { Button, Modal } from "@/components/ui";
import {
  CONNECTION_REQUEST_REASONS,
  MAX_CONNECTION_INTRO_MESSAGE_LENGTH,
} from "@/lib/network/constants";
import type { ConnectionRequestReason } from "@/lib/network/types";

const REASON_LABELS: Record<ConnectionRequestReason, string> = {
  "similar-subjects": "We teach similar subjects",
  "same-curriculum": "We share the same curriculum",
  collaborate: "I'd like to collaborate",
  "exchange-resources": "I'd like to exchange resources",
  "learn-from-you": "I'd like to learn from you",
  network: "I'd like to network",
  other: "Other",
};

interface ConnectionRequestDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason?: ConnectionRequestReason; introMessage?: string }) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
}

export default function ConnectionRequestDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  submitError,
}: ConnectionRequestDialogProps) {
  const [reason, setReason] = useState<ConnectionRequestReason | "">("");
  const [introMessage, setIntroMessage] = useState("");
  const remaining = MAX_CONNECTION_INTRO_MESSAGE_LENGTH - introMessage.length;

  const canSubmit = useMemo(() => {
    return remaining >= 0 && !isSubmitting;
  }, [isSubmitting, remaining]);

  async function handleSubmit() {
    await onSubmit({
      reason: reason || undefined,
      introMessage: introMessage.trim() || undefined,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Why would you like to connect?" className="max-w-xl">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Add context to help this educator understand your professional intent.
        </p>

        <fieldset>
          <legend className="text-sm font-semibold text-foreground">Reason (optional)</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Connection reason options">
            {CONNECTION_REQUEST_REASONS.map((option) => {
              const selected = reason === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setReason(selected ? "" : option)}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "border-primary-400 bg-primary-50 text-primary-900"
                      : "border-border bg-surface text-foreground hover:bg-surface-hover"
                  }`}
                >
                  {REASON_LABELS[option]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="connection-intro-message" className="text-sm font-semibold text-foreground">
            Introductory message (optional)
          </label>
          <textarea
            id="connection-intro-message"
            value={introMessage}
            onChange={(event) => setIntroMessage(event.target.value.slice(0, MAX_CONNECTION_INTRO_MESSAGE_LENGTH))}
            className="mt-2 min-h-28 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary-400"
            placeholder="Hi! I noticed we both teach similar students and I'd love to exchange ideas."
          />
          <p className="mt-1 text-xs text-muted" aria-live="polite">
            {remaining} characters remaining.
          </p>
        </div>

        {submitError && (
          <p className="rounded-md bg-error-50 px-3 py-2 text-sm text-error-700" role="alert">
            {submitError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!canSubmit}>
            Send request
          </Button>
        </div>
      </div>
    </Modal>
  );
}
