"use client";

import { getBadge, type BadgeDefinition } from "@/lib/badges";

// ---------------------------------------------------------------------------
// Color → Tailwind class map
// ---------------------------------------------------------------------------

const COLOR_CLASSES: Record<BadgeDefinition["color"], string> = {
  blue: "bg-info-50 text-info-700 border-info-500/25",
  green: "bg-success-50 text-success-700 border-success-500/25",
  purple: "bg-primary-100 text-primary-800 border-primary-500/25",
  amber: "bg-accent-50 text-accent-700 border-accent-500/25",
  teal: "bg-secondary-100 text-secondary-800 border-secondary-500/25",
  pink: "bg-accent-100 text-accent-800 border-accent-500/25",
  gold: "bg-accent-50 text-accent-700 border-accent-500/25",
  maroon: "bg-error-50 text-error-700 border-error-500/25",
};

// ---------------------------------------------------------------------------
// BadgeIcon - renders a single badge pill or compact icon
//
// Props:
//   badgeId  - the badge ID string (e.g. "resource-creator")
//   compact  - if true, renders icon-only (no label) - good for comment lines
//   className - extra classes
// ---------------------------------------------------------------------------

interface BadgeIconProps {
  badgeId: string;
  compact?: boolean;
  className?: string;
}

export default function BadgeIcon({
  badgeId,
  compact = false,
  className = "",
}: BadgeIconProps) {
  const badge = getBadge(badgeId);
  if (!badge) return null;

  const colors = COLOR_CLASSES[badge.color];

  if (compact) {
    return (
      <span
          title={`${badge.label}: ${badge.description}`}
        aria-label={badge.label}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-xs cursor-default ${colors} ${className}`}
      >
        {badge.icon}
      </span>
    );
  }

  return (
    <span
      title={badge.description}
      aria-label={badge.label}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-default ${colors} ${className}`}
    >
      <span aria-hidden="true">{badge.icon}</span>
      {badge.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// BadgeList - renders a row of badge icons for a profile
// ---------------------------------------------------------------------------

interface BadgeListProps {
  badgeIds: string[];
  compact?: boolean;
  className?: string;
}

export function BadgeList({
  badgeIds,
  compact = false,
  className = "",
}: BadgeListProps) {
  if (badgeIds.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {badgeIds.map((id) => (
        <BadgeIcon key={id} badgeId={id} compact={compact} />
      ))}
    </div>
  );
}
