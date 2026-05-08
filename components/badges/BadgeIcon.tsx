"use client";

import { getBadge, type BadgeDefinition } from "@/lib/badges";

// ---------------------------------------------------------------------------
// Color → Tailwind class map
// ---------------------------------------------------------------------------

const COLOR_CLASSES: Record<BadgeDefinition["color"], string> = {
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  teal: "bg-teal-100 text-teal-700 border-teal-200",
  pink: "bg-pink-100 text-pink-700 border-pink-200",
  gold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  maroon: "bg-red-100 text-red-900 border-red-200",
};

// ---------------------------------------------------------------------------
// BadgeIcon — renders a single badge pill or compact icon
//
// Props:
//   badgeId  — the badge ID string (e.g. "resource-creator")
//   compact  — if true, renders icon-only (no label) — good for comment lines
//   className — extra classes
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
        title={`${badge.label} — ${badge.description}`}
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
// BadgeList — renders a row of badge icons for a profile
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
