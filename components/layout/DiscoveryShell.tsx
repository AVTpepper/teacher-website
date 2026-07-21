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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-300">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
            {subtitle}
          </p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {controls && (
        <div className="border-t border-white/10 bg-surface px-6 py-6 text-foreground">
          {controls}
        </div>
      )}
    </div>
  );
}