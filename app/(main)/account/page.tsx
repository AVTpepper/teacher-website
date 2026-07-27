"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "firebase/auth";

import { useAuth } from "@/lib/auth-context";
import { getUser, updateUser, type UserProfile } from "@/lib/firestore/users";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
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
  | "billingStatus"
  | "updatedAt"
>;

function toBillingProfileSnapshot(
  profile: UserProfile | null
): BillingProfileSnapshot | null {
  if (!profile) return null;

  return {
    stripeCustomerId: profile.stripeCustomerId,
    stripeSubscriptionId: profile.stripeSubscriptionId,
    stripeSubscriptionStatus: profile.stripeSubscriptionStatus,
    stripeCurrentPeriodEnd: profile.stripeCurrentPeriodEnd,
    stripeCancelAt: profile.stripeCancelAt,
    stripeCancelAtPeriodEnd: profile.stripeCancelAtPeriodEnd,
    stripeCanceledAt: profile.stripeCanceledAt,
    stripeLastSyncedAt: profile.stripeLastSyncedAt,
    billingStatus: profile.billingStatus,
    updatedAt: profile.updatedAt,
  };
}

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

function getBillingCycleLabel(
  profile: BillingProfileSnapshot | null,
  tier: "free" | "plus" | null
): string {
  if (!profile) return "No billing cycle yet";

  const cycleEnd =
    profile.stripeCurrentPeriodEnd ??
    profile.stripeCancelAt ??
    profile.stripeCanceledAt;

  if (!cycleEnd) {
    return tier === "plus"
      ? "Awaiting Stripe sync"
      : "No active billing cycle";
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
  const isSandboxBilling =
    (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").startsWith(
      "pk_test_"
    );

  // Display name state
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Tier state
  const [tier, setTier] = useState<"free" | "plus" | null>(null);
  const [loadingTier, setLoadingTier] = useState(true);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingProfile, setBillingProfile] =
    useState<BillingProfileSnapshot | null>(null);

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
    const uid = user.uid;

    async function loadProfile() {
      try {
        const profile = await getUser(uid);
        if (cancelled) return;
        setTier(profile?.tier ?? "free");
        setBillingProfile(toBillingProfileSnapshot(profile));
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
    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");

    const clearTierRefreshTimer = () => {
      if (tierRefreshTimerRef.current !== null) {
        window.clearTimeout(tierRefreshTimerRef.current);
        tierRefreshTimerRef.current = null;
      }
    };

    const refreshProfile = async () => {
      try {
        const profile = await getUser(uid);
        setTier(profile?.tier ?? "free");
        setBillingProfile(toBillingProfileSnapshot(profile));
      } catch {
        setTier("free");
        setBillingProfile(null);
      }
    };

    if (billing === "success") {
      addToast("Subscription updated. Your Plus access will refresh shortly.");
      params.delete("billing");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      );

      clearTierRefreshTimer();
      void refreshProfile();
      tierRefreshTimerRef.current = window.setTimeout(() => {
        void refreshProfile();
      }, 2500);
    } else if (billing === "cancelled") {
      addToast("Checkout was cancelled.", "error");
      params.delete("billing");
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      );
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
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to queue account deletion.");
      }

      await signOut();
      document.cookie = "__session=; path=/; max-age=0";
      router.push("/");
      addToast("Account deletion queued. Your account will be removed shortly.");
    } catch {
      setDeleting(false);
      setDeleteOpen(false);
      addToast(
        "Failed to delete account. Please sign out, sign back in, and try again.",
        "error"
      );
    }
  }

  function beginCheckout() {
    if (billingLoading) return;
    setBillingLoading(true);
    router.push("/pricing?source=account");
  }

  async function openBillingPortal() {
    if (!user || billingLoading) return;

    setBillingLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "portal_failed");
      }

      window.location.assign(payload.url);
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
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "cancel_failed");
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
        billingStatus: prev?.billingStatus,
        updatedAt: prev?.updatedAt,
      }));
      setCancelSubscriptionOpen(false);
      addToast(
        "Subscription canceled. Your account has been moved back to Free."
      );
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

      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        <DiscoveryShell
          eyebrow="Account"
          title="Account Management"
          subtitle="Manage profile basics, security, and your plan in one place."
          className="mb-0"
        />

        <Card padding="lg">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/profile/edit">
              <Button variant="outline" size="sm">Edit profile</Button>
            </Link>
            <Link href="/pricing?source=account">
              <Button variant="outline" size="sm">Compare Free vs Plus</Button>
            </Link>
            {tier !== "plus" && (
              <Button size="sm" onClick={beginCheckout} isLoading={billingLoading}>
                Upgrade to Plus
              </Button>
            )}
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Profile & Plan
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-muted">Email address</dt>
              <dd className="mt-1 text-sm text-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted">Account created</dt>
              <dd className="mt-1 text-sm text-foreground">{creationTime}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted">Current plan</dt>
              <dd className="mt-1">
                {loadingTier ? (
                  <div className="h-5 w-16 bg-secondary-100 rounded animate-pulse" />
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant={tier === "plus" ? "success" : "default"}>
                      {tier === "plus" ? "Plus" : "Free"}
                    </Badge>
                    <Link
                      href="/pricing?source=account"
                      className="text-sm text-primary-900 hover:underline font-medium"
                    >
                      View plan details
                    </Link>
                  </div>
                )}
              </dd>
            </div>
          </dl>

          <form onSubmit={handleSaveName} className="mt-5 space-y-4 border-t border-border pt-5">
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

        <Card padding="lg">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Billing & Subscription
              </h2>
              <p className="mt-1 text-sm text-muted">
                Review your Stripe status and manage your current plan.
              </p>
            </div>
            {!loadingTier && (
              <Badge variant={tier === "plus" ? "success" : "default"}>
                {tier === "plus" ? "Plus active" : "Free plan"}
              </Badge>
            )}
          </div>

          {isSandboxBilling && tier !== "plus" && (
            <div className="mt-4 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900">
              <p className="font-semibold">Sandbox early-access Plus</p>
              <p className="mt-1">
                This site is using Stripe test mode. You can upgrade with the
                Stripe test card <span className="font-medium">4242 4242 4242 4242</span>.
              </p>
              <p className="mt-1 text-xs">
                Use any future expiry date, any 3-digit CVC, and any ZIP/postcode.
              </p>
            </div>
          )}

          {loadingTier ? (
            <div className="mt-4 h-24 rounded-xl bg-secondary-100 animate-pulse" />
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-3">
                {tier !== "plus" ? (
                  <Button size="sm" onClick={beginCheckout} isLoading={billingLoading}>
                    Upgrade to Plus
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openBillingPortal}
                      isLoading={billingLoading}
                    >
                      Manage Billing
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setCancelSubscriptionOpen(true)}
                      isLoading={billingLoading}
                    >
                      Cancel Subscription
                    </Button>
                  </>
                )}
                <Link href="/pricing?source=account">
                  <Button variant="outline" size="sm">View Plan Details</Button>
                </Link>
              </div>

              <div className="rounded-xl border border-border bg-secondary-50/70 px-4 py-4">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      Mode
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {isSandboxBilling ? "Sandbox / Test" : "Live"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      Subscription Status
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {formatBillingStatus(
                        billingProfile?.stripeSubscriptionStatus ??
                          billingProfile?.billingStatus
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      Renews / Ends
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {getBillingCycleLabel(billingProfile, tier)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      Customer Record
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {billingProfile?.stripeCustomerId ? "Linked" : "Not linked"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      Customer ID
                    </dt>
                    <dd className="mt-1 font-mono text-foreground">
                      {maskStripeId(billingProfile?.stripeCustomerId)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      Subscription ID
                    </dt>
                    <dd className="mt-1 font-mono text-foreground">
                      {maskStripeId(billingProfile?.stripeSubscriptionId)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      Last Stripe Sync
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {formatDateTime(billingProfile?.stripeLastSyncedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                      Profile Updated
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {formatDateTime(billingProfile?.updatedAt)}
                    </dd>
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
            Permanently delete your account and all associated data. This
            action cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-error-500 bg-transparent px-4 py-2 text-sm font-medium text-error-700 transition-colors hover:bg-error-50 focus-ring cursor-pointer"
          >
            Delete account
          </button>
        </Card>
      </div>
    </>
  );
}
