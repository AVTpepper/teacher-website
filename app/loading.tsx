import { PageSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-6xl space-y-8">
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
            <PageSkeleton />
            <PageSkeleton />
          </div>
          <div className="space-y-6">
            <PageSkeleton />
            <PageSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}