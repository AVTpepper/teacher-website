import { CardSkeleton, ListSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function MainLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6 lg:py-8">
      <div className="space-y-6 pb-8">
        <div className="surface-panel overflow-hidden rounded-3xl border border-primary-200 bg-linear-to-r from-primary-950 via-primary-900 to-primary-800 px-6 py-6 text-white shadow-card">
          <Skeleton className="h-4 w-40 bg-white/20" />
          <Skeleton className="mt-4 h-8 w-72 bg-white/20" />
          <Skeleton className="mt-3 h-4 w-full max-w-2xl bg-white/15" />
          <div className="mt-6 flex flex-wrap gap-3">
            <Skeleton className="h-11 w-36 rounded-xl bg-white/15" />
            <Skeleton className="h-11 w-32 rounded-xl bg-white/15" />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <div className="surface-panel rounded-2xl border border-border bg-surface p-5">
              <Skeleton className="h-5 w-40" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <CardSkeleton key={index} />
                ))}
              </div>
            </div>

            <ListSkeleton rows={2} />
          </div>

          <div className="space-y-6">
            <div className="surface-panel rounded-2xl border border-border bg-surface p-5">
              <Skeleton className="h-5 w-48" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-20 rounded-2xl bg-secondary-50 animate-pulse" />
                ))}
              </div>
            </div>

            <div className="surface-panel rounded-2xl border border-border bg-surface p-5">
              <Skeleton className="h-5 w-40" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 rounded-2xl bg-secondary-50 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}