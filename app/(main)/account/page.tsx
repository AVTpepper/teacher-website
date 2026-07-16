"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "firebase/auth";

import { useAuth } from "@/lib/auth-context";
import { getUser, updateUser, type UserProfile } from "@/lib/firestore/users";
import { Button, Input, Card, Badge, ConfirmDialog } from "@/components/ui";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

interface PasswordErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

type BillingProfileSnapshot = Pick<
  UserProfile,
  | "stripeCustomerId"
  | "stripeSubscriptionId"
  | "stripeSubscriptionStatus"
  | "stripeCurrentPeriodEnd"
  | "stripeCancelAt"
  | "stripeCancelAtPeriodEnd"
  | "stripeCanceledAt"
  | "stripeLastSyncedAt"
  | "updatedAt"
>;

function maskStripeId(value?: string): string {
  if (!value) return "Not linked";
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatBillingStatus(status?: string): string {
  if (!status) return "No subscription yet";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: unknown): string {
  if (!value) return "Not available";

  let date: Date | null = null;

  if (typeof value === "number") {
    date = new Date(value * 1000);
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    const parsed = new Date(value);
    date = Number.isNaN(parsed.getTime()) ? null : parsed;
  } else if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    date = new Date(((value as { seconds: number }).seconds) * 1000);
  } else if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    date = (value as { toDate: () => Date }).toDate();
  }

  if (!date || Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBillingCycleLabel(profile: BillingProfileSnapshot | null, tier: "free" | "plus" | null): string {
  if (!profile) return "No billing cycle yet";

  const cycleEnd = profile.stripeCurrentPeriodEnd ?? profile.stripeCancelAt ?? profile.stripeCanceledAt;
  if (!cycleEnd) {
    return tier === "plus" ? "Awaiting Stripe sync" : "No active billing cycle";
  }

  if (profile.stripeCancelAtPeriodEnd) {
    return `Access ends ${formatDateTime(cycleEnd)}`;
  }

  if (tier === "plus") {
    return `Renews ${formatDateTime(cycleEnd)}`;
  }

  return `Ended ${formatDateTime(cycleEnd)}`;
}

export default function AccountManagementPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const isSandboxBilling = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").startsWith("pk_test_");

  // Display name state
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Tier state
  const [tier, setTier] = useState<"free" | "plus" | null>(null);
  const [loadingTier, setLoadingTier] = useState(true);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingProfile, setBillingProfile] = useState<BillingProfileSnapshot | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [savingPassword, setSavingPassword] = useState(false);

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelSubscriptionOpen, setCancelSubscriptionOpen] = useState(false);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);
  const tierRefreshTimerRef = useRef<number | null>(null);

  function addToast(message: string, type: "success" | "error" = "success") {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  // Pre-fill display name and load tier from Firestore
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const userId = user.uid;

    function applyProfile(profile: UserProfile | null) {
      if (profile) {
        setTier(profile.tier ?? "free");
        setBillingProfile({
          stripeCustomerId: profile.stripeCustomerId,
          stripeSubscriptionId: profile.stripeSubscriptionId,
          stripeSubscriptionStatus: profile.stripeSubscriptionStatus,
          stripeCurrentPeriodEnd: profile.stripeCurrentPeriodEnd,
          stripeCancelAt: profile.stripeCancelAt,
          stripeCancelAtPeriodEnd: profile.stripeCancelAtPeriodEnd,
          stripeCanceledAt: profile.stripeCanceledAt,
          stripeLastSyncedAt: profile.stripeLastSyncedAt,
          updatedAt: profile.updatedAt,
        });
      } else {
        setTier("free");
        setBillingProfile(null);
      }
    }

    async function loadTier() {
      try {
        const profile = await getUser(userId);
        if (cancelled) return;
        applyProfile(profile);
      } catch {
        if (!cancelled) {
          setTier("free");
          setBillingProfile(null);
        }
      } finally {
        if (!cancelled) setLoadingTier(false);
      }
    }

    setDisplayName(user.displayName || "");
    setLoadingTier(true);
    void loadTier();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");

    const clearTierRefreshTimer = () => {
      if (tierRefreshTimerRef.current !== null) {
        window.clearTimeout(tierRefreshTimerRef.current);
        tierRefreshTimerRef.current = null;
      }
    };

    const refreshTierFromFirestore = async () => {
      if (!user) return;
      try {
        const profile = await getUser(user.uid);
        setTier(profile?.tier ?? "free");
        setBillingProfile(
          profile
            ? {
                stripeCustomerId: profile.stripeCustomerId,
                stripeSubscriptionId: profile.stripeSubscriptionId,
                stripeSubscriptionStatus: profile.stripeSubscriptionStatus,
                stripeCurrentPeriodEnd: profile.stripeCurrentPeriodEnd,
                stripeCancelAt: profile.stripeCancelAt,
                stripeCancelAtPeriodEnd: profile.stripeCancelAtPeriodEnd,
                stripeCanceledAt: profile.stripeCanceledAt,
                stripeLastSyncedAt: profile.stripeLastSyncedAt,
                updatedAt: profile.updatedAt,
              }
            : null,
        );
      } catch {
        // Ignore - the normal account view already has a fallback state.
      }
    };

    if (billing === "success") {
      addToast("Subscription updated. Your Plus access will refresh shortly.");
      params.delete("billing");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);

      clearTierRefreshTimer();
      void refreshTierFromFirestore();

      tierRefreshTimerRef.current = window.setTimeout(() => {
        void refreshTierFromFirestore();
      }, 2500);
    } else if (billing === "cancelled") {
      addToast("Checkout was cancelled.", "error");
      params.delete("billing");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }

    return clearTierRefreshTimer;
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const creationTime = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Unknown";

  // --- Display Name ---
  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await updateProfile(user!, { displayName: trimmed });
      await updateUser(user!.uid, { displayName: trimmed });
      addToast("Display name updated.");
    } catch {
      addToast("Failed to update display name. Please try again.", "error");
    } finally {
      setSavingName(false);
    }
  }

  // --- Change Password ---
  function validatePassword(): boolean {
    const errors: PasswordErrors = {};
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (newPassword.length < 8 || !hasLetter || !hasNumber) {
      errors.newPassword =
        "Password must be at least 8 characters and include at least one letter and one number.";
    } else if (newPassword === currentPassword) {
      errors.newPassword =
        "New password must be different from your current password.";
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (!validatePassword()) return;
    setSavingPassword(true);
    setPasswordErrors({});
    try {
      const credential = EmailAuthProvider.credential(
        user!.email!,
        currentPassword
      );
      await reauthenticateWithCredential(user!, credential);
      await updatePassword(user!, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      addToast("Password changed successfully.");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setPasswordErrors({
          currentPassword: "Current password is incorrect.",
        });
      } else {
        addToast(
          "Failed to change password. Please try again.",
          "error"
        );
      }
    } finally {
      setSavingPassword(false);
    }
  }

  // --- Delete Account ---
  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("delete_queue_failed");
      }

      await signOut();

      // Clear session cookie and redirect to landing page.
      document.cookie = "__session=; path=/; max-age=0";
      router.push("/");
    } catch {
      setDeleting(false);
      setDeleteOpen(false);
      addToast(
        "Failed to delete account. Please sign out, sign back in, and try again.",
        "error"
      );
    }
  }

  async function beginCheckout() {
    if (billingLoading) return;
    setBillingLoading(true);
    router.push("/account/upgrade");
  }

  async function openBillingPortal() {
    if (!user || billingLoading) return;
    setBillingLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "portal_failed");
      }

      window.location.assign(data.url);
    } catch {
      addToast("Unable to open billing portal right now.", "error");
      setBillingLoading(false);
    }
  }

  async function cancelSubscription() {
    if (!user || billingLoading) return;
    setBillingLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "cancel_failed");
      }

      setTier("free");
      setBillingProfile((prev) => ({
        stripeCustomerId: prev?.stripeCustomerId,
        stripeSubscriptionId: prev?.stripeSubscriptionId,
        stripeSubscriptionStatus: "canceled",
        stripeCurrentPeriodEnd: prev?.stripeCurrentPeriodEnd ?? null,
        stripeCancelAt: prev?.stripeCancelAt ?? null,
        stripeCancelAtPeriodEnd: false,
        stripeCanceledAt: Math.floor(Date.now() / 1000),
        stripeLastSyncedAt: new Date(),
        updatedAt: prev?.updatedAt,
      }));
      setCancelSubscriptionOpen(false);
      addToast("Subscription canceled. Your account has been moved back to Free.");
    } catch {
      addToast("Unable to cancel subscription right now.", "error");
    } finally {
      setBillingLoading(false);
    }
  }

  return (
    <>
      {/* Toast notifications */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg text-white ${
              t.type === "success" ? "bg-primary-900" : "bg-error-700"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        description="This will permanently delete your account and all your data. This cannot be undone."
        confirmLabel="Delete Account"
        isDestructive
        isLoading={deleting}
      />

      <ConfirmDialog
        isOpen={cancelSubscriptionOpen}
        onClose={() => {
          if (!billingLoading) setCancelSubscriptionOpen(false);
        }}
        onConfirm={cancelSubscription}
        title="Cancel Plus subscription"
        description="This immediately cancels the current Stripe subscription and moves the account back to the Free tier."
        confirmLabel="Cancel Subscription"
        isDestructive
        isLoading={billingLoading}
      />

      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <h1 className="text-2xl font-bold text-foreground">
          Account Management
        </h1>

        {/* Account Details */}
        <Card padding="lg">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Account Details
          </h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-muted">Email address</dt>
              <dd className="mt-1 text-sm text-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted">Account created</dt>
              <dd className="mt-1 text-sm text-foreground">{creationTime}</dd>
            </div>
          </dl>
        </Card>

        {/* Display Name */}
        <Card padding="lg">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Display Name
          </h2>
          <form onSubmit={handleSaveName} className="space-y-4">
            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />
            <Button
              type="submit"
              isLoading={savingName}
              disabled={!displayName.trim()}
            >
              Save name
            </Button>
          </form>
        </Card>

        {/* Subscription Tier */}
        <Card padding="lg">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Subscription Tier
          </h2>
          {isSandboxBilling && tier !== "plus" && (
            <div className="mb-4 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900">
              <p className="font-semibold">Sandbox early-access Plus</p>
              <p className="mt-1">
                This site is using Stripe test mode. Early users can upgrade themselves to Plus for free using the Stripe test card:
                <span className="font-medium"> 4242 4242 4242 4242</span>.
              </p>
              <p className="mt-1 text-xs">
                Use any future expiry date, any 3-digit CVC, and any ZIP/postcode.
              </p>
            </div>
          )}
          {loadingTier ? (
            <div className="h-5 w-16 bg-secondary-100 rounded animate-pulse" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={tier === "plus" ? "success" : "default"}>
                  {tier === "plus" ? "Plus" : "Free"}
                </Badge>
                {tier !== "plus" ? (
                  <Button size="sm" onClick={beginCheckout} isLoading={billingLoading}>
                    Upgrade to Plus
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={openBillingPortal} isLoading={billingLoading}>
                      Manage Billing
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setCancelSubscriptionOpen(true)} isLoading={billingLoading}>
                      Cancel Subscription
                    </Button>
                  </>
                )}
              </div>

              <div className="rounded-lg border border-border bg-secondary-50/70 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Billing Status</h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">Mode</dt>
                    <dd className="mt-1 text-foreground">{isSandboxBilling ? "Sandbox / Test" : "Live"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">Subscription Status</dt>
                    <dd className="mt-1 text-foreground">{formatBillingStatus(billingProfile?.stripeSubscriptionStatus)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">Renews / Ends</dt>
                    <dd className="mt-1 text-foreground">{getBillingCycleLabel(billingProfile, tier)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">Customer Record</dt>
                    <dd className="mt-1 text-foreground">{billingProfile?.stripeCustomerId ? "Linked" : "Not linked"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">Customer ID</dt>
                    <dd className="mt-1 font-mono text-foreground">{maskStripeId(billingProfile?.stripeCustomerId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">Subscription ID</dt>
                    <dd className="mt-1 font-mono text-foreground">{maskStripeId(billingProfile?.stripeSubscriptionId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">Last Stripe Sync</dt>
                    <dd className="mt-1 text-foreground">{formatDateTime(billingProfile?.stripeLastSyncedAt)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </Card>

        {/* Change Password */}
        <Card padding="lg">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Change Password
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (passwordErrors.currentPassword) {
                  setPasswordErrors((prev) => ({
                    ...prev,
                    currentPassword: undefined,
                  }));
                }
              }}
              error={passwordErrors.currentPassword}
              autoComplete="current-password"
              required
            />
            <Input
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (passwordErrors.newPassword) {
                  setPasswordErrors((prev) => ({
                    ...prev,
                    newPassword: undefined,
                  }));
                }
              }}
              error={passwordErrors.newPassword}
              autoComplete="new-password"
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (passwordErrors.confirmPassword) {
                  setPasswordErrors((prev) => ({
                    ...prev,
                    confirmPassword: undefined,
                  }));
                }
              }}
              error={passwordErrors.confirmPassword}
              autoComplete="new-password"
              required
            />
            <Button type="submit" isLoading={savingPassword}>
              Change password
            </Button>
          </form>
        </Card>

        {/* Danger Zone */}
        <Card padding="lg" className="border-error-500">
          <h2 className="text-base font-semibold text-error-700 mb-2">
            Danger Zone
          </h2>
          <p className="text-sm text-muted mb-4">
            Submit a permanent account deletion request. Background cleanup will
            remove your data and account shortly after confirmation.
          </p>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-error-500 bg-transparent px-4 py-2 text-sm font-medium text-error-700 transition-colors hover:bg-error-50 focus-ring cursor-pointer"
          >
            Delete account
          </button>
        </Card>
      </div>
    </>
  );
}
