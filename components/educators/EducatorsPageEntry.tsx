"use client";

import DiscoverEducatorsPage from "@/components/educators/discover/DiscoverEducatorsPage";
import PublicEducatorDirectory from "@/components/educators/PublicEducatorDirectory";
import { useAuth } from "@/lib/auth-context";

export default function EducatorsPageEntry() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted">Loading educators...</div>;
  }

  if (!user) {
    return <PublicEducatorDirectory />;
  }

  return <DiscoverEducatorsPage />;
}
