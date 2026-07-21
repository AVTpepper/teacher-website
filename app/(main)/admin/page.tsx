"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import { Button, Card, ConfirmDialog, Input, Select } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

type AdminUser = {
  uid: string;
  displayName: string;
  email: string;
  tier: "free" | "plus";
  role: "user" | "admin";
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  async function fetchUsers() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const resp = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.status === 403) {
        router.replace("/home");
        return;
      }

      const data = (await resp.json()) as { users?: AdminUser[]; error?: string };
      if (!resp.ok || !data.users) {
        throw new Error(data.error || "Failed to load users.");
      }

      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    );
  }, [users, query]);

  async function patchUser(uid: string, payload: Record<string, unknown>) {
    if (!user) return;
    setSavingUid(uid);
    setError("");
    try {
      const token = await user.getIdToken();
      const resp = await fetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        throw new Error(data.error || "Update failed.");
      }
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingUid(null);
    }
  }

  async function deleteUserAccount(uid: string) {
    if (!user) return;
    setSavingUid(uid);
    setError("");
    try {
      const token = await user.getIdToken();
      const resp = await fetch(`/api/admin/users/${uid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        throw new Error(data.error || "Delete failed.");
      }
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSavingUid(null);
    }
  }

  async function generateResetLink(uid: string) {
    if (!user) return;
    setSavingUid(uid);
    setError("");
    try {
      const token = await user.getIdToken();
      const resp = await fetch(`/api/admin/users/${uid}/password-reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await resp.json()) as { resetLink?: string; error?: string };
      if (!resp.ok || !data.resetLink) {
        throw new Error(data.error || "Failed to generate reset link.");
      }
      await navigator.clipboard.writeText(data.resetLink);
      alert("Password reset link copied to clipboard.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate reset link.");
    } finally {
      setSavingUid(null);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteUserAccount(deleteTarget.uid);
        }}
        title="Delete User Account"
        description="This will permanently delete the user from Firebase Auth and remove their profile document."
        confirmLabel="Delete account"
        isDestructive
        isLoading={savingUid === deleteTarget?.uid}
      />

      <DiscoveryShell
        title="Admin Console"
        subtitle="Manage users, roles, account state, and subscription tiers."
        eyebrow="Admin"
      />

      <Card className="space-y-4" padding="lg">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Input
            label="Search users"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, or UID"
          />
          <Button variant="outline" onClick={() => fetchUsers()} disabled={loading}>
            Refresh
          </Button>
        </div>
        {error && <p className="text-sm text-error-600">{error}</p>}
      </Card>

      {loading ? (
        <Card padding="lg">
          <p className="text-sm text-muted">Loading users…</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((account) => (
            <Card key={account.uid} padding="lg" className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {account.displayName || "(no display name)"}
                  </h2>
                  <p className="text-sm text-muted">{account.email || "(no email)"}</p>
                  <p className="mt-1 text-xs text-muted">UID: {account.uid}</p>
                </div>
                <div className="text-xs text-muted">
                  <p>Created: {formatDate(account.createdAt)}</p>
                  <p>Last sign-in: {formatDate(account.lastSignInAt)}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Select
                  label="Tier"
                  value={account.tier}
                  onChange={(e) => {
                    const nextTier = e.target.value as "free" | "plus";
                    void patchUser(account.uid, { tier: nextTier });
                  }}
                  options={[
                    { value: "free", label: "Free" },
                    { value: "plus", label: "Plus" },
                  ]}
                />
                <Select
                  label="Role"
                  value={account.role}
                  onChange={(e) => {
                    const nextRole = e.target.value as "user" | "admin";
                    void patchUser(account.uid, { role: nextRole });
                  }}
                  options={[
                    { value: "user", label: "User" },
                    { value: "admin", label: "Admin" },
                  ]}
                />
                <Select
                  label="Account State"
                  value={account.disabled ? "disabled" : "active"}
                  onChange={(e) => {
                    const disabled = e.target.value === "disabled";
                    void patchUser(account.uid, { disabled });
                  }}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "disabled", label: "Disabled" },
                  ]}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const nextName = window.prompt("Update display name", account.displayName || "");
                    if (nextName && nextName.trim()) {
                      void patchUser(account.uid, { displayName: nextName.trim() });
                    }
                  }}
                  disabled={savingUid === account.uid}
                >
                  Update Display Name
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateResetLink(account.uid)}
                  isLoading={savingUid === account.uid}
                >
                  Copy Password Reset Link
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteTarget(account)}
                >
                  Delete Account
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
