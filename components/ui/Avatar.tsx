"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getUser } from "@/lib/firestore/users";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: AvatarSize;
  className?: string;
  preferInitials?: boolean;
  userId?: string;
  showPlusBadge?: boolean;
  isPlus?: boolean;
}

const plusTierCache = new Map<string, boolean>();
const plusTierRequests = new Map<string, Promise<boolean>>();

async function getPlusTier(userId: string): Promise<boolean> {
  if (plusTierCache.has(userId)) {
    return plusTierCache.get(userId) ?? false;
  }

  const pending = plusTierRequests.get(userId);
  if (pending) return pending;

  const request = getUser(userId)
    .then((profile) => profile?.tier === "plus")
    .catch(() => false)
    .then((isPlusUser) => {
      plusTierCache.set(userId, isPlusUser);
      plusTierRequests.delete(userId);
      return isPlusUser;
    });

  plusTierRequests.set(userId, request);
  return request;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

const sizePx: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

function getInitials(name: string): string {
  return (name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Avatar({
  src,
  alt,
  size = "md",
  className = "",
  preferInitials = false,
  userId,
  showPlusBadge = false,
  isPlus,
}: AvatarProps) {
  const showImage = Boolean(src) && !preferInitials;
  const [resolvedPlus, setResolvedPlus] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!showPlusBadge || !userId || isPlus !== undefined) {
      return;
    }

    getPlusTier(userId).then((value) => {
      if (!cancelled) setResolvedPlus(value);
    });

    return () => {
      cancelled = true;
    };
  }, [showPlusBadge, userId, isPlus]);

  const showPlus = showPlusBadge && (isPlus ?? resolvedPlus);
  const premiumFrameClass = showPlus
    ? "ring-2 ring-accent-400 ring-offset-2 ring-offset-background shadow-[0_0_0_1px_rgba(255,255,255,0.55)]"
    : "";

  return (
    <div
      className={`relative rounded-full shrink-0 ${sizeClasses[size]} ${premiumFrameClass} ${className}`}
    >
      <div className="h-full w-full overflow-hidden rounded-full">
        {showImage ? (
          <Image
            src={src!}
            alt={alt}
            width={sizePx[size]}
            height={sizePx[size]}
            sizes={`${sizePx[size]}px`}
            quality={60}
            className="object-cover w-full h-full"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-surface-subtle text-primary-800 font-semibold"
            aria-label={alt || "User avatar"}
          >
            {getInitials(alt)}
          </div>
        )}
      </div>
      {showPlus && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full border border-accent-200/70"
        />
      )}
      {showPlus && (
        <span
          aria-label="Plus member"
          className="absolute -right-1.5 -top-1.5 rounded-full border border-accent-300 bg-accent-400 px-1.5 py-0.5 text-[9px] font-bold leading-none text-primary-950 shadow-sm"
        >
          ★
        </span>
      )}
    </div>
  );
}
