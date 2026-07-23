"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getUser } from "@/lib/firestore/users";
import { getOnboardingEligibility } from "@/lib/onboarding";

const EXEMPT_PATH_PREFIXES = ["/onboarding", "/profile/edit", "/account", "/admin"];

export default function OnboardingGuard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !user) return;
    if (EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;

    let cancelled = false;

    getUser(user.uid)
      .then((profile) => {
        if (cancelled) return;
        const eligibility = getOnboardingEligibility(profile);
        if (eligibility === "needs-onboarding") {
          const redirect = pathname || "/home";
          router.replace(`/onboarding?redirect=${encodeURIComponent(redirect)}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const redirect = pathname || "/home";
          router.replace(`/onboarding?redirect=${encodeURIComponent(redirect)}`);
        }
      })
      .finally(() => {});

    return () => {
      cancelled = true;
    };
  }, [loading, pathname, router, user]);

  return null;
}
