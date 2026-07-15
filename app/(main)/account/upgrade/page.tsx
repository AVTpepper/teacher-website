"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useAuth } from "@/lib/auth-context";
import { Button, Card } from "@/components/ui";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;
const isSandboxBilling = (publishableKey ?? "").startsWith("pk_test_");

export default function AccountUpgradePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const fetchClientSecret = useMemo(
    () => async () => {
      if (!user) {
        throw new Error("You must be signed in to upgrade.");
      }

      const token = await user.getIdToken();
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uiMode: "embedded" }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        clientSecret?: string;
        error?: string;
      };

      if (!response.ok || !payload.clientSecret) {
        throw new Error(payload.error ?? "Unable to start embedded checkout.");
      }

      return payload.clientSecret;
    },
    [user],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <Card padding="lg" className="space-y-4 text-center">
          <h1 className="text-2xl font-bold text-foreground">Sign in to upgrade</h1>
          <p className="text-sm text-muted">
            You need an account session before starting a Plus subscription.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => router.push("/auth/login")}>Sign In</Button>
            <Button variant="outline" onClick={() => router.push("/account")}>Back</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!stripePromise || !publishableKey) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <Card padding="lg" className="space-y-4 text-center">
          <h1 className="text-2xl font-bold text-foreground">Billing is not configured</h1>
          <p className="text-sm text-muted">
            Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable embedded checkout.
          </p>
          <Button variant="outline" onClick={() => router.push("/account")}>Back to Account</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Billing</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">Upgrade to Plus</h1>
        <p className="mt-2 text-sm text-muted">
          Complete your subscription without leaving TeacherlyConnect.
        </p>
      </div>

      {isSandboxBilling && (
        <Card padding="lg" className="border-warning-200 bg-warning-50 text-warning-900">
          <p className="text-sm font-semibold">Stripe sandbox card for early-access Plus</p>
          <p className="mt-2 text-sm">
            Card number: <span className="font-mono font-medium">4242 4242 4242 4242</span>
          </p>
          <p className="mt-1 text-sm">Expiry: any future date</p>
          <p className="mt-1 text-sm">CVC: any 3 digits</p>
          <p className="mt-1 text-sm">ZIP/postcode: any value</p>
        </Card>
      )}

      <Card padding="lg" className="overflow-hidden">
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.push("/account")}>Back to Account</Button>
      </div>
    </div>
  );
}
