"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import { Button, Card, ConfirmDialog, Input, Select } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { parseSlug } from "@/lib/utils";

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

type ShowcaseKey =
  | "educatorProfileIds"
  | "lessonPlanIds"
  | "resourceIds"
  | "discussionIds"
  | "inspirationIds"
  | "feedPostIds";

type ShowcaseConfig = Record<ShowcaseKey, string[]>;

type ShowcaseItem = {
  id: string;
  label: string;
  subtitle: string;
  href: string | null;
  status: "found" | "missing";
};

type ShowcaseResponse = {
  config: ShowcaseConfig;
  items: Record<ShowcaseKey, ShowcaseItem[]>;
};

type BackfillResponse = {
  scanned: number;
  created: number;
  updated: number;
  unchanged: number;
  error?: string;
};

const EMPTY_SHOWCASE_CONFIG: ShowcaseConfig = {
  educatorProfileIds: [],
  lessonPlanIds: [],
  resourceIds: [],
  discussionIds: [],
  inspirationIds: [],
  feedPostIds: [],
};

const EMPTY_SHOWCASE_ITEMS: Record<ShowcaseKey, ShowcaseItem[]> = {
  educatorProfileIds: [],
  lessonPlanIds: [],
  resourceIds: [],
  discussionIds: [],
  inspirationIds: [],
  feedPostIds: [],
};

const SHOWCASE_SECTIONS: Array<{ key: ShowcaseKey; title: string; description: string; placeholder: string; hint: string }> = [
  {
    key: "educatorProfileIds",
    title: "Featured educators",
    description: "Shown on the landing page and allowed as guest-visible educator profiles.",
    placeholder: "Paste profile URL or user UID",
    hint: "Example: /educators/Go6ALjLIjXXtoRxTE05PZADegUm1",
  },
  {
    key: "lessonPlanIds",
    title: "Featured lessons",
    description: "Guest-visible lesson plan detail pages that can also be reused in future landing modules.",
    placeholder: "Paste lesson URL or lesson ID",
    hint: "Example: /lesson-builder/eEj4CpRKcmVkeuIxBUYl",
  },
  {
    key: "resourceIds",
    title: "Featured resources",
    description: "Reserve resource IDs here for public showcases or future featured content rows.",
    placeholder: "Paste resource URL or resource ID",
    hint: "Example: /resources/my-resource-title--abc123",
  },
  {
    key: "discussionIds",
    title: "Featured discussions",
    description: "Guest-visible forum discussion detail pages.",
    placeholder: "Paste discussion URL or thread ID",
    hint: "Example: /forums/topic-title--ELVTFTxRhJ11pgEEWAoA",
  },
  {
    key: "inspirationIds",
    title: "Featured inspiration posts",
    description: "Guest-visible inspiration detail pages.",
    placeholder: "Paste inspiration URL or inspiration ID",
    hint: "Example: /inspiration/abc123",
  },
  {
    key: "feedPostIds",
    title: "Featured feed posts",
    description: "Reserve specific feed posts for curated surfaces or future landing modules.",
    placeholder: "Paste feed URL (?post=) or post ID",
    hint: "Example: /feed?post=post123 or /home?post=post123",
  },
];

function getShowcaseMissingSubtitle(key: ShowcaseKey): string {
  if (key === "educatorProfileIds") return "No matching user profile document.";
  if (key === "lessonPlanIds") return "No matching lesson document.";
  if (key === "resourceIds") return "No matching resource document.";
  if (key === "discussionIds") return "No matching forum thread document.";
  if (key === "inspirationIds") return "No matching inspiration document.";
  return "No matching post document.";
}

function normalizeIds(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value : ""))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeShowcaseConfig(config: ShowcaseConfig): ShowcaseConfig {
  return {
    educatorProfileIds: normalizeIds(config.educatorProfileIds),
    lessonPlanIds: normalizeIds(config.lessonPlanIds),
    resourceIds: normalizeIds(config.resourceIds),
    discussionIds: normalizeIds(config.discussionIds),
    inspirationIds: normalizeIds(config.inspirationIds),
    feedPostIds: normalizeIds(config.feedPostIds),
  };
}

function normalizeShowcaseItems(
  items: Partial<Record<ShowcaseKey, ShowcaseItem[]>> | undefined,
): Record<ShowcaseKey, ShowcaseItem[]> {
  return {
    educatorProfileIds: Array.isArray(items?.educatorProfileIds) ? items.educatorProfileIds : [],
    lessonPlanIds: Array.isArray(items?.lessonPlanIds) ? items.lessonPlanIds : [],
    resourceIds: Array.isArray(items?.resourceIds) ? items.resourceIds : [],
    discussionIds: Array.isArray(items?.discussionIds) ? items.discussionIds : [],
    inspirationIds: Array.isArray(items?.inspirationIds) ? items.inspirationIds : [],
    feedPostIds: Array.isArray(items?.feedPostIds) ? items.feedPostIds : [],
  };
}

function extractShowcaseId(rawInput: string, key: ShowcaseKey): string {
  const raw = rawInput.trim();
  if (!raw) return "";

  // Handle query-string style paste first (e.g. ?post=abc123 or /home?post=abc123)
  if (key === "feedPostIds") {
    const inlineQueryMatch = raw.match(/[?&]post=([^&#]+)/i);
    if (inlineQueryMatch?.[1]) {
      return decodeURIComponent(inlineQueryMatch[1]).trim();
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(raw, "http://localhost");
  } catch {
    if (key === "resourceIds" || key === "discussionIds") {
      return parseSlug(raw);
    }
    return raw;
  }

  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  if (key === "educatorProfileIds") {
    const match = pathname.match(/^\/educators\/([^/]+)$/i);
    return match?.[1] ? decodeURIComponent(match[1]).trim() : raw;
  }

  if (key === "lessonPlanIds") {
    const match = pathname.match(/^\/lesson-builder\/([^/]+)$/i);
    return match?.[1] ? decodeURIComponent(match[1]).trim() : raw;
  }

  if (key === "resourceIds") {
    const match = pathname.match(/^\/resources\/([^/]+)$/i);
    if (!match?.[1]) return parseSlug(raw);
    return parseSlug(decodeURIComponent(match[1]).trim());
  }

  if (key === "discussionIds") {
    const match = pathname.match(/^\/forums\/([^/]+)$/i);
    if (!match?.[1]) return parseSlug(raw);
    return parseSlug(decodeURIComponent(match[1]).trim());
  }

  if (key === "inspirationIds") {
    const match = pathname.match(/^\/inspiration\/([^/]+)$/i);
    return match?.[1] ? decodeURIComponent(match[1]).trim() : raw;
  }

  const postId = parsed.searchParams.get("post");
  return postId ? postId.trim() : raw;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [showcaseConfig, setShowcaseConfig] = useState<ShowcaseConfig>(EMPTY_SHOWCASE_CONFIG);
  const [showcaseItems, setShowcaseItems] = useState<Record<ShowcaseKey, ShowcaseItem[]>>(EMPTY_SHOWCASE_ITEMS);
  const [showcaseInputs, setShowcaseInputs] = useState<Record<ShowcaseKey, string>>({
    educatorProfileIds: "",
    lessonPlanIds: "",
    resourceIds: "",
    discussionIds: "",
    inspirationIds: "",
    feedPostIds: "",
  });
  const [showcaseLoading, setShowcaseLoading] = useState(true);
  const [showcaseSaving, setShowcaseSaving] = useState(false);
  const [showcaseError, setShowcaseError] = useState("");
  const [backfillUidInput, setBackfillUidInput] = useState("");
  const [backfillLimitInput, setBackfillLimitInput] = useState("200");
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState("");

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

  async function fetchShowcase() {
    if (!user) return;
    setShowcaseLoading(true);
    setShowcaseError("");
    try {
      const token = await user.getIdToken();
      const resp = await fetch("/api/admin/public-showcase", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.status === 403) {
        router.replace("/home");
        return;
      }

      const data = (await resp.json()) as ShowcaseResponse & { error?: string };
      if (!resp.ok || !data.config) {
        throw new Error(data.error || "Failed to load public showcase.");
      }

      setShowcaseConfig(normalizeShowcaseConfig(data.config));
      setShowcaseItems(normalizeShowcaseItems(data.items));
    } catch (err) {
      setShowcaseError(err instanceof Error ? err.message : "Failed to load public showcase.");
    } finally {
      setShowcaseLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/");
      return;
    }
    void fetchUsers();
    void fetchShowcase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

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

  function addShowcaseId(key: ShowcaseKey) {
    const nextId = extractShowcaseId(showcaseInputs[key], key);
    if (!nextId) return;
    if (showcaseConfig[key].includes(nextId)) return;

    const nextConfig = normalizeShowcaseConfig({
      ...showcaseConfig,
      [key]: [...showcaseConfig[key], nextId],
    });

    setShowcaseConfig(nextConfig);
    setShowcaseInputs((current) => ({ ...current, [key]: "" }));
    void saveShowcase(nextConfig);
  }

  function removeShowcaseId(key: ShowcaseKey, id: string) {
    const nextConfig = normalizeShowcaseConfig({
      ...showcaseConfig,
      [key]: showcaseConfig[key].filter((value) => value !== id),
    });
    setShowcaseConfig(nextConfig);
    void saveShowcase(nextConfig);
  }

  function moveShowcaseId(key: ShowcaseKey, index: number, direction: -1 | 1) {
    const values = [...showcaseConfig[key]];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= values.length) return;
    const [item] = values.splice(index, 1);
    values.splice(targetIndex, 0, item);

    const nextConfig = normalizeShowcaseConfig({
      ...showcaseConfig,
      [key]: values,
    });
    setShowcaseConfig(nextConfig);
    void saveShowcase(nextConfig);
  }

  async function saveShowcase(configToSave: ShowcaseConfig = showcaseConfig) {
    if (!user) return;
    const normalizedConfig = normalizeShowcaseConfig(configToSave);
    setShowcaseSaving(true);
    setShowcaseError("");
    try {
      const token = await user.getIdToken();
      const resp = await fetch("/api/admin/public-showcase", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(normalizedConfig),
      });

      const data = (await resp.json()) as ShowcaseResponse & { error?: string };
      if (!resp.ok || !data.config) {
        throw new Error(data.error || "Failed to save public showcase.");
      }

      setShowcaseConfig(normalizeShowcaseConfig(data.config));
      setShowcaseItems(normalizeShowcaseItems(data.items));
    } catch (err) {
      setShowcaseError(err instanceof Error ? err.message : "Failed to save public showcase.");
    } finally {
      setShowcaseSaving(false);
    }
  }

  async function runBackfill(options: { uid?: string; limit?: number }) {
    if (!user) return;
    setBackfillLoading(true);
    setError("");
    setBackfillMessage("");
    try {
      const token = await user.getIdToken();
      const resp = await fetch("/api/admin/users/backfill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(options),
      });

      const data = (await resp.json()) as BackfillResponse;
      if (!resp.ok) {
        throw new Error(data.error || "Backfill failed.");
      }

      setBackfillMessage(
        `Backfill complete: scanned ${data.scanned}, created ${data.created}, updated ${data.updated}, unchanged ${data.unchanged}.`
      );
      await Promise.all([fetchUsers(), fetchShowcase()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backfill failed.");
    } finally {
      setBackfillLoading(false);
    }
  }

  async function backfillSingleUid() {
    const uid = backfillUidInput.trim();
    if (!uid) return;
    await runBackfill({ uid });
  }

  async function backfillManyUsers() {
    const parsedLimit = Number.parseInt(backfillLimitInput, 10);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 200;
    await runBackfill({ limit });
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
          <div>
            <h2 className="text-base font-semibold text-foreground">Public Showcase</h2>
            <p className="mt-1 text-sm text-muted">
              Manage which real content items are featured publicly or permitted as guest-visible showcase pages.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fetchShowcase()} disabled={showcaseLoading || showcaseSaving}>
              Refresh showcase
            </Button>
            <Button onClick={() => saveShowcase()} isLoading={showcaseSaving}>
              Save showcase
            </Button>
          </div>
        </div>
        {showcaseError && <p className="text-sm text-error-600">{showcaseError}</p>}
        {showcaseLoading ? (
          <p className="text-sm text-muted">Loading public showcase…</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {SHOWCASE_SECTIONS.map((section) => {
              const items = showcaseConfig[section.key].map((id) => {
                const resolved = showcaseItems[section.key].find((item) => item.id === id);
                if (resolved) return resolved;
                return {
                  id,
                  label: section.key === "educatorProfileIds" ? "Missing educator" : "Unresolved item",
                  subtitle: getShowcaseMissingSubtitle(section.key),
                  href: null,
                  status: "missing" as const,
                };
              });
              return (
                <Card key={section.key} padding="lg" className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                    <p className="mt-1 text-sm text-muted">{section.description}</p>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      label={`Add ${section.title.toLowerCase()}`}
                      value={showcaseInputs[section.key]}
                      onChange={(e) =>
                        setShowcaseInputs((current) => ({
                          ...current,
                          [section.key]: e.target.value,
                        }))
                      }
                      placeholder={section.placeholder}
                    />
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => addShowcaseId(section.key)}
                        disabled={!showcaseInputs[section.key].trim() || showcaseSaving}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted">{section.hint}</p>

                  {items.length === 0 ? (
                    <p className="text-sm text-muted">No items added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div key={`${section.key}-${item.id}`} className="rounded-xl border border-border bg-surface-subtle p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                              <p className="mt-1 break-all text-xs text-muted">ID: {item.id}</p>
                              <p className={`mt-1 text-xs ${item.status === "missing" ? "text-error-600" : "text-muted"}`}>
                                {item.status === "missing" ? item.subtitle : item.subtitle}
                              </p>
                              {item.href && item.status === "found" && (
                                <a href={item.href} className="mt-2 inline-block text-xs font-semibold text-primary-900 hover:underline">
                                  Open item
                                </a>
                              )}
                              {section.key === "educatorProfileIds" && item.status === "missing" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2"
                                  onClick={() => runBackfill({ uid: item.id })}
                                  disabled={backfillLoading}
                                  isLoading={backfillLoading}
                                >
                                  Initialize profile from UID
                                </Button>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveShowcaseId(section.key, index, -1)}
                                disabled={index === 0}
                              >
                                Up
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveShowcaseId(section.key, index, 1)}
                                disabled={index === items.length - 1}
                              >
                                Down
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeShowcaseId(section.key, item.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Card>

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

      <Card className="space-y-4" padding="lg">
        <div>
          <h2 className="text-base font-semibold text-foreground">Profile Backfill Tools</h2>
          <p className="mt-1 text-sm text-muted">
            Initialize missing profile documents from Firebase Auth and fill required default fields.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Input
              label="Backfill one UID"
              placeholder="Paste a Firebase Auth UID"
              value={backfillUidInput}
              onChange={(e) => setBackfillUidInput(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => backfillSingleUid()}
              disabled={backfillLoading || !backfillUidInput.trim()}
              isLoading={backfillLoading}
            >
              Initialize UID Profile
            </Button>
          </div>

          <div className="space-y-2">
            <Input
              label="Bulk backfill limit"
              placeholder="200"
              value={backfillLimitInput}
              onChange={(e) => setBackfillLimitInput(e.target.value)}
            />
            <Button
              variant="secondary"
              onClick={() => backfillManyUsers()}
              disabled={backfillLoading}
              isLoading={backfillLoading}
            >
              Backfill Missing Fields (Batch)
            </Button>
          </div>
        </div>
        {backfillMessage && <p className="text-sm text-success-700">{backfillMessage}</p>}
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
