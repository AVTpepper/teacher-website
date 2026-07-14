"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import LandingPage from "@/components/landing/LandingPage";
import Spinner from "@/components/ui/Spinner";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedPostId = searchParams.get("post");

  useEffect(() => {
    if (!loading && user) {
      const target = linkedPostId
        ? `/home?post=${encodeURIComponent(linkedPostId)}`
        : "/home";
      router.replace(target);
    }
  }, [user, loading, router, linkedPostId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (user) {
    // Redirect is in progress via useEffect
    return null;
  }

  return <LandingPage />;
}
