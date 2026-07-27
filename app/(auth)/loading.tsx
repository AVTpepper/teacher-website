import { Skeleton } from "@/components/ui/Skeleton";

export default function AuthLoading() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-10">
      <div className="surface-panel w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-40 mx-auto" />
          <Skeleton className="h-4 w-56 mx-auto" />
          <div className="space-y-4 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-11 w-full mt-4" />
          <Skeleton className="h-4 w-40 mx-auto mt-6" />
        </div>
      </div>
    </div>
  );
}