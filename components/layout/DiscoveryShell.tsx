import { type ReactNode } from "react";

interface DiscoveryShellProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
  controls?: ReactNode;
  eyebrow?: string;
  className?: string;
}

export default function DiscoveryShell({
  title,
  subtitle,
  action,
  controls,
  eyebrow = "VistaTeacher",
  className = "",
}: DiscoveryShellProps) {
  return (
    <div
      className={`mb-6 overflow-hidden rounded-2xl border border-primary-700/25 bg-linear-to-r from-primary-800 via-primary-700 to-primary-600 text-white shadow-[0_16px_40px_rgba(15,76,92,0.18)] ${className}`}
    >
      <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="type-body-medium text-xs font-semibold uppercase tracking-[0.22em] text-accent-300">
            {eyebrow}
          </p>
          <h1 className="type-heading-strong mt-2 text-2xl font-extrabold text-white sm:text-3xl">
            {title}
          </h1>
          <p className="type-body-medium mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
            {subtitle}
          </p>
        </div>
        {action && (
          <div className="shrink-0 [&_button]:min-h-10! [&_button]:min-w-10! [&_button]:rounded-lg! [&_button]:border-0! [&_button]:bg-accent-500! [&_button]:px-5! [&_button]:py-2.5! [&_button]:text-sm! [&_button]:font-semibold! [&_button]:text-white! [&_button]:shadow-sm! [&_button]:transition-colors [&_button]:hover:bg-accent-600! [&_button]:active:bg-accent-600! [&_button]:focus-visible:outline-2! [&_button]:focus-visible:outline-offset-2! [&_button]:focus-visible:outline-white! [&_button]:disabled:bg-accent-500/60! [&_button]:disabled:text-white/80!">
            {action}
          </div>
        )}
      </div>

      {controls && (
        <div className="border-t border-white/10 bg-surface px-6 py-6 text-foreground">
          {controls}
        </div>
      )}
    </div>
  );
}