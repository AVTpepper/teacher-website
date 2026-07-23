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
import { getUser, updateUser } from "@/lib/firestore/users";
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

export default function AccountManagementPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  // Display name state
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Tier state
  const [tier, setTier] = useState<"free" | "plus" | null>(null);
  const [loadingTier, setLoadingTier] = useState(true);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [savingPassword, setSavingPassword] = useState(false);

  // Delete account state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

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
    setDisplayName(user.displayName || "");
    getUser(user.uid)
      .then((profile) => {
        if (profile) {
          setTier(profile.tier ?? "free");
        } else {
          setTier("free");
        }
      })
      .catch(() => setTier("free"))
      .finally(() => setLoadingTier(false));
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
            <Link href="/account/plans">
              <Button variant="outline" size="sm">Compare Free vs Plus</Button>
            </Link>
            {tier !== "plus" && (
              <Link href="/account/upgrade">
                <Button size="sm">Upgrade to Plus</Button>
              </Link>
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
                      href="/account/plans"
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
