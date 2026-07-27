"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import { Badge, Button, Card } from "@/components/ui";

export default function PricingSuccessPage() {
  return (
    <Suspense fallback={<PricingSuccessLoadingState />}>
      <PricingSuccessPageInner />
    </Suspense>
  );
}

function PricingSuccessPageInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="space-y-6 pb-8">
      <DiscoveryShell
        eyebrow="Billing"
        title="Your Plus checkout is complete"
        subtitle="Stripe received the subscription request. Your account will refresh after the webhook confirms the new entitlement state."
        className="mb-0"
      />

      <Card padding="lg" className="space-y-4 border-primary-100 bg-primary-50/40">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Checkout successful</Badge>
          {sessionId && <Badge variant="default">Session {sessionId.slice(0, 8)}...</Badge>}
        </div>
        <p className="text-sm text-muted">
          You can head back to your account while the subscription sync completes.
          If the plan does not refresh immediately, wait a few seconds and reload the account page.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/account">
            <Button>Go to account</Button>
          </Link>
          <Link href="/home">
            <Button variant="outline">Continue to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function PricingSuccessLoadingState() {
  return (
    <div className="space-y-6 pb-8">
      <Card padding="lg" className="space-y-4">
        <div className="h-4 w-28 animate-pulse rounded-full bg-secondary-100" />
        <div className="h-8 w-64 animate-pulse rounded-xl bg-secondary-100" />
        <div className="h-4 w-full animate-pulse rounded-full bg-secondary-100" />
      </Card>
    </div>
  );
}
