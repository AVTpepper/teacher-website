import type { Metadata } from "next";
import { Suspense } from "react";
import PersonalizedDashboard from "@/components/dashboard/PersonalizedDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | VistaTeacher",
  description: "Your private VistaTeacher dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardLoadingState />}>
      <PersonalizedDashboard />
    </Suspense>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-6 pb-8">
      <div className="overflow-hidden rounded-3xl border border-primary-200 bg-linear-to-r from-primary-950 via-primary-900 to-primary-800 px-6 py-6 text-white shadow-card">
        <div className="h-4 w-40 animate-pulse rounded-full bg-white/20" />
        <div className="mt-4 h-8 w-72 animate-pulse rounded-xl bg-white/20" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded-full bg-white/15" />
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="h-11 w-36 animate-pulse rounded-xl bg-white/15" />
          <div className="h-11 w-32 animate-pulse rounded-xl bg-white/15" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <div className="surface-panel rounded-2xl border border-border bg-surface p-5">
            <div className="h-5 w-40 animate-pulse rounded-full bg-secondary-100" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-border bg-surface-subtle p-4">
                  <div className="h-4 w-20 animate-pulse rounded-full bg-secondary-100" />
                  <div className="mt-3 h-8 w-12 animate-pulse rounded-full bg-secondary-100" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="surface-panel rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-secondary-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 animate-pulse rounded-full bg-secondary-100" />
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-secondary-100" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full animate-pulse rounded-full bg-secondary-100" />
                  <div className="h-3 w-5/6 animate-pulse rounded-full bg-secondary-100" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface-panel rounded-2xl border border-border bg-surface p-5">
            <div className="h-5 w-48 animate-pulse rounded-full bg-secondary-100" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 rounded-2xl bg-secondary-50 animate-pulse" />
              ))}
            </div>
          </div>

          <div className="surface-panel rounded-2xl border border-border bg-surface p-5">
            <div className="h-5 w-40 animate-pulse rounded-full bg-secondary-100" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 rounded-2xl bg-secondary-50 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}