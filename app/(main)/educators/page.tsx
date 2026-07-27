import { Suspense } from "react";
import EducatorsPageEntry from "@/components/educators/EducatorsPageEntry";

export default function EducatorsPageRoute() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-muted">Loading discover...</div>}>
      <EducatorsPageEntry />
    </Suspense>
  );
}
