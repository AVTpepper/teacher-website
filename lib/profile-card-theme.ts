import type { UserProfile } from "@/lib/firestore/users";

export type ProfileCardThemeId = "classic" | "ocean" | "forest" | "sunset" | "midnight";

export interface ProfileCardThemeOption {
  id: ProfileCardThemeId;
  label: string;
  description: string;
  plusOnly: boolean;
  swatchClass: string;
}

interface ProfileCardThemeStyle {
  gradientClass: string;
  chipClass: string;
}

export const PROFILE_CARD_THEME_OPTIONS: ProfileCardThemeOption[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Deep teal identity used by default.",
    plusOnly: false,
    swatchClass: "bg-linear-to-r from-primary-900 via-primary-800 to-secondary-900",
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Cool blue gradient for a calm profile mood.",
    plusOnly: true,
    swatchClass: "bg-linear-to-r from-sky-900 via-cyan-800 to-blue-900",
  },
  {
    id: "forest",
    label: "Forest",
    description: "Green/teal gradient with earthy contrast.",
    plusOnly: true,
    swatchClass: "bg-linear-to-r from-emerald-900 via-teal-800 to-green-900",
  },
  {
    id: "sunset",
    label: "Sunset",
    description: "Warm orange-magenta gradient with bold energy.",
    plusOnly: true,
    swatchClass: "bg-linear-to-r from-orange-700 via-rose-700 to-fuchsia-800",
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Dark indigo slate for a premium, quiet look.",
    plusOnly: true,
    swatchClass: "bg-linear-to-r from-slate-900 via-indigo-900 to-slate-800",
  },
];

const PROFILE_CARD_THEME_STYLES: Record<ProfileCardThemeId, ProfileCardThemeStyle> = {
  classic: {
    gradientClass: "bg-linear-to-r from-primary-900 via-primary-800 to-secondary-900",
    chipClass: "border-primary-200/35 text-primary-50",
  },
  ocean: {
    gradientClass: "bg-linear-to-r from-sky-900 via-cyan-800 to-blue-900",
    chipClass: "border-cyan-200/35 text-cyan-50",
  },
  forest: {
    gradientClass: "bg-linear-to-r from-emerald-900 via-teal-800 to-green-900",
    chipClass: "border-emerald-200/35 text-emerald-50",
  },
  sunset: {
    gradientClass: "bg-linear-to-r from-orange-700 via-rose-700 to-fuchsia-800",
    chipClass: "border-orange-100/45 text-orange-50",
  },
  midnight: {
    gradientClass: "bg-linear-to-r from-slate-900 via-indigo-900 to-slate-800",
    chipClass: "border-indigo-100/35 text-indigo-50",
  },
};

export function resolveProfileCardTheme(
  requestedTheme: string | null | undefined,
  tier: UserProfile["tier"]
): ProfileCardThemeId {
  const normalized = (requestedTheme ?? "").trim() as ProfileCardThemeId;
  const option = PROFILE_CARD_THEME_OPTIONS.find((item) => item.id === normalized);
  if (!option) return "classic";
  if (option.plusOnly && tier !== "plus") return "classic";
  return option.id;
}

export function getProfileCardThemeStyle(
  requestedTheme: string | null | undefined,
  tier: UserProfile["tier"]
): ProfileCardThemeStyle {
  const safeTheme = resolveProfileCardTheme(requestedTheme, tier);
  return PROFILE_CARD_THEME_STYLES[safeTheme];
}
