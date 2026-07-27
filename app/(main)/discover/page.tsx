import { Suspense } from "react";
import DiscoverEducatorsPage from "@/components/educators/discover/DiscoverEducatorsPage";
import { CardSkeleton, ListSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function DiscoverRoutePage() {
	return (
		<Suspense fallback={<DiscoverLoadingState />}>
			<DiscoverEducatorsPage />
		</Suspense>
	);
}

function DiscoverLoadingState() {
	return (
		<div className="space-y-6 pb-8">
			<div className="surface-panel rounded-3xl border border-border bg-surface p-5 shadow-card">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="mt-4 h-8 w-64" />
				<Skeleton className="mt-3 h-4 w-4/5" />
				<div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, index) => (
						<CardSkeleton key={index} />
					))}
				</div>
			</div>

			<div className="space-y-3">
				<ListSkeleton rows={4} />
			</div>
		</div>
	);
}
