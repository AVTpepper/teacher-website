import { type ReactNode } from "react";
import Button from "./Button";

interface ErrorStateProps {
  title?: string;
  message: string;
  icon?: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = "Something went wrong",
  message,
  icon = "⚠️",
  retryLabel = "Try again",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="surface-panel mx-auto flex max-w-2xl flex-col items-center gap-3 border-error-500/30 bg-error-50/50 px-5 py-10 text-center sm:px-8">
      <div className="text-3xl" aria-hidden="true">{icon}</div>
      <h2 className="type-section-title text-xl text-foreground">{title}</h2>
      <p className="max-w-lg text-sm text-text-secondary">{message}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
