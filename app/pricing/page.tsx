"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import { Badge, Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import {
  BILLING_COPY,
  FREE_MONTHLY_CONNECTION_REQUEST_LIMIT,
  FREE_MONTHLY_MESSAGE_LIMIT,
  PRICING_DIFFERENCES,
  PRICING_FAQ,
  PRICING_PLANS,
} from "@/lib/billing/config";
import {
  FREE_DAILY_LESSON_AI_LIMIT,
  FREE_MONTHLY_LESSON_AI_REFINE_LIMIT,
} from "@/lib/ai/limits";

interface PublicPricingResponse {
  plus: {
    priceId: string;
    priceLabel: string | null;
    currency: string;
    interval: string | null;
    intervalCount: number | null;
    unitAmount: number | null;
  } | null;
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingPageLoadingState />}>
      <PricingPageInner />
    </Suspense>
  );
}

function PricingPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [plusPriceLabel, setPlusPriceLabel] = useState<string | null>(null);

  const source = searchParams.get("source");
  const billing = searchParams.get("billing");
  const secondaryBrowseHref = user ? "/educators" : "/";
  const secondaryBrowseLabel = user ? "Explore Educators" : "View Landing Page";

  useEffect(() => {
    let cancelled = false;

    fetch("/api/billing/public-plan", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as PublicPricingResponse;
        if (!cancelled) {
          setPlusPriceLabel(payload.plus?.priceLabel ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlusPriceLabel(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (billing === "cancelled") {
      setNotice("Checkout was cancelled. You can review the plan details below anytime.");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("billing");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `/pricing?${qs}` : "/pricing");
    }
  }, [billing, searchParams]);

  async function startCheckout() {
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent("/pricing")}`);
      return;
    }

    setLoadingCheckout(true);
    setNotice(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ flow: "pricing", uiMode: "hosted" }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        if (response.status === 409) {
          router.push("/account");
          return;
        }
        throw new Error(payload.error ?? "Unable to start checkout.");
      }

      window.location.assign(payload.url);
    } catch {
      setNotice("We could not start Stripe checkout right now. Please try again.");
    } finally {
      setLoadingCheckout(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-clip pb-8">
      <DiscoveryShell
        eyebrow="Plans"
        title="Choose the plan that fits your network"
        subtitle="VistaTeacher Free covers the core product. Plus removes networking limits, improves profile visibility, and unlocks stronger AI-supported workflows."
      />

      {source === "account" && (
        <Card padding="md" className="border-primary-100 bg-primary-50/40">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-foreground">You returned here from account management.</p>
            <Badge variant="default">Pricing context restored</Badge>
          </div>
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {PRICING_PLANS.map((plan) => (
          <Card
            key={plan.id}
            padding="lg"
            className={`min-w-0 ${plan.id === "plus" ? "border-primary-200 bg-primary-50/60" : "bg-surface"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-foreground">{plan.name}</h2>
                <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
              </div>
              <Badge variant={plan.id === "plus" ? "success" : "default"}>
                {plan.id === "plus" ? plusPriceLabel ?? "Monthly billing" : plan.priceLabel}
              </Badge>
            </div>
            <p className="mt-4 text-sm text-muted">{plan.description}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {plan.id === "plus" ? (
                <Button onClick={startCheckout} isLoading={loadingCheckout} className="w-full sm:w-auto">
                  {plan.ctaLabel}
                </Button>
              ) : (
                <Link href="/auth/signup?redirect=/pricing">
                  <Button variant="outline" className="w-full sm:w-auto">{plan.ctaLabel}</Button>
                </Link>
              )}
              <Link href={secondaryBrowseHref}>
                <Button variant="outline" className="w-full sm:w-auto">{secondaryBrowseLabel}</Button>
              </Link>
            </div>
          </Card>
        ))}
      </section>

      {notice && (
        <Card padding="md" className="border-warning-200 bg-warning-50 text-warning-900">
          {notice}
        </Card>
      )}

      {loading ? null : user ? (
        <Card padding="md" className="border-primary-100 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Signed in as {user.email}</p>
              <p className="mt-1 text-sm text-muted">
                {BILLING_COPY.secureBilling} {BILLING_COPY.taxNote}
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={startCheckout} isLoading={loadingCheckout}>
                Upgrade now
              </Button>
              <Link href="/account">
                <Button variant="outline">Manage account</Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <Card padding="md" className="border-primary-100 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Create your profile, then upgrade any time</p>
              <p className="mt-1 text-sm text-muted">
                Sign up first, or log in if you already have an account.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/auth/signup?redirect=/pricing">
                <Button>Create profile</Button>
              </Link>
              <Link href="/auth/login?redirect=/pricing">
                <Button variant="outline">Log in</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <Card padding="lg" className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">What changes when you upgrade</h2>
          <p className="mt-1 text-sm text-muted">
            The differences below reflect the product behavior that exists in the app today. Shared features are intentionally omitted.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {PRICING_DIFFERENCES.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-surface-subtle p-4">
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/80 bg-white/75 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Free</p>
                    <p className="mt-1 text-sm text-foreground">{item.free}</p>
                  </div>
                  <div className="rounded-lg border border-primary-200 bg-primary-50/70 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-900">Plus</p>
                    <p className="mt-1 text-sm text-foreground">{item.plus}</p>
                  </div>
                </div>
                {item.note && <p className="mt-3 text-xs text-muted">{item.note}</p>}
              </div>
            ))}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card padding="lg">
            <h2 className="text-base font-semibold text-foreground">Free account limits</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li>{FREE_MONTHLY_CONNECTION_REQUEST_LIMIT} outgoing connection requests per month.</li>
              <li>{FREE_MONTHLY_MESSAGE_LIMIT} sent messages per month.</li>
              <li>{FREE_DAILY_LESSON_AI_LIMIT} AI lesson generation requests per day.</li>
              <li>{FREE_MONTHLY_LESSON_AI_REFINE_LIMIT} AI lesson refinement requests per month.</li>
            </ul>
          </Card>

          <Card padding="lg">
            <h2 className="text-base font-semibold text-foreground">What stays the same</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li>Your profile, existing connections, and message history remain intact if you move back to Free.</li>
              <li>Checkout, payment methods, invoices, and subscription management are handled securely by Stripe.</li>
              <li>Communities, resources, lesson publishing, and the broader educator network remain part of the core platform.</li>
            </ul>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card padding="lg">
          <h2 className="text-base font-semibold text-foreground">Frequently asked questions</h2>
          <div className="mt-4 space-y-4">
            {PRICING_FAQ.map((item) => (
              <div key={item.question} className="space-y-1 border-b border-border/70 pb-4 last:border-b-0 last:pb-0">
                <h3 className="text-sm font-semibold text-foreground">{item.question}</h3>
                <p className="text-sm text-muted">{item.answer}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="lg" className="border-primary-100 bg-primary-50/40">
          <h2 className="text-base font-semibold text-foreground">Need the account view instead?</h2>
          <p className="mt-3 text-sm text-muted">
            The account page still handles Stripe portal access, cancellation, and current subscription status for signed-in users.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/account">
              <Button>Go to account</Button>
            </Link>
            <Link href={secondaryBrowseHref}>
              <Button variant="outline">{user ? "Keep browsing" : "View landing page"}</Button>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}

function PricingPageLoadingState() {
  return (
    <div className="space-y-6 pb-8">
      <div className="mb-6 overflow-hidden rounded-2xl border border-primary-700/25 bg-linear-to-r from-primary-900 via-primary-800 to-primary-700 p-6 text-white shadow-md">
        <div className="space-y-3">
          <div className="h-4 w-20 animate-pulse rounded-full bg-white/20" />
          <div className="h-8 w-72 max-w-full animate-pulse rounded-xl bg-white/20" />
          <div className="h-4 w-full max-w-2xl animate-pulse rounded-full bg-white/15" />
        </div>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} padding="lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-36 animate-pulse rounded-full bg-secondary-100" />
                <div className="h-4 w-40 animate-pulse rounded-full bg-secondary-100" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-secondary-100" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full animate-pulse rounded-full bg-secondary-100" />
              <div className="h-4 w-5/6 animate-pulse rounded-full bg-secondary-100" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-secondary-100" />
            </div>
            <div className="mt-5 space-y-2 sm:space-y-0 sm:flex sm:gap-2">
              <div className="h-11 w-full animate-pulse rounded-xl bg-secondary-100 sm:w-40" />
              <div className="h-11 w-full animate-pulse rounded-xl bg-secondary-100 sm:w-36" />
            </div>
          </Card>
        ))}
      </section>
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-52 animate-pulse rounded-full bg-secondary-100" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded-full bg-secondary-100" />
          </div>
          <div className="flex gap-3">
            <div className="h-11 w-32 animate-pulse rounded-xl bg-secondary-100" />
            <div className="h-11 w-24 animate-pulse rounded-xl bg-secondary-100" />
          </div>
        </div>
      </Card>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <Card padding="lg">
          <div className="h-6 w-32 animate-pulse rounded-full bg-secondary-100" />
          <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded-full bg-secondary-100" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 w-full animate-pulse rounded-xl bg-secondary-100" />
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Card padding="lg">
            <div className="h-6 w-36 animate-pulse rounded-full bg-secondary-100" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-4 w-full animate-pulse rounded-full bg-secondary-100" />
              ))}
            </div>
          </Card>
          <Card padding="lg">
            <div className="h-6 w-32 animate-pulse rounded-full bg-secondary-100" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-4 w-full animate-pulse rounded-full bg-secondary-100" />
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
