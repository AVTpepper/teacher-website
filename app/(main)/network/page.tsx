"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import ConnectionCard from "@/components/network/ConnectionCard";
import ConnectionQuotaNotice from "@/components/network/ConnectionQuotaNotice";
import ConnectionRequestCard from "@/components/network/ConnectionRequestCard";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Tabs,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { getOrCreateConversation } from "@/lib/messages/client";
import {
  acceptConnectionRequest,
  cancelConnectionRequest,
  declineConnectionRequest,
  fetchAcceptedConnections,
  fetchIncomingRequests,
  fetchNetworkSummary,
  fetchSentRequests,
  removeConnection,
} from "@/lib/network/client";
import { NETWORK_TABS } from "@/lib/network/constants";
import type { ConnectionListItem } from "@/lib/network/types";
import { getFollowers, getFollowing } from "@/lib/firestore/follows";
import type { UserProfile } from "@/lib/firestore/users";

const TAB_LABELS: Record<(typeof NETWORK_TABS)[number], string> = {
  connections: "Connections",
  requests: "Requests",
  sent: "Sent",
  following: "Following",
  followers: "Followers",
};

export default function NetworkPage() {
  return (
    <Suspense>
      <NetworkPageInner />
    </Suspense>
  );
}

function NetworkPageInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") ?? "connections";
  const activeTab = (NETWORK_TABS as readonly string[]).includes(tabParam)
    ? (tabParam as (typeof NETWORK_TABS)[number])
    : "connections";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<{
    connections: number;
    incoming: number;
    sent: number;
    quota: {
      periodKey: string;
      isUnlimited: boolean;
      limit: number | null;
      used: number;
      remaining: number | null;
      canSend: boolean;
    };
  } | null>(null);

  const [connections, setConnections] = useState<ConnectionListItem[]>([]);
  const [incoming, setIncoming] = useState<ConnectionListItem[]>([]);
  const [sent, setSent] = useState<ConnectionListItem[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [followers, setFollowers] = useState<UserProfile[]>([]);

  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [removeTarget, setRemoveTarget] = useState<ConnectionListItem | null>(null);

  const tabs = useMemo(
    () => NETWORK_TABS.map((tab) => ({ value: tab, label: TAB_LABELS[tab] })),
    [],
  );

  const pushTab = useCallback(
    (tab: string) => {
      const next = (NETWORK_TABS as readonly string[]).includes(tab) ? tab : "connections";
      router.push(`/network?tab=${next}`);
    },
    [router],
  );

  const runWithLoadingKey = useCallback(async (key: string, fn: () => Promise<void>) => {
    setLoadingKeys((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });

    try {
      await fn();
    } finally {
      setLoadingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const [nextSummary, nextConnections, nextIncoming, nextSent, nextFollowing, nextFollowers] =
        await Promise.all([
          fetchNetworkSummary(() => Promise.resolve(token)),
          fetchAcceptedConnections(() => Promise.resolve(token)),
          fetchIncomingRequests(() => Promise.resolve(token)),
          fetchSentRequests(() => Promise.resolve(token)),
          getFollowing(user.uid),
          getFollowers(user.uid),
        ]);

      setSummary(nextSummary);
      setConnections(nextConnections);
      setIncoming(nextIncoming);
      setSent(nextSent);
      setFollowing(nextFollowing);
      setFollowers(nextFollowers);
    } catch {
      setError("We could not load your network right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth/login?redirect=${encodeURIComponent("/network")}`);
      return;
    }
    if (!authLoading && user) {
      void loadData();
    }
  }, [authLoading, loadData, router, user]);

  async function onAccept(item: ConnectionListItem) {
    if (!user) return;
    await runWithLoadingKey(item.participantKey, async () => {
      const token = await user.getIdToken();
      await acceptConnectionRequest(() => Promise.resolve(token), item.participantKey);
      await loadData();
    });
  }

  async function onDecline(item: ConnectionListItem) {
    if (!user) return;
    await runWithLoadingKey(item.participantKey, async () => {
      const token = await user.getIdToken();
      await declineConnectionRequest(() => Promise.resolve(token), item.participantKey);
      await loadData();
    });
  }

  async function onCancel(item: ConnectionListItem) {
    if (!user) return;
    await runWithLoadingKey(item.participantKey, async () => {
      const token = await user.getIdToken();
      await cancelConnectionRequest(() => Promise.resolve(token), item.participantKey);
      await loadData();
    });
  }

  async function onRemoveConnection(item: ConnectionListItem) {
    if (!user) return;
    await runWithLoadingKey(item.participantKey, async () => {
      const token = await user.getIdToken();
      await removeConnection(() => Promise.resolve(token), item.participantKey);
      await loadData();
    });
  }

  async function onMessageConnection(item: ConnectionListItem) {
    if (!user || !item.otherUser?.uid) return;
    try {
      await runWithLoadingKey(`message:${item.participantKey}`, async () => {
        const token = await user.getIdToken();
        const conversation = await getOrCreateConversation(() => Promise.resolve(token), item.otherUser!.uid);
        router.push(`/messages/${conversation.conversationId}`);
      });
    } catch {
      setError("We could not open that conversation right now. Please try again.");
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadData()} />;
  }

  return (
    <div className="space-y-6 pb-8">
      <ConfirmDialog
        isOpen={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          void onRemoveConnection(removeTarget);
          setRemoveTarget(null);
        }}
        title="Remove connection"
        description="This will remove your mutual connection. You can send a new request later."
        confirmLabel="Remove"
        isDestructive
      />

      <DiscoveryShell
        title="My Network"
        subtitle="Manage your professional connections, requests, followers, and educators you follow."
      />

      <ConnectionQuotaNotice quota={summary?.quota ?? null} />

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryStat label="Connections" value={summary?.connections ?? 0} />
        <SummaryStat label="Incoming Requests" value={summary?.incoming ?? 0} />
        <SummaryStat label="Sent Requests" value={summary?.sent ?? 0} />
      </section>

      <Tabs
        tabs={tabs}
        value={activeTab}
        defaultValue={activeTab}
        onChange={pushTab}
        variant="underline"
      />

      {activeTab === "connections" && (
        <section className="space-y-3">
          {connections.length === 0 ? (
            <EmptyState
              icon="🤝"
              title="Start building your professional network."
              description="Connect with educators to build trusted professional relationships."
              actionLabel="Discover Educators"
              onAction={() => router.push("/discover")}
            />
          ) : (
            connections.map((item) => (
              <ConnectionCard
                key={item.participantKey}
                item={item}
                removing={loadingKeys.has(item.participantKey)}
                messaging={loadingKeys.has(`message:${item.participantKey}`)}
                onMessage={() => void onMessageConnection(item)}
                onRemove={() => setRemoveTarget(item)}
              />
            ))
          )}
        </section>
      )}

      {activeTab === "requests" && (
        <section className="space-y-3">
          {incoming.length === 0 ? (
            <EmptyState
              icon="📭"
              title="You have no pending connection requests."
              description="When educators request to connect, they will appear here."
            />
          ) : (
            incoming.map((item) => (
              <ConnectionRequestCard
                key={item.participantKey}
                item={item}
                mode="incoming"
                loading={loadingKeys.has(item.participantKey)}
                onAccept={() => onAccept(item)}
                onDecline={() => onDecline(item)}
              />
            ))
          )}
        </section>
      )}

      {activeTab === "sent" && (
        <section className="space-y-3">
          {sent.length === 0 ? (
            <EmptyState
              icon="📨"
              title="You have no outgoing requests waiting for a response."
              description="Requests you send will appear here until accepted or declined."
            />
          ) : (
            sent.map((item) => (
              <ConnectionRequestCard
                key={item.participantKey}
                item={item}
                mode="sent"
                loading={loadingKeys.has(item.participantKey)}
                onCancel={() => onCancel(item)}
              />
            ))
          )}
        </section>
      )}

      {activeTab === "following" && (
        <section className="space-y-3">
          {following.length === 0 ? (
            <EmptyState
              icon="⭐"
              title="You are not following any educators yet."
              description="Follow educators to keep up with their public contributions."
              actionLabel="Discover Educators"
              onAction={() => router.push("/discover")}
            />
          ) : (
            following.map((profile) => (
              <SimpleFollowCard key={profile.uid} profile={profile} />
            ))
          )}
        </section>
      )}

      {activeTab === "followers" && (
        <section className="space-y-3">
          {followers.length === 0 ? (
            <EmptyState
              icon="🌱"
              title="No followers yet."
              description="Keep sharing your work and your professional network will grow."
            />
          ) : (
            followers.map((profile) => (
              <SimpleFollowCard key={profile.uid} profile={profile} />
            ))
          )}
        </section>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function SimpleFollowCard({ profile }: { profile: UserProfile }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{profile.displayName}</p>
        <p className="text-xs text-muted">
          {profile.professionalHeadline?.trim() || profile.professionalRole?.trim() || "Professional educator"}
        </p>
      </div>
      <Link href={`/educators/${profile.uid}`}>
        <Button variant="outline" size="sm">View Profile</Button>
      </Link>
    </div>
  );
}
