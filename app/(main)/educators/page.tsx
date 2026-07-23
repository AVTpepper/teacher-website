import { Suspense } from "react";
import DiscoverEducatorsPage from "@/components/educators/discover/DiscoverEducatorsPage";

export default function EducatorsPageRoute() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-muted">Loading discover...</div>}>
      <DiscoverEducatorsPage />
    </Suspense>
  );
}
