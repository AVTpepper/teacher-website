"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import LandingPage from "@/components/landing/LandingPage";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";

function HomepageGateContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedPostId = searchParams.get("post");

  useEffect(() => {
    if (!loading && user) {
      const target = linkedPostId
          ? `/feed?post=${encodeURIComponent(linkedPostId)}`
        : "/home";
      router.replace(target);
    }
  }, [user, loading, router, linkedPostId]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-6 lg:px-6 lg:py-8">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <div className="surface-panel rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-10 w-3/5" />
            <Skeleton className="mt-3 h-4 w-4/5" />
            <div className="mt-6 flex flex-wrap gap-3">
              <Skeleton className="h-11 w-36 rounded-xl" />
              <Skeleton className="h-11 w-32 rounded-xl" />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
            <div className="space-y-6">
              <CardSkeleton />
              <CardSkeleton />
            </div>
            <div className="space-y-6">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <LandingPage />;
}

export default function HomepageGate() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen px-4 py-6 lg:px-6 lg:py-8">
          <div className="mx-auto w-full max-w-6xl space-y-8">
            <div className="surface-panel rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-4 h-10 w-3/5" />
              <Skeleton className="mt-3 h-4 w-4/5" />
            </div>
          </div>
        </div>
      }
    >
      <HomepageGateContent />
    </Suspense>
  );
}
