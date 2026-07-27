"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar, { SidebarDrawerButton } from "@/components/layout/Sidebar";
import SiteMessageBanner from "@/components/layout/SiteMessageBanner";
import OnboardingGuard from "@/components/layout/OnboardingGuard";
import { TwoColumnLayout } from "@/components/ui/PageLayout";
import { useAuth } from "@/lib/auth-context";
import {
  getPublicShowcaseConfig,
  getShowcaseTarget,
  isShowcaseTargetAllowed,
  type PublicShowcaseConfig,
} from "@/lib/firestore/publicShowcase";

const TRUST_ROUTE_PATTERNS = [
  /^\/about$/,
  /^\/blog$/,
  /^\/careers$/,
  /^\/contact$/,
  /^\/cookies$/,
  /^\/pricing$/,
  /^\/privacy$/,
  /^\/terms$/,
];

function isTrustRoute(pathname: string | null): boolean {
  return TRUST_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname ?? ""));
}

function isGuestPreviewRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/forums\/[^/]+$/.test(pathname) || /^\/inspiration\/[^/]+$/.test(pathname);
}

export default function MainAppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const useTrustShell = isTrustRoute(pathname);

  const [showcaseConfig, setShowcaseConfig] = useState<PublicShowcaseConfig>({
    educatorProfileIds: [],
    lessonPlanIds: [],
    resourceIds: [],
    discussionIds: [],
    inspirationIds: [],
    feedPostIds: [],
  });
  const [showcaseConfigLoading, setShowcaseConfigLoading] = useState(false);
  const [showcaseConfigResolved, setShowcaseConfigResolved] = useState(false);

  const showcaseTarget = useMemo(() => getShowcaseTarget(pathname), [pathname]);
  const isGuest = !loading && !user;
  const allowGuestPreviewRoute = isGuestPreviewRoute(pathname);

  useEffect(() => {
    let cancelled = false;

    if (loading || user || useTrustShell || !showcaseTarget) {
      setShowcaseConfigResolved(false);
      return;
    }

    setShowcaseConfigResolved(false);
    setShowcaseConfigLoading(true);
    getPublicShowcaseConfig()
      .then((config) => {
        if (!cancelled) {
          setShowcaseConfig(config);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setShowcaseConfigLoading(false);
          setShowcaseConfigResolved(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user, useTrustShell, showcaseTarget]);

  const isAllowedShowcase = isShowcaseTargetAllowed(showcaseTarget, showcaseConfig);
  const isShowcaseAccessPending = isGuest && !useTrustShell && Boolean(showcaseTarget) && !showcaseConfigResolved;
  const shouldShowRestrictedGate =
    isGuest && !useTrustShell && !allowGuestPreviewRoute && !isShowcaseAccessPending && !isAllowedShowcase;
  const loginHref = `/auth/login?redirect=${encodeURIComponent(pathname || "/")}`;

  return (
    <>
      <div className="flex-1 bg-linear-to-b from-page-background via-page-background-soft to-page-background">
        <div className="app-container py-6 lg:py-8">
          <OnboardingGuard />
          {shouldShowRestrictedGate ? (
            <main className="mx-auto w-full max-w-3xl py-6 lg:py-10">
              <section className="surface-panel rounded-2xl border border-border bg-surface p-6 text-center shadow-card sm:p-8">
                <p className="type-meta uppercase tracking-[0.14em] text-accent-500">Limited public access</p>
                <h1 className="mt-3 text-2xl font-extrabold text-foreground sm:text-3xl">
                  Create your profile or log in to view this page
                </h1>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
                  Register or sign in to your account to get the full view of each page. With Plus membership, you get access to unlimited connections, messaging, and improved AI workflows.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href={loginHref}
                    className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-primary-900/20 px-5 py-2.5 text-sm font-semibold text-primary-900 hover:bg-primary-50"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-600"
                  >
                    Create Profile
                  </Link>
                </div>
                <p className="mt-5 text-xs text-text-muted">
                  Looking around first? Start on the landing page where featured profiles and resources are highlighted.
                </p>
              </section>
            </main>
          ) : useTrustShell ? (
            <main className="mx-auto w-full max-w-4xl py-4 lg:py-6">{children}</main>
          ) : isGuest ? (
            <main className="mx-auto w-full max-w-5xl py-4 lg:py-6">
              {showcaseConfigLoading || isShowcaseAccessPending ? (
                <div className="rounded-xl border border-border bg-surface p-6 text-sm text-text-secondary">
                  Loading featured preview...
                </div>
              ) : (
                children
              )}
            </main>
          ) : (
            <>
              <SiteMessageBanner />
              <main>
                <TwoColumnLayout sidebar={<Sidebar />} className="mt-4">
                  {children}
                </TwoColumnLayout>
              </main>
            </>
          )}
        </div>
      </div>
      {!useTrustShell && Boolean(user) && <SidebarDrawerButton />}
    </>
  );
}