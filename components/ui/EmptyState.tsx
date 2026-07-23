import { type ReactNode } from "react";
import Button from "./Button";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  description,
  icon = "📭",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="surface-panel mx-auto flex max-w-2xl flex-col items-center gap-3 px-5 py-10 text-center sm:px-8">
      <div className="text-3xl" aria-hidden="true">{icon}</div>
      <h2 className="type-section-title text-xl text-foreground">{title}</h2>
      <p className="max-w-lg text-sm text-text-secondary">{description}</p>
      {actionLabel && onAction && (
        <Button type="button" variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
