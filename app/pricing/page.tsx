"use client";

import { Suspense, useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
        subtitle="Start free, or choose Plus if you want unlimited outreach, stronger discovery, and expanded AI-supported workflows."
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
        {PRICING_PLANS.map((plan) => {
          const isPlus = plan.id === "plus";

          return (
            <Card
              key={plan.id}
              padding="lg"
              className={`min-w-0 ${isPlus ? "border-primary-200 bg-primary-50/60" : "border-border bg-surface"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isPlus ? "text-primary-700" : "text-muted"}`}>
                    {isPlus ? "Best for active networking" : "Get started free"}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">{plan.name}</h2>
                </div>
                <Badge variant={isPlus ? "success" : "default"}>
                  {isPlus ? plusPriceLabel ?? "$9.00/month" : plan.priceLabel}
                </Badge>
              </div>

              <p className="mt-3 text-sm font-medium text-foreground/90">{plan.tagline}</p>
              <p className="mt-3 text-sm leading-6 text-muted">{plan.description}</p>

              <ul className="mt-5 space-y-2.5">
                {plan.featureBullets.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm leading-6 text-foreground/90">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isPlus ? (
                  <Button onClick={startCheckout} isLoading={loadingCheckout} className="w-full">
                    {plan.ctaLabel}
                  </Button>
                ) : (
                  <Link href="/auth/signup?redirect=/pricing">
                    <Button className="w-full">{plan.ctaLabel}</Button>
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </section>

      <div className="flex justify-start">
        <Link href={secondaryBrowseHref} className="text-sm font-semibold text-primary-700 transition hover:text-primary-800">
          {secondaryBrowseLabel}
        </Link>
      </div>

      {notice && (
        <Card padding="md" className="border-warning-200 bg-warning-50 text-warning-900">
          {notice}
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)]">
        <Card padding="lg" className="min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Clear differences</h2>
              <p className="mt-1 text-sm text-muted">A quick view of what changes when you move from Free to Plus.</p>
            </div>
               <div className="mt-4 hidden sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,120px)_minmax(0,120px)] sm:gap-6">
                 <div />
                 <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Free</p>
                 <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">Plus</p>
               </div>
          </div>

          <ul className="mt-5 divide-y divide-border/70">
            {PRICING_DIFFERENCES.map((item) => (
              <li key={item.title} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,120px)_minmax(0,120px)] sm:items-start sm:gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  {item.note ? <p className="mt-1 text-xs leading-5 text-muted">{item.note}</p> : null}
                </div>
                <div className="flex items-center justify-between rounded-lg bg-surface-subtle px-3 py-2 sm:block sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted sm:hidden">Free</p>
                  <p className="text-sm text-foreground">{item.free}</p>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-primary-50/70 px-3 py-2 sm:block sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700 sm:hidden">Plus</p>
                  <p className="text-sm font-medium text-foreground">{item.plus}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding="lg">
          <h2 className="text-base font-semibold text-foreground">Free plan limits</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li>{FREE_MONTHLY_CONNECTION_REQUEST_LIMIT} outgoing connection requests per month.</li>
            <li>{FREE_MONTHLY_MESSAGE_LIMIT} sent messages per month.</li>
            <li>{FREE_DAILY_LESSON_AI_LIMIT} AI lesson generation requests per day.</li>
            <li>{FREE_MONTHLY_LESSON_AI_REFINE_LIMIT} AI lesson refinement requests per month.</li>
          </ul>
          <p className="mt-5 text-sm leading-6 text-muted">{BILLING_COPY.secureBilling} {BILLING_COPY.taxNote}</p>
        </Card>
      </section>

      <section>
        <Card padding="lg">
          <h2 className="text-base font-semibold text-foreground">Frequently asked questions</h2>
          <div className="mt-4 space-y-3">
            {PRICING_FAQ.map((item) => (
              <details key={item.question} className="group rounded-xl border border-border bg-surface-subtle px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground">
                  <span>{item.question}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 pr-6 text-sm leading-6 text-muted">{item.answer}</p>
              </details>
            ))}
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
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-3 w-28 animate-pulse rounded-full bg-secondary-100" />
                <div className="h-7 w-40 animate-pulse rounded-full bg-secondary-100" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-secondary-100" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-4 w-48 animate-pulse rounded-full bg-secondary-100" />
              <div className="h-4 w-full animate-pulse rounded-full bg-secondary-100" />
              <div className="h-4 w-5/6 animate-pulse rounded-full bg-secondary-100" />
            </div>
            <div className="mt-5 space-y-2">
              <div className="h-4 w-full animate-pulse rounded-full bg-secondary-100" />
              <div className="h-4 w-11/12 animate-pulse rounded-full bg-secondary-100" />
              <div className="h-4 w-4/5 animate-pulse rounded-full bg-secondary-100" />
              <div className="h-4 w-3/4 animate-pulse rounded-full bg-secondary-100" />
            </div>
            <div className="mt-6">
              <div className="h-11 w-full animate-pulse rounded-xl bg-secondary-100" />
            </div>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <Card padding="lg">
          <div className="h-6 w-32 animate-pulse rounded-full bg-secondary-100" />
          <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded-full bg-secondary-100" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 w-full animate-pulse rounded-xl bg-secondary-100" />
            ))}
          </div>
        </Card>
        <Card padding="lg">
          <div className="h-6 w-36 animate-pulse rounded-full bg-secondary-100" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-4 w-full animate-pulse rounded-full bg-secondary-100" />
            ))}
          </div>
        </Card>
      </section>
      <Card padding="lg">
        <div className="h-6 w-44 animate-pulse rounded-full bg-secondary-100" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 w-full animate-pulse rounded-xl bg-secondary-100" />
          ))}
        </div>
      </Card>
    </div>
  );
}
